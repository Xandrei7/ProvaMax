import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Stopwords jurídicas + genéricas — não entram como keyword de busca
const STOPWORDS = new Set([
  'sobre', 'qual', 'como', 'quem', 'para', 'onde', 'porque', 'quando',
  'assinale', 'alternativa', 'correta', 'incorreta', 'seguintes', 'abaixo',
  'conforme', 'segundo', 'acordo', 'teste', 'explicacao', 'texto', 'questao',
  'afirmativa', 'opcao', 'todas', 'nenhuma', 'pode', 'deve', 'sera', 'sao',
  'estao', 'esse', 'essa', 'este', 'esta', 'pelo', 'pela', 'pelas', 'pelos',
  'caso', 'forma', 'sendo', 'ainda', 'assim', 'mais', 'apenas', 'tambem',
])

/**
 * Extrai keywords com peso maior para termos jurídicos relevantes.
 * Usa o `subject` para forçar termos do tema como prioritários.
 */
function extractKeywords(questionText: string, userMessage: string, subject: string): string[] {
  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  // Extrai termos do subject como âncoras prioritárias (ex: "organizacao administrativa" → ["organizacao", "administrativa"])
  const subjectTerms = normalize(subject)
    .split(/\W+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))

  // Extrai termos do enunciado + dúvida
  const bodyTerms = normalize(questionText + ' ' + userMessage)
    .split(/\W+/)
    .filter(w => w.length > 4 && !STOPWORDS.has(w))

  // Mescla: subject primeiro (mais relevante), depois body
  const all = [...subjectTerms, ...bodyTerms]
  const unique = Array.from(new Set(all))

  // Limita a 7 termos para não pulverizar a busca
  return unique.slice(0, 7)
}

/**
 * Pontua um chunk conforme quantos dos termos-chave ele contém.
 * Chunks sem nenhum termo relevante são eliminados.
 */
