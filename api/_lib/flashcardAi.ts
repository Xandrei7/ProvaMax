import OpenAI from 'openai'

interface FlashcardAiInput {
  bank?: string
  discipline?: string
  subject?: string
  questionType?: string
  statement: string
  alternatives?: unknown
  options?: unknown
  correctAnswer: string
  userWrongAnswer: string
  explanation?: string | null
  comment?: string | null
  legalBasis?: string | null
  // Trecho do material didático (PDF em chunks) para enriquecer a frente/verso
  chunkContext?: string
}

export interface GeneratedFlashcard {
  front_text: string
  back_answer: string
  back_trap: string
  back_antidote: string
}

const MAX_STATEMENT_LENGTH = 1800
const MAX_EXPLANATION_LENGTH = 1200
const MAX_LEGAL_BASIS_LENGTH = 900

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact
}

function normalizeOptions(options: unknown) {
  if (!Array.isArray(options)) return '[]'

  const compact = options
    .slice(0, 8)
    .map((option, index) => {
      if (typeof option === 'string') {
        return `${index + 1}) ${normalizeText(option, 240)}`
      }

      if (option && typeof option === 'object') {
        const letterRaw = (option as { letter?: unknown }).letter
        const textRaw = (option as { text?: unknown }).text
        const letter = normalizeText(letterRaw, 8)
        const text = normalizeText(textRaw, 240)
        if (letter || text) return `${letter || String(index + 1)}) ${text}`
      }

      return null
    })
    .filter((item): item is string => Boolean(item))

  return compact.length > 0 ? compact.join(' | ') : '[]'
}

function normalizeForComparison(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeCopiedStatement(frontText: string, statement: string) {
  const normalizedFront = normalizeForComparison(frontText)
  const normalizedStatement = normalizeForComparison(statement)

  if (!normalizedFront || !normalizedStatement) return false
  if (normalizedFront === normalizedStatement) return true
  if (normalizedFront.length > 60 && normalizedStatement.includes(normalizedFront)) return true
  return false
}

function buildFallback(input: {
  discipline: string
  subject: string
  correctAnswer: string
  userWrongAnswer: string
  explanation: string
  legalBasis: string
}): GeneratedFlashcard {
  const focus = input.subject || input.discipline || 'tema central'
  const explanationSnippet = input.explanation.slice(0, 220)
  const legalSnippet = input.legalBasis.slice(0, 160)

  return {
    front_text: `Em prova FCC, qual e a regra principal sobre ${focus}?`,
    back_answer: explanationSnippet || `A alternativa correta e ${input.correctAnswer}. Aplique o criterio objetivo da regra.`,
    back_trap: input.userWrongAnswer
      ? `A pegadinha e marcar ${input.userWrongAnswer} por parecer plausivel sem conferir o criterio tecnico.`
      : 'A pegadinha e confundir regra geral com excecao ou trocar sujeito competente.',
    back_antidote: legalSnippet
      ? `SE aparecer questao sobre ${focus}, ENTAO valide primeiro: ${legalSnippet}.`
      : `SE aparecer questao sobre ${focus}, ENTAO confirme regra, excecoes e termos absolutos antes de marcar.`,
  }
}

export function buildFallbackFlashcard(correctAnswer: string): GeneratedFlashcard {
  return {
    front_text: 'Qual e a regra central desta questao?',
    back_answer: `Resposta correta: ${normalizeText(correctAnswer, 180) || 'ver comentario da questao.'}`,
    back_trap: 'A banca costuma trocar excecao por regra geral (ou o inverso).',
    back_antidote: 'SE duas alternativas parecerem certas, ENTAO valide excecoes, prazo e sujeito competente.',
  }
}

function asFlashcardOrNull(value: unknown, statement: string): GeneratedFlashcard | null {
  if (!value || typeof value !== 'object') return null

  const frontText = normalizeText((value as { front_text?: unknown }).front_text, 280)
  const backAnswer = normalizeText((value as { back_answer?: unknown }).back_answer, 420)
  const backTrap = normalizeText((value as { back_trap?: unknown }).back_trap, 420)
  const backAntidote = normalizeText((value as { back_antidote?: unknown }).back_antidote, 420)

  if (!frontText || !backAnswer || !backTrap || !backAntidote) return null
  if (looksLikeCopiedStatement(frontText, statement)) return null

  return {
    front_text: frontText,
    back_answer: backAnswer,
    back_trap: backTrap,
    back_antidote: backAntidote,
  }
}

function parseJson(content: string) {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI response is not valid JSON')
    return JSON.parse(match[0])
  }
}

const CHUNK_HIGH_VALUE_RE = /prazo|qu[oó]rum|compet[eê]ncia|distin[cç][aã]o|exce[cç][aã]o|conceito|classifica[cç][aã]o|obrigat[oó]rio|vedado|proibido|exclusivo|privativo|maioria|aprova[cç][aã]o|rejei[cç][aã]o/i

function chunkHasHighValue(chunk: string): boolean {
  return CHUNK_HIGH_VALUE_RE.test(chunk)
}

