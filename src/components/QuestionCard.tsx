import { useState, useEffect, useRef } from 'react'
import { Flag, ChevronDown, ChevronUp, Bookmark, Lightbulb, Scissors } from 'lucide-react'
import { cn, normalizeAnswer, displayAnswer } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { submitReport } from '@/lib/dataService'
import { sanitizeRichTextForRender } from '@/lib/richText'
import { toast } from 'sonner'
import type { Question } from '@/types'

interface QuestionCardProps {
  question: Question
  questionNumber: number
  totalQuestions: number
  // Controlled by parent — never derives state from these
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
}: QuestionCardProps) {
  const { user } = useAuth()

  // Only UI state lives here — never selection or submission
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const touchStartRef = useRef<Record<string, { x: number; y: number }>>({})
  const [associatedOpen, setAssociatedOpen] = useState(false)
  const [commentOpen, setCommentOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportText, setReportText] = useState('')

  // Reset UI-only state when question changes
  useEffect(() => {
    setAssociatedOpen(false)
    setCommentOpen(false)
    setReportOpen(false)
    setReportText('')
  }, [question.id])

  const safeSelected = normalizeAnswer(selected, question.type)
  const safeCorrect  = normalizeAnswer(question.correct_answer, question.type)

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
      await submitReport(question.id, user.id, reportText.trim())
      toast.success('Erro reportado!')
      setReportText('')
      setReportOpen(false)
    } catch {
      toast.error('Erro ao enviar reporte.')
    }
  }

  const options =
    question.type === 'true_false'
      ? [{ letter: 'C', text: 'Certo' }, { letter: 'E', text: 'Errado' }]
      : (question.options ?? [])

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Questão {questionNumber} de {totalQuestions}
          </span>
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            question.type === 'true_false'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-primary/10 text-primary'
          )}>
            {question.type === 'true_false' ? 'Certo / Errado' : 'Múltipla escolha'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setReportOpen(v => !v)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            title="Reportar erro"
          >
            <Flag size={16} />
          </button>
        </div>
      </div>

      {/* Report form */}
      {reportOpen && (
        <div className="rounded-lg border border-border bg-muted/50 p-3 flex flex-col gap-2">
          <p className="text-sm font-medium">Reportar erro na questão</p>
          <textarea
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Descreva o erro encontrado..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
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

      {/* Associated text — collapsible, only when present */}
      {question.associated_text && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 overflow-hidden">
          <button
            onClick={() => setAssociatedOpen(v => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/20 transition-colors"
          >
            <span>Texto associado {associatedOpen ? '(−)' : '(+)'}</span>
            {associatedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {associatedOpen && (
            <div className="border-t border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/10 px-4 py-3">
              <p
                className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: sanitizeRichTextForRender(question.associated_text) }}
              />
            </div>
          )}
        </div>
      )}

      {/* Statement */}
      <p className="text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeRichTextForRender(question.statement) }} />

      {/* Options */}
      <div className={cn('flex flex-col gap-2', question.type === 'true_false' && 'flex-row')}>
        {options.map(opt => {
          const optNorm      = normalizeAnswer(opt.letter, question.type)
          const isSelected   = safeSelected === optNorm
          const isCorrectOpt = optNorm === safeCorrect
          const isEliminated = !submitted && eliminated.has(opt.letter)
          const showScissors = question.type === 'multiple_choice' && !submitted

          return (
            <div
              key={opt.letter}
              className={cn(
                'flex items-center gap-1',
                question.type === 'true_false' && 'flex-1',
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
                  question.type === 'true_false' && 'justify-center',
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
                {question.type !== 'true_false' && (
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
              ? '✓ Resposta correta!'
              : `✗ Resposta incorreta — Gabarito: ${displayAnswer(question.correct_answer, question.type)}`}
          </p>
        </div>
      )}

      {/* Collapsible comment */}
      {submitted && question.comment && (
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
              <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeRichTextForRender(question.comment, true) }} />
              {question.legal_basis && (
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <Bookmark size={14} className="shrink-0 mt-0.5" />
                  <span><strong>Fundamento:</strong> {question.legal_basis}</span>
                </div>
              )}
              {question.exam_tips && (
                <div className="flex gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <Lightbulb size={14} className="shrink-0 mt-0.5" />
                  <span><strong>Dica:</strong> {question.exam_tips}</span>
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
