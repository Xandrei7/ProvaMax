import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, RotateCcw, ArrowLeft } from 'lucide-react'
import { getSubjects, getDisciplines, getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import type { Question } from '@/types'

export function StudyComplete() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()
  const { answers } = useStudy()
  const [subjectName, setSubjectName] = useState('')
  const [disciplineName, setDisciplineName] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])

  useEffect(() => {
    if (!subjectId) return
    async function load() {
      const [subjects, disciplines, qs] = await Promise.all([
        getSubjects(),
        getDisciplines(),
        getQuestions({ subjectId }),
      ])
      const subject = subjects.find(s => s.id === subjectId)
      const discipline = disciplines.find(d => d.id === subject?.discipline_id)
      setSubjectName(subject?.name ?? '')
      setDisciplineName(discipline?.name ?? '')
      setQuestions(qs)
    }
    load()
  }, [subjectId])

  const questionIds = questions.map(q => q.id)
  const subjectAnswers = answers.filter(a => questionIds.includes(a.questionId))
  const correct = subjectAnswers.filter(a => a.isCorrect).length
  const wrong = subjectAnswers.filter(a => !a.isCorrect).length
  const answered = subjectAnswers.length
  const percent = answered === 0 ? 0 : Math.round((correct / answered) * 100)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <CheckCircle2 size={64} className="text-green-500" />
        <div>
          <h1 className="text-2xl font-bold">Assunto concluído!</h1>
          <p className="text-muted-foreground mt-1">{disciplineName} › {subjectName}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="col-span-2 rounded-xl border border-border bg-card p-4">
            <p className="text-3xl font-bold text-primary">{percent}%</p>
            <p className="text-sm text-muted-foreground">Aproveitamento</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-green-500">{correct}</p>
            <p className="text-sm text-muted-foreground">Acertos</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-red-500">{wrong}</p>
            <p className="text-sm text-muted-foreground">Erros</p>
          </div>
          <div className="col-span-2 rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold">{answered}</p>
            <p className="text-sm text-muted-foreground">Respondidas</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={() => navigate(`/study/${subjectId}`)}
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50"
          >
            <RotateCcw size={16} />
            Começar do início
          </button>
          <button
            onClick={() => navigate(-2)}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <ArrowLeft size={16} />
            Voltar aos assuntos
          </button>
        </div>
      </div>
    </div>
  )
}