function rankChunks(chunks: string[], keywords: string[]): string[] {
  if (keywords.length === 0) return chunks

  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const scored = chunks.map(chunk => {
    const norm = normalize(chunk)
    const hits = keywords.filter(kw => norm.includes(kw)).length
    return { chunk, hits }
  })

  // Ordena por relevância e remove chunks com 0 correspondências
  const relevant = scored
    .filter(s => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map(s => s.chunk)

  // Se filtrar demais, devolve pelo menos o mais relevante bruto
  return relevant.length > 0 ? relevant.slice(0, 3) : chunks.slice(0, 2)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  )

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' })
    }
    const token = authHeader.replace('Bearer ', '').trim()

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Missing Supabase configuration')

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

    // Client com token do usuário para respeitar RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
    const { messages, questionData, discipline, subject } = body

    const lastUserMessage = messages?.length > 0 ? messages[messages.length - 1].content : ''
    const questionText = questionData?.statement || ''

    console.log('[chat-questao] subject:', subject, '| discipline:', discipline)

    // --- Extração de keywords aprimorada ---
    const keywords = extractKeywords(questionText, lastUserMessage, subject || '')
    const tsQuery = keywords.join(' | ')
    
    // Detect mentioned letter in user message (A, B, C, D, E)
    const mentionedLetterMatch = lastUserMessage.match(/\b([A-Ea-e])\b/)
    const mentionedLetter = mentionedLetterMatch ? mentionedLetterMatch[1].toUpperCase() : null

    // Detect request for simplified explanation
    const simplifiedKeywords = [/simpl/i, /resum/i, /nao entendi/i, /exemplo/i, /analogia/i, /faci[l|s]/i, /iniciante/i, /destrincha/i, /melhor/i]
    const isSimplified = simplifiedKeywords.some(regex => regex.test(lastUserMessage))
    
    console.log('[chat-questao] keywords:', keywords, '| tsQuery:', tsQuery, '| mentioned:', mentionedLetter, '| simplified:', isSimplified)

    let rawChunks: string[] = []

    // Busca textual com filtro de subject/discipline
    if (tsQuery) {
      let query = supabase.from('document_chunks').select('content')

      // Prioridade: filtrar por subject se disponível
      if (subject) {
        query = query.ilike('subject', `%${subject}%`)
      } else if (discipline) {
        query = query.ilike('discipline', `%${discipline}%`)
      }

      const { data: searchData, error: searchError } = await query
        .textSearch('content', tsQuery)
        .limit(10) // busca mais para depois rankear

      if (!searchError && searchData) {
        rawChunks = searchData.map(d => d.content)
      }
    }

    // Fallback: pega chunks do subject sem textSearch
    if (rawChunks.length === 0 && subject) {
      const { data: fallbackData } = await supabase
        .from('document_chunks')
        .select('content')
        .ilike('subject', `%${subject}%`)
        .limit(5)
      if (fallbackData) rawChunks = fallbackData.map(d => d.content)
    }

    // --- Ranking + filtro de relevância ---
    const chunks = rankChunks(rawChunks, keywords)
    console.log('[chat-questao] rawChunks:', rawChunks.length, '| chunks após ranking:', chunks.length)

    const contextText = chunks.length > 0
      ? 'TRECHOS DO MATERIAL DIDÁTICO RELEVANTES:\n\n' + chunks.join('\n\n---\n\n')
      : 'Nenhum trecho específico encontrado no material didático para este tema.'

    // --- Prompt estruturado com formato de saída fixo ---
    let systemPrompt = ''
    
    if (isSimplified) {
      systemPrompt = `Você é um professor de concursos públicos especializado em transformar temas complexos em explicações simples.
Dê sua resposta em TEXTO SIMPLES. PROIBIDO usar markdown, asteriscos (**), negrito ou bullets estilizados.

QUESTÃO DO ALUNO:
Disciplina: ${discipline || 'Não informada'}
Assunto: ${subject || 'Não informado'}
Enunciado: ${questionText || 'Não informado'}
Gabarito Correto: ${questionData?.correctAnswer || 'Não informado'}
Alternativas:
${(questionData?.options || []).map((o: any) => `${o.letter}: ${o.text}`).join('\n')}

${mentionedLetter ? `FOCO NA ALTERNATIVA: ${mentionedLetter}` : ''}

${contextText}

INSTRUÇÕES PARA O MODO SIMPLIFICADO:
Use linguagem clara, evite termos técnicos complicados. Use analogias simples e exemplos cotidianos.
Responda SEMPRE neste formato exato em TEXTO SIMPLES, sem asteriscos:

${mentionedLetter 
  ? `A alternativa ${mentionedLetter} esta errada porque: [erro em linguagem simples]
Porem, a questao pede: [o que a banca realmente quer]
O correto seria entender que: [conceito certo em linguagem simples]`
  : `Em resumo: [explicacao curta e simples do tema]`}

Na pratica: [exemplo cotidiano ou juridico muito curto que ilustre o ponto]

Pense assim: [analogia curta para facilitar a memorizacao, se ajudar. Se nao ajudar, pule esta seção]

Base legal: [se houver artigo especifico]

Pegadinha: [o detalhe bobo que faz o aluno errar]`
    } else {
      systemPrompt = `Você é um professor de concursos públicos especializado em Direito Constitucional.
Dê sua resposta em TEXTO SIMPLES. PROIBIDO usar markdown, asteriscos (**), negrito ou bullets estilizados.

QUESTÃO DO ALUNO:
Disciplina: ${discipline || 'Não informada'}
Assunto: ${subject || 'Não informado'}
Enunciado: ${questionText || 'Não informado'}
Gabarito Correto: ${questionData?.correctAnswer || 'Não informado'}
Comentário Oficial: ${questionData?.explanation || 'Não informado'}
Alternativas:
${(questionData?.options || []).map((o: any) => `${o.letter}: ${o.text}`).join('\n')}

${mentionedLetter ? `O ALUNO PERGUNTOU ESPECIFICAMENTE DA ALTERNATIVA: ${mentionedLetter}` : ''}

${contextText}

INSTRUÇÕES PARA SUA RESPOSTA:
Responda SEMPRE neste formato exato em TEXTO SIMPLES, sem introdução, sem texto antes e sem asteriscos:

Correta: [explique por que a alternativa correta está certa, citando a norma ou artigo se souber]

${mentionedLetter ? `Por que a ${mentionedLetter} esta errada:` : 'Por que as outras estao erradas:'} [analise a alternativa ${mentionedLetter || 'incorreta'} mencionada ou as demais, explicando o erro material ou juridico com base no material fornecido e nas alternativas]

Base legal: [cite o artigo, inciso ou lei aplicável. Se não souber, diga "Não identificada nos trechos"]

Pegadinha: [aponte a armadilha clássica dessa questão — troca de palavras, inversão de conceito, etc]

Use linguagem direta e técnica. Máximo 4 linhas por seção.`
    }

    // ==========================================
    // MOCK PARA EVITAR CUSTO DE OPENAI (DEBUG)
    // ==========================================
    const MOCK_AI = false // Altere para true para desativar OpenAI

    if (MOCK_AI) {
      console.log('[chat-questao] -> Retornando MOCK')
      const mockReply = [
        '**Correta:** MOCK — alternativa correta conforme gabarito.',
        '',
        '**Por que a marcada está errada:** MOCK — a alternativa incorreta contém uma inversão de conceito típica.',
        '',
        '**Base legal:** MOCK — art. 35 da CF/88.',
        '',
        `**Pegadinha:** MOCK — chunks encontrados: ${chunks.length}. Termos usados: ${keywords.join(', ')}.`,
      ].join('\n')
      return res.status(200).json({ reply: mockReply, usedChunks: chunks.length })
    }

    if (!OPENAI_API_KEY) {
      console.error('[chat-questao] OPENAI_API_KEY ausente')
      return res.status(500).json({ error: 'OpenAI API key missing' })
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

    const formattedMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...(messages || []).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: formattedMessages,
      temperature: 0.2,
      max_tokens: 700,
    })

    const reply = response.choices[0]?.message?.content || 'Erro ao gerar resposta.'
    return res.status(200).json({ reply, usedChunks: chunks.length })
  } catch (error: unknown) {
    console.error('[chat-questao] Erro:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
