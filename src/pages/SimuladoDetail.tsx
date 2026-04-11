import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Target, CheckCircle2, XCircle, BrainCircuit, RotateCcw, ChevronRight } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import { ProgressBar } from '@/components/ProgressBar'
import {
  getSimuladoById,
  getSimuladoQuestions,
  getQuestionsByIds,
  getDisciplines,
  getSubjects,
  generateFlashcard,
} from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import { useAuth } from '@/contexts/AuthContext'
import { cn, normalizeAnswer, displayAnswer } from '@/lib/utils'
import type { SimuladoRecord, SimuladoQuestion, Question, Discipline, Subject } from '@/types'

type Phase = 'detail' | 'reviewing' | 'review_result'

interface ReviewAnswer {
  questionId: string
  selected: string | null
  isCorrect: boolean
}

// Recompute correctness from snapshot values — never trust stored is_correct.
// questionType é obtido do map de questões e garante normalização correta por tipo.
function isSnapshotCorrect(
  selectedAnswer: string | null,
  correctAnswer: string,
  questionType?: string,
): boolean {
  if (!selectedAnswer) return false
  return (
    normalizeAnswer(selectedAnswer, questionType) ===
    normalizeAnswer(correctAnswer, questionType)
  )
}

interface WrongItem {
  sq: SimuladoQuestion
  question: Question
}

