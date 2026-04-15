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

function stripInlineFormatting(line: string): string {
  return line.replace(/<\/?(?:b|i|u|mark|span(?:\s+[^>]*)?)>/gi, '')
}

function isSingleLetterLine(line: string): boolean {
  const plain = stripInlineFormatting(line).trim()
  return /^[A-Za-zÀ-ÿ]$/.test(plain)
}

function endsWithLetter(line: string): boolean {
  const plain = stripInlineFormatting(line).trim()
  return /[A-Za-zÀ-ÿ]$/.test(plain)
}

function isVowel(char: string): boolean {
  return /[AEIOUÁÉÍÓÚÂÊÔÃÕÀÜ]/i.test(char)
}

function isConsonant(char: string): boolean {
  return /[BCDFGHJKLMNPQRSTVWXYZÇ]/i.test(char)
}

function shouldMergeDetachedFinalVowel(prevPlain: string, vowel: string, nextPlain: string): boolean {
  const v = vowel.toLowerCase()
  const nextIsBoundary = nextPlain === '' || /^[,.;:!?)}\]]/.test(nextPlain)

  if (/^[A-Z]{2,}$/.test(prevPlain) && /^[AEIOU]$/.test(vowel) && nextIsBoundary) {
    return true
  }

  if (v === 'a') {
    if (/(?:et|rt|iv|id|ç|cas)$/i.test(prevPlain)) return true
    if (/(?:or)$/i.test(prevPlain) && nextIsBoundary) return true
    return false
  }

  if (v === 'e') {
    return /(?:gent|ment|quent|nt|idad)$/i.test(prevPlain)
  }

  if (v === 'o') {
    return /(?:rt|iv)$/i.test(prevPlain) && nextIsBoundary
  }

  return false
}

function inferMissingFinalVowel(plainToken: string, nextPlain: string): string {
  const atBoundary = nextPlain === '' || /^[,.;:!?)}\]]/.test(nextPlain)
  if (!atBoundary) return ''

  if (/(?:gent|ment|quent|idad)$/i.test(plainToken)) return 'e'
  if (/(?:tiv|ç|v[aá]lid)$/i.test(plainToken)) return 'a'

  return ''
}

function splitWordAndPunctuation(token: string): { word: string; punctuation: string } | null {
  const match = token.match(/^([A-Za-zÀ-ÿ]+)([,.;:!?)}\]]*)$/)
  if (!match) return null
  return { word: match[1], punctuation: match[2] }
}

function mergeSplitFinalLettersInLine(line: string): string {
  const tokens = line.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return line

  const merged: string[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const plain = stripInlineFormatting(token).trim()
    const tokenParts = splitWordAndPunctuation(plain)

    const prevRaw = merged[merged.length - 1]
    const prevPlain = prevRaw ? stripInlineFormatting(prevRaw).trim() : ''
    const prevWord = prevPlain.replace(/[,.;:!?)}\]]+$/, '')
    const nextRaw = tokens[i + 1] ?? ''
    const nextPlain = stripInlineFormatting(nextRaw).trim()
    const nextContextPlain = tokenParts?.punctuation ? tokenParts.punctuation : nextPlain
    const letterCandidate = tokenParts && tokenParts.word.length === 1 ? tokenParts.word : ''
    const acronymMergeCandidate =
      /^[A-Z]{2,}$/.test(prevWord) &&
      /^[AEIOU]$/.test(letterCandidate)

    const canMergeWithPrev =
      !!prevRaw &&
      !!letterCandidate &&
      isVowel(letterCandidate) &&
      (
        acronymMergeCandidate ||
        (prevWord.length >= 2 && isConsonant(prevWord.slice(-1)))
      ) &&
      shouldMergeDetachedFinalVowel(prevWord, letterCandidate, nextContextPlain)

    if (canMergeWithPrev) {
      merged[merged.length - 1] = `${prevRaw}${token}`
      continue
    }

    if (!token.includes('<') && tokenParts) {
      const missing = inferMissingFinalVowel(tokenParts.word, nextPlain)
      if (missing) {
        merged.push(`${tokenParts.word}${missing}${tokenParts.punctuation}`)
        continue
      }
    }

    merged.push(token)
  }

  return merged.join(' ')
}

