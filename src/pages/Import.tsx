import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Upload, CheckCircle2, XCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { parseQuestionsText, type ParsedQuestion } from '@/lib/parser'
import { extractEmphasisFromHtml } from '@/lib/richText'
import { getDisciplines, getSubjects, getSubjectParts, getQuestions } from '@/lib/dataService'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Discipline, Subject, SubjectPart } from '@/types'

// Importante: não usar marcador com ponto (ex.: "e. "),
// porque isso colide com final normal de frase/palavra e separa a última letra.
const INLINE_ALT_MARKER_REGEX = /(^|[^\n\s])([a-eA-E]\)\s)/g


function getPreviousVisibleChar(text: string, markerStart: number): string {
  let cursor = markerStart - 1

  while (cursor >= 0) {
    const char = text[cursor]

    if (/[\u200B-\u200D\uFEFF]/.test(char) || /\p{M}/u.test(char)) {
      cursor -= 1
      continue
    }

    if (char === '>') {
      const tagStart = text.lastIndexOf('<', cursor)
      if (tagStart >= 0) {
        cursor = tagStart - 1
        continue
      }
    }

    return char
  }

  return ''
}

function normalizeInlineAlternativeBreaks(text: string, regex: RegExp): string {
  return text.replace(regex, (fullMatch, prefix, marker, offset: number, source: string) => {
    if (!prefix) return fullMatch

    const lineStart = source.lastIndexOf('\n', offset) + 1
    const lineEndRaw = source.indexOf('\n', offset)
    const lineEnd = lineEndRaw === -1 ? source.length : lineEndRaw
    const currentLine = source.slice(lineStart, lineEnd)
    const lineMarkers = [...currentLine.matchAll(/[a-eA-E]\)\s/g)].map(m => m[0][0].toUpperCase())
    const lineHasInlineOptionBlock =
      lineMarkers.length >= 3 &&
      lineMarkers.includes('A') &&
      lineMarkers.includes('B') &&
      lineMarkers.includes('C')

    if (!lineHasInlineOptionBlock) {
      return fullMatch
    }

    const markerStart = offset + prefix.length
    const previousVisibleChar = getPreviousVisibleChar(source, markerStart)

    if (/\p{L}/u.test(previousVisibleChar)) {
      return fullMatch
    }

    return `${prefix}\n${marker}`
  })
}

type CollapsedAlternativeMarker = {
  index: number
  letter: string
}

const MAX_COLLAPSED_ALT_MARKER_GAP = 380
const MAX_COLLAPSED_ALT_RUN_SPAN = 1400
const MAX_COLLAPSED_ALT_LINE_BREAKS = 1

function findCollapsedAlternativeRun(text: string): CollapsedAlternativeMarker[] {
  const markerRegex = /([^\n\sA-Za-zÀ-ÿ])([A-E])([a-z\u00C0-\u00FF]{2,})/g
  const markers: CollapsedAlternativeMarker[] = []

  for (const match of text.matchAll(markerRegex)) {
    const matchIndex = match.index ?? -1
    if (matchIndex < 0) continue
    markers.push({ index: matchIndex + match[1].length, letter: match[2] })
  }

  if (markers.length < 4) return []

  let bestRun: CollapsedAlternativeMarker[] = []

  for (let i = 0; i < markers.length; i++) {
    if (markers[i].letter !== 'A') continue

    const run: CollapsedAlternativeMarker[] = [markers[i]]
    let expectedCode = 'B'.charCodeAt(0)

    for (let j = i + 1; j < markers.length && expectedCode <= 'E'.charCodeAt(0); j++) {
      const previousMarker = run[run.length - 1]
      const gap = markers[j].index - previousMarker.index
      if (gap > MAX_COLLAPSED_ALT_MARKER_GAP) break

      if (markers[j].letter.charCodeAt(0) === expectedCode) {
        run.push(markers[j])
        expectedCode++
      }
    }

    if (run.length < 4) continue

    const runSpan = run[run.length - 1].index - run[0].index
    if (runSpan > MAX_COLLAPSED_ALT_RUN_SPAN) continue

    const runSegment = text.slice(run[0].index, run[run.length - 1].index)
    const runLineBreaks = runSegment.match(/\n/g)?.length ?? 0
    if (runLineBreaks > MAX_COLLAPSED_ALT_LINE_BREAKS) continue

    const bestSpan =
      bestRun.length > 0
        ? bestRun[bestRun.length - 1].index - bestRun[0].index
        : Number.POSITIVE_INFINITY

    if (run.length > bestRun.length || (run.length === bestRun.length && runSpan < bestSpan)) {
      bestRun = run
    }
  }

  return bestRun
}