function formatDuration(secs: number | null) {
  if (!secs) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}min ${s}s`
  return `${s}s`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function AccuracyColor(p: number) {
  if (p >= 70) return 'text-green-500'
  if (p >= 50) return 'text-amber-500'
  return 'text-red-500'
}

// ── Inline review question card ───────────────────────────────────────────────

interface ReviewCardProps {
  question: Question
  // Authoritative correct answer from simulado_questions snapshot —
  // ALWAYS use this for display and validation, never question.correct_answer
  authorizedCorrectAnswer: string
  index: number
  total: number
  onAnswer: (selected: string) => void
}

function ReviewCard({ question, authorizedCorrectAnswer, index, total, onAnswer }: ReviewCardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const safeCorrect = normalizeAnswer(authorizedCorrectAnswer, question.type)

  const options =
    question.type === 'true_false'
      ? [{ letter: 'C', text: 'Certo' }, { letter: 'E', text: 'Errado' }]
      : (question.options ?? [])

  function handleSubmit() {
    if (!selected) return
    setSubmitted(true)
  }

  function handleNext() {
    onAnswer(selected!)
  }

  const userGotItRight = submitted && selected !== null && normalizeAnswer(selected, question.type) === safeCorrect

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Revisão · Questão {index + 1} de {total}</span>
        <span className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          question.type === 'true_false' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
        )}>
          {question.type === 'true_false' ? 'C/E' : 'Múltipla escolha'}
        </span>
      </div>

      <p className="text-base leading-relaxed">{question.statement}</p>

      <div className={cn('flex flex-col gap-2', question.type === 'true_false' && 'flex-row')}>
        {options.map(opt => {
          const optNorm      = normalizeAnswer(opt.letter, question.type)
          const isCorrectOpt = optNorm === safeCorrect
          const isSelected   = selected !== null && normalizeAnswer(selected, question.type) === optNorm
          let cls = 'flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors'
          if (submitted) {
            if (isCorrectOpt)        cls += ' border-green-500 bg-green-50 dark:bg-green-950/30'
            else if (isSelected)     cls += ' border-red-500 bg-red-50 dark:bg-red-950/30'
            else                     cls += ' border-border opacity-60'
          } else {
            cls += isSelected
              ? ' border-primary bg-primary/10'
              : ' border-border hover:border-primary hover:bg-primary/5 cursor-pointer'
          }
          if (question.type === 'true_false') cls += ' flex-1 justify-center'
          return (
            <button
              key={opt.letter}
              disabled={submitted}
              onClick={() => !submitted && setSelected(opt.letter)}
              className={cls}
            >
              {question.type !== 'true_false' && <span className="font-bold shrink-0">{opt.letter}.</span>}
              <span dangerouslySetInnerHTML={{ __html: opt.text }} />
              {submitted && isCorrectOpt && <CheckCircle2 size={15} className="text-green-500 shrink-0 ml-auto" />}
              {submitted && isSelected && !isCorrectOpt && <XCircle size={15} className="text-red-500 shrink-0 ml-auto" />}
            </button>
          )
        })}
      </div>

      {/* Feedback after submission */}
      {submitted && (
        <div className={cn(
          'rounded-xl border p-4 text-sm flex flex-col gap-2',
          userGotItRight
            ? 'border-green-500/30 bg-green-50 dark:bg-green-950/20'
            : 'border-red-500/30 bg-red-50 dark:bg-red-950/20'
        )}>
          <p className={cn(
            'font-semibold',
            userGotItRight ? 'text-green-600' : 'text-red-600'
          )}>
            {userGotItRight ? '✓ Correto!' : `✗ Incorreto — resposta: ${displayAnswer(authorizedCorrectAnswer, question.type)}`}
          </p>
          {question.comment && (
            <p className="text-muted-foreground leading-relaxed">{question.comment}</p>
          )}
        </div>
      )}

      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={!selected}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          Confirmar resposta
        </button>
      ) : (
        <button
          onClick={handleNext}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {index < total - 1 ? 'Próxima questão' : 'Ver resultado da revisão'}
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SimuladoDetail() {
  const { simuladoId } = useParams<{ simuladoId: string }>()
  const navigate = useNavigate()
  const { recordAnswer } = useStudy()
  const { user } = useAuth()

  const [simulado, setSimulado] = useState<SimuladoRecord | null>(null)
  const [simQs, setSimQs] = useState<SimuladoQuestion[]>([])
  const [questions, setQuestions] = useState<Map<string, Question>>(new Map())
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  // Review state
  const [phase, setPhase] = useState<Phase>('detail')
  const [reviewIndex, setReviewIndex] = useState(0)
  const [reviewAnswers, setReviewAnswers] = useState<ReviewAnswer[]>([])

  useEffect(() => {
    if (!simuladoId || !user) return

    const currentSimuladoId = simuladoId
    const currentUserId = user.id

    async function load() {
      const [sim, sqs, discs, subs] = await Promise.all([
        getSimuladoById(currentSimuladoId, currentUserId),
        getSimuladoQuestions(currentSimuladoId, currentUserId),
        getDisciplines(),
        getSubjects(),
      ])
      if (!sim) { navigate('/stats'); return }
      setSimulado(sim)
      setSimQs(sqs)
      setDisciplines(discs)
      setSubjects(subs)

      const qIds = sqs.map(sq => sq.question_id)
      const qs = await getQuestionsByIds(qIds)
      const qMap = new Map(qs.map(q => [q.id, q]))
      setQuestions(qMap)
      setLoading(false)
    }
    load()
  }, [simuladoId, user, navigate])

  if (loading || !simulado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const currentSimulado = simulado
  // Recompute wrong questions using normalized snapshot comparison.
  // Never trust the stored is_correct — recompute from selected_answer vs correct_answer.
  // Passa o tipo da questão para distinguir C/E de múltipla escolha vs certo/errado.
  const wrongSimQs = simQs.filter(sq => {
    if (sq.selected_answer === null) return false
    const qType = questions.get(sq.question_id)?.type
    return !isSnapshotCorrect(sq.selected_answer, sq.correct_answer, qType)
  })

  // Pair each wrong SimuladoQuestion with its full Question object for review
  const wrongItems: WrongItem[] = wrongSimQs
    .map(sq => {
      const question = questions.get(sq.question_id)
      return question ? { sq, question } : null
    })
    .filter(Boolean) as WrongItem[]

  // Per-discipline breakdown — recompute correctness from normalized snapshot
  const discBreakdown = disciplines
    .map(d => {
      const dSimQs = simQs.filter(sq => sq.discipline_id === d.id && sq.selected_answer !== null)
      if (dSimQs.length === 0) return null
      const correct = dSimQs.filter(sq => {
        const qType = questions.get(sq.question_id)?.type
        return isSnapshotCorrect(sq.selected_answer, sq.correct_answer, qType)
      }).length
      const percent = Math.round((correct / dSimQs.length) * 100)

      const subBreakdown = subjects
        .filter(s => s.discipline_id === d.id)
        .map(s => {
          const sSimQs = dSimQs.filter(sq => sq.subject_id === s.id)
          if (sSimQs.length === 0) return null
          const sCorrect = sSimQs.filter(sq => {
            const qType = questions.get(sq.question_id)?.type
            return isSnapshotCorrect(sq.selected_answer, sq.correct_answer, qType)
          }).length
          return {
            subject: s,
            answered: sSimQs.length,
            correct: sCorrect,
            percent: Math.round((sCorrect / sSimQs.length) * 100),
          }
        })
        .filter(Boolean) as { subject: Subject; answered: number; correct: number; percent: number }[]

      return { discipline: d, answered: dSimQs.length, correct, percent, subBreakdown }
    })
    .filter(Boolean) as {
      discipline: Discipline
      answered: number
      correct: number
      percent: number
      subBreakdown: { subject: Subject; answered: number; correct: number; percent: number }[]
    }[]

  // ── REVIEWING ────────────────────────────────────────────────────────────────
  if (phase === 'reviewing') {
    const item = wrongItems[reviewIndex]
    if (!item) return null
    const { sq: reviewSq, question: reviewQ } = item
    // Use snapshot correct_answer as the authoritative source — this is what was
    // displayed to the user in the wrong-questions list, so validation must match it.
    const snapshotCorrect = reviewSq.correct_answer

    function handleAnswer(selected: string) {
      // Valida usando snapshot normalizado com o tipo correto da questão
      const qType = reviewQ.type
      const isCorrect =
        normalizeAnswer(selected, qType) === normalizeAnswer(snapshotCorrect, qType)
      const newAns: ReviewAnswer = { questionId: reviewQ.id, selected, isCorrect }
      const updated = [...reviewAnswers, newAns]
      setReviewAnswers(updated)

      // Record to user_answers (updates overall progress)
      recordAnswer({
        questionId: reviewQ.id,
        selectedAnswer: selected,
        isCorrect,
        answeredAt: new Date().toISOString(),
      })

      if (!isCorrect) {
        generateFlashcard({
          question: reviewQ,
          selectedAnswer: selected,
          sourceType: 'review',
          simuladoId: currentSimulado.id,
        }).catch(console.error)
      }

      if (reviewIndex < wrongItems.length - 1) {
        setReviewIndex(i => i + 1)
      } else {
        setPhase('review_result')
      }
    }

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => { setPhase('detail'); setReviewIndex(0); setReviewAnswers([]) }}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="text-sm font-semibold">Revisando erros</p>
            <p className="text-xs text-muted-foreground truncate">{currentSimulado.title}</p>
          </div>
          <span className="text-xs text-muted-foreground">{reviewIndex + 1}/{wrongItems.length}</span>
        </div>
        <div className="flex-1 mx-auto w-full max-w-lg px-4 py-4 pb-8">
          <div className="mb-3"><ProgressBar value={reviewIndex} max={wrongItems.length} /></div>
          <ReviewCard
            key={reviewQ.id}
            question={reviewQ}
            authorizedCorrectAnswer={snapshotCorrect}
            index={reviewIndex}
            total={wrongItems.length}
            onAnswer={handleAnswer}
          />
        </div>
      </div>
    )
  }

  // ── REVIEW RESULT ─────────────────────────────────────────────────────────
  if (phase === 'review_result') {
    const revCorrect = reviewAnswers.filter(a => a.isCorrect).length
    const revPercent = reviewAnswers.length === 0 ? 0 : Math.round((revCorrect / reviewAnswers.length) * 100)
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setPhase('detail'); setReviewIndex(0); setReviewAnswers([]) }}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <p className="text-sm font-semibold flex-1">Resultado da revisão</p>
        </div>
        <div className="flex-1 mx-auto w-full max-w-lg px-4 py-6 flex flex-col gap-5">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className={cn('text-5xl font-bold mb-1', AccuracyColor(revPercent))}>{revPercent}%</p>
            <p className="text-muted-foreground text-sm">Aproveitamento na revisão</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-green-500">{revCorrect}</p>
              <p className="text-sm text-muted-foreground">Acertos</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{reviewAnswers.length - revCorrect}</p>
              <p className="text-sm text-muted-foreground">Erros</p>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {revPercent >= 70
              ? 'Ótimo aproveitamento na revisão! Continue assim.'
              : 'Revise o material e tente novamente para fixar o conteúdo.'}
          </p>
          <button
            onClick={() => { setPhase('detail'); setReviewIndex(0); setReviewAnswers([]) }}
            className="rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted/50"
          >
            Voltar ao resumo do simulado
          </button>
          {wrongItems.length > 0 && (
            <button
              onClick={() => { setReviewIndex(0); setReviewAnswers([]); setPhase('reviewing') }}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <RotateCcw size={15} /> Refazer erros novamente
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── DETAIL ────────────────────────────────────────────────────────────────
  const duration = formatDuration(simulado.duration_seconds)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with back */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/stats')}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">{simulado.title}</h1>
            <p className="text-xs text-muted-foreground">{formatDate(simulado.completed_at)}</p>
          </div>
          {simulado.is_advanced && (
            <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <BrainCircuit size={12} /> Avançado
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24 flex flex-col gap-6">

        {/* Accuracy hero */}
        <div className="rounded-xl border border-border bg-card p-5 text-center">
          <p className={cn('text-5xl font-bold mb-1', AccuracyColor(simulado.accuracy_percentage))}>
            {simulado.accuracy_percentage}%
          </p>
          <p className="text-muted-foreground text-sm">Aproveitamento</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-green-500">{simulado.total_correct}</p>
            <p className="text-sm text-muted-foreground">Acertos</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-red-500">{simulado.total_wrong}</p>
            <p className="text-sm text-muted-foreground">Erros</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-primary">{simulado.total_answered}</p>
            <p className="text-sm text-muted-foreground">Respondidas</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-muted-foreground">
              {simulado.total_questions - simulado.total_answered}
            </p>
            <p className="text-sm text-muted-foreground">Puladas</p>
          </div>
        </div>

        {duration && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
            <Clock size={16} className="text-muted-foreground shrink-0" />
            <span className="text-sm">Tempo utilizado: <strong>{duration}</strong></span>
          </div>
        )}

        {/* Per-discipline breakdown */}
        {discBreakdown.length > 0 && (
          <div>
            <h2 className="font-semibold mb-2">Desempenho por matéria</h2>
            <div className="flex flex-col gap-2">
              {discBreakdown.map(b => (
                <div key={b.discipline.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{b.discipline.icon}</span>
                    <span className="flex-1 font-medium text-sm">{b.discipline.name}</span>
                    <span className={cn('font-bold text-sm', AccuracyColor(b.percent))}>
                      {b.percent}%
                    </span>
                  </div>
                  <ProgressBar value={b.correct} max={b.answered} showLabel />
                  {b.subBreakdown.length > 1 && (
                    <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                      {b.subBreakdown.map(s => (
                        <div key={s.subject.id} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 text-muted-foreground truncate">{s.subject.name}</span>
                          <span className="text-muted-foreground">{s.correct}/{s.answered}</span>
                          <span className={cn('font-semibold w-8 text-right', AccuracyColor(s.percent))}>
                            {s.percent}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wrong questions section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold flex-1">Questões erradas</h2>
            <span className="text-sm text-muted-foreground">{wrongSimQs.length} questão{wrongSimQs.length !== 1 ? 'ões' : ''}</span>
          </div>

          {wrongSimQs.length === 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 p-4 text-center">
              <CheckCircle2 size={24} className="text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Parabéns! Nenhuma questão errada neste simulado.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {wrongSimQs.map((sq, idx) => {
                const q = questions.get(sq.question_id)
                if (!q) return null
                const disc = disciplines.find(d => d.id === sq.discipline_id)
                const sub = subjects.find(s => s.id === sq.subject_id)
                return (
                  <div key={sq.id} className="rounded-xl border border-red-200 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-3 leading-relaxed">{q.statement}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                          {disc && (
                            <span className="text-xs text-muted-foreground">{disc.icon} {disc.name}</span>
                          )}
                          {sub && (
                            <span className="text-xs text-muted-foreground">· {sub.name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="text-red-500 font-medium">
                            Resposta dada: {sq.selected_answer ? displayAnswer(sq.selected_answer, q.type) : '—'}
                          </span>
                          <span className="text-green-600 font-medium">
                            Correta: {displayAnswer(sq.correct_answer, q.type)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Refazer erros CTA */}
        {wrongSimQs.length > 0 && (
          <button
            onClick={() => { setReviewIndex(0); setReviewAnswers([]); setPhase('reviewing') }}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Target size={16} />
            Refazer {wrongSimQs.length} erro{wrongSimQs.length !== 1 ? 's' : ''}
            <ChevronRight size={16} />
          </button>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
