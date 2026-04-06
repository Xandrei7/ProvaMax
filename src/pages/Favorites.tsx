import { useEffect, useState, useCallback } from 'react'
import { Heart } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { QuestionCard } from '@/components/QuestionCard'
import { getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import type { Question, UserAnswer } from '@/types'

export function Favorites() {
  const { favorites, answers, recordAnswer } = useStudy()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    async function load() {
      const all = await getQuestions()
      const favQs = all.filter(q => favorites.includes(q.id))
      setQuestions(favQs)
      // Init state for first question
      if (favQs.length > 0) {
        const existing = answers.find(a => a.questionId === favQs[0].id)
        setSelected(existing?.selectedAnswer ?? null)
        setSubmitted(!!existing)
        setCurrentIndex(0)
      }
      setLoading(false)
    }
    load()
  }, [favorites]) // eslint-disable-line react-hooks/exhaustive-deps

  const goToIndex = useCallback((newIndex: number) => {
    const q = questions[newIndex]
    if (!q) return
    const existing = answers.find(a => a.questionId === q.id)
    setCurrentIndex(newIndex)
    setSelected(existing?.selectedAnswer ?? null)
    setSubmitted(!!existing)
  }, [questions, answers])

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
      <Header title="Favoritos" subtitle={`${questions.length} questões salvas`} />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Heart size={48} className="text-muted-foreground/40" />
            <p className="font-medium">Nenhum favorito ainda</p>
            <p className="text-sm text-muted-foreground">
              Toque no coração em qualquer questão para salvá-la aqui.
            </p>
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
            onNext={() => goToIndex(Math.min(questions.length - 1, currentIndex + 1))}
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
