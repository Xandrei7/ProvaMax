import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { ProgressBar } from '@/components/ProgressBar'
import { getDisciplines, getSubjects, getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import { cn, formatPercent } from '@/lib/utils'
import type { Discipline, Subject, Question } from '@/types'

interface DisciplineStat {
  discipline: Discipline
  subjects: Subject[]
  questions: Question[]
}

export function Stats() {
  const { answers } = useStudy()
  const [stats, setStats] = useState<DisciplineStat[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const [disciplines, subjects, questions] = await Promise.all([
        getDisciplines(),
        getSubjects(),
        getQuestions(),
      ])
      setStats(disciplines.map(d => ({
        discipline: d,
        subjects: subjects.filter(s => s.discipline_id === d.id),
        questions: questions.filter(q => q.discipline_id === d.id),
      })))
      setLoading(false)
    }
    load()
  }, [])

  const allQuestionIds = stats.flatMap(s => s.questions.map(q => q.id))
  const totalQuestions = allQuestionIds.length
  const answered = answers.filter(a => allQuestionIds.includes(a.questionId)).length
  const correct = answers.filter(a => allQuestionIds.includes(a.questionId) && a.isCorrect).length
  const wrong = answered - correct
  const notAnswered = totalQuestions - answered
  const percent = answered === 0 ? 0 : Math.round((correct / answered) * 100)

  function getAccuracy(questionIds: string[]) {
    const ans = answers.filter(a => questionIds.includes(a.questionId))
    if (ans.length === 0) return null
    return {
      correct: ans.filter(a => a.isCorrect).length,
      answered: ans.length,
      percent: Math.round((ans.filter(a => a.isCorrect).length / ans.length) * 100),
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Estatísticas" subtitle="Seu desempenho geral" />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : answered === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            Comece a responder questões para ver suas estatísticas.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Overall */}
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Aproveitamento geral</span>
                  <span className={cn(
                    'text-2xl font-bold',
                    percent >= 70 ? 'text-green-500' : percent >= 50 ? 'text-amber-500' : 'text-red-500'
                  )}>
                    {percent}%
                  </span>
                </div>
                <ProgressBar value={correct} max={answered} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-2xl font-bold text-green-500">{correct}</p>
                  <p className="text-sm text-muted-foreground">Acertos</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-2xl font-bold text-red-500">{wrong}</p>
                  <p className="text-sm text-muted-foreground">Erros</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-2xl font-bold text-primary">{answered}</p>
                  <p className="text-sm text-muted-foreground">Respondidas</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-2xl font-bold text-muted-foreground">{notAnswered}</p>
                  <p className="text-sm text-muted-foreground">Não respondidas</p>
                </div>
              </div>
            </div>

            {/* Progress total */}
            <div>
              <h2 className="font-semibold mb-2">Progresso total</h2>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>{answered} de {totalQuestions} questões</span>
                  <span className="text-muted-foreground">{formatPercent(answered, totalQuestions)}</span>
                </div>
                <ProgressBar value={answered} max={totalQuestions} />
              </div>
            </div>

            {/* Per discipline + subject */}
            <div>
              <h2 className="font-semibold mb-2">Por matéria</h2>
              <div className="flex flex-col gap-2">
                {stats.map(({ discipline, subjects, questions }) => {
                  const acc = getAccuracy(questions.map(q => q.id))
                  if (!acc) return null
                  const isOpen = expanded.has(discipline.id)
                  const disciplineAnswered = answers.filter(a =>
                    questions.map(q => q.id).includes(a.questionId)
                  ).length

                  return (
                    <div key={discipline.id} className="rounded-xl border border-border bg-card overflow-hidden">
                      <button
                        onClick={() => toggleExpand(discipline.id)}
                        className="w-full flex items-center gap-2 p-4 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span>{discipline.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-medium flex-1">{discipline.name}</span>
                            <span className={cn(
                              'font-bold text-sm shrink-0',
                              acc.percent >= 70 ? 'text-green-500' : acc.percent >= 50 ? 'text-amber-500' : 'text-red-500'
                            )}>
                              {acc.percent}%
                            </span>
                          </div>
                          <ProgressBar value={disciplineAnswered} max={questions.length} showLabel />
                        </div>
                        {subjects.length > 0 && (
                          <span className="text-muted-foreground shrink-0 ml-1">
                            {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </span>
                        )}
                      </button>

                      {/* Subject breakdown */}
                      {isOpen && subjects.length > 0 && (
                        <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
                          {subjects.map(s => {
                            const sQIds = questions.filter(q => q.subject_id === s.id).map(q => q.id)
                            const sAcc = getAccuracy(sQIds)
                            if (!sAcc) return null
                            return (
                              <div key={s.id} className="flex items-center gap-2 text-sm">
                                <span className="flex-1 text-muted-foreground truncate">{s.name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {sAcc.correct}/{sAcc.answered}
                                </span>
                                <span className={cn(
                                  'font-semibold text-xs w-10 text-right shrink-0',
                                  sAcc.percent >= 70 ? 'text-green-500' : sAcc.percent >= 50 ? 'text-amber-500' : 'text-red-500'
                                )}>
                                  {sAcc.percent}%
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Clique em uma matéria para ver o desempenho por assunto.
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
