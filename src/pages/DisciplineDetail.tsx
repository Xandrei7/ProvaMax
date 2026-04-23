import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, CheckCircle2, Shuffle, BookOpen, Layers, Scale, Plus, ChevronUp, ChevronDown, Save } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { ProgressBar } from '@/components/ProgressBar'
import { getDisciplines, getSubjects, getSubjectParts, getQuestions, saveSubject } from '@/lib/dataService'
import { getTheoriesByDiscipline } from '@/lib/theoryService'
import { useStudy } from '@/contexts/StudyContext'
import { useAuth } from '@/contexts/AuthContext'
import type { Discipline, Subject, SubjectPart, Question, Theory } from '@/types'

type DisciplineTab = 'questions' | 'theories' | 'lei_seca'

export function DisciplineDetail() {
  const { disciplineId } = useParams<{ disciplineId: string }>()
  const navigate = useNavigate()
  const { answers } = useStudy()
  const { isAdmin } = useAuth()
  const [discipline, setDiscipline] = useState<Discipline | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [theories, setTheories] = useState<Theory[]>([])
  // map de subjectId → partes (para saber se tem partes ou não)
  const [partsBySubject, setPartsBySubject] = useState<Record<string, SubjectPart[]>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DisciplineTab>('questions')

  // ── Estado do admin ───────────────────────────────────────────────────────
  const [showNewSubjectModal, setShowNewSubjectModal] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [creating, setCreating] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderChanged, setOrderChanged] = useState(false)

  useEffect(() => {
    if (!disciplineId) return
    async function load() {
      const [disciplines, subs, qs, allParts, disciplineTheories] = await Promise.all([
        getDisciplines(),
        getSubjects(disciplineId),
        getQuestions({ disciplineId }),
        getSubjectParts(),
        getTheoriesByDiscipline(disciplineId!),
      ])
      setDiscipline(disciplines.find(d => d.id === disciplineId) ?? null)
      setSubjects(subs)
      setQuestions(qs)
      setTheories(disciplineTheories)

      // Agrupa partes por subject_id (apenas para os assuntos dessa matéria)
      const subIds = new Set(subs.map(s => s.id))
      const grouped: Record<string, SubjectPart[]> = {}
      for (const part of allParts) {
        if (!subIds.has(part.subject_id)) continue
        if (!grouped[part.subject_id]) grouped[part.subject_id] = []
        grouped[part.subject_id].push(part)
      }
      setPartsBySubject(grouped)
      setLoading(false)
    }
    load()
  }, [disciplineId])

  function isLeiSecaSubject(subjectId: string): boolean {
    return theories.some(
      t => t.subject_id === subjectId && t.title.toLowerCase().includes('lei seca')
    )
  }

  function getProgress(subjectId: string) {
    const qIds = questions.filter(q => q.subject_id === subjectId).map(q => q.id)
    const answered = answers.filter(a => qIds.includes(a.questionId)).length
    return { answered, total: qIds.length }
  }

  function handleSubjectClick(subject: Subject) {
    const hasParts = (partsBySubject[subject.id]?.length ?? 0) > 0
    if (hasParts) {
      navigate(`/subject/${subject.id}/parts`)
    } else {
      navigate(`/study/${subject.id}`)
    }
  }

  // ── Admin: reordenar assuntos ─────────────────────────────────────────────

  function moveSubject(visibleIndex: number, direction: 'up' | 'down') {
    const visible = subjects.filter(s => !isLeiSecaSubject(s.id))
    const targetIndex = direction === 'up' ? visibleIndex - 1 : visibleIndex + 1
    if (targetIndex < 0 || targetIndex >= visible.length) return

    // Troca posições na lista visível e reatribui sort_order por índice
    const newVisible = [...visible]
    ;[newVisible[visibleIndex], newVisible[targetIndex]] = [newVisible[targetIndex], newVisible[visibleIndex]]

    const leiSeca = subjects.filter(s => isLeiSecaSubject(s.id))
    setSubjects([
      ...newVisible.map((s, i) => ({ ...s, sort_order: i * 10 })),
      ...leiSeca,
    ])
    setOrderChanged(true)
  }

  async function saveOrder() {
    if (!disciplineId) return
    setSavingOrder(true)
    try {
      const visible = subjects.filter(s => !isLeiSecaSubject(s.id))
      await Promise.all(visible.map(s => saveSubject(s)))
      setOrderChanged(false)
    } catch (e) {
      console.error('[DisciplineDetail] saveOrder error:', e)
    } finally {
      setSavingOrder(false)
    }
  }

  async function handleCreateSubject() {
    if (!newSubjectName.trim() || !disciplineId) return
    setCreating(true)
    try {
      const visible = subjects.filter(s => !isLeiSecaSubject(s.id))
      const maxOrder = visible.length > 0 ? Math.max(...visible.map(s => s.sort_order ?? 0)) + 10 : 0
      await saveSubject({ name: newSubjectName.trim(), discipline_id: disciplineId, sort_order: maxOrder })
      const updated = await getSubjects(disciplineId)
      setSubjects(updated)
      setNewSubjectName('')
      setShowNewSubjectModal(false)
    } catch (e) {
      console.error('[DisciplineDetail] createSubject error:', e)
    } finally {
      setCreating(false)
    }
  }

  // Listas derivadas (usadas em múltiplas abas)
  const visibleSubjects = subjects.filter(s => !isLeiSecaSubject(s.id))
  const leiSecaSubjects = subjects.filter(s => isLeiSecaSubject(s.id))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title={discipline?.name ?? '...'} showBack />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {/* Tab selector */}
        <div className="flex gap-1 mb-4 rounded-lg border border-border bg-muted/30 p-1">
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${activeTab === 'questions' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Questões
          </button>
          <button
            onClick={() => setActiveTab('theories')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${activeTab === 'theories' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Teoria
          </button>
          <button
            onClick={() => setActiveTab('lei_seca')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${activeTab === 'lei_seca' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Lei Seca
          </button>
        </div>

        {/* Aviso de atualização — apenas na aba Teoria */}
        {activeTab === 'theories' && (
          <p className="mb-3 text-center text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            EM ATUALIZAÇÃO
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : activeTab === 'lei_seca' ? (
          <div className="flex flex-col gap-3">
            {leiSecaSubjects.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Nenhum conteúdo de lei seca cadastrado.</p>
            ) : (
              leiSecaSubjects.map(subject => (
                <button
                  key={subject.id}
                  onClick={() => navigate(`/theory/${subject.id}`, { state: { tipo: 'lei_seca' } })}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-amber-500 hover:shadow-sm transition-all"
                >
                  <Scale size={16} className="text-amber-600 shrink-0" />
                  <span className="font-medium flex-1 truncate">{subject.name}</span>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        ) : activeTab === 'theories' ? (
          <div className="flex flex-col gap-3">
            {visibleSubjects.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Nenhum assunto cadastrado.</p>
            ) : (
              visibleSubjects.map(subject => (
                <button
                  key={subject.id}
                  onClick={() => navigate(`/theory/${subject.id}`)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-primary hover:shadow-sm transition-all"
                >
                  <BookOpen size={16} className="text-primary shrink-0" />
                  <span className="font-medium flex-1 truncate">{subject.name}</span>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Admin: Novo assunto + Salvar ordem */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNewSubjectModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-primary/60 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus size={14} /> Novo assunto
                </button>
                {orderChanged && (
                  <button
                    onClick={saveOrder}
                    disabled={savingOrder}
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                  >
                    <Save size={14} /> {savingOrder ? 'Salvando...' : 'Salvar ordem'}
                  </button>
                )}
              </div>
            )}

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

            {visibleSubjects.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Nenhum assunto cadastrado.</p>
            ) : (
              visibleSubjects.map((subject, visIdx) => {
                const { answered, total } = getProgress(subject.id)
                const complete = total > 0 && answered === total
                const hasParts = (partsBySubject[subject.id]?.length ?? 0) > 0
                return (
                  <div key={subject.id} className="flex items-center gap-2">
                    <button
                      onClick={() => handleSubjectClick(subject)}
                      className="flex-1 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-primary hover:shadow-sm transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{subject.name}</span>
                          {complete && <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
                          {hasParts && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0">
                              <Layers size={10} />
                              {partsBySubject[subject.id].length} partes
                            </span>
                          )}
                        </div>
                        <ProgressBar value={answered} max={total} showLabel />
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                    </button>

                    {/* Controles de reordenação — somente admin */}
                    {isAdmin && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => moveSubject(visIdx, 'up')}
                          disabled={visIdx === 0}
                          className="rounded-md border border-border bg-card p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 transition-colors"
                          title="Subir"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moveSubject(visIdx, 'down')}
                          disabled={visIdx === visibleSubjects.length - 1}
                          className="rounded-md border border-border bg-card p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 transition-colors"
                          title="Descer"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </main>
      <BottomNav />

      {/* Modal: Novo Assunto (admin only) */}
      {showNewSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 flex flex-col gap-4">
            <h2 className="font-bold text-base">Novo Assunto</h2>
            <input
              type="text"
              value={newSubjectName}
              onChange={e => setNewSubjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleCreateSubject()}
              placeholder="Nome do assunto"
              className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none focus:border-primary"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNewSubjectModal(false); setNewSubjectName('') }}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted/50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleCreateSubject()}
                disabled={creating || !newSubjectName.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {creating ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
