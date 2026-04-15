import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, CheckCircle2, Layers, BookOpen } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { ProgressBar } from '@/components/ProgressBar'
import { getDisciplines, getSubjects, getSubjectParts, getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import type { Subject, SubjectPart, Question } from '@/types'

export function SubjectParts() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()
  const { answers } = useStudy()

  const [subject, setSubject] = useState<Subject | null>(null)
  const [disciplineName, setDisciplineName] = useState('')
  const [parts, setParts] = useState<SubjectPart[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!subjectId) return
    async function load() {
      const [subjects, disciplines, partsData, qs] = await Promise.all([
        getSubjects(),
        getDisciplines(),
        getSubjectParts(subjectId),
        getQuestions({ subjectId }),
      ])
      const sub = subjects.find(s => s.id === subjectId) ?? null
      const disc = disciplines.find(d => d.id === sub?.discipline_id)
      setSubject(sub)
      setDisciplineName(disc?.name ?? '')
      setParts(partsData)
      setQuestions(qs)
      setLoading(false)
    }
    load()
  }, [subjectId])

  // Progresso do assunto inteiro (todas as questões, independente de parte)
  function getTotalProgress() {
    const qIds = questions.map(q => q.id)
    const answered = answers.filter(a => qIds.includes(a.questionId)).length
    return { answered, total: qIds.length }
  }

  // Progresso de uma parte específica
  function getPartProgress(partId: string) {
    const qIds = questions.filter(q => q.part_id === partId).map(q => q.id)
    const answered = answers.filter(a => qIds.includes(a.questionId)).length
    return { answered, total: qIds.length }
  }

  const totalProgress = getTotalProgress()
  const totalComplete = totalProgress.total > 0 && totalProgress.answered === totalProgress.total

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title={subject?.name ?? '...'} showBack />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {disciplineName && (
          <p className="mb-4 text-xs font-medium text-muted-foreground tracking-wide uppercase">
            {disciplineName}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Entrada virtual "Geral" — representa o assunto inteiro */}
            <button
              onClick={() => navigate(`/study/${subjectId}`)}
              className="flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 px-4 py-4 text-left hover:border-primary hover:bg-primary/10 transition-all"
            >
              <BookOpen size={16} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-primary truncate">Geral</span>
                  {totalComplete && <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
                </div>
                <ProgressBar value={totalProgress.answered} max={totalProgress.total} showLabel />
              </div>
              <ChevronRight size={16} className="text-primary/60 shrink-0" />
            </button>

            {/* Divisor visual */}
            {parts.length > 0 && (
              <div className="flex items-center gap-2 px-1 pt-1">
                <Layers size={13} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{parts.length} {parts.length === 1 ? 'parte' : 'partes'}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {/* Partes específicas */}
            {parts.map(part => {
              const { answered, total } = getPartProgress(part.id)
              const complete = total > 0 && answered === total
              return (
                <button
                  key={part.id}
                  onClick={() => navigate(`/study/${subjectId}/part/${part.id}`)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-primary hover:shadow-sm transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{part.name}</span>
                      {complete && <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
                    </div>
                    <ProgressBar value={answered} max={total} showLabel />
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
