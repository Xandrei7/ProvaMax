import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Shuffle, List, RotateCcw } from 'lucide-react'
import { Header } from '@/components/Header'
import { QuestionCard } from '@/components/QuestionCard'
import { getSubjects, getDisciplines, getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import { shuffle } from '@/lib/utils'
import type { Question, UserAnswer } from '@/types'

type Mode = 'discipline' | 'subject'

export function StudyMode() {
  const { subjectId, disciplineId } = useParams<{ subjectId?: string; disciplineId?: string }>()
  const mode: Mode = disciplineId ? 'discipline' : 'subject'
  const navigate = useNavigate()
  const { answers, recordAnswer } = useStudy()

  const [title, setTitle] = useState('')
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [studyStarted, setStudyStarted] = useState(false)

  // ── Controlled question state (lives here, NOT in QuestionCard) ──────────
  // This is the definitive fix: state resets synchronously in the same
  // event handler that changes the question, with no async timing issues.
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    async function load() {
      if (mode === 'subject' && subjectId) {
        const [subjects, disciplines, qs] = await Promise.all([
          getSubjects(),
          getDisciplines(),
          getQuestions({ subjectId }),
        ])
        const subject = subjects.find(s => s.id === subjectId)
        const discipline = disciplines.find(d => d.id === subject?.discipline_id)
        setTitle(`${discipline?.name ?? ''} › ${subject?.name ?? ''}`)
        setAllQuestions(qs)
      } else if (mode === 'discipline' && disciplineId) {
        const [disciplines, qs] = await Promise.all([
          getDisciplines(),
          getQuestions({ disciplineId }),
        ])
        const discipline = disciplines.find(d => d.id === disciplineId)
        setTitle(discipline?.name ?? '')
        setAllQuestions(qs)
      }
      setLoading(false)
    }
    load()
  }, [subjectId, disciplineId, mode])

  const answeredIds = new Set(answers.map(a => a.questionId))
  const answeredCount = allQuestions.filter(q => answeredIds.has(q.id)).length
  const hasProgress = answeredCount > 0

  // Initialize selection state for a given question index
  function initStateForIndex(index: number, qs: Question[]) {
    const q = qs[index]
    if (!q) return
    const existing = answers.find(a => a.questionId === q.id)
    setSelected(existing?.selectedAnswer ?? null)
    setSubmitted(!!existing)
  }

  function startStudy(selectedMode: 'sequential' | 'random', fromStart = false) {
    let qs = [...allQuestions]
    if (selectedMode === 'random') qs = shuffle(qs)
    setQuestions(qs)

    let startIndex = 0
    if (!fromStart && selectedMode === 'sequential') {
      const firstUnanswered = qs.findIndex(q => !answeredIds.has(q.id))
      startIndex = firstUnanswered >= 0 ? firstUnanswered : 0
    }

    setCurrentIndex(startIndex)
    initStateForIndex(startIndex, qs)
    setStudyStarted(true)
  }

  function resetAndStart(selectedMode: 'sequential' | 'random') {
    startStudy(selectedMode, true)
  }

  // Navigate to a specific question index, resetting state synchronously
  const goToIndex = useCallback((newIndex: number, qs: Question[]) => {
    const q = qs[newIndex]
    if (!q) return
    const existing = answers.find(a => a.questionId === q.id)
    // All three state updates are batched in one render by React 18
    setCurrentIndex(newIndex)
    setSelected(existing?.selectedAnswer ?? null)
    setSubmitted(!!existing)
  }, [answers])

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

  const handleNext = useCallback(() => {
    if (currentIndex === questions.length - 1) {
      if (mode === 'subject' && subjectId) {
        navigate(`/study/${subjectId}/complete`)
      } else {
        navigate('/')
      }
    } else {
      goToIndex(currentIndex + 1, questions)
    }
  }, [currentIndex, questions, mode, subjectId, navigate, goToIndex])

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) goToIndex(currentIndex - 1, questions)
  }, [currentIndex, questions, goToIndex])

  const handleSkip = useCallback(() => {
    if (currentIndex < questions.length - 1) goToIndex(currentIndex + 1, questions)
  }, [currentIndex, questions, goToIndex])

  const currentQuestion = questions[currentIndex]

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!studyStarted) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header title={title} showBack />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
          <h2 className="text-lg font-bold mb-1">Como deseja estudar?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {allQuestions.length} questões disponíveis
            {hasProgress && ` · ${answeredCount} já respondidas`}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => startStudy('sequential')}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-primary hover:bg-primary/5 transition-all"
            >
              <List size={22} className="text-primary" />
              <div>
                <p className="font-medium">Ordem sequencial</p>
                <p className="text-sm text-muted-foreground">
                  {hasProgress ? 'Continuar de onde parou' : 'Começar do início'}
                </p>
              </div>
            </button>
            <button
              onClick={() => startStudy('random')}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Shuffle size={22} className="text-primary" />
              <div>
                <p className="font-medium">Ordem aleatória</p>
                <p className="text-sm text-muted-foreground">Questões embaralhadas</p>
              </div>
            </button>
            {hasProgress && (
              <button
                onClick={() => resetAndStart('sequential')}
                className="flex items-center gap-4 rounded-xl border border-dashed border-border px-4 py-4 text-left hover:border-primary transition-all"
              >
                <RotateCcw size={22} className="text-muted-foreground" />
                <div>
                  <p className="font-medium text-muted-foreground">Começar do início</p>
                  <p className="text-sm text-muted-foreground">Resetar e reiniciar</p>
                </div>
              </button>
            )}
          </div>
        </main>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Nenhuma questão encontrada.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title={title} showBack />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-8">
        <QuestionCard
          key={currentQuestion.id ?? currentIndex}
          question={currentQuestion}
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          selected={selected}
          submitted={submitted}
          onSelect={setSelected}
          onSubmit={handleSubmit}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
          isFirst={currentIndex === 0}
          isLast={currentIndex === questions.length - 1}
        />
      </main>
    </div>
  )
}
