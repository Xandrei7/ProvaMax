import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, CheckCircle2, Shuffle } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { ProgressBar } from '@/components/ProgressBar'
import { getDisciplines, getSubjects, getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import type { Discipline, Subject, Question } from '@/types'

export function DisciplineDetail() {
  const { disciplineId } = useParams<{ disciplineId: string }>()
  const navigate = useNavigate()
  const { answers } = useStudy()
  const [discipline, setDiscipline] = useState<Discipline | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!disciplineId) return
    async function load() {
      const [disciplines, subs, qs] = await Promise.all([
        getDisciplines(),
        getSubjects(disciplineId),
        getQuestions({ disciplineId }),
      ])
      setDiscipline(disciplines.find(d => d.id === disciplineId) ?? null)
      setSubjects(subs)
      setQuestions(qs)
      setLoading(false)
    }
    load()
  }, [disciplineId])

  function getProgress(subjectId: string) {
    const qIds = questions.filter(q => q.subject_id === subjectId).map(q => q.id)
    const answered = answers.filter(a => qIds.includes(a.questionId)).length
    return { answered, total: qIds.length }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title={discipline?.name ?? '...'} showBack />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Study all button */}
            {questions.length > 0 && (
              <button
                onClick={() => navigate(`/study-discipline/${disciplineId}`)}
                className="flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-left hover:border-primary hover:bg-primary/10 transition-all"
              >
                <Shuffle size={18} className="text-primary" />
                <span className="text-sm font-medium text-primary">Todas as questões da matéria</span>
                <span className="ml-auto text-xs text-muted-foreground">{questions.length} questões</span>
              </button>
            )}

            {subjects.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Nenhum assunto cadastrado.</p>
            ) : (
              subjects.map(subject => {
                const { answered, total } = getProgress(subject.id)
                const complete = total > 0 && answered === total
                return (
                  <button
                    key={subject.id}
                    onClick={() => navigate(`/study/${subject.id}`)}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-primary hover:shadow-sm transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{subject.name}</span>
                        {complete && <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
                      </div>
                      <ProgressBar value={answered} max={total} showLabel />
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </button>
                )
              })
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
