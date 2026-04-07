import OpenAI from 'openai'

const MAX_STATEMENT_LENGTH = 1800
const MAX_EXPLANATION_LENGTH = 1200
const MAX_LEGAL_BASIS_LENGTH = 900

function normalizeText(value, maxLength) {
  if (typeof value !== 'string') return ''
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return '[]'

  const compact = options
    .slice(0, 8)
    .map((option, index) => {
      if (typeof option === 'string') {
        return `${index + 1}) ${normalizeText(option, 240)}`
      }

      if (option && typeof option === 'object') {
        const letterRaw = option.letter
        const textRaw = option.text
        const letter = normalizeText(letterRaw, 8)
        const text = normalizeText(textRaw, 240)
        if (letter || text) return `${letter || String(index + 1)}) ${text}`
      }

      return null
    })
    .filter(Boolean)

  return compact.length > 0 ? compact.join(' | ') : '[]'
}

function normalizeForComparison(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeCopiedStatement(frontText, statement) {
  const normalizedFront = normalizeForComparison(frontText)
  const normalizedStatement = normalizeForComparison(statement)

  if (!normalizedFront || !normalizedStatement) return false
  if (normalizedFront === normalizedStatement) return true
  if (normalizedFront.length > 60 && normalizedStatement.includes(normalizedFront)) return true
  return false
}

function buildFallback(input) {
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

export function buildFallbackFlashcard(correctAnswer) {
  return {
    front_text: 'Qual e a regra central desta questao?',
    back_answer: `Resposta correta: ${normalizeText(correctAnswer, 180) || 'ver comentario da questao.'}`,
    back_trap: 'A banca costuma trocar excecao por regra geral (ou o inverso).',
    back_antidote: 'SE duas alternativas parecerem certas, ENTAO valide excecoes, prazo e sujeito competente.',
  }
}

function asFlashcardOrNull(value, statement) {
  if (!value || typeof value !== 'object') return null

  const frontText = normalizeText(value.front_text, 280)
  const backAnswer = normalizeText(value.back_answer, 420)
  const backTrap = normalizeText(value.back_trap, 420)
  const backAntidote = normalizeText(value.back_antidote, 420)

  if (!frontText || !backAnswer || !backTrap || !backAntidote) return null
  if (looksLikeCopiedStatement(frontText, statement)) return null

  return {
    front_text: frontText,
    back_answer: backAnswer,
    back_trap: backTrap,
    back_antidote: backAntidote,
  }
}

function parseJson(content) {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI response is not valid JSON')
    return JSON.parse(match[0])
  }
}

function buildPrompt(input) {
  return `Voce e um gerador de flashcards de recuperacao ativa para concurso, com foco total em padrao de banca e memorizacao util.

Sua tarefa e transformar UMA questao errada do usuario em UM flashcard altamente eficiente.

OBJETIVO
Gerar 1 flashcard por questao errada, com foco em:
- recuperacao ativa
- regra cobrada
- pegadinha da banca
- antidoto mental pratico
- revisao rapida e util

MISSAO
Voce NAO deve copiar o enunciado original.
Voce deve extrair a REGRA que estava sendo cobrada e transformar isso em um flashcard que ajude o usuario a nunca mais errar esse padrao.

ENTRADA
Voce recebera:
- banca
- disciplina
- assunto
- tipo_da_questao
- enunciado
- alternativas
- resposta_correta
- resposta_marcada_pelo_usuario
- comentario_gabarito
- fundamento_legal

REGRAS OBRIGATORIAS
1. Gere exatamente 1 flashcard por questao
2. Frente = pergunta sobre a regra, sem copiar enunciado
3. Verso = resposta curta + pegadinha + antidoto SE->ENTAO
4. Linguagem objetiva
5. Nao inventar dado fora da entrada
6. Foco total no padrao FCC

Formato de saida:
{
  "front_text": "...",
  "back_answer": "...",
  "back_trap": "...",
  "back_antidote": "..."
}

Dados:
${JSON.stringify(input, null, 2)}`
}

export async function generateFlashcardWithAi(openai, input) {
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
  })

  let lastError = null

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

      const parsed = parseJson(content)
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
