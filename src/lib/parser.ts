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
}

export function parseQuestionsText(rawText: string): ParsedQuestion[] {
  const gabaritoRegex = /GABARITO\s*COMENTADO/i
  const splitIndex = rawText.search(gabaritoRegex)

  const questionsText = splitIndex >= 0 ? rawText.slice(0, splitIndex) : rawText
  const gabaritoText = splitIndex >= 0 ? rawText.slice(splitIndex) : ''

  const questionMap = parseQuestionsSection(questionsText)
  const answerMap = gabaritoText ? parseGabaritoSection(gabaritoText) : {}

  return questionMap
    .sort((a, b) => a.number - b.number)
    .map(q => ({
      ...q,
      correctAnswer: answerMap[q.number]?.letter ?? '',
      comment: answerMap[q.number]?.comment ?? '',
    }))
}

function parseQuestionsSection(text: string) {
  // KEY FIX: old regex had $ at the end, requiring the number to be ALONE on
  // the line (e.g. "1." by itself). This broke the common format "1. Enunciado"
  // where number and text are on the same line.
  //
  // New regex: matches "1." or "1)" at the very start of a line (no leading
  // whitespace), followed by optional space. Text can follow on the same line.
  const questionStartRegex = /^(\d+)[.)]\s*/gm

  const matches = [...text.matchAll(questionStartRegex)]

  const results: Omit<ParsedQuestion, 'correctAnswer' | 'comment'>[] = []

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const nextMatch = matches[i + 1]
    const number = parseInt(match[1])

    // Block starts right after "1. " — so any text on that same line is included
    const blockStart = (match.index ?? 0) + match[0].length
    const blockEnd = nextMatch?.index ?? text.length
    const blockText = text.slice(blockStart, blockEnd)

    const { statement, options } = parseQuestionBlock(blockText)

    // Skip if no statement detected (avoids false positives on stray numbers)
    if (!statement.trim()) continue

    const isTrueFalse =
      options.length === 0 ||
      (options.length === 2 &&
        options.every(o => ['C', 'E'].includes(o.letter.toUpperCase())))

    results.push({
      number,
      statement,
      type: isTrueFalse ? 'true_false' : 'multiple_choice',
      options: isTrueFalse ? null : options,
    })
  }

  return results
}

function parseQuestionBlock(text: string) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  // Option line: starts with a single letter a-e followed by ) then text
  const optionPattern = /^([a-eA-E])\)\s*(.+)/

  const firstOptIdx = lines.findIndex(l => optionPattern.test(l))

  const statementLines = firstOptIdx >= 0 ? lines.slice(0, firstOptIdx) : lines
  const optionLines = firstOptIdx >= 0 ? lines.slice(firstOptIdx) : []

  const options: ParsedOption[] = optionLines
    .map(line => {
      const m = line.match(optionPattern)
      return m ? { letter: m[1].toUpperCase(), text: m[2].trim() } : null
    })
    .filter(Boolean) as ParsedOption[]

  const statement = statementLines
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { statement, options }
}

function parseGabaritoSection(text: string): Record<number, { letter: string; comment: string }> {
  // Matches "1. C" (alone) or "1. C Comment..." (same line).
  // \b ensures the letter is standalone — won't match "1. Cada..." (no boundary between C and a).
  const answerLineRegex = /^[ \t]*(\d+)[.)]\s+([A-Ea-e])\b/gm
  const matches = [...text.matchAll(answerLineRegex)]

  const map: Record<number, { letter: string; comment: string }> = {}

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const nextMatch = matches[i + 1]

    const number = parseInt(match[1])
    const letter = match[2].toUpperCase()

    const commentStart = (match.index ?? 0) + match[0].length
    const commentEnd = nextMatch?.index ?? text.length
    const comment = text
      .slice(commentStart, commentEnd)
      .replace(/^\s+/, '')
      .replace(/\s+$/, '')
      .trim()

    map[number] = { letter, comment }
  }

  return map
}
