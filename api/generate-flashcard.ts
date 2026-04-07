import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Constants
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration')
    }

    // Initialize Supabase admin client to bypass RLS or insert securely
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized', details: authError?.message })
    }

    const { question_id, source_type, simulado_id, discipline_id, subject_id, statement, options, correct_answer, user_wrong_answer, comment, legal_basis } = req.body

    if (!question_id) {
      return res.status(400).json({ error: 'question_id is required' })
    }

    // 1. Verify if flashcard already exists
    const { data: existingFlashcard, error: fetchError } = await supabaseAdmin
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .eq('question_id', question_id)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing flashcard:', fetchError)
      return res.status(500).json({ error: 'Database error' })
    }

    if (existingFlashcard) {
      // 2. If it exists, update priority/status/times_wrong rather than duplicate (per requirements)
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('flashcards')
        .update({
          priority: existingFlashcard.priority + 1,
          times_wrong: existingFlashcard.times_wrong + 1,
          status: 'reviewing',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingFlashcard.id)
        .select('*')
        .single()

      if (updateError) {
        return res.status(500).json({ error: 'Failed to update existing flashcard', details: updateError.message })
      }

      return res.status(200).json({ flashcard: updated, isNew: false })
    }

    // 3. Prepare AI Prompt
    if (!OPENAI_API_KEY) {
      throw new Error('Missing OpenAI configuration')
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

    const prompt = `Você é um gerador de flashcards de recuperação ativa para concurso, com foco total em padrão de banca e memorização útil.
Sua tarefa é transformar UMA questão errada do usuário em UM flashcard altamente eficiente.

OBJETIVO:
Gerar 1 flashcard por questão errada, com foco em recuperação ativa, regra cobrada, pegadinha da banca e antídoto mental prático.

ENTRADA:
- Banca/Padrão: FCC
- Enunciado: ${statement}
- Alternativas: ${JSON.stringify(options ?? [])}
- Gabarito (Resposta Correta): ${correct_answer}
- Marcada pelo Usuário: ${user_wrong_answer}
- Comentário/Explicação: ${comment}
- Fundamento Legal: ${legal_basis || 'Nenhum'}

REGRAS OBRIGATÓRIAS:
1. Gere exatamente 1 flashcard.
2. Frente (front_text) = pergunta sobre a regra cobrada. NÃO copie o enunciado original.
3. Verso = resposta curta (back_answer) + pegadinha abordada (back_trap) + antídoto SE->ENTÃO (back_antidote).
4. Linguagem objetiva, direta e curta.
5. Foco 100% no padrão da questão.

Responda APENAS em JSON válido conforme o formato abaixo:
{
  "front_text": "...",
  "back_answer": "...",
  "back_trap": "...",
  "back_antidote": "..."
}`

    let flashcardData

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Empty AI response')

      flashcardData = JSON.parse(content)

      // Validate required fields
      if (!flashcardData.front_text || !flashcardData.back_answer || !flashcardData.back_trap || !flashcardData.back_antidote) {
         throw new Error('Invalid JSON structure from AI')
      }
    } catch (aiError) {
      console.error('AI Error:', aiError)
      
      // Fallback
      flashcardData = {
        front_text: `Revisar Lei/Regra sobre o tema desta questão.`,
        back_answer: `Gabarito da banca: ${correct_answer}. Consulte o comentário da questão.`,
        back_trap: `Atenção à forma como a banca abordou as alternativas erradas.`,
        back_antidote: `SE a banca cobrar este assunto, ENTÃO lembre das exceções ou prazos e não confunda com conceitos similares.`
      }
    }

    // 4. Save to Database
    const { data: newFlashcard, error: insertError } = await supabaseAdmin
      .from('flashcards')
      .insert({
        user_id: user.id,
        question_id,
        source_type: source_type || 'study',
        simulado_id: simulado_id || null,
        discipline_id: discipline_id || 'unknown',
        subject_id: subject_id || 'unknown',
        front_text: flashcardData.front_text,
        back_answer: flashcardData.back_answer,
        back_trap: flashcardData.back_trap,
        back_antidote: flashcardData.back_antidote,
        status: 'new',
        priority: 1,
        times_seen: 0,
        times_correct: 0,
        times_wrong: 1, // User just got it wrong
        last_reviewed_at: null,
        next_review_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (insertError) {
      return res.status(500).json({ error: 'Failed to save flashcard', details: insertError.message })
    }

    return res.status(200).json({ flashcard: newFlashcard, isNew: true })

  } catch (error: any) {
    console.error('API Error:', error)
    return res.status(500).json({ error: 'Internal server error', details: error?.message })
  }
}
