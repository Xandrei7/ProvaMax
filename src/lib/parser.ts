export interface ParsedOption {
  letter: string
  text: string
}

export interface ParsedQuestion {
  number: number
  statement: string
  type: 'multiple_choice' | 'true_false'
  options: ParsedOption[] | null
  correctAnswer: string
  comment: string
  /** Texto de apoio extraído antes da questão (ou entre grupos de questões) */
  associatedText: string | null
}

export function parseQuestionsText(rawText: string): ParsedQuestion[] {
  const gabaritoRegex = /GABARITO\s*COMENTADO/i
  const splitIndex = rawText.search(gabaritoRegex)

  const questionsText = splitIndex >= 0 ? rawText.slice(0, splitIndex) : rawText
  const gabaritoText  = splitIndex >= 0 ? rawText.slice(splitIndex) : ''

  // Parseia gabarito PRIMEIRO para obter números válidos de questão.
  // Isso permite distinguir questões reais de itens numerados dentro do texto de apoio.
  const answerMap     = gabaritoText ? parseGabaritoSection(gabaritoText) : {}
  const validNumbers  = new Set(Object.keys(answerMap).map(Number))

  const questionMap = parseQuestionsSection(questionsText, validNumbers)

  return questionMap
    .sort((a, b) => a.number - b.number)
    .map(q => ({
      ...q,
      correctAnswer: answerMap[q.number]?.letter ?? '',
      comment:       answerMap[q.number]?.comment ?? '',
    }))
}

// ──────────────────────────────────────────────────────────────────────────────
// Detecta texto de apoio/associado num bloco de texto.
// Heurística progressiva: sinais fortes primeiro, depois tamanho como fallback.
// ──────────────────────────────────────────────────────────────────────────────
function detectAssociatedText(block: string): string | null {
  const trimmed = block.trim()
  if (!trimmed) return null

  // Ruído muito curto (ex: título solto, número isolado)
  if (trimmed.length < 30) return null

  // Sinal 1: instrução explícita comum em provas
  if (/^aten[çc][aã]o\s*:/i.test(trimmed))                                      return trimmed
  if (/^(?:leia|considere|com base|a partir|baseado|analise|observe|texto\s*[\d:–\-])/i.test(trimmed)) return trimmed
  if (/^(?:para responder|para as quest[õo]es|julgue|assinale)/i.test(trimmed))  return trimmed

  // Sinal 2: dois ou mais parágrafos com conteúdo real
  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 15)
  if (paragraphs.length >= 2) return trimmed

  // Sinal 3: passagem única com substância (artigo, trecho, citação)
  if (trimmed.length > 80) return trimmed

  return null
}

// ──────────────────────────────────────────────────────────────────────────────
// Verifica se o bloco de uma match contém linhas de alternativas (a–e)
// ──────────────────────────────────────────────────────────────────────────────
function blockHasOptions(text: string, matchIdx: number, allMatches: RegExpMatchArray[]): boolean {
  const m     = allMatches[matchIdx]
  const nextM = allMatches[matchIdx + 1]
  const start = (m.index ?? 0) + m[0].length
  const end   = nextM?.index ?? text.length
  return /^[a-eA-E]\)\s/m.test(text.slice(start, end))
}

