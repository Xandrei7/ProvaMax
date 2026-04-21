import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag, ChevronDown, ChevronUp, Bookmark, Lightbulb, Scissors, BookOpen, Pencil, X, Check } from 'lucide-react'
import { cn, normalizeAnswer, displayAnswer } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { submitReport, saveQuestion } from '@/lib/dataService'
import { extractEmphasisFromHtml, sanitizeRichTextForRender } from '@/lib/richText'
import { toast } from 'sonner'
import type { Question, QuestionType } from '@/types'
import { QuestionChat } from './QuestionChat'

interface QuestionCardProps {
  question: Question
  questionNumber: number
  totalQuestions: number
  // Controlled by parent â€” never derives state from these
  selected: string | null
  submitted: boolean
  onSelect: (letter: string) => void
  onSubmit: () => void
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  isFirst: boolean
  isLast: boolean
  hidePrev?: boolean
  hideSkip?: boolean
  // Optional: parent can sync updated question data after admin saves
  onQuestionUpdate?: (updated: Question) => void
}

interface EditForm {
  type: QuestionType
  statement: string
  options: { letter: string; text: string }[]
  correct_answer: string
  comment: string
  legal_basis: string
  exam_tips: string
  associated_text: string
  specific_link: string
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selected,
  submitted,
  onSelect,
  onSubmit,
  onNext,
  onPrev,
  onSkip,
  isFirst,
  isLast,
  hidePrev = false,
  hideSkip = false,
  onQuestionUpdate,
}: QuestionCardProps) {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  // localQ: starts from prop, gets updated after admin saves â€” so UI reflects changes immediately
  const [localQ, setLocalQ] = useState<Question>(question)

  // Sync when parent passes a new question (navigation between questions)
  useEffect(() => {
    setLocalQ(question)
  }, [question.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Only UI state lives here â€” never selection or submission
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const touchStartRef = useRef<Record<string, { x: number; y: number }>>({})
  const [associatedOpen, setAssociatedOpen] = useState(false)
  const [commentOpen, setCommentOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportText, setReportText] = useState('')

  // Admin edit mode
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const commentRef = useRef<HTMLTextAreaElement>(null)

  function autoResizeMobileTextarea(el: HTMLTextAreaElement) {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(min-width: 768px)').matches) return
    el.style.height = 'auto'
    const nextHeight = Math.min(Math.max(el.scrollHeight, 144), 520)
    el.style.height = `${nextHeight}px`
  }

  function applyMark(color: 'yellow' | 'green') {
    const el = commentRef.current
    if (!el || !editForm) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start === end) { toast.error('Selecione um trecho do comentário primeiro'); return }
    const bg = color === 'yellow' ? '#fef08a' : '#86efac'
    const current = editForm.comment
    const next = current.substring(0, start) + `<mark style="background-color:${bg}">` + current.substring(start, end) + '</mark>' + current.substring(end)
    setEditForm({ ...editForm, comment: next })
    // Restore focus so the user can keep editing
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(end + 37 + (color === 'yellow' ? 7 : 7), end + 37 + (color === 'yellow' ? 7 : 7)) })
  }

  // Reset UI-only state when question changes
  useEffect(() => {
    setAssociatedOpen(false)
    setCommentOpen(false)
    setReportOpen(false)
    setReportText('')
    setEditMode(false)
    setEditForm(null)
  }, [question.id])

  useEffect(() => {
    if (!editMode) return
    if (!commentRef.current) return
    autoResizeMobileTextarea(commentRef.current)
  }, [editMode, localQ.id])

  const safeSelected = normalizeAnswer(selected, localQ.type)
  const safeCorrect  = normalizeAnswer(localQ.correct_answer, localQ.type)

  const isCorrect = safeSelected !== '' && safeSelected === safeCorrect

  function toggleEliminate(letter: string) {
    if (submitted) return
    setEliminated(prev => {
      const next = new Set(prev)
      if (next.has(letter)) next.delete(letter); else next.add(letter)
      return next
    })
  }

  async function handleReport() {
    if (!reportText.trim() || !user) return
    try {
      await submitReport(localQ.id, user.id, reportText.trim())
      toast.success('Erro reportado!')
      setReportText('')
      setReportOpen(false)
    } catch {
      toast.error('Erro ao enviar reporte.')
    }
  }

  // â”€â”€ Admin edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function openEdit() {
    setEditForm({
      type: localQ.type,
      statement: localQ.statement,
      options: localQ.options?.length
        ? localQ.options
        : [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }],
      correct_answer: localQ.correct_answer,
      comment: localQ.comment,
      legal_basis: localQ.legal_basis ?? '',
      exam_tips: localQ.exam_tips ?? '',
      associated_text: localQ.associated_text ?? '',
      specific_link: localQ.specific_link ?? '',
    })
    setEditMode(true)
    setReportOpen(false)
  }

  function cancelEdit() {
    setEditMode(false)
    setEditForm(null)
  }

  async function handleSaveEdit() {
    if (!editForm) return
    setSaving(true)
    try {
      await saveQuestion({
        id: localQ.id,
        statement: editForm.statement,
        type: editForm.type,
        options: editForm.type === 'multiple_choice' ? editForm.options : null,
        correct_answer: editForm.correct_answer,
        comment: editForm.comment,
        legal_basis: editForm.legal_basis || null,
        exam_tips: editForm.exam_tips || null,
        associated_text: editForm.associated_text || null,
        specific_link: editForm.specific_link.trim() || null,
        subject_id: localQ.subject_id,
        discipline_id: localQ.discipline_id,
        sort_order: localQ.sort_order,
      })
      const updated: Question = {
        ...localQ,
        statement: editForm.statement,
        type: editForm.type,
        options: editForm.type === 'multiple_choice' ? editForm.options : null,
        correct_answer: editForm.correct_answer,
        comment: editForm.comment,
        legal_basis: editForm.legal_basis || null,
        exam_tips: editForm.exam_tips || null,
        associated_text: editForm.associated_text || null,
        specific_link: editForm.specific_link.trim() || null,
      }
      setLocalQ(updated)
      onQuestionUpdate?.(updated)
      setEditMode(false)
      setEditForm(null)
      toast.success('Questão atualizada!')
    } catch {
      toast.error('Erro ao salvar questão.')
    } finally {
      setSaving(false)
    }
  }

  function addEditOption() {
    if (!editForm) return
    const letters = 'ABCDE'
    const next = letters[editForm.options.length] ?? 'X'
    setEditForm({ ...editForm, options: [...editForm.options, { letter: next, text: '' }] })
  }

  // â”€â”€ render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const options =
    localQ.type === 'true_false'
      ? [{ letter: 'C', text: 'Certo' }, { letter: 'E', text: 'Errado' }]
      : (localQ.options ?? [])

  // â”€â”€ Edit mode panel (admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (editMode && editForm && isAdmin) {
    return (
      <div className="flex flex-col gap-4">
        {/* Edit header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Questão {questionNumber} de {totalQuestions}
            </span>
            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              Modo edição
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editForm.statement.trim()}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <Check size={14} />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={cancelEdit}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              title="Cancelar edição"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Edit form */}
        <div className="rounded-xl border border-orange-200 dark:border-orange-800/50 bg-card p-4 flex flex-col gap-3">

          {/* specific_link â€” primeiro campo para acesso rÃ¡pido */}
          <input
            value={editForm.specific_link}
            onChange={e => setEditForm({ ...editForm, specific_link: e.target.value })}
            placeholder="Link específico (opcional) - ex: vídeo, mapa mental, artigo..."
            type="url"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {/* Type */}
          <select
            value={editForm.type}
            onChange={e => setEditForm({
              ...editForm,
              type: e.target.value as QuestionType,
              correct_answer: e.target.value === 'true_false' ? 'C' : 'A',
            })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="true_false">Certo / Errado</option>
            <option value="multiple_choice">Múltipla Escolha</option>
          </select>

          {/* Statement */}
          <textarea
            value={editForm.statement}
            onChange={e => setEditForm({ ...editForm, statement: e.target.value })}
            onPaste={e => {
              const html = e.clipboardData.getData('text/html')
              if (!html) return
              e.preventDefault()
              const sanitized = extractEmphasisFromHtml(html)
              const target = e.target as HTMLTextAreaElement
              const start = target.selectionStart
              const end = target.selectionEnd
              setEditForm(f => f ? { ...f, statement: f.statement.substring(0, start) + sanitized + f.statement.substring(end) } : f)
            }}
            placeholder="Enunciado *"
            rows={5}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
            style={{ minHeight: '6rem' }}
          />

          {/* Alternatives */}
          {editForm.type === 'multiple_choice' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alternativas</p>
              {editForm.options.map((opt, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="font-bold text-sm w-5 shrink-0 pt-1.5">{opt.letter}.</span>
                  <textarea
                    value={opt.text}
                    rows={2}
                    onChange={e => {
                      const opts = [...editForm.options]
                      opts[i] = { ...opts[i], text: e.target.value }
                      setEditForm({ ...editForm, options: opts })
                    }}
                    onPaste={e => {
                      const html = e.clipboardData.getData('text/html')
                      if (!html) return
                      e.preventDefault()
                      const text = extractEmphasisFromHtml(html)
                      const opts = [...editForm.options]
                      opts[i] = { ...opts[i], text }
                      setEditForm({ ...editForm, options: opts })
                    }}
                    placeholder={`Alternativa ${opt.letter}`}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                    style={{ minHeight: '4rem' }}
                  />
                </div>
              ))}
              {editForm.options.length < 5 && (
                <button
                  onClick={addEditOption}
                  className="text-sm text-primary hover:underline self-start"
                >
                  + Adicionar alternativa
                </button>
              )}
            </div>
          )}

          {/* Correct answer */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Gabarito *</p>
            {editForm.type === 'true_false' ? (
              <div className="flex gap-2">
                {['C', 'E'].map(v => (
                  <button
                    key={v}
                    onClick={() => setEditForm({ ...editForm, correct_answer: v })}
                    className={cn(
                      'rounded-md px-4 py-2 text-sm font-medium border transition-colors',
                      editForm.correct_answer === v
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary',
                    )}
                  >
                    {v === 'C' ? 'Certo' : 'Errado'}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {editForm.options.map(opt => (
                  <button
                    key={opt.letter}
                    onClick={() => setEditForm({ ...editForm, correct_answer: opt.letter })}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium border transition-colors',
                      editForm.correct_answer === opt.letter
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary',
                    )}
                  >
                    {opt.letter}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Comment â€” maior, expansÃ­vel, com marca-texto */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Comentário / explicação</p>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Marca-texto:</span>
                <button
                  type="button"
                  onClick={() => applyMark('yellow')}
                  className="rounded px-2 py-0.5 text-xs font-medium border border-border hover:border-yellow-400 transition-colors"
                  style={{ backgroundColor: '#fef08a', color: '#713f12' }}
                  title="Destacar em amarelo"
                >
                  Amarelo
                </button>
                <button
                  type="button"
                  onClick={() => applyMark('green')}
                  className="rounded px-2 py-0.5 text-xs font-medium border border-border hover:border-green-400 transition-colors"
                  style={{ backgroundColor: '#86efac', color: '#14532d' }}
                  title="Destacar em verde"
                >
                  Verde
                </button>
              </div>
            </div>
            <textarea
              ref={commentRef}
              value={editForm.comment}
              onChange={e => setEditForm({ ...editForm, comment: e.target.value })}
              onInput={e => autoResizeMobileTextarea(e.currentTarget)}
              onPaste={e => {
                const html = e.clipboardData.getData('text/html')
                if (!html) return
                e.preventDefault()
                const sanitized = extractEmphasisFromHtml(html, true)
                const target = e.target as HTMLTextAreaElement
                const start = target.selectionStart
                const end = target.selectionEnd
                setEditForm(f => f ? { ...f, comment: f.comment.substring(0, start) + sanitized + f.comment.substring(end) } : f)
              }}
              enterKeyHint="enter"
              placeholder="Comentário / explicação"
              rows={7}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ minHeight: '9rem' }}
            />
            <p className="text-xs text-muted-foreground/60">Selecione um trecho e clique em "Amarelo" ou "Verde" para destacar.</p>
          </div>

          {/* legal_basis */}
          <input
            value={editForm.legal_basis}
            onChange={e => setEditForm({ ...editForm, legal_basis: e.target.value })}
            placeholder="Fundamento Legal (opcional)"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {/* exam_tips */}
          <input
            value={editForm.exam_tips}
            onChange={e => setEditForm({ ...editForm, exam_tips: e.target.value })}
            placeholder="Dica de prova (opcional)"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {/* associated_text */}
          <textarea
            value={editForm.associated_text}
            onChange={e => setEditForm({ ...editForm, associated_text: e.target.value })}
            onPaste={e => {
              const html = e.clipboardData.getData('text/html')
              if (!html) return
              e.preventDefault()
              setEditForm(f => f ? { ...f, associated_text: extractEmphasisFromHtml(html) } : f)
            }}
            placeholder="Texto associado (opcional)"
            rows={2}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-y md:resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editForm.statement.trim()}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <Check size={14} />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50"
            >
              <X size={14} />
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // â”€â”€ Normal render (user view, or admin not in edit mode) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Questão {questionNumber} de {totalQuestions}
          </span>
          {localQ.type === 'true_false' ? (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Certo / Errado
            </span>
          ) : (
            <button
              onClick={() => navigate(`/theory/${localQ.subject_id}`)}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <BookOpen size={11} />
              Teoria
            </button>
          )}
          {localQ.specific_link && (
            <a
              href={localQ.specific_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors"
            >
              <BookOpen size={11} />
              Específico
            </a>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin ? (
            <button
              onClick={openEdit}
              className="rounded-md p-1.5 text-muted-foreground hover:text-orange-500 transition-colors"
              title="Editar questão (admin)"
            >
              <Pencil size={15} />
            </button>
          ) : (
            <button
              onClick={() => setReportOpen(v => !v)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              title="Reportar erro"
            >
              <Flag size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Report form â€” only for non-admin */}
      {!isAdmin && reportOpen && (
        <div className="rounded-lg border border-border bg-muted/50 p-3 flex flex-col gap-2">
          <p className="text-sm font-medium">Reportar erro na questão</p>
          <textarea
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Descreva o erro encontrado..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-y md:resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setReportOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={handleReport}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      {/* Associated text â€” collapsible, only when present */}
      {localQ.associated_text && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 overflow-hidden">
          <button
            onClick={() => setAssociatedOpen(v => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/20 transition-colors"
          >
            <span>Texto associado {associatedOpen ? '(âˆ’)' : '(+)'}</span>
            {associatedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {associatedOpen && (
            <div className="border-t border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/10 px-4 py-3">
              <p
                className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: sanitizeRichTextForRender(localQ.associated_text) }}
              />
            </div>
          )}
        </div>
      )}

      {/* Statement */}
      <p className="text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeRichTextForRender(localQ.statement) }} />

      {/* Options */}
      <div className={cn('flex flex-col gap-2', localQ.type === 'true_false' && 'flex-row')}>
        {options.map(opt => {
          const optNorm      = normalizeAnswer(opt.letter, localQ.type)
          const isSelected   = safeSelected === optNorm
          const isCorrectOpt = optNorm === safeCorrect
          const isEliminated = !submitted && eliminated.has(opt.letter)
          const showScissors = localQ.type === 'multiple_choice' && !submitted

          return (
            <div
              key={opt.letter}
              className={cn(
                'flex items-center gap-1',
                localQ.type === 'true_false' && 'flex-1',
                isEliminated && 'opacity-50',
              )}
            >
              <button
                onClick={() => { if (!submitted) onSelect(opt.letter) }}
                disabled={submitted}
                onTouchStart={showScissors ? e => {
                  touchStartRef.current[opt.letter] = { x: e.touches[0].clientX, y: e.touches[0].clientY }
                } : undefined}
                onTouchEnd={showScissors ? e => {
                  const start = touchStartRef.current[opt.letter]
                  if (!start) return
                  const dx = e.changedTouches[0].clientX - start.x
                  const dy = Math.abs(e.changedTouches[0].clientY - start.y)
                  if (Math.abs(dx) > 50 && Math.abs(dx) > dy) {
                    setEliminated(prev => {
                      const next = new Set(prev)
                      if (dx < 0) next.add(opt.letter); else next.delete(opt.letter)
                      return next
                    })
                  }
                } : undefined}
                className={cn(
                  'flex flex-1 items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                  localQ.type === 'true_false' && 'justify-center',
                  // Not answered yet
                  !submitted && !isSelected && 'border-border hover:border-primary hover:bg-primary/5',
                  !submitted && isSelected && 'border-primary bg-primary/10',
                  // Answered: correct option always green
                  submitted && isCorrectOpt && 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
                  // Answered: selected wrong option red
                  submitted && isSelected && !isCorrectOpt && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
                  // Answered: other wrong options faded
                  submitted && !isSelected && !isCorrectOpt && 'opacity-40',
                )}
              >
                {localQ.type !== 'true_false' && (
                  <span className={cn('font-bold shrink-0', isEliminated && 'line-through')}>{opt.letter}.</span>
                )}
                <span className={cn(isEliminated && 'line-through')} dangerouslySetInnerHTML={{ __html: sanitizeRichTextForRender(opt.text) }} />
              </button>
              {showScissors && (
                <button
                  onClick={() => toggleEliminate(opt.letter)}
                  className={cn(
                    'shrink-0 rounded p-1.5 transition-colors',
                    eliminated.has(opt.letter)
                      ? 'text-red-400 hover:text-muted-foreground'
                      : 'text-muted-foreground opacity-40 hover:opacity-100 hover:text-foreground',
                  )}
                  title={eliminated.has(opt.letter) ? 'Reativar alternativa' : 'Eliminar alternativa'}
                >
                  <Scissors size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Feedback banner */}
      {submitted && (
        <div className={cn(
          'rounded-lg p-3',
          isCorrect
            ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
            : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
        )}>
          <p className="font-medium text-sm">
            {isCorrect
              ? '\u2713 Resposta correta!'
              : `\u2717 Resposta incorreta \u2013 Gabarito: ${displayAnswer(localQ.correct_answer, localQ.type)}`}
          </p>
        </div>
      )}

      {/* Collapsible comment */}
      {submitted && localQ.comment && (
        <div className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setCommentOpen(v => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
          >
            Ver comentário
            {commentOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {commentOpen && (
            <div className="border-t border-border px-4 py-3 flex flex-col gap-3">
              {/* Chat da QuestÃ£o */}
              <div className="mt-2">
                <QuestionChat question={localQ} />
              </div>

              <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeRichTextForRender(localQ.comment, true) }} />
              {localQ.legal_basis && (
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <Bookmark size={14} className="shrink-0 mt-0.5" />
                  <span><strong>Fundamento:</strong> {localQ.legal_basis}</span>
                </div>
              )}
              {localQ.exam_tips && (
                <div className="flex gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <Lightbulb size={14} className="shrink-0 mt-0.5" />
                  <span><strong>Dica:</strong> {localQ.exam_tips}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 pt-1">
        {!hidePrev && !isFirst && (
          <button
            onClick={onPrev}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50"
          >
            Anterior
          </button>
        )}

        {!submitted ? (
          <>
            <button
              onClick={onSubmit}
              disabled={!selected}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              Responder questão
            </button>
            {!hideSkip && !isLast && (
              <button
                onClick={onSkip}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50"
              >
                Pular
              </button>
            )}
          </>
        ) : (
          <button
            onClick={onNext}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {isLast ? 'Finalizar' : 'Próxima questão'}
          </button>
        )}
      </div>
    </div>
  )
}

