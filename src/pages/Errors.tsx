import { useEffect, useState, useCallback } from 'react'
import { XCircle, RotateCcw } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { QuestionCard } from '@/components/QuestionCard'
import { getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import type { Question, UserAnswer } from '@/types'

export function Errors() {
  const { answers, recordAnswer, getWrongAnswers } = useStudy()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)

  // Controlled state
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const wrongAnswers = getWrongAnswers()

  useEffect(() => {
    async function load() {
      const wrongIds = wrongAnswers.map(a => a.questionId)
      if (wrongIds.length === 0) {
        setQuestions([])
        setLoading(false)
        return
      }
      const all = await getQuestions()
      setQuestions(all.filter(q => wrongIds.includes(q.id)))
      setLoading(false)
    }
    load()
  }, [answers]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSubmit = useCallback(() => {
    const q = questions[currentIndex]
    if (!selected || !q || submitted) return
    const answer: UserAnswer = {
      questionId: q.id,
      selectedAnswer: selected,
      isCorrect: selected === q.correct_answer,
      answeredAt: new Date().toISOString(),
    }
    recordAnswer(answer)
    setSubmitted(true)
  }, [selected, questions, currentIndex, submitted, recordAnswer])

  const currentQuestion = questions[currentIndex]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        title="Caderno de Erros"
        subtitle={reviewing ? 'Refazendo erros' : 'Revise suas questões erradas'}
      />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <XCircle size={48} className="text-muted-foreground/40" />
            <p className="font-medium">Nenhum erro registrado!</p>
            <p className="text-sm text-muted-foreground">
              Continue respondendo questões para ver seus erros aqui.
            </p>
          </div>
        ) : !reviewing ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 p-4">
              <p className="font-medium text-red-700 dark:text-red-400">
                {questions.length} questões erradas
              </p>
              <p className="text-sm text-red-600/70 dark:text-red-400/70 mt-0.5">
                Refaça as questões que você errou.
              </p>
            </div>
            <button
              onClick={startReview}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RotateCcw size={16} />
              Revisar erros
            </button>
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
            onSkip={() => goToIndex(Math.min(questions.length - 1, currentIndex + 1))}
            isFirst={currentIndex === 0}
            isLast={currentIndex === questions.length - 1}
          />
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
