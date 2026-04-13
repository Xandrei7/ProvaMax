import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CheckCircle2, Upload, ChevronLeft } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { RankingSection } from '@/components/RankingSection'
import { ProgressBar } from '@/components/ProgressBar'
import { getDisciplines, getSubjects, getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import { useAuth } from '@/contexts/AuthContext'
import type { Discipline, Subject, Question } from '@/types'
import { DISCIPLINE_GROUPS, getGroupForDiscipline, type DisciplineGroup, type DisciplineSubgroup } from '@/config/disciplineGroups'

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
  const [selectedGroup, setSelectedGroup] = useState<DisciplineGroup | null>(null)
  const [selectedSubgroup, setSelectedSubgroup] = useState<DisciplineSubgroup | null>(null)

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

  function getGroupProgress(group: DisciplineGroup) {
    const groupCards = cards.filter(
      c => getGroupForDiscipline(c.discipline.name, c.discipline.group_name)?.id === group.id
    )
    const total = groupCards.reduce((sum, c) => sum + c.subjects.length, 0)
    const answered = groupCards.reduce((sum, c) => sum + getDisciplineProgress(c).answered, 0)
    return { answered, total }
  }

  const groupCards = selectedGroup
    ? cards.filter(c => getGroupForDiscipline(c.discipline.name, c.discipline.group_name)?.id === selectedGroup.id)
    : []

  const visibleCards = selectedSubgroup
    ? groupCards.filter(c =>
        selectedSubgroup.nameMatches.some(m => c.discipline.name.toLowerCase().includes(m.toLowerCase()))
      )
    : groupCards

  function getSubgroupProgress(subgroup: DisciplineSubgroup) {
    const subgroupCards = groupCards.filter(c =>
      subgroup.nameMatches.some(m => c.discipline.name.toLowerCase().includes(m.toLowerCase()))
    )
    const total = subgroupCards.reduce((sum, c) => sum + c.subjects.length, 0)
    const answered = subgroupCards.reduce((sum, c) => sum + getDisciplineProgress(c).answered, 0)
    return { answered, total }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : selectedGroup && selectedGroup.subgroups && !selectedSubgroup ? (
          /* ── Vista de subgrupos (ex: dentro de Conhecimentos Gerais) ── */
          <div className="flex flex-col gap-3">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <button
                onClick={() => setSelectedGroup(null)}
                className="hover:text-foreground transition-colors font-medium"
              >
                Matérias
              </button>
              <ChevronRight size={12} className="shrink-0" />
              <span className={`font-semibold ${selectedGroup.color.text}`}>
                {selectedGroup.label}
              </span>
            </nav>

            {/* Cabeçalho do grupo */}
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 mb-1 ${selectedGroup.color.bg} ${selectedGroup.color.border}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl shrink-0 ${selectedGroup.color.iconBg}`}>
                {selectedGroup.icon}
              </div>
              <div>
                <p className={`font-bold text-sm ${selectedGroup.color.text}`}>{selectedGroup.label}</p>
                <p className="text-xs text-muted-foreground">{selectedGroup.description}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedGroup(null)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors -mt-1 mb-1 w-fit"
            >
              <ChevronLeft size={14} />
              Voltar para pastas
            </button>

            {selectedGroup.subgroups.map(sg => {
              const progress = getSubgroupProgress(sg)
              const complete = progress.total > 0 && progress.answered === progress.total
              const pct = progress.total > 0 ? Math.round((progress.answered / progress.total) * 100) : 0
              const disciplineCount = groupCards.filter(c =>
                sg.nameMatches.some(m => c.discipline.name.toLowerCase().includes(m.toLowerCase()))
              ).length
              return (
                <button
                  key={sg.id}
                  onClick={() => setSelectedSubgroup(sg)}
                  className={`flex items-center gap-4 rounded-xl border px-4 py-4 text-left transition-all hover:shadow-md ${selectedGroup.color.bg} ${selectedGroup.color.border} hover:border-current`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl shrink-0 ${selectedGroup.color.iconBg}`}>
                    {sg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`font-bold text-sm truncate ${selectedGroup.color.text}`}>
                        {sg.label}
                      </span>
                      {complete && progress.total > 0 && (
                        <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${selectedGroup.color.badge}`}>
                        {disciplineCount} {disciplineCount === 1 ? 'matéria' : 'matérias'}
                      </span>
                      {progress.total > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {progress.answered}/{progress.total} assuntos · {pct}%
                        </span>
                      )}
                    </div>
                    {progress.total > 0 && (
                      <div className="mt-2">
                        <ProgressBar value={progress.answered} max={progress.total} />
                      </div>
                    )}
                  </div>
                  <ChevronRight size={18} className={`shrink-0 ${selectedGroup.color.text}`} />
                </button>
              )
            })}
          </div>

        ) : selectedGroup ? (
          /* ── Vista interna de um grupo (ou subgrupo) ── */
          <div className="flex flex-col gap-3">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 flex-wrap">
              <button
                onClick={() => { setSelectedGroup(null); setSelectedSubgroup(null) }}
                className="hover:text-foreground transition-colors font-medium"
              >
                Matérias
              </button>
              {selectedSubgroup && (
                <>
                  <ChevronRight size={12} className="shrink-0" />
                  <button
                    onClick={() => setSelectedSubgroup(null)}
                    className={`hover:text-foreground transition-colors font-semibold ${selectedGroup.color.text}`}
                  >
                    {selectedGroup.label}
                  </button>
                  <ChevronRight size={12} className="shrink-0" />
                  <span className={`font-semibold ${selectedGroup.color.text}`}>
                    {selectedSubgroup.label}
                  </span>
                </>
              ) }
              {!selectedSubgroup && (
                <>
                  <ChevronRight size={12} className="shrink-0" />
                  <span className={`font-semibold ${selectedGroup.color.text}`}>
                    {selectedGroup.label}
                  </span>
                </>
              )}
            </nav>

            {/* Cabeçalho do grupo */}
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 mb-1 ${selectedGroup.color.bg} ${selectedGroup.color.border}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl shrink-0 ${selectedGroup.color.iconBg}`}>
                {selectedSubgroup ? selectedSubgroup.icon : selectedGroup.icon}
              </div>
              <div>
                <p className={`font-bold text-sm ${selectedGroup.color.text}`}>
                  {selectedSubgroup ? selectedSubgroup.label : selectedGroup.label}
                </p>
                <p className="text-xs text-muted-foreground">{selectedGroup.description}</p>
              </div>
            </div>

            {/* Botão voltar visível */}
            <button
              onClick={() => selectedSubgroup ? setSelectedSubgroup(null) : setSelectedGroup(null)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors -mt-1 mb-1 w-fit"
            >
              <ChevronLeft size={14} />
              {selectedSubgroup ? `Voltar para ${selectedGroup.label}` : 'Voltar para pastas'}
            </button>

            {visibleCards.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm">
                Nenhuma matéria nesta pasta.
              </p>
            ) : (
              visibleCards.map(card => {
                const progress = getDisciplineProgress(card)
                const complete = progress.total > 0 && progress.answered === progress.total
                const pct = progress.total > 0 ? Math.round((progress.answered / progress.total) * 100) : 0
                return (
                  <button
                    key={card.discipline.id}
                    onClick={() => navigate(`/discipline/${card.discipline.id}`)}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-primary hover:shadow-sm transition-all"
                  >
                    <span className="text-2xl shrink-0">{card.discipline.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold text-sm truncate leading-tight">
                          {card.discipline.name}
                        </span>
                        {complete && (
                          <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <ProgressBar value={progress.answered} max={progress.total} showLabel />
                        </div>
                        {progress.total > 0 && (
                          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                            {pct}%
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </button>
                )
              })
            )}
          </div>
        ) : (
          /* ── Vista inicial: pastas ── */
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

            {/* Label de seção */}
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mt-1">
              Pastas de estudo
            </p>

            {cards.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm">
                Nenhuma matéria ainda. Use o botão acima para importar suas primeiras questões.
              </p>
            ) : (
              DISCIPLINE_GROUPS.map(group => {
                const progress = getGroupProgress(group)
                const complete = progress.total > 0 && progress.answered === progress.total
                const pct = progress.total > 0
                  ? Math.round((progress.answered / progress.total) * 100)
                  : 0
                const disciplineCount = cards.filter(
                  c => getGroupForDiscipline(c.discipline.name, c.discipline.group_name)?.id === group.id
                ).length

                return (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-4 text-left transition-all hover:shadow-md ${group.color.bg} ${group.color.border} hover:border-current`}
                  >
                    {/* Ícone */}
                    <div className={`flex h-14 w-14 items-center justify-center rounded-xl text-3xl shrink-0 ${group.color.iconBg}`}>
                      {group.icon}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-bold text-sm truncate ${group.color.text}`}>
                          {group.label}
                        </span>
                        {complete && progress.total > 0 && (
                          <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mb-2 truncate">
                        {group.description}
                      </p>

                      {/* Badge de contagem + progresso */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${group.color.badge}`}>
                          {disciplineCount} {disciplineCount === 1 ? 'matéria' : 'matérias'}
                        </span>
                        {progress.total > 0 && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {progress.answered}/{progress.total} assuntos · {pct}%
                          </span>
                        )}
                      </div>

                      {/* Barra de progresso */}
                      {progress.total > 0 && (
                        <div className="mt-2">
                          <ProgressBar value={progress.answered} max={progress.total} />
                        </div>
                      )}
                    </div>

                    <ChevronRight size={18} className={`shrink-0 ${group.color.text}`} />
                  </button>
                )
              })
            )}

            {/* Ranking dos usuários — visível na vista inicial */}
            <RankingSection />
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
