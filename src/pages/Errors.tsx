import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { XCircle, RotateCcw, Brain } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { QuestionCard } from '@/components/QuestionCard'
import { generateFlashcard, getQuestionsByIds } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import { normalizeAnswer } from '@/lib/utils'
import type { Question, UserAnswer } from '@/types'

interface ErrorReviewLocationState {
  source?: 'simulado'
  questionIds?: string[]
  simuladoId?: string
}

export function Errors() {
  const location = useLocation()
  const navigate = useNavigate()
  const { answers, recordAnswer } = useStudy()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)

  // Controlled state
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const locationState = (location.state ?? null) as ErrorReviewLocationState | null
  const scopedQuestionIds = useMemo(() => {
    const rawIds = Array.isArray(locationState?.questionIds) ? locationState.questionIds : []
    return [...new Set(rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
  }, [locationState])
  const isSimuladoScoped = locationState?.source === 'simulado' && scopedQuestionIds.length > 0
  const scopedSimuladoId = typeof locationState?.simuladoId === 'string' && locationState.simuladoId.length > 0
    ? locationState.simuladoId
    : null

  const questionIdsForReview = useMemo(() => {
    if (isSimuladoScoped) return scopedQuestionIds
    return answers.filter(a => !a.isCorrect).map(a => a.questionId)
  }, [isSimuladoScoped, scopedQuestionIds, answers])

  useEffect(() => {
    if (reviewing) return
    async function load() {
      const wrongIds = questionIdsForReview
      if (wrongIds.length === 0) {
        setQuestions([])
        setLoading(false)
        return
      }
      const loaded = await getQuestionsByIds(wrongIds)
      const byId = new Map(loaded.map(q => [q.id, q]))
      setQuestions(wrongIds.map(id => byId.get(id)).filter(Boolean) as Question[])
      setLoading(false)
    }
    load()
  }, [questionIdsForReview, reviewing])

  function startReview() {
    setCurrentIndex(0)
    // Start clean so the user can retry each wrong question
    setSelected(null)
    setSubmitted(false)
    setReviewing(true)
  }

  const goToIndex = useCallback((newIndex: number) => {
    setCurrentIndex(newIndex)
    // In error review, always start each question clean for retrying
    setSelected(null)
    setSubmitted(false)
  }, [])

  const handleSkip = useCallback(() => {
    const q = questions[currentIndex]
    if (q) {
      setQuestions(prev => [...prev, q])
    }
    goToIndex(currentIndex + 1)
  }, [currentIndex, questions, goToIndex])

  const handleSubmit = useCallback(() => {
    const q = questions[currentIndex]
    if (!selected || !q || submitted) return
    const answer: UserAnswer = {
      questionId: q.id,
      selectedAnswer: selected,
      isCorrect: normalizeAnswer(selected, q.type) === normalizeAnswer(q.correct_answer, q.type),
      answeredAt: new Date().toISOString(),
    }
    recordAnswer(answer)
    setSubmitted(true)

    if (!answer.isCorrect) {
      const flashcardSource = (isSimuladoScoped && scopedSimuladoId)
        ? { sourceType: 'simulado' as const, simuladoId: scopedSimuladoId }
        : { sourceType: 'review' as const }

      generateFlashcard({
        question: q,
        selectedAnswer: selected,
        ...flashcardSource,
      }).catch(console.error)

      setQuestions(prev => [...prev, q])
    } else {
      if (isSimuladoScoped && locationState?.questionIds) {
        const newIds = locationState.questionIds.filter(id => id !== q.id)
        navigate(location.pathname, {
          replace: true,
          state: { ...locationState, questionIds: newIds }
        })
      }
    }
  }, [selected, questions, currentIndex, submitted, recordAnswer, isSimuladoScoped, scopedSimuladoId, locationState, navigate, location.pathname])

  const currentQuestion = questions[currentIndex]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        title="Caderno de Erros"
        subtitle={reviewing
          ? (isSimuladoScoped ? 'Refazendo erros do simulado' : 'Refazendo erros')
          : (isSimuladoScoped ? 'Revise os erros deste simulado' : 'Revise suas questões erradas')}
      />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <XCircle size={48} className="text-muted-foreground/40" />
            <p className="font-medium">{isSimuladoScoped ? 'Nenhum erro deste simulado.' : 'Nenhum erro registrado!'}</p>
            <p className="text-sm text-muted-foreground">
              {isSimuladoScoped
                ? 'Conclua outro simulado para revisar novos erros por tentativa.'
                : 'Continue respondendo questões para ver seus erros aqui.'}
            </p>
          </div>
        ) : !reviewing ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 p-4">
              <p className="font-medium text-red-700 dark:text-red-400">
                {questions.length} questões erradas{isSimuladoScoped ? ' neste simulado' : ''}
              </p>
              <p className="text-sm text-red-600/70 dark:text-red-400/70 mt-0.5">
                {isSimuladoScoped ? 'Refaça apenas os erros desta tentativa.' : 'Refaça as questões que você errou.'}
              </p>
            </div>
            <button
              onClick={startReview}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RotateCcw size={16} />
              Revisar erros
            </button>
            {isSimuladoScoped && (
              <button
                onClick={() => navigate('/flashcards?section=simulado&source=simulado')}
                className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10"
              >
                <Brain size={16} />
                Ir para Flashcards de Simulados
              </button>
            )}
          </div>
        ) : currentQuestion ? (
          <QuestionCard
            key={currentQuestion.id ?? currentIndex}
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questions.length}
            selected={selected}
            submitted={submitted}
            onSelect={setSelected}
            onSubmit={handleSubmit}
            onNext={() => {
              if (currentIndex === questions.length - 1) setReviewing(false)
              else goToIndex(currentIndex + 1)
            }}
            onPrev={() => goToIndex(Math.max(0, currentIndex - 1))}
            onSkip={handleSkip}
            isFirst={currentIndex === 0}
            isLast={currentIndex === questions.length - 1}
          />
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
