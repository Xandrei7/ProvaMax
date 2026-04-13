import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const STOPWORDS = new Set([
  'sobre', 'qual', 'como', 'quem', 'para', 'onde', 'porque', 'quando',
  'assinale', 'alternativa', 'correta', 'incorreta', 'seguintes', 'abaixo',
  'conforme', 'segundo', 'acordo', 'teste', 'explicacao', 'texto', 'questao',
  'afirmativa', 'opcao', 'todas', 'nenhuma', 'pode', 'deve', 'sera', 'sao',
  'estao', 'esse', 'essa', 'este', 'esta', 'pelo', 'pela', 'pelas', 'pelos',
  'caso', 'forma', 'sendo', 'ainda', 'assim', 'mais', 'apenas', 'tambem',
])

const DISCIPLINE_SEARCH_ALIASES: Record<string, string> = {
  'direito constitucional': 'CONSTITUCIONAL',
  constitucional: 'CONSTITUCIONAL',
  'direito administrativo': 'DIREITO ADMINISTRATIVO',
  'administracao financeira e orcamentaria': 'AFO',
  afo: 'AFO',
  'lingua portuguesa': 'PORTUGUES',
  portugues: 'PORTUGUES',
  historia: 'HISTORIA',
  'historia de roraima': 'HISTORIA',
  geografia: 'GEOGRAFIA',
  'nocoes de administracao publica': 'NOÇÕES DE ADMINISTRAÇÃO PÚBLICA',
  'administracao publica': 'NOÇÕES DE ADMINISTRAÇÃO PÚBLICA',
}

function normalizeText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeStrict(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function mapDisciplineForSearch(discipline: string): string | null {
  const normalized = normalizeStrict(discipline)
  if (!normalized) return null

  if (DISCIPLINE_SEARCH_ALIASES[normalized]) return DISCIPLINE_SEARCH_ALIASES[normalized]

  for (const [alias, mapped] of Object.entries(DISCIPLINE_SEARCH_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) return mapped
  }

  return normalized.toUpperCase()
}

function extractKeywords(questionText: string, userMessage: string, subject: string, optionsText = ''): string[] {
  const subjectTerms = normalizeText(subject)
    .split(/\W+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))

  const bodyTerms = normalizeText(`${questionText} ${userMessage} ${optionsText}`)
    .split(/\W+/)
    .filter(w => w.length > 4 && !STOPWORDS.has(w))

  const all = [...subjectTerms, ...bodyTerms]
  return Array.from(new Set(all)).slice(0, 8)
}

