import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { generateFlashcardWithAi } from './_lib/flashcardAi.js'

type SourceType = 'study' | 'simulado' | 'review' | 'import'

interface GenerateFlashcardBody {
  user_id?: string
  question_id?: string
  bank?: string
  discipline?: string
  subject?: string
  question_type?: string
  statement?: string
  alternatives?: unknown
  options?: unknown
  correct_answer?: string
  user_wrong_answer?: string
  explanation?: string
  comment?: string
  legal_basis?: string | null
  source_type?: SourceType
  simulado_id?: string
  discipline_id?: string
  subject_id?: string
}

interface QuestionInput {
  id: string
  statement: string
  type: string
  options: unknown
  correct_answer: string
  comment: string | null
  legal_basis: string | null
  discipline_id: string
  subject_id: string
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const FLASHCARD_AI_DAILY_LIMIT = Number(process.env.FLASHCARD_AI_DAILY_LIMIT || '0')

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function fallbackFlashcard(params: {
  discipline: string
  subject: string
  correctAnswer: string
  userWrongAnswer: string
  explanation: string
  legalBasis: string
}) {
  const focus = params.subject || params.discipline || 'regra central'
  const explanation = params.explanation.slice(0, 220)
  const legal = params.legalBasis.slice(0, 160)

  return {
    front_text: `Em prova FCC, qual e a regra principal sobre ${focus}?`,
    back_answer: explanation || `Resposta correta: ${params.correctAnswer}. Aplique o criterio objetivo da regra.`,
    back_trap: params.userWrongAnswer
      ? `A pegadinha e marcar ${params.userWrongAnswer} por parecer plausivel sem conferir o criterio tecnico.`
      : 'A pegadinha e confundir regra geral com excecao, prazo ou sujeito competente.',
    back_antidote: legal
      ? `SE aparecer questao sobre ${focus}, ENTAO valide primeiro: ${legal}.`
      : `SE aparecer questao sobre ${focus}, ENTAO confirme criterio, excecoes e termos absolutos antes de marcar.`,
  }
}

async function reachedDailyAiLimit(userScopedSupabase: unknown, userId: string) {
  const sb = userScopedSupabase as any

  if (!FLASHCARD_AI_DAILY_LIMIT || Number.isNaN(FLASHCARD_AI_DAILY_LIMIT) || FLASHCARD_AI_DAILY_LIMIT <= 0) {
    return false
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const { count, error } = await sb
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', today.toISOString())

  if (error) {
    console.warn('[generate-flashcard] daily limit check failed:', error.message)
    return false
  }

  return (count || 0) >= FLASHCARD_AI_DAILY_LIMIT
}

async function resolveNameById(userScopedSupabase: unknown, table: 'disciplines' | 'subjects', id?: string) {
  const sb = userScopedSupabase as any

  if (!id || !isUuid(id)) return ''
  const { data } = await sb.from(table).select('name').eq('id', id).maybeSingle()
  return safeString((data as { name?: unknown } | null)?.name)
}

// Busca chunks do material didático relevantes para enriquecer o contexto da IA
// Prioridade: busca por texto completo na disciplina → fallback por assunto
async function findChunkContext(supabase: unknown, disciplineName: string, subjectName: string, statement: string): Promise<string> {
  const sb = supabase as any
  let chunks: string[] = []

  // Palavras-chave extraídas do enunciado (exclui termos genéricos de prova)
  const stopwords = new Set(['sobre', 'qual', 'como', 'para', 'segundo', 'conforme', 'acordo', 'questao', 'alternativa', 'correta', 'assinale'])
  const keywords = statement
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopwords.has(w))
    .slice(0, 6)

  if (keywords.length > 0) {
    const tsQuery = keywords.join(' | ')
    const discNorm = disciplineName.toUpperCase().replace(/\s+/g, ' ').trim().slice(0, 50)
    const { data } = await sb
      .from('document_chunks')
      .select('content')
      .or(`discipline.eq.${discNorm},discipline.ilike.%${discNorm}%`)
      .textSearch('content', tsQuery)
      .limit(4)
    if (data?.length) chunks = (data as { content: string }[]).map(d => d.content)
  }

  // Fallback: busca apenas pelo assunto
  if (chunks.length === 0 && subjectName) {
    const { data } = await sb
      .from('document_chunks')
      .select('content')
      .ilike('subject', `%${subjectName.slice(0, 40)}%`)
      .limit(3)
    if (data?.length) chunks = (data as { content: string }[]).map(d => d.content)
  }

  if (chunks.length === 0) return ''
  return chunks.slice(0, 3).map(c => c.slice(0, 400)).join('\n\n')
}

async function resolveQuestionPayload(userScopedSupabase: unknown, body: GenerateFlashcardBody, questionId: string) {
  const sb = userScopedSupabase as any

  const hasBodyQuestionData =
    !!safeString(body.statement) &&
    !!safeString(body.correct_answer) &&
    !!safeString(body.discipline_id) &&
    !!safeString(body.subject_id)

  let dbQuestion: QuestionInput | null = null

  if (!hasBodyQuestionData) {
    const { data, error } = await sb
      .from('questions')
      .select('id, statement, type, options, correct_answer, comment, legal_basis, discipline_id, subject_id')
      .eq('id', questionId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to load question: ${error.message}`)
    }

    if (!data) {
      throw new Error('Question not found')
    }

    dbQuestion = data as QuestionInput
  }

  const disciplineId = safeString(body.discipline_id) || dbQuestion?.discipline_id || ''
  const subjectId = safeString(body.subject_id) || dbQuestion?.subject_id || ''

  return {
    statement: safeString(body.statement) || dbQuestion?.statement || '',
    questionType: safeString(body.question_type) || dbQuestion?.type || 'multiple_choice',
    alternatives: body.alternatives ?? body.options ?? dbQuestion?.options ?? [],
    correctAnswer: safeString(body.correct_answer) || dbQuestion?.correct_answer || '',
    explanation: safeString(body.explanation || body.comment) || dbQuestion?.comment || '',
    legalBasis: safeString(body.legal_basis) || dbQuestion?.legal_basis || '',
    disciplineId,
    subjectId,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return res.status(401).json({ error: 'Invalid authorization header' })
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const userScopedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized', details: authError?.message })
    }

    const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
    const body = parsedBody as GenerateFlashcardBody

    const userId = safeString(body.user_id)
    const questionId = safeString(body.question_id)
    const simuladoId = safeString(body.simulado_id)
    const userWrongAnswer = safeString(body.user_wrong_answer)

    const sourceType: SourceType = ['study', 'simulado', 'review', 'import'].includes(String(body.source_type))
      ? (body.source_type as SourceType)
      : 'study'

    if (!isUuid(questionId)) {
      return res.status(400).json({ error: 'question_id is required and must be UUID' })
    }

    if (!isUuid(userId) || userId !== user.id) {
      return res.status(403).json({ error: 'user_id must match authenticated user' })
    }

    if (!userWrongAnswer) {
      return res.status(400).json({ error: 'user_wrong_answer is required' })
    }

    if (sourceType === 'simulado' && !isUuid(simuladoId)) {
      return res.status(400).json({ error: 'simulado_id is required and must be UUID for simulado source' })
    }

    if (sourceType === 'simulado' && simuladoId) {
      const { data: ownSimulado, error: simuladoError } = await userScopedSupabase
        .from('simulados')
        .select('id')
        .eq('id', simuladoId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (simuladoError) {
        return res.status(500).json({ error: 'Failed to validate simulado ownership', details: simuladoError.message })
      }

      if (!ownSimulado) {
        return res.status(403).json({ error: 'Simulado does not belong to current user' })
      }
    }

    const question = await resolveQuestionPayload(userScopedSupabase, body, questionId)

    if (!question.statement || !question.correctAnswer || !question.disciplineId || !question.subjectId) {
      return res.status(400).json({
        error: 'Missing required question data',
        required: ['statement', 'correct_answer', 'discipline_id', 'subject_id'],
      })
    }

    const { data: existingFlashcard, error: existingError } = await userScopedSupabase
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .maybeSingle()

    if (existingError && existingError.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Failed to fetch existing flashcard', details: existingError.message })
    }

    if (existingFlashcard) {
      const { data: updated, error: updateError } = await userScopedSupabase
        .from('flashcards')
        .update({
          priority: (existingFlashcard.priority ?? 0) + 1,
          times_wrong: (existingFlashcard.times_wrong ?? 0) + 1,
          status: 'reviewing',
          source_type: sourceType,
          simulado_id: sourceType === 'simulado' ? simuladoId : existingFlashcard.simulado_id,
          next_review_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingFlashcard.id)
        .eq('user_id', user.id)
        .select('*')
        .single()

      if (updateError) {
        return res.status(500).json({ error: 'Failed to update flashcard', details: updateError.message })
      }

      return res.status(200).json({ flashcard: updated, isNew: false, usedAI: false, reusedExisting: true })
    }

    const disciplineName = safeString(body.discipline) || await resolveNameById(userScopedSupabase, 'disciplines', question.disciplineId)
    const subjectName = safeString(body.subject) || await resolveNameById(userScopedSupabase, 'subjects', question.subjectId)

    let flashcardData = fallbackFlashcard({
      discipline: disciplineName,
      subject: subjectName,
      correctAnswer: question.correctAnswer,
      userWrongAnswer,
      explanation: question.explanation,
      legalBasis: question.legalBasis,
    })
    let usedAI = false

    const limitReached = await reachedDailyAiLimit(userScopedSupabase, user.id)

    if (OPENAI_API_KEY && !limitReached) {
      // Busca contexto dos chunks do PDF para enriquecer a qualidade do flashcard
      const chunkContext = await findChunkContext(userScopedSupabase, disciplineName, subjectName, question.statement)
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
      flashcardData = await generateFlashcardWithAi(openai, {
        bank: safeString(body.bank) || 'FCC',
        discipline: disciplineName,
        subject: subjectName,
        questionType: question.questionType,
        statement: question.statement,
        alternatives: question.alternatives,
        correctAnswer: question.correctAnswer,
        userWrongAnswer,
        explanation: question.explanation,
        legalBasis: question.legalBasis,
        chunkContext: chunkContext || undefined,
      })
      usedAI = true
    }

    const { data: created, error: insertError } = await userScopedSupabase
      .from('flashcards')
      .insert({
        user_id: user.id,
        question_id: questionId,
        source_type: sourceType,
        simulado_id: sourceType === 'simulado' ? simuladoId : null,
        discipline_id: question.disciplineId,
        subject_id: question.subjectId,
        front_text: flashcardData.front_text,
        back_answer: flashcardData.back_answer,
        back_trap: flashcardData.back_trap,
        back_antidote: flashcardData.back_antidote,
        status: 'new',
        priority: 1,
        times_seen: 0,
        times_correct: 0,
        times_wrong: 1,
        last_reviewed_at: null,
        next_review_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: racedCard, error: raceFetchError } = await userScopedSupabase
          .from('flashcards')
          .select('*')
          .eq('user_id', user.id)
          .eq('question_id', questionId)
          .maybeSingle()

        if (raceFetchError || !racedCard) {
          return res.status(409).json({ error: 'Flashcard already exists and could not be loaded' })
        }

        const { data: raceUpdated, error: raceUpdateError } = await userScopedSupabase
          .from('flashcards')
          .update({
            priority: (racedCard.priority ?? 0) + 1,
            times_wrong: (racedCard.times_wrong ?? 0) + 1,
            status: 'reviewing',
            source_type: sourceType,
            simulado_id: sourceType === 'simulado' ? simuladoId : racedCard.simulado_id,
            next_review_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', racedCard.id)
          .eq('user_id', user.id)
          .select('*')
          .single()

        if (raceUpdateError) {
          return res.status(500).json({ error: 'Failed to update raced flashcard', details: raceUpdateError.message })
        }

        return res.status(200).json({ flashcard: raceUpdated, isNew: false, usedAI: false, reusedExisting: true })
      }

      return res.status(500).json({ error: 'Failed to create flashcard', details: insertError.message })
    }

    return res.status(200).json({ flashcard: created, isNew: true, usedAI, reusedExisting: false })
  } catch (error: unknown) {
    console.error('API Error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
