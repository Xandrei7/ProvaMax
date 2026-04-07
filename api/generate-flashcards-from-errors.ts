import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { generateFlashcardWithAi } from './_lib/flashcardAi.js'

interface RequestBody {
  limit?: number
}

interface WrongAnswerRow {
  question_id: string
  selected_answer: string
}

interface QuestionRow {
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

function buildFallbackFlashcard(correctAnswer: string) {
  return {
    front_text: 'Em prova FCC, qual regra central resolve essa questao?',
    back_answer: `Resposta correta: ${correctAnswer || 'ver comentario da questao.'}`,
    back_trap: 'A pegadinha costuma trocar excecao por regra geral ou inverter termos absolutos.',
    back_antidote: 'SE houver duvida, ENTAO confirme criterio, excecoes e sujeito competente antes de marcar.',
  }
}

function normalizeLimit(raw: unknown) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 5
  const rounded = Math.floor(parsed)
  if (rounded < 1) return 1
  if (rounded > 20) return 20
  return rounded
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
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

    const body = (req.body ?? {}) as RequestBody
    const limit = normalizeLimit(body.limit)
    const lookupLimit = Math.max(limit * 4, 12)

    const { data: wrongRows, error: wrongRowsError } = await userScopedSupabase
      .from('user_answers')
      .select('question_id, selected_answer')
      .eq('user_id', user.id)
      .eq('is_correct', false)
      .order('answered_at', { ascending: false })
      .limit(lookupLimit)

    if (wrongRowsError) {
      return res.status(500).json({ error: 'Failed to fetch wrong answers', details: wrongRowsError.message })
    }

    const wrongAnswers = (wrongRows ?? []) as WrongAnswerRow[]
    if (wrongAnswers.length === 0) {
      return res.status(200).json({ generated: 0, skipped: 0, failed: 0, total_candidates: 0 })
    }

    const uniqueQuestionIds = [...new Set(wrongAnswers.map(row => row.question_id))]

    const { data: existingFlashcards, error: existingError } = await userScopedSupabase
      .from('flashcards')
      .select('question_id')
      .eq('user_id', user.id)
      .in('question_id', uniqueQuestionIds)

    if (existingError) {
      return res.status(500).json({ error: 'Failed to fetch existing flashcards', details: existingError.message })
    }

    const existingSet = new Set((existingFlashcards ?? []).map(row => row.question_id as string))
    const missingQuestionIds = uniqueQuestionIds.filter(id => !existingSet.has(id)).slice(0, limit)

    if (missingQuestionIds.length === 0) {
      return res.status(200).json({ generated: 0, skipped: uniqueQuestionIds.length, failed: 0, total_candidates: uniqueQuestionIds.length })
    }

    const { data: questionRows, error: questionRowsError } = await userScopedSupabase
      .from('questions')
      .select('id, statement, type, options, correct_answer, comment, legal_basis, discipline_id, subject_id')
      .in('id', missingQuestionIds)

    if (questionRowsError) {
      return res.status(500).json({ error: 'Failed to fetch question details', details: questionRowsError.message })
    }

    const questionMap = new Map<string, QuestionRow>()
    for (const question of (questionRows ?? []) as QuestionRow[]) {
      questionMap.set(question.id, question)
    }

    const wrongAnswerMap = new Map<string, string>()
    for (const row of wrongAnswers) {
      if (!wrongAnswerMap.has(row.question_id)) {
        wrongAnswerMap.set(row.question_id, row.selected_answer)
      }
    }

    const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null

    let generated = 0
    let skipped = 0
    let failed = 0

    for (const questionId of missingQuestionIds) {
      const question = questionMap.get(questionId)
      if (!question) {
        failed += 1
        continue
      }

      const userWrongAnswer = wrongAnswerMap.get(questionId) ?? ''
      const flashcardData = openai
        ? await generateFlashcardWithAi(openai, {
            bank: 'FCC',
            discipline: question.discipline_id,
            subject: question.subject_id,
            questionType: question.type,
            statement: question.statement,
            alternatives: question.options,
            correctAnswer: question.correct_answer,
            userWrongAnswer,
            explanation: question.comment,
            legalBasis: question.legal_basis,
          })
        : buildFallbackFlashcard(question.correct_answer)

      const { error: insertError } = await userScopedSupabase
        .from('flashcards')
        .insert({
          user_id: user.id,
          question_id: questionId,
          source_type: 'review',
          simulado_id: null,
          discipline_id: question.discipline_id,
          subject_id: question.subject_id,
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

      if (insertError) {
        if (insertError.code === '23505') {
          skipped += 1
        } else {
          failed += 1
        }
        continue
      }

      generated += 1
    }

    return res.status(200).json({
      generated,
      skipped,
      failed,
      total_candidates: uniqueQuestionIds.length,
    })
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : 'Unknown error'
    console.error('API Error:', error)
    return res.status(500).json({ error: 'Internal server error', details })
  }
}