function parseQuestionsSection(
  text: string,
  validNumbers: Set<number> = new Set(),
) {
  // Regex mais tolerante: aceita início de linha ou quebra de linha, 
  // com ou sem espaços antes do número.
  const questionStartRegex = /(?:^|\n)[ \t]*(\d+)[.)]\s+/g
  const allMatches = [...text.matchAll(questionStartRegex)]

  if (allMatches.length === 0) return []

  const hasValidNumbers = validNumbers.size > 0

  // ── Encontrar a primeira questão REAL ──────────────────────────────────────
  // Critério primário: bloco contém alternativas a–e  (questão de múltipla escolha)
  // Critério secundário: número está no gabarito         (questão C/E)
  // Fallback: primeiro match qualquer
  let firstRealIdx = allMatches.findIndex((_, i) => blockHasOptions(text, i, allMatches))

  if (firstRealIdx < 0 && hasValidNumbers) {
    firstRealIdx = allMatches.findIndex(m => validNumbers.has(parseInt(m[1])))
  }
  if (firstRealIdx < 0) firstRealIdx = 0

  // ── Construir lista de matches válidos a partir da primeira questão real ───
  // Inclui matches que têm alternativas OU cujo número está no gabarito.
  // Se nenhum critério é aplicável (sem gabarito, sem alternativas), usa todos.
  let matches = allMatches.slice(firstRealIdx).filter((m, relIdx) => {
    const absIdx = firstRealIdx + relIdx
    if (blockHasOptions(text, absIdx, allMatches)) return true
    if (hasValidNumbers && validNumbers.has(parseInt(m[1])))  return true
    return false
  })

  // Fallback: se o filtro zerou tudo, usa o slice sem filtro
  if (matches.length === 0) {
    matches = allMatches.slice(firstRealIdx)
  }

  // ── Contexto inicial: texto antes da primeira questão real ─────────────────
  const firstRealPos = matches[0].index ?? 0
  let currentContext = detectAssociatedText(text.slice(0, firstRealPos))

  const results: Omit<ParsedQuestion, 'correctAnswer' | 'comment'>[] = []

  for (let i = 0; i < matches.length; i++) {
    const match     = matches[i]
    const nextMatch = matches[i + 1]
    const number    = parseInt(match[1])

    const blockStart = (match.index ?? 0) + match[0].length
    const blockEnd   = nextMatch?.index ?? text.length
    const blockText  = text.slice(blockStart, blockEnd)

    const { statement, options, trailingText } = parseQuestionBlock(blockText)

    // Ignora blocos sem enunciado (falso positivo de número solto)
    if (!statement.trim()) continue

    const isTrueFalse =
      options.length === 0 ||
      (options.length === 2 &&
        options.every(o => ['C', 'E'].includes(o.letter.toUpperCase())))

    results.push({
      number,
      statement,
      type:           isTrueFalse ? 'true_false' : 'multiple_choice',
      options:        isTrueFalse ? null : options,
      associatedText: currentContext,
    })

    // ── Contexto inter-questões ────────────────────────────────────────────
    // Se houver texto substancial após as alternativas desta questão,
    // ele se torna o novo contexto para as questões seguintes.
    if (trailingText) {
      const newContext = detectAssociatedText(trailingText)
      if (newContext) currentContext = newContext
    }
  }

  return results
}

function parseQuestionBlock(text: string): {
  statement:    string
  options:      ParsedOption[]
  trailingText: string | null
} {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  // Permite espaços em branco antes da letra da alternativa (comum no mobile)
  const optionPattern = /^[ \t]*([a-eA-E])\)\s*(.+)/

  const firstOptIdx = lines.findIndex(l => optionPattern.test(l))

  // Sem alternativas: questão C/E ou enunciado puro
  if (firstOptIdx < 0) {
    return {
      statement:    lines.join(' ').replace(/\s+/g, ' ').trim(),
      options:      [],
      trailingText: null,
    }
  }

  const statementLines = lines.slice(0, firstOptIdx)
  const restLines      = lines.slice(firstOptIdx)

  // Encontra o índice do ÚLTIMO option line dentro de restLines
  let lastOptIdx = -1
  for (let j = 0; j < restLines.length; j++) {
    if (optionPattern.test(restLines[j])) lastOptIdx = j
  }

  const optionLines   = restLines.slice(0, lastOptIdx + 1)
  const trailingLines = lastOptIdx >= 0 ? restLines.slice(lastOptIdx + 1) : []

  const options: ParsedOption[] = optionLines
    .map(line => {
      const m = line.match(optionPattern)
      return m ? { letter: m[1].toUpperCase(), text: m[2].trim() } : null
    })
    .filter(Boolean) as ParsedOption[]

  const statement    = statementLines.join(' ').replace(/\s+/g, ' ').trim()
  const trailingText = trailingLines.join('\n').trim() || null

  return { statement, options, trailingText }
}

function parseGabaritoSection(text: string): Record<number, { letter: string; comment: string }> {
  // Matches "1. C" (sozinho) ou "1. C Comentário..." (mesma linha).
  // \b garante que a letra é isolada. Tolerante a múltiplos espaços e quebras.
  const answerLineRegex = /(?:^|\n)[ \t]*(\d+)[.)]\s*([A-Ea-e])\b/g
  const matches = [...text.matchAll(answerLineRegex)]

  const map: Record<number, { letter: string; comment: string }> = {}

  for (let i = 0; i < matches.length; i++) {
    const match     = matches[i]
    const nextMatch = matches[i + 1]

    const number = parseInt(match[1])
    const letter = match[2].toUpperCase()

    const commentStart = (match.index ?? 0) + match[0].length
    const commentEnd   = nextMatch?.index ?? text.length
    const comment      = text
      .slice(commentStart, commentEnd)
      .replace(/^\s+/, '')
      .replace(/\s+$/, '')
      .trim()

    map[number] = { letter, comment }
  }

  return map
}
