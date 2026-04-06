import { useState, useEffect } from 'react'
import { Heart, Flag, ChevronDown, ChevronUp, Bookmark, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useStudy } from '@/contexts/StudyContext'
import { submitReport } from '@/lib/dataService'
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
}: QuestionCardProps) {
  const { user } = useAuth()
  const { toggleFavorite, isFavorite } = useStudy()

  // Only UI state lives here — never selection or submission
  const [commentOpen, setCommentOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportText, setReportText] = useState('')

  // Reset UI-only state when question changes
  useEffect(() => {
    setCommentOpen(false)
    setReportOpen(false)
    setReportText('')
  }, [question.id])

  const isCorrect = selected === question.correct_answer

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
          <button
            onClick={() => toggleFavorite(question.id)}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              isFavorite(question.id) ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
            )}
            title={isFavorite(question.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Heart size={16} fill={isFavorite(question.id) ? 'currentColor' : 'none'} />
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

      {/* Statement */}
      <p className="text-base leading-relaxed">{question.statement}</p>

      {/* Options */}
      <div className={cn('flex flex-col gap-2', question.type === 'true_false' && 'flex-row')}>
        {options.map(opt => {
          const isSelected = selected === opt.letter
          const isCorrectOpt = opt.letter === question.correct_answer

          return (
            <button
              key={opt.letter}
              onClick={() => { if (!submitted) onSelect(opt.letter) }}
              disabled={submitted}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                question.type === 'true_false' && 'flex-1 justify-center',
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
                <span className="font-bold shrink-0">{opt.letter}.</span>
              )}
              <span>{opt.text}</span>
            </button>
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
              : `✗ Resposta incorreta — Gabarito: ${question.correct_answer}`}
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
              <p className="text-sm leading-relaxed">{question.comment}</p>
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
        {!isFirst && (
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
            {!isLast && (
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