function normalizeCollapsedAlternativeRun(text: string, run: CollapsedAlternativeMarker[]): string {
  if (run.length === 0) return text

  let normalized = text
  let offset = 0

  for (const marker of run) {
    const markerIndex = marker.index + offset
    normalized = `${normalized.slice(0, markerIndex)}\n${marker.letter}) ${normalized.slice(markerIndex + 1)}`
    offset += 3
  }

  return normalized
}

type StudyNowImportState = {
  fromStudyNow?: boolean
  disciplina?: string
  assunto?: string
  semana?: number
  dia?: string
}

function normStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').trim()
}

interface EmbeddedImportProps {
  embedded?: boolean
  initialContext?: { disciplina: string; assunto: string; parte?: string }
  onSuccess?: (count: number) => void
  onCancel?: () => void
}

export function Import({ embedded, initialContext, onSuccess, onCancel }: EmbeddedImportProps = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const fromStudyNowState = embedded && initialContext
    ? { fromStudyNow: true as const, disciplina: initialContext.disciplina, assunto: initialContext.assunto }
    : (location.state as StudyNowImportState | null)?.fromStudyNow
      ? (location.state as StudyNowImportState)
      : null

  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [availableParts, setAvailableParts] = useState<SubjectPart[]>([])
  const [disciplineName, setDisciplineName] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [partName, setPartName] = useState('')
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedQuestion[] | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const disciplinePrePopRef = useRef(false)
  const subjectPrePopRef = useRef(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    getDisciplines().then(setDisciplines)
  }, [])

  // Pré-popula disciplina vinda do StudyNow (roda uma única vez quando disciplines carrega)
  useEffect(() => {
    if (disciplinePrePopRef.current) return
    if (!fromStudyNowState?.disciplina || disciplines.length === 0) return
    disciplinePrePopRef.current = true
    const planDisc = fromStudyNowState.disciplina
    const match = disciplines.find(d =>
      normStr(d.name).includes(normStr(planDisc)) || normStr(planDisc).includes(normStr(d.name))
    )
    setDisciplineName(match ? match.name : planDisc)
  }, [fromStudyNowState, disciplines])

  useEffect(() => {
    const disc = disciplines.find(d => d.name.trim().toLowerCase() === disciplineName.trim().toLowerCase())
    if (!disc) { setSubjects([]); setSubjectName(''); setAvailableParts([]); setPartName(''); return }
    getSubjects(disc.id).then(setSubjects)
  }, [disciplineName, disciplines])

  // Pré-popula assunto vindo do StudyNow (roda quando subjects carrega após a disciplina ser definida)
  useEffect(() => {
    if (subjectPrePopRef.current) return
    if (!fromStudyNowState?.assunto || subjects.length === 0) return
    subjectPrePopRef.current = true
    const baseAssunto = fromStudyNowState.assunto.split(' — ')[0].trim()
    // Não pré-popula se for bateria acumulada (não existe subject literal para isso)
    if (normStr(baseAssunto).includes('acumulad')) return
    const match = subjects.find(s =>
      normStr(s.name).includes(normStr(baseAssunto)) || normStr(baseAssunto).includes(normStr(s.name))
    )
    setSubjectName(match ? match.name : baseAssunto)
  }, [fromStudyNowState, subjects])

  useEffect(() => {
    const sub = subjects.find(s => s.name.trim().toLowerCase() === subjectName.trim().toLowerCase())
    if (!sub) { setAvailableParts([]); setPartName(''); return }
    getSubjectParts(sub.id).then(setAvailableParts)
  }, [subjectName, subjects])

  // Fingerprint local (evita depender de módulo externo durante o parse)
  function _fpLocal(statement: string, options: { letter: string; text: string }[] | null | undefined): string {
    const clean = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    let core = clean(statement)
    core = core.replace(/^\s*\([^)]{0,150}\)\s*/, '')
    core = core.replace(/^\s*\[[^\]]{0,150}\]\s*/, '')
    core = core.replace(/^(?:[\w/]+\s*[-–]\s*){2,}/i, '').trim()
    return core + '\x01' + (options ?? []).map(o => clean(o.text)).join('\x00')
  }

  function handleParse() {
    if (!disciplineName.trim()) return toast.error('Informe o nome da Matéria.')
    if (!subjectName.trim()) return toast.error('Informe o nome do Assunto.')

    // Captura o valor diretamente do Ref (DOM) para garantir valor real no Mobile
    const currentRawText = textareaRef.current?.value || rawText
    if (!currentRawText.trim()) return toast.error('Cole as questões no campo de texto.')

    setParsing(true)

    try {
      // Normalização inicial para Mobile (Causa: falta de quebras de linha ou caracteres exóticos)
      let text = normalizeInlineAlternativeBreaks(
        currentRawText
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .normalize('NFC')
          .replace(/\u00A0/g, ' ')
          .replace(/[\u200B-\u200D\uFEFF]/g, '')
          .replace(/\u00AD/g, ''),
        INLINE_ALT_MARKER_REGEX,
      ).trim()

      // --- CAMADA ADITIVA MOBILE ISOLADA (Alternativas colapsadas) ---
      // Só ativa se NÃO houver alternativas já formatadas (a) / A) ).
      // Se o texto já tem "a) " ou "A) ", ele vem do PC com formato correto
      // e o heurístico de colapso NÃO deve tocar nele.
      const hasProperAlternatives = /^[ \t]*[a-eA-E][.)]\s/m.test(text)
      if (!hasProperAlternatives) {
        const collapsedRun = findCollapsedAlternativeRun(text)
        if (collapsedRun.length > 0) {
          text = normalizeCollapsedAlternativeRun(text, collapsedRun)
        }
      }
      // ---------------------------------------------------------------

      // Normalização agressiva para mobile (Causa Raiz: falta de quebras de linha em colagens mobile)
      const finalNormalizedText = text
        .replace(/\n{2,}/g, '\n\n') // Reduz excessos
        .replace(/(\n|^)([ \t]+)(\d+[.)]\s+)/g, '$1$3') // Remove espaços antes de números
        // Caso o texto não tenha NENHUMA quebra de linha (colagem compacta mobile)
        // Tenta inserir quebras antes de números de questão.
        // [^ \n0-9] exclui dígitos do trigger para não quebrar números dentro de
        // outros números (ex: não transformar "2025)" em "2\n025)" nem "10." em "1\n0."):
        .replace(/([^ \n0-9])(\d+[.)]\s+[A-Z])/g, '$1\n$2')
        // Garante que o Gabarito esteja isolado
        .replace(/([^\n])(GABARITO\s*COMENTADO)/i, '$1\n\n$2')
        .replace(/(GABARITO\s*COMENTADO)([^\n])/i, '$1\n\n$2')

      const normalizedForAlternatives = normalizeInlineAlternativeBreaks(finalNormalizedText, INLINE_ALT_MARKER_REGEX)

      const questions = parseQuestionsText(normalizedForAlternatives)
      console.log("Total identificadas:", questions.length)

      if (questions.length === 0) {
        return toast.error(
          'Nenhuma questão encontrada. Verifique se o texto está no formato correto:\n"1.\nEnunciado\na) opção\nb) opção\n...\nGABARITO COMENTADO\n1. C\nComentário..."'
        )
      }

      const selectedDisciplineId =
        disciplines.find(d => d.name.trim().toLowerCase() === disciplineName.trim().toLowerCase())?.id ?? ''
      const selectedSubjectId =
        subjects.find(s => s.name.trim().toLowerCase() === subjectName.trim().toLowerCase())?.id ?? ''

      const mappedQuestions = questions.map(q => ({
        ...q,
        disciplineId: selectedDisciplineId,
        subjectId: selectedSubjectId,
      }))

      const semGabarito = mappedQuestions.filter(q => !q.correctAnswer)
      if (semGabarito.length > 0) {
        toast.warning(
          `${semGabarito.length} questão(ões) sem gabarito identificado. Verifique o formato do GABARITO COMENTADO.`
        )
      }

      setParsed(mappedQuestions)
      toast.success(`${mappedQuestions.length} questões identificadas! Confira e clique em Importar.`)
    } finally {
      setParsing(false)
    }
  }

  async function handleSave() {
    if (!parsed || !disciplineName.trim() || !subjectName.trim()) return
    setSaving(true)

    try {
      // 1. Discipline: find existing or create
      let discId: string
      const existingDisc = disciplines.find(
        d => d.name.trim().toLowerCase() === disciplineName.trim().toLowerCase()
      )

      if (existingDisc) {
        discId = existingDisc.id
      } else {
        const { data, error } = await supabase
          .from('disciplines')
          .insert({ name: disciplineName.trim(), icon: '📖' })
          .select('id')
          .single()
        if (error) throw error
        discId = data.id
      }

      // 2. Subject: find existing in this discipline or create
      const existingSubs = await getSubjects(discId)
      const existingSub = existingSubs.find(
        s => s.name.trim().toLowerCase() === subjectName.trim().toLowerCase()
      )

      let subId: string
      if (existingSub) {
        subId = existingSub.id
      } else {
        const { data, error } = await supabase
          .from('subjects')
          .insert({
            name: subjectName.trim(),
            discipline_id: discId,
            sort_order: existingSubs.length + 1,
          })
          .select('id')
          .single()
        if (error) throw error
        subId = data.id
      }

      // 3. Part: find existing or create (opcional)
      let partId: string | null = null
      if (partName.trim()) {
        const existingParts = await getSubjectParts(subId)
        const existingPart = existingParts.find(
          p => p.name.trim().toLowerCase() === partName.trim().toLowerCase()
        )
        if (existingPart) {
          partId = existingPart.id
        } else {
          const { data, error } = await supabase
            .from('subject_parts')
            .insert({ name: partName.trim(), subject_id: subId, sort_order: existingParts.length + 1 })
            .select('id')
            .single()
          if (error) throw error
          partId = data.id
        }
      }

      // 4. Duplicate guard: filter out questions already in the DB
      const existingQs = await getQuestions({ disciplineId: discId })
      const existingFps = new Set(existingQs.map(q => _fpLocal(q.statement, q.options)))
      const toInsert = parsed.filter(q => !existingFps.has(_fpLocal(q.statement, q.options)))
      const skipped = parsed.length - toInsert.length
      if (toInsert.length === 0) {
        toast.warning('Todas as questões já existem na base. Nenhuma nova questão foi importada.')
        return
      }
      if (skipped > 0) {
        toast.info(`${skipped} questão(ões) já existia(m) na base e foi(ram) ignorada(s).`)
      }

      // 5. Insert questions
      const rows = toInsert.map((q: ParsedQuestion, i: number) => ({
        statement: q.statement,
        type: q.type,
        options: q.type === 'multiple_choice' ? q.options : null,
        correct_answer: q.correctAnswer || 'C',
        comment: q.comment || '',
        legal_basis: null,
        exam_tips: null,
        associated_text: q.associatedText ?? null,
        part_id: partId,
        subject_id: subId,
        discipline_id: discId,
        sort_order: i + 1,
      }))

      const { error } = await supabase.from('questions').insert(rows)
      if (error) throw error

      toast.success(`${toInsert.length} questões importadas com sucesso!`)
      if (embedded && onSuccess) {
        onSuccess(toInsert.length)
      } else if (partId) {
        navigate(`/study/${subId}/part/${partId}`)
      } else {
        navigate(`/study/${subId}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData('text/html')
    if (!html) {
      // No mobile, muitas vezes só temos o plain text.
      // Deixamos o evento padrão (onChange) lidar com isso para não quebrar o comportamento do teclado.
      return
    }

    // Se temos HTML (comum vindo do QConcursos no Desktop ou alguns browsers mobile),
    // processamos para manter o negrito/itálico.
    e.preventDefault()
    const sanitized = extractEmphasisFromHtml(html)
    
    // Inserção inteligente: tenta inserir na posição do cursor
    const target = e.target as HTMLTextAreaElement
    const start = target.selectionStart
    const end = target.selectionEnd
    const currentText = rawText
    const newText = currentText.substring(0, start) + sanitized + currentText.substring(end)
    
    setRawText(newText)
    
    // Feedback visual para o usuário
    toast.info('Texto formatado inserido com sucesso!')
  }

  function handleClear() {
    if (!rawText) return
    if (window.confirm('Limpar todo o texto colado?')) {
      setRawText('')
      setParsed(null)
    }
  }

  function reset() {
    setParsed(null)
    setExpandedIdx(null)
    setPartName('')
  }

  const innerContent = (
    <>
      {embedded && onCancel && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">Importar Questões</p>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded border border-border"
          >
            ✕ Fechar
          </button>
        </div>
      )}

      {!parsed ? (
          /* ── STEP 1: paste ── */
          <div className="flex flex-col gap-5">

            {/* Banner de contexto do StudyNow */}
            {fromStudyNowState && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/50 px-4 py-3">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  Importando para: <strong>{fromStudyNowState.disciplina}</strong>
                  {fromStudyNowState.assunto && (
                    <> › <strong>{fromStudyNowState.assunto.split(' — ')[0]}</strong></>
                  )}
                </p>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/70 mt-0.5">
                  Disciplina pré-selecionada. Ajuste assunto/parte conforme necessário ou crie novos inline.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-3">1. Informe a Matéria e o Assunto</p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Matéria {disciplines.length > 0 && '(existentes: ' + disciplines.map(d => d.name).join(', ') + ')'}
                  </label>
                  <input
                    list="disciplines-list"
                    value={disciplineName}
                    onChange={e => setDisciplineName(e.target.value)}
                    placeholder="Ex: Lei nº 963/2014"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <datalist id="disciplines-list">
                    {disciplines.map(d => <option key={d.id} value={d.name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Assunto{' '}
                    <span className="text-muted-foreground/60">
                      {subjects.length > 0 ? `(${subjects.length} existentes — ou digite novo)` : '(ou digite novo assunto)'}
                    </span>
                  </label>
                  <input
                    list="subjects-list"
                    value={subjectName}
                    onChange={e => setSubjectName(e.target.value)}
                    placeholder={disciplineName ? 'Selecione ou digite novo assunto...' : 'Informe a Matéria primeiro'}
                    disabled={!disciplineName.trim()}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                  <datalist id="subjects-list">
                    {subjects.map(s => <option key={s.id} value={s.name} />)}
                  </datalist>
                  {!disciplineName.trim() && (
                    <p className="mt-1 text-xs text-muted-foreground">Informe a Matéria para ver assuntos disponíveis.</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Parte{' '}
                    <span className="text-muted-foreground/60">
                      {availableParts.length > 0 ? `(${availableParts.length} existentes — ou crie nova)` : '(opcional — deixe vazio para assunto geral)'}
                    </span>
                  </label>
                  <input
                    list="parts-list"
                    value={partName}
                    onChange={e => setPartName(e.target.value)}
                    placeholder={subjectName ? 'Selecione parte, crie nova ou deixe vazio' : 'Informe o Assunto primeiro'}
                    disabled={!subjectName.trim()}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                  <datalist id="parts-list">
                    {availableParts.map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
                  {subjectName.trim() && availableParts.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">Nenhuma parte ainda. Digite um nome para criar nova parte inline.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm font-semibold">2. Cole aqui as questões + gabarito</p>
                {rawText && (
                  <button 
                    onClick={handleClear}
                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    Limpar texto
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                No celular, você pode colar normalmente o conteúdo do QConcursos.
              </p>
              <textarea
                ref={textareaRef}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                onPaste={handlePaste}
                rows={isMobile ? 12 : 16}
                placeholder={`Cole o conteúdo aqui...\n\nExemplo:\n1. Enunciado\na) Opção\n...\nGABARITO COMENTADO\n1. A\nExplicação...`}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary min-h-[300px]"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            </div>

            <button
              onClick={() => { void handleParse() }}
              disabled={!disciplineName || !subjectName || !rawText || parsing}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {parsing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {parsing ? 'Verificando...' : 'Identificar questões'}
            </button>
          </div>
        ) : (
          /* ── STEP 2: preview + confirm ── */
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900/50 p-4">
              <p className="font-semibold text-green-700 dark:text-green-400">
                {parsed.length} questões identificadas
              </p>
              <p className="text-sm text-green-600/80 dark:text-green-400/70">
                Matéria: <strong>{disciplineName}</strong> · Assunto: <strong>{subjectName}</strong>
                {partName.trim() && <> · Parte: <strong>{partName}</strong></>}
              </p>
            </div>

            {/* Preview list */}
            <div className="flex flex-col gap-2">
              {parsed.map((q: ParsedQuestion, i: number) => (
                <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/30"
                  >
                    <span className={cn(
                      'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold',
                      q.type === 'true_false'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-primary/10 text-primary'
                    )}>
                      {q.type === 'true_false' ? 'C/E' : 'MC'}
                    </span>
                    <div className="flex-1 min-w-0">
                      {q.statement ? (
                        <p className="text-sm line-clamp-2" dangerouslySetInnerHTML={{ __html: q.statement }} />
                      ) : (
                        <p className="text-sm line-clamp-2 text-red-500 italic">⚠ Enunciado não detectado</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {q.correctAnswer ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 size={12} /> Gabarito: {q.correctAnswer}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-500">
                            <XCircle size={12} /> Sem gabarito
                          </span>
                        )}
                        {q.comment && (
                          <span className="text-xs text-muted-foreground">· Com comentário</span>
                        )}
                        {q.associatedText && (
                          <span className="text-xs text-blue-600 font-medium">· Texto associado</span>
                        )}
                      </div>
                    </div>
                    {expandedIdx === i ? <ChevronUp size={14} className="shrink-0 mt-1 text-muted-foreground" /> : <ChevronDown size={14} className="shrink-0 mt-1 text-muted-foreground" />}
                  </button>

                  {expandedIdx === i && (
                    <div className="border-t border-border px-4 py-3 flex flex-col gap-3 text-sm">
                      {q.associatedText && (
                        <div>
                          <p className="text-xs font-semibold text-blue-600 mb-1">TEXTO ASSOCIADO</p>
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: q.associatedText ?? '' }} />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">ENUNCIADO</p>
                        <p dangerouslySetInnerHTML={{ __html: q.statement }} />
                      </div>
                      {q.options && q.options.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">ALTERNATIVAS</p>
                          <div className="flex flex-col gap-1.5 mt-2 ml-1 border-l-2 border-primary/20 pl-3">
                            {q.options.map((opt: { letter: string; text: string }) => (
                              <div key={opt.letter} className={cn(
                                'text-sm',
                                opt.letter === q.correctAnswer ? 'text-green-600 font-semibold' : 'text-muted-foreground'
                              )}>
                                <span className="font-bold mr-1">{opt.letter})</span>
                                <span dangerouslySetInnerHTML={{ __html: opt.text }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {q.comment && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">COMENTÁRIO</p>
                          <p className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: q.comment }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={reset}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium hover:bg-muted/50"
              >
                Editar texto
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? (
                  <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                ) : (
                  <><CheckCircle2 size={16} /> Confirmar importação</>
                )}
              </button>
            </div>
          </div>
        )}
    </>
  )

  if (embedded) {
    return <div className="flex flex-col gap-0">{innerContent}</div>
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Importar Questões" showBack />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-10">
        {innerContent}
      </main>
    </div>
  )
}