function rankChunks(chunks: string[], keywords: string[]): string[] {
  if (keywords.length === 0) return chunks

  const scored = chunks.map(chunk => {
    const norm = normalizeText(chunk)
    const hits = keywords.filter(kw => norm.includes(kw)).length
    return { chunk, hits }
  })

  const relevant = scored
    .filter(s => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map(s => s.chunk)

  return relevant.length > 0 ? relevant.slice(0, 3) : chunks.slice(0, 2)
}

function detectMentionedLetter(message: string): string | null {
  const normalized = normalizeText(message)

  const withContext = normalized.match(/\b(?:alternativa|letra|item|opcao)\s*([a-e])\b/)
  if (withContext) return withContext[1].toUpperCase()

  const directQuestion = normalized.match(/\bpor que\s+a\s+([a-e])\b/)
  if (directQuestion) return directQuestion[1].toUpperCase()

  const standalone = message.match(/^\s*([A-Ea-e])\s*$/)
  if (standalone) return standalone[1].toUpperCase()

  return null
}

function stripBaseLegalFromReply(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const result: string[] = []
  let skippingBaseLegalBlock = false

  const isHeadingLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    const plain = trimmed.replace(/^[*_`>#\-\d.()\s]+/, '')
    return /^[A-Za-z][^:\n]{0,60}:/.test(plain)
  }

  const isBaseLegalStart = (line: string) => {
    const normalized = normalizeText(line)
    return /^(base|fundamento|embasamento) legal\b/.test(normalized)
  }

  for (const rawLine of lines) {
    if (isBaseLegalStart(rawLine)) {
      skippingBaseLegalBlock = true
      continue
    }

    if (skippingBaseLegalBlock) {
      if (!rawLine.trim()) {
        skippingBaseLegalBlock = false
        continue
      }

      if (isHeadingLine(rawLine)) {
        skippingBaseLegalBlock = false
      } else {
        continue
      }
    }

    const cleanedLine = rawLine.replace(/\b(?:base|fundamento|embasamento)\s*legal\b\s*[:.\-–].*$/gi, '').trimEnd()
    if (cleanedLine.trim()) {
      result.push(cleanedLine)
    }
  }

  const cleaned = result.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return cleaned || 'Erro ao gerar resposta.'
}

function limitReplyLines(text: string, maxLines: number): string {
  if (!text || maxLines <= 0) return text

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const selected: string[] = []
  let nonEmptyCount = 0

  for (const line of lines) {
    if (line.trim()) {
      nonEmptyCount += 1
      if (nonEmptyCount > maxLines) break
    }
    selected.push(line)
  }

  return selected.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function classifyDiscipline(discipline: string, subject = '') {
  const normalized = normalizeText(`${discipline} ${subject}`.trim())

  const isPortuguese = /\b(portugues|lingua portuguesa)\b/.test(normalized)
  const isHistory = /\bhistoria\b/.test(normalized)
  const isGeography = /\bgeografia\b/.test(normalized)
  const isAfo = /\bafo\b|administracao financeira e orcamentaria/.test(normalized)
  const isPublicAdministration = /nocoes de administracao publica|administracao publica/.test(normalized)

  const isKnownNonJuridical = isPortuguese || isHistory || isGeography || isAfo || isPublicAdministration
  const hasJuridicalSignal = /\bdireito\b|legislacao|regimento|normativ|estatuto|constituicao|codigo|decreto|portaria|\blei\b|processual|previdenciario/.test(normalized)
  const isJuridical = hasJuridicalSignal && !isKnownNonJuridical

  return { isJuridical, isPortuguese, isHistory, isGeography }
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
    const {
      messages,
      questionData,
      discipline: incomingDiscipline,
      subject: incomingSubject,
      disciplineId,
      subjectId,
    } = body

    let discipline = typeof incomingDiscipline === 'string' ? incomingDiscipline.trim() : ''
    let subject = typeof incomingSubject === 'string' ? incomingSubject.trim() : ''

    const fallbackDiscipline = normalizeText(discipline) === 'direito constitucional'
    if ((!discipline || !subject || fallbackDiscipline) && (disciplineId || subjectId)) {
      if ((!discipline || fallbackDiscipline) && disciplineId) {
        const { data: discData } = await supabase
          .from('disciplines')
          .select('name')
          .eq('id', disciplineId)
          .maybeSingle()
        discipline = discData?.name?.trim() || discipline
      }

      if (!subject && subjectId) {
        const { data: subData } = await supabase
          .from('subjects')
          .select('name')
          .eq('id', subjectId)
          .maybeSingle()
        subject = subData?.name?.trim() || subject
      }
    }

    const chatMessages = Array.isArray(messages) ? messages : []
    const lastUserMessage = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1].content : ''
    const questionText = questionData?.statement || ''
    const options = Array.isArray(questionData?.options) ? questionData.options : []

    const optionsText = options.map((o: any) => o.text).join(' ')
    const keywords = extractKeywords(questionText, lastUserMessage, subject || '', optionsText)
    const tsQuery = keywords.join(' | ')

    const mentionedLetter = detectMentionedLetter(lastUserMessage)
    const lowerMsg = normalizeText(lastUserMessage)

    const isSimplified = /explique? (mais )?(simples|facil)|me explica (melhor|mais simples)|fala de um jeito (facil|simples)|nao entendi|resume|resuma|descomplica|mais didatico/.test(lowerMsg)
    const asksWhyWrong = /por que (eu )?errei|porque (eu )?errei|onde errei|qual foi meu erro|meu erro|errei onde/.test(lowerMsg)
    const asksAllOptions = /justifi(?:que|car) (?:todas|cada)|expli(?:que|car) (?:todas|cada)|todas as alternativas|alternativa por alternativa|uma a uma|uma por uma|por que as outras/.test(lowerMsg)
    const asksWhatQuestionWanted = /o que (a )?questao (quis|queria|quer) cobrar|o que (a )?banca (quis|queria|quer) cobrar|qual era o foco da questao|qual era o ponto central da questao|o que essa questao cobra/.test(lowerMsg)
    const asksOnlyCorrect = /qual (e|eh)? (a )?(alternativa )?correta|qual (e|eh)? o gabarito|qual letra|resposta certa|so o gabarito/.test(lowerMsg)

    const answerMode = isSimplified
      ? 'simplified'
      : asksWhyWrong
      ? 'whyWrong'
      : mentionedLetter
      ? 'specificLetter'
      : asksAllOptions
      ? 'allOptions'
      : asksWhatQuestionWanted
      ? 'questionFocus'
      : asksOnlyCorrect
      ? 'onlyCorrect'
      : 'default'

    let rawChunks: string[] = []

    if (tsQuery) {
      let query = supabase.from('document_chunks').select('content, subject')
      const mappedDisc = mapDisciplineForSearch(discipline)

      if (mappedDisc) {
        query = query.or(`discipline.eq.${mappedDisc},discipline.ilike.%${mappedDisc}%`)
      }

      const { data: searchData, error: searchError } = await query
        .textSearch('content', tsQuery)
        .limit(12)

      if (!searchError && searchData) {
        rawChunks = searchData.map(d => d.content)
      }
    }

    if (rawChunks.length === 0 && subject) {
      const { data: fallbackData } = await supabase
        .from('document_chunks')
        .select('content')
        .ilike('subject', `%${subject}%`)
        .limit(5)
      if (fallbackData) rawChunks = fallbackData.map(d => d.content)
    }

    const chunks = rankChunks(rawChunks, keywords)
    const contextText = chunks.length > 0
      ? 'TRECHOS DO MATERIAL DIDATICO RELEVANTES:\n\n' + chunks.join('\n\n---\n\n')
      : 'Nenhum trecho especifico encontrado no material didatico para este tema.'

    const { isJuridical, isPortuguese, isHistory, isGeography } = classifyDiscipline(discipline)
    const needsBaseLegalStrip = !isJuridical
    const maxResponseLines = answerMode === 'allOptions' ? 10 : 7

    const studentAnswer = String(
      questionData?.selectedAnswer || questionData?.markedAnswer || questionData?.userAnswer || questionData?.chosenAnswer || 'Nao informado',
    )
    const studentOutcome =
      typeof questionData?.isCorrect === 'boolean'
        ? questionData.isCorrect
          ? 'Acertou'
          : 'Errou'
        : studentAnswer !== 'Nao informado' && questionData?.correctAnswer
        ? studentAnswer.trim().toUpperCase() === String(questionData.correctAnswer).trim().toUpperCase()
          ? 'Acertou'
          : 'Errou'
        : 'Nao informado'

    let systemPrompt = `Voce e um professor de concursos publicos. Voce e o Tira-Duvidas: auxiliar, curto e didatico.
De sua resposta em TEXTO SIMPLES. PROIBIDO usar markdown, asteriscos, negrito ou bullets estilizados.
Nao repita o comentario oficial inteiro. Nao transforme a resposta em um novo gabarito completo.
Responda somente o que o aluno pediu na ultima mensagem.

FONTES PRINCIPAIS (ordem de prioridade):
1. Disciplina
2. Assunto
3. Chunks relevantes da base documental
4. Enunciado
5. Alternativas
6. Gabarito
7. Se o aluno acertou ou errou
8. Pergunta do usuario
9. Comentario oficial (apoio secundario)

DADOS DA QUESTAO:
Disciplina: ${discipline || 'Nao informada'}
Assunto: ${subject || 'Nao informado'}
Enunciado: ${questionText || 'Nao informado'}
Gabarito: ${questionData?.correctAnswer || 'Nao informado'}
Resposta do aluno: ${studentAnswer}
Resultado do aluno: ${studentOutcome}
Pergunta do usuario: ${lastUserMessage || 'Nao informada'}
Alternativas:
${options.map((o: any) => `${o.letter}: ${o.text}`).join('\n')}
Comentario oficial (use apenas como apoio, nao repita): ${(questionData?.explanation || '').slice(0, 260)}

${contextText}

`

    if (isJuridical) {
      if (answerMode === 'simplified') {
        systemPrompt += `O aluno pediu simplificacao. Responda EXATAMENTE neste formato:

Em resumo: [explicacao curta e simples]
Na pratica: [exemplo curto e direto]
Pense assim: [analogia curta para facilitar]
Base legal: [artigo, principio ou dispositivo aplicavel, se couber]
Pegadinha: [confusao comum da banca]

Regras obrigatorias:
- Nao comecar com "Correta:".
- Nao abrir com "Por que as outras estao erradas".
- Nao listar varias alternativas sem pedido expresso.`
      } else if (answerMode === 'whyWrong') {
        systemPrompt += `O aluno perguntou "por que eu errei?". Responda EXATAMENTE neste formato:

Voce errou porque [o que voce confundiu].
A questao queria que voce percebesse que [ponto central].
Em resumo: [explicacao curta e simples].
Base legal: [artigo, principio ou dispositivo aplicavel, se couber].
Pegadinha: [confusao exata da banca].

Regras obrigatorias:
- Foque somente no erro do aluno.
- Nao responda com "Por que as outras estao erradas".
- Nao listar todas as alternativas.`
      } else if (answerMode === 'specificLetter') {
        systemPrompt += `O aluno perguntou especificamente da alternativa ${mentionedLetter}. Foque somente nela.

A alternativa ${mentionedLetter}: [diga se esta certa ou errada]
Explicacao: [justificativa curta e didatica]
Base legal: [artigo, principio ou dispositivo aplicavel, se couber]
Pegadinha: [por que essa letra confunde]`
      } else if (answerMode === 'allOptions') {
        systemPrompt += `O aluno pediu justificativa de todas as alternativas. Responda uma por uma:

Gabarito: [letra correta] - [motivo curto]
${options.map((o: any) => `${o.letter}: [justificativa curta da ${o.letter}]`).join('\n')}
Base legal: [artigo, principio ou dispositivo principal]
Pegadinha: [armadilha geral da banca]`
      } else if (answerMode === 'questionFocus') {
        systemPrompt += `O aluno perguntou o que a questao quis cobrar. Responda neste formato:

Ponto cobrado: [o nucleo do que a banca queria]
Em resumo: [explicacao curta e simples]
Base legal: [artigo, principio ou dispositivo aplicavel, se couber]
Pegadinha: [erro de leitura mais comum]`
      } else if (answerMode === 'onlyCorrect') {
        systemPrompt += `O aluno pediu apenas o gabarito. Responda neste formato:

Gabarito: [letra correta com justificativa em 1-2 linhas]
Base legal: [artigo, principio ou dispositivo aplicavel, se couber]`
      } else {
        systemPrompt += `Responda de forma curta e didatica no formato:

Em resumo: [explicacao objetiva]
Na pratica: [exemplo curto]
Base legal: [artigo, principio ou dispositivo aplicavel, se couber]
Pegadinha: [erro comum da banca]

Nao listar alternativas sem pedido expresso.`
      }
    } else {
      const noBaseLegalInstruction = `

REGRA ABSOLUTA PARA NAO JURIDICO:
- O rotulo "Base legal" e proibido.
- Nunca escreva "Base legal" nem variacoes parecidas.
- Nunca escreva "Base legal: nao se aplica" ou qualquer variante.`

      if (isPortuguese) {
        if (answerMode === 'simplified') {
          systemPrompt += `Responda EXATAMENTE com os rotulos abaixo, nesta ordem.
Formato de PORTUGUES (simples):

Regra: [regra gramatical em linguagem simples]
Como pensar: [teste pratico para acertar]
Exemplo: [comparacao curta de uso]
Pegadinha: [erro comum da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'whyWrong') {
          systemPrompt += `Formato de PORTUGUES para "por que eu errei":

Regra: [regra gramatical central]
Por que esta errado: [o ponto que voce confundiu]
Como pensar: [teste pratico]
Exemplo: [certo x errado em 1-2 linhas]
Pegadinha: [armadilha comum]` + noBaseLegalInstruction
        } else if (answerMode === 'specificLetter') {
          systemPrompt += `Foque apenas na alternativa ${mentionedLetter} em PORTUGUES:

Por que a ${mentionedLetter} esta errada: [erro objetivo]
Regra: [regra aplicavel]
Como pensar: [teste rapido]
Exemplo: [exemplo curto]
Pegadinha: [armadilha da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'allOptions') {
          systemPrompt += `O aluno pediu todas as alternativas em PORTUGUES:

Gabarito: [letra correta] - [motivo curto]
${options.map((o: any) => `${o.letter}: [justificativa curta]`).join('\n')}
Pegadinha: [erro recorrente da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'questionFocus') {
          systemPrompt += `O aluno perguntou o que a questao quis cobrar em PORTUGUES:

Regra: [regra central cobrada]
Como pensar: [forma pratica de identificar]
Exemplo: [exemplo curto]
Pegadinha: [confusao tipica]` + noBaseLegalInstruction
        } else {
          systemPrompt += `Formato padrao de PORTUGUES:

Regra: [regra gramatical central]
Por que esta errado: [erro da alternativa ou interpretacao]
Como pensar: [teste pratico]
Exemplo: [exemplo curto]
Pegadinha: [erro comum da banca]` + noBaseLegalInstruction
        }
      } else if (isHistory) {
        if (answerMode === 'simplified') {
          systemPrompt += `Formato de HISTORIA (simples):

Tema central: [tema principal da questao]
Contexto: [processo historico em 2-3 linhas]
Como lembrar: [sintese para fixar]
Pegadinha: [confusao comum da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'whyWrong') {
          systemPrompt += `Formato de HISTORIA para "por que eu errei":

Tema central: [o que a banca cobrava]
Por que esta errado: [o ponto que voce confundiu]
Contexto: [causa e consequencia resumidas]
Como lembrar: [chave de memorizacao]
Pegadinha: [armadilha tipica]` + noBaseLegalInstruction
        } else if (answerMode === 'specificLetter') {
          systemPrompt += `Foque apenas na alternativa ${mentionedLetter} em HISTORIA:

Por que a ${mentionedLetter} esta errada: [erro historico central]
Tema central: [conteudo cobrado]
Contexto: [situacao historica resumida]
Pegadinha: [armadilha da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'allOptions') {
          systemPrompt += `O aluno pediu todas as alternativas em HISTORIA:

Gabarito: [letra correta] - [motivo curto]
${options.map((o: any) => `${o.letter}: [justificativa curta]`).join('\n')}
Pegadinha: [erro recorrente da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'questionFocus') {
          systemPrompt += `Responda EXATAMENTE com os rotulos abaixo, nesta ordem.
O aluno perguntou o que a questao quis cobrar em HISTORIA:

Tema central: [nucleo do que a banca cobrou]
Contexto: [processo historico relevante]
Como lembrar: [forma curta de memorizar]
Pegadinha: [confusao tipica]` + noBaseLegalInstruction
        } else {
          systemPrompt += `Formato padrao de HISTORIA:

Tema central: [conteudo cobrado]
Por que esta errado: [erro da alternativa]
Contexto: [processo historico resumido]
Como lembrar: [sintese para fixacao]
Pegadinha: [erro comum da banca]` + noBaseLegalInstruction
        }
      } else if (isGeography) {
        if (answerMode === 'simplified') {
          systemPrompt += `Formato de GEOGRAFIA (simples):

Conceito central: [conceito principal]
Como entender: [relacao espacial/fenomeno em linguagem simples]
Exemplo pratico: [aplicacao curta]
Pegadinha: [confusao comum da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'whyWrong') {
          systemPrompt += `Formato de GEOGRAFIA para "por que eu errei":

Conceito central: [o que a banca cobrava]
Por que esta errado: [o ponto que voce confundiu]
Como entender: [explicacao simples do fenomeno]
Exemplo pratico: [aplicacao no mundo real]
Pegadinha: [armadilha tipica]` + noBaseLegalInstruction
        } else if (answerMode === 'specificLetter') {
          systemPrompt += `Foque apenas na alternativa ${mentionedLetter} em GEOGRAFIA:

Por que a ${mentionedLetter} esta errada: [erro objetivo]
Conceito central: [conceito cobrado]
Como entender: [explicacao curta]
Exemplo pratico: [exemplo rapido]
Pegadinha: [armadilha da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'allOptions') {
          systemPrompt += `O aluno pediu todas as alternativas em GEOGRAFIA:

Gabarito: [letra correta] - [motivo curto]
${options.map((o: any) => `${o.letter}: [justificativa curta]`).join('\n')}
Pegadinha: [erro recorrente da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'questionFocus') {
          systemPrompt += `O aluno perguntou o que a questao quis cobrar em GEOGRAFIA:

Conceito central: [nucleo cobrado]
Como entender: [explicacao simples do fenomeno]
Exemplo pratico: [aplicacao curta]
Pegadinha: [confusao tipica]` + noBaseLegalInstruction
        } else {
          systemPrompt += `Formato padrao de GEOGRAFIA:

Conceito central: [o que a questao cobra]
Por que esta errado: [erro da alternativa]
Como entender: [explicacao simples]
Exemplo pratico: [aplicacao curta]
Pegadinha: [erro comum da banca]` + noBaseLegalInstruction
        }
      } else {
        if (answerMode === 'simplified') {
          systemPrompt += `Formato CONCEITUAL (simples):

Conceito central: [conceito principal]
Como entender: [explicacao simples]
Exemplo pratico: [aplicacao curta]
Pegadinha: [erro comum da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'whyWrong') {
          systemPrompt += `Formato CONCEITUAL para "por que eu errei":

Conceito central: [o que a banca cobrava]
Por que esta errado: [o ponto que voce confundiu]
Como entender: [explicacao didatica]
Exemplo pratico: [uso real]
Pegadinha: [armadilha tipica]` + noBaseLegalInstruction
        } else if (answerMode === 'specificLetter') {
          systemPrompt += `Foque apenas na alternativa ${mentionedLetter}:

Por que a ${mentionedLetter} esta errada: [erro objetivo]
Conceito central: [conteudo cobrado]
Como entender: [explicacao curta]
Exemplo pratico: [exemplo rapido]
Pegadinha: [armadilha da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'allOptions') {
          systemPrompt += `O aluno pediu todas as alternativas:

Gabarito: [letra correta] - [motivo curto]
${options.map((o: any) => `${o.letter}: [justificativa curta]`).join('\n')}
Pegadinha: [erro recorrente da banca]` + noBaseLegalInstruction
        } else if (answerMode === 'questionFocus') {
          systemPrompt += `O aluno perguntou o que a questao quis cobrar:

Conceito central: [nucleo cobrado]
Como entender: [explicacao didatica]
Exemplo pratico: [aplicacao curta]
Pegadinha: [confusao tipica]` + noBaseLegalInstruction
        } else {
          systemPrompt += `Formato padrao CONCEITUAL:

Conceito central: [o que a questao cobra]
Por que esta errado: [erro da alternativa]
Como entender: [explicacao didatica]
Exemplo pratico: [aplicacao curta]
Pegadinha: [detalhe que induz ao erro]` + noBaseLegalInstruction
        }
      }
    }

    systemPrompt += `

Lembrete final: TEXTO PURO, sem markdown. Use no maximo ${maxResponseLines} linhas curtas.`

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key missing' })
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

    const formattedMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...chatMessages.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: formattedMessages,
      temperature: 0.2,
      max_tokens: asksAllOptions ? 520 : 380,
    })

    let reply = response.choices[0]?.message?.content || 'Erro ao gerar resposta.'

    if (needsBaseLegalStrip) {
      reply = stripBaseLegalFromReply(reply)
    }

    reply = limitReplyLines(reply, maxResponseLines)

    if (needsBaseLegalStrip) {
      reply = stripBaseLegalFromReply(reply)
      if (/\bbase\s*legal\b/i.test(reply)) {
        reply = reply.replace(/\bbase\s*legal\b\s*:?\s*/gi, '').replace(/\n{3,}/g, '\n\n').trim()
      }
    }

    return res.status(200).json({ reply, usedChunks: chunks.length })
  } catch (error: unknown) {
    console.error('[chat-questao] Erro:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
