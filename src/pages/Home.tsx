import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CheckCircle2, Upload } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { ProgressBar } from '@/components/ProgressBar'
import { getDisciplines, getSubjects, getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import { useAuth } from '@/contexts/AuthContext'
import type { Discipline, Subject, Question } from '@/types'

interface DisciplineCard {
  discipline: Discipline
  subjects: Subject[]
  questions: Question[]
}

export function Home() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { answers } = useStudy()
  const [cards, setCards] = useState<DisciplineCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [disciplines, subjects, questions] = await Promise.all([
        getDisciplines(),
        getSubjects(),
        getQuestions(),
      ])
      setCards(disciplines.map(d => ({
        discipline: d,
        subjects: subjects.filter(s => s.discipline_id === d.id),
        questions: questions.filter(q => q.discipline_id === d.id),
      })))
      setLoading(false)
    }
    load()
  }, [])

  function getDisciplineProgress(card: DisciplineCard) {
    const answeredIds = new Set(answers.map(a => a.questionId))
    const answeredSubjects = card.subjects.filter(s => {
      const subjectQIds = card.questions.filter(q => q.subject_id === s.id).map(q => q.id)
      return subjectQIds.length > 0 && subjectQIds.every(id => answeredIds.has(id))
    })
    return { answered: answeredSubjects.length, total: card.subjects.length }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="PapaMike Questões" subtitle="Selecione uma matéria para estudar" />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Import button — admin only */}
            {isAdmin && (
              <button
                onClick={() => navigate('/import')}
                className="flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3 text-left hover:border-primary hover:bg-primary/10 transition-all"
              >
                <Upload size={18} className="text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-primary">Importar questões</p>
                  <p className="text-xs text-muted-foreground">Cole questões + gabarito comentado</p>
                </div>
              </button>
            )}

            {cards.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm">
                Nenhuma matéria ainda. Use o botão acima para importar suas primeiras questões.
              </p>
            ) : (
              cards.map(card => {
                const progress = getDisciplineProgress(card)
                const complete = progress.total > 0 && progress.answered === progress.total
                return (
                  <button
                    key={card.discipline.id}
                    onClick={() => navigate(`/discipline/${card.discipline.id}`)}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-primary hover:shadow-sm transition-all"
                  >
                    <span className="text-2xl">{card.discipline.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{card.discipline.name}</span>
                        {complete && <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
                      </div>
                      <ProgressBar value={progress.answered} max={progress.total} showLabel />
                    </div>
                    <ChevronRight size={18} className="text-muted-foreground shrink-0" />
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