function mergeDanglingLetterLines(lines: string[]): string[] {
  const merged: string[] = []
  for (const rawLine of lines) {
    const line = mergeSplitFinalLettersInLine(rawLine.trim())
    if (!line) continue

    if (isSingleLetterLine(line) && merged.length > 0 && endsWithLetter(merged[merged.length - 1])) {
      merged[merged.length - 1] += line
      continue
    }

    merged.push(line)
  }
  return merged
}

export function parseQuestionsText(rawText: string): ParsedQuestion[] {
  const gabaritoRegex = /GABARITOS?\s*COMENTADOS?/i
  const splitIndex = rawText.search(gabaritoRegex)

  const questionsText = splitIndex >= 0 ? rawText.slice(0, splitIndex) : rawText
  const gabaritoText  = splitIndex >= 0 ? rawText.slice(splitIndex) : ''
  const questionNumberHints = new Set(
    [...questionsText.matchAll(/(?:^|\n)[ \t]*(\d+)\s*[.)\-–—:]\s+/g)].map(m => parseInt(m[1], 10)),
  )

  // Parseia gabarito PRIMEIRO para obter números válidos de questão.
  // Isso permite distinguir questões reais de itens numerados dentro do texto de apoio.
  const answerMap     = gabaritoText ? parseGabaritoSection(gabaritoText, questionNumberHints) : {}
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
  if (/^(?:leia|considere|com base|a partir|baseado|analise|observe|texto\s*[\d:–-])/i.test(trimmed)) return trimmed
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
  return /^[ \t]*[a-eA-E][.)]\s+\S/m.test(text.slice(start, end))
}

function parseQuestionsSection(
  text: string,
  validNumbers: Set<number> = new Set(),
) {
  // Regex mais tolerante: aceita início de linha ou quebra de linha,
  // com ou sem espaços antes do número.
  // Guard extra: evita tratar padrões tipo "1. I. item" como novo início
  // de questão (listagens em algarismos romanos dentro do enunciado).
  const questionStartRegex = /(?:^|\n)[ \t]*(\d{1,3})\s*[.)\-–—:]\s+(?![IVXLCDM]+[.)]\s)/g
  let allMatches = [...text.matchAll(questionStartRegex)]

  // Fallback para não perder casos reais em que o enunciado começa direto com romano.
  if (allMatches.length === 0) {
    allMatches = [...text.matchAll(/(?:^|\n)[ \t]*(\d+)\s*[.)\-–—:]\s+/g)]
  }

  if (allMatches.length === 0) return []

  const hasValidNumbers = validNumbers.size > 0

  // ── Encontrar a primeira questão REAL ──────────────────────────────────────
  // Se há gabarito, ele é a âncora mais confiável para evitar falso início
  // em listas internas do enunciado (ex.: enumeração em itens).
  // Sem gabarito, usa detecção por bloco com alternativas.
  // Fallback: primeiro match qualquer.
  let firstRealIdx = hasValidNumbers
    ? allMatches.findIndex(m => validNumbers.has(parseInt(m[1], 10)))
    : allMatches.findIndex((_, i) => blockHasOptions(text, i, allMatches))

  if (firstRealIdx < 0 && !hasValidNumbers) {
    firstRealIdx = allMatches.findIndex((_, i) => blockHasOptions(text, i, allMatches))
  }
  if (firstRealIdx < 0) firstRealIdx = 0

  // ── Construir lista de matches válidos a partir da primeira questão real ───
  // Inclui matches que têm alternativas OU cujo número está no gabarito.
  // Se nenhum critério é aplicável (sem gabarito, sem alternativas), usa todos.
  const candidatesFromFirstReal = allMatches.slice(firstRealIdx)

  let matches = candidatesFromFirstReal.filter((m, relIdx) => {
    const absIdx = firstRealIdx + relIdx
    if (blockHasOptions(text, absIdx, allMatches)) return true
    if (hasValidNumbers && validNumbers.has(parseInt(m[1], 10))) return true
    return false
  })

  // Fallback: se o filtro zerou tudo, usa o slice sem filtro
  if (matches.length === 0) {
    matches = candidatesFromFirstReal
  }

  // Se o gabarito foi parcialmente identificado (ex.: formato alternativo),
  // evita subcontagem severa de questões C/E sem alternativas explícitas.
  if (hasValidNumbers && candidatesFromFirstReal.length > 0) {
    const ratio = matches.length / candidatesFromFirstReal.length
    if (ratio < 0.45) {
      matches = candidatesFromFirstReal
    }
  }

  // ── Filtro monotônico (PC / importação em lote) ───────────────────────────
  // Garante que os números de questão aceitos sejam estritamente crescentes.
  // Rejeita qualquer match cujo número seja <= ao último aceito.
  // Isso elimina falsos positivos sem exigir sequência estrita (aceita lacunas
  // como Q2→Q3→Q10, comuns quando a lista não começa em 1 ou tem questões ausentes).
  {
    const seq: RegExpExecArray[] = []
    let lastAccepted = -1
    for (const m of matches) {
      const n = parseInt(m[1], 10)
      if (n > lastAccepted) {
        seq.push(m)
        lastAccepted = n
      }
      // n <= lastAccepted → número repetido ou em ordem errada → falso positivo
    }
    if (seq.length > 0) matches = seq
  }

  // ── Contexto inicial: texto antes da primeira questão real ─────────────────
  const firstRealPos = matches[0].index ?? 0
  let currentContext = detectAssociatedText(text.slice(0, firstRealPos))

  const results: Omit<ParsedQuestion, 'correctAnswer' | 'comment'>[] = []

  for (let i = 0; i < matches.length; i++) {
    const match     = matches[i]
    const nextMatch = matches[i + 1]
    const number    = parseInt(match[1], 10)

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
  const lines = mergeDanglingLetterLines(text.split('\n'))

  // Permite espaços em branco antes da letra da alternativa (comum no mobile)
  const optionPattern = /^[ \t]*([a-eA-E])[.)]\s*(.+)/

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