function buildPrompt(input: {
  bank: string
  discipline: string
  subject: string
  questionType: string
  statement: string
  alternatives: string
  correctAnswer: string
  userWrongAnswer: string
  explanation: string
  legalBasis: string
  chunkContext?: string
}) {
  const { chunkContext, ...dados } = input
  const chunkSection = chunkContext
    ? `\nMATERIAL DIDATICO RELEVANTE (use para enriquecer frente e verso, sem copiar diretamente):\n${chunkContext}\n`
    : ''

  return `Voce e um gerador de flashcards de alta performance para concurso FCC, cargo Tecnico Legislativo - Assistente Legislativo da ALE-RR.

TAREFA: transformar UMA questao errada em UM flashcard de recuperacao ativa eficiente.

REGRAS PARA A FRENTE (front_text):
- NAO copiar o enunciado
- Cobrar UMA ideia por vez
- Respondivel em poucos segundos sem releitura
- Maximo 120 caracteres
- Use EXATAMENTE um dos 6 modelos abaixo (prioridade: prazo/quorum/competencia > distincao/excecao > lacuna > situacao FCC > associacao):

MODELO 1 - LACUNA DIRIGIDA
Quando a regra tem um nome/conceito central.
Ex: "O principio orcamentario que veda materia estranha a LOA e o da ______."

MODELO 2 - REGRA NUCLEAR (PRIORITARIO — use sempre que houver prazo, quorum ou competencia)
Para regras objetivas, prazos, quoruns, competencias.
Ex: "O veto presidencial pode ser derrubado por qual quorum?"

MODELO 3 - COMPLETE A REGRA (PRIORITARIO — use sempre que houver numero ou prazo)
Quando o ponto central e numero, prazo ou completar regra.
Ex: "No processo legislativo, a medida provisoria tem prazo inicial de ____ dias."

MODELO 4 - DISTINCAO COBRADA
Quando a banca cobra confusao entre dois institutos.
Ex: "Qual a diferenca central entre dispensa e inexigibilidade de licitacao?"

MODELO 5 - SITUACAO CURTA FCC
Quando a questao cobra identificar conceito por situacao.
Ex: "Se a Administracao atua com foco em resultado e flexibilidade, ela se aproxima de qual modelo?"

MODELO 6 - ASSOCIACAO OBJETIVA
Quando cobra classificacao, atributo ou elemento de instituto.
Ex: "O atributo do ato administrativo que permite execucao direta e qual?"

REGRAS PARA O VERSO (max 200 chars cada):
- back_answer: resposta direta, curta, seca, precisa
- back_trap: pegadinha classica FCC relacionada (troca de sujeito, excecao por regra, termo absoluto)
- back_antidote: formato obrigatorio "SE [condicao], ENTAO [regra/resultado]"

PROIBICOES:
- Nao criar pergunta vaga, aberta demais ou impossivel de responder em segundos
- Nao copiar enunciado ou trecho longo na frente
- Nao inventar dado fora da entrada
- Nao criar resposta dissertativa
${chunkSection}
Formato de saida:
{
  "front_text": "...",
  "back_answer": "...",
  "back_trap": "...",
  "back_antidote": "..."
}

Dados:
${JSON.stringify(dados, null, 2)}`
}

export async function generateFlashcardWithAi(openai: OpenAI, input: FlashcardAiInput): Promise<GeneratedFlashcard> {
  const bank = normalizeText(input.bank, 80) || 'FCC'
  const discipline = normalizeText(input.discipline, 140)
  const subject = normalizeText(input.subject, 140)
  const questionType = normalizeText(input.questionType, 80)
  const statement = normalizeText(input.statement, MAX_STATEMENT_LENGTH)
  const alternatives = normalizeOptions(input.alternatives ?? input.options)
  const correctAnswer = normalizeText(input.correctAnswer, 180)
  const wrongAnswer = normalizeText(input.userWrongAnswer, 180)
  const explanation = normalizeText(input.explanation ?? input.comment, MAX_EXPLANATION_LENGTH)
  const legalBasis = normalizeText(input.legalBasis, MAX_LEGAL_BASIS_LENGTH)

  const fallback = buildFallback({
    discipline,
    subject,
    correctAnswer,
    userWrongAnswer: wrongAnswer,
    explanation,
    legalBasis,
  })

  if (!statement || !correctAnswer || !wrongAnswer) {
    return fallback
  }

  const rawChunk = typeof input.chunkContext === 'string' ? input.chunkContext.slice(0, 1200) : undefined
  const chunkContext = rawChunk && chunkHasHighValue(rawChunk) ? rawChunk : undefined

  const prompt = buildPrompt({
    bank,
    discipline,
    subject,
    questionType,
    statement,
    alternatives,
    correctAnswer,
    userWrongAnswer: wrongAnswer,
    explanation: explanation || 'Nao informado',
    legalBasis: legalBasis || 'Nao informado',
    chunkContext,
  })

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_FLASHCARD_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Responda apenas com JSON valido.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 420,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        lastError = new Error('Empty AI response')
        continue
      }

      const parsed = parseJson(content) as unknown
      const flashcard = asFlashcardOrNull(parsed, statement)
      if (!flashcard) {
        lastError = new Error('Invalid flashcard payload from AI')
        continue
      }

      return flashcard
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown AI error')
    }
  }

  if (lastError) {
    console.warn('[flashcardAi] fallback activated after AI failure:', lastError.message)
  }

  return fallback
}