function normalizeInlineGabaritoEntries(text: string, hintedNumbers: Set<number>): string {
  const tokenRegex = /(\d{1,3})\s*[.)\-–—:]\s*([A-Ea-e])(?=\s*(?:\(|GABARITO\b|[-–—:]|$))/g
  let lastPos = 0
  let out = ''

  for (const match of text.matchAll(tokenRegex)) {
    const idx = match.index ?? -1
    if (idx < 0) continue

    const number = parseInt(match[1], 10)
    if (Number.isNaN(number)) continue
    if (hintedNumbers.size > 0 && !hintedNumbers.has(number)) continue

    const prevChar = idx > 0 ? text[idx - 1] : '\n'
    if (prevChar === '\n') continue

    const isSeparator = /[\s>»|.;:!?\])]/.test(prevChar)
    if (!isSeparator) continue

    out += text.slice(lastPos, idx)
    if (!out.endsWith('\n')) out += '\n'
    lastPos = idx
  }

  out += text.slice(lastPos)
  return out
}

function parseGabaritoSection(
  text: string,
  hintedNumbers: Set<number> = new Set(),
): Record<number, { letter: string; comment: string }> {
  const normalizedHeaderText = text
    .replace(/(GABARITOS?\s*COMENTADOS?)\s*(?=\d+\s*[.)\-–—:]\s*[A-Ea-e]\b)/i, '$1\n')
    .replace(/(GABARITO\s*COMENTADO)\s*S\s*(?=\d+\s*[.)\-–—:]\s*[A-Ea-e]\b)/i, '$1\n')
  const normalizedText = normalizeInlineGabaritoEntries(normalizedHeaderText, hintedNumbers)

  // Matches "1. C" (sozinho) ou "1. C Comentário..." (mesma linha).
  // \b garante que a letra é isolada. Tolerante a múltiplos espaços e quebras.
  const answerLineRegex = /(?:^|\n)[ \t>*-]*(\d+)\s*[.)\-–—:]\s*([A-Ea-e])\b/g
  const matches = [...normalizedText.matchAll(answerLineRegex)]

  const map: Record<number, { letter: string; comment: string }> = {}

  for (let i = 0; i < matches.length; i++) {
    const match     = matches[i]
    const nextMatch = matches[i + 1]

    const number = parseInt(match[1], 10)
    const letter = match[2].toUpperCase()

    const commentStart = (match.index ?? 0) + match[0].length
    const commentEnd   = nextMatch?.index ?? normalizedText.length
    const commentRaw = normalizedText.slice(commentStart, commentEnd)
    const comment = mergeDanglingLetterLines(commentRaw.split('\n')).join('\n').trim()

    map[number] = { letter, comment }
  }

  return map
}
