import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, ClipboardList, TrendingUp, ChevronRight, BrainCircuit, Clock, Target, Trash2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { ProgressBar } from '@/components/ProgressBar'
import { getDisciplines, getSubjects, getQuestions, getSimulados, deleteSimulado } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatPercent } from '@/lib/utils'
import type { Discipline, Subject, Question, SimuladoRecord } from '@/types'

type StatsTab = 'geral' | 'simulados'

// ── Contagem diária/semanal com suporte a pausas ────────────────────────────
const PAUSE_KEY        = 'provamax_count_pauses'
const COUNT_RESET_KEY  = 'provamax_count_reset'
const STATS_BASE_KEY   = 'provamax_stats_baseline'
interface PauseInterval { from: string; to: string | null }

function loadPauses(): PauseInterval[] {
  try { return JSON.parse(localStorage.getItem(PAUSE_KEY) ?? '[]') } catch { return [] }
}

function isInPause(answeredAt: string, pauses: PauseInterval[]): boolean {
  const t = new Date(answeredAt).getTime()
  return pauses.some(p => {
    const from = new Date(p.from).getTime()
    const to   = p.to ? new Date(p.to).getTime() : Date.now()
    return t >= from && t <= to
  })
}

interface DisciplineStat {
  discipline: Discipline
  subjects: Subject[]
  questions: Question[]
}

function formatDuration(secs: number | null) {
  if (!secs) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}min`
  return `${secs}s`
}

function AccuracyBadge({ percent }: { percent: number }) {
  const cls =
    percent >= 70
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : percent >= 50
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', cls)}>
      {percent}%
    </span>
  )
}

export function Stats() {
  const navigate = useNavigate()
  const { answers } = useStudy()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<StatsTab>('geral')

  // ── Estado de pausa da contagem diária/semanal
  const [paused, setPaused] = useState(() => {
    const ps = loadPauses()
    return ps.length > 0 && ps[ps.length - 1].to === null
  })

  function togglePause() {
    const ps = loadPauses()
    if (!paused) {
      ps.push({ from: new Date().toISOString(), to: null })
    } else if (ps.length > 0 && ps[ps.length - 1].to === null) {
      ps[ps.length - 1].to = new Date().toISOString()
    }
    localStorage.setItem(PAUSE_KEY, JSON.stringify(ps))
    setPaused(v => !v)
  }

  // ── Reiniciar contagem (Hoje/Semana)
  const [countResetTs, setCountResetTs] = useState(() => localStorage.getItem(COUNT_RESET_KEY) ?? '')
  function handleCountReset() {
    const ts = new Date().toISOString()
    localStorage.setItem(COUNT_RESET_KEY, ts)
    setCountResetTs(ts)
  }

  // ── Reinício geral (baseline global)
  const [statsBaselineTs, setStatsBaselineTs] = useState(() => localStorage.getItem(STATS_BASE_KEY) ?? '')
  function handleStatsBaseline() {
    if (!window.confirm('Zerar o painel de estatísticas? Os dados reais são mantidos — apenas a visualização começa do zero agora.')) return
    const ts = new Date().toISOString()
    localStorage.setItem(STATS_BASE_KEY, ts)
    setStatsBaselineTs(ts)
  }

  // ── Totais filtrados pelas pausas
  const pauses = loadPauses()
  const now = new Date()
  const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekStart     = todayStart - 6 * 24 * 60 * 60 * 1000
  const countResetTime = countResetTs ? new Date(countResetTs).getTime() : 0
  const todayCount = answers.filter(a => {
    const t = new Date(a.answeredAt).getTime()
    return t >= todayStart && t >= countResetTime && !isInPause(a.answeredAt, pauses)
  }).length
  const weekCount = answers.filter(a => {
    const t = new Date(a.answeredAt).getTime()
    return t >= weekStart && t >= countResetTime && !isInPause(a.answeredAt, pauses)
  }).length
  const [stats, setStats] = useState<DisciplineStat[]>([])
  const [simulados, setSimulados] = useState<SimuladoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [simLoading, setSimLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // ── Load disciplines/subjects/questions
  useEffect(() => {
    async function load() {
      const [disciplines, subjects, questions] = await Promise.all([
        getDisciplines(),
        getSubjects(),
        getQuestions(),
      ])
      setStats(
        disciplines.map(d => ({
          discipline: d,
          subjects: subjects.filter(s => s.discipline_id === d.id),
          questions: questions.filter(q => q.discipline_id === d.id),
        }))
      )
      setLoading(false)
    }
    load()
  }, [])

  // ── Load simulados when tab opens
  async function fetchSimulados() {
    if (!user) return
    setSimLoading(true)
    try {
      const data = await getSimulados(user.id)
      setSimulados(data)
    } catch (err) {
      console.error('[stats] erro array simulados:', err)
    } finally {
      setSimLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'simulados') {
      fetchSimulados()
    }
  }, [activeTab, user])

  async function handleDeleteSimulado(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!user) return
    if (!window.confirm('Tem certeza que deseja apagar este simulado? Ele não entrará mais no seu cálculo.')) return

    setDeletingId(id)
    try {
      await deleteSimulado(user.id, id)
      // Immediately remove from local state — metrics update right away
      setSimulados(prev => prev.filter(s => s.id !== id))
      // Silent background refetch to update simulado_number titles — no spinner
      getSimulados(user.id).then(data => setSimulados(data)).catch(() => {})
    } catch (err) {
      console.error('Erro ao deletar simulado:', err)
      alert('Não foi possível deletar o simulado. Verifique sua conexão e tente novamente.')
    } finally {
      setDeletingId(null)
    }
  }

  // ── General stats
  const baselineTime = statsBaselineTs ? new Date(statsBaselineTs).getTime() : 0
  const effectiveAnswers = baselineTime > 0
    ? answers.filter(a => new Date(a.answeredAt).getTime() >= baselineTime)
    : answers

  const allQuestionIds = stats.flatMap(s => s.questions.map(q => q.id))
  const totalQuestions = allQuestionIds.length
  const answered = effectiveAnswers.filter(a => allQuestionIds.includes(a.questionId)).length
  const correct = effectiveAnswers.filter(a => allQuestionIds.includes(a.questionId) && a.isCorrect).length
  const wrong = answered - correct
  const notAnswered = totalQuestions - answered
  const percent = answered === 0 ? 0 : Math.round((correct / answered) * 100)

  function getAccuracy(questionIds: string[]) {
    const ans = effectiveAnswers.filter(a => questionIds.includes(a.questionId))
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
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Simulados summary
  const totalSimulados = simulados.length
  const bestSim = simulados.reduce<SimuladoRecord | null>(
    (best, s) => (!best || s.accuracy_percentage > best.accuracy_percentage ? s : best),
    null
  )
  const avgAccuracy =
    totalSimulados === 0
      ? 0
      : Math.round(simulados.reduce((sum, s) => sum + s.accuracy_percentage, 0) / totalSimulados)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Estatísticas" subtitle="Seu desempenho completo" />

      {/* Tab switcher */}
      <div className="sticky top-0 z-10 border-b border-border bg-background px-4 pt-3 pb-0">
        <div className="mx-auto max-w-lg flex gap-0">
          <button
            onClick={() => setActiveTab('geral')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium border-b-2 transition-all',
              activeTab === 'geral'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <TrendingUp size={15} />
            Desempenho Geral
          </button>
          <button
            onClick={() => setActiveTab('simulados')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium border-b-2 transition-all',
              activeTab === 'simulados'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <ClipboardList size={15} />
            Simulados
            {totalSimulados > 0 && activeTab !== 'simulados' && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
                {totalSimulados}
              </span>
            )}
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">

        {/* ══ ABA: DESEMPENHO GERAL ══════════════════════════════════════════ */}
        {activeTab === 'geral' && (
          <>
            {/* ── Bloco: Hoje & Semana */}
            <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3 mb-3">
              <div className="flex gap-6">
                <div>
                  <p className="text-xl font-bold text-primary">{todayCount}</p>
                  <p className="text-xs text-muted-foreground">Hoje</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-primary">{weekCount}</p>
                  <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleCountReset}
                  title="Reiniciar contagem de hoje e semana"
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Zerar
                </button>
                <button
                  onClick={togglePause}
                  title={paused ? 'Reativar contagem' : 'Pausar contagem'}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                    paused
                      ? 'border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {paused ? '▶ Reativar' : '⏸ Pausar'}
                </button>
              </div>
            </div>
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

                {/* ── Ranking visual por disciplina */}
                {(() => {
                  const ranking = stats
                    .map(({ discipline, questions }) => {
                      const acc = getAccuracy(questions.map(q => q.id))
                      return acc ? { discipline, acc } : null
                    })
                    .filter((x): x is { discipline: Discipline; acc: { correct: number; answered: number; percent: number } } => x !== null)
                    // Critério principal: % de acerto. Desempate: mais respondido primeiro (amostra mais representante).
                    .sort((a, b) =>
                      a.acc.percent !== b.acc.percent
                        ? a.acc.percent - b.acc.percent
                        : b.acc.answered - a.acc.answered
                    )

                  const MIN_SAMPLE = 10
                  const reliable  = ranking.filter(r => r.acc.answered >= MIN_SAMPLE)
                  const lowSample = ranking.filter(r => r.acc.answered > 0 && r.acc.answered < MIN_SAMPLE)

                  if (ranking.length < 2) return null
                  const best  = reliable.length > 0 ? reliable[reliable.length - 1] : null
                  const worst = reliable.length > 0 ? reliable[0] : null

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="font-semibold">Desempenho por disciplina</h2>
                        <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />≥70%</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />50–69%</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />&lt;50%</span>
                        </div>
                      </div>

                      {best && worst ? (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-xl border border-green-200 dark:border-green-900/40 bg-green-50/60 dark:bg-green-950/20 px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 mb-1">Melhor desempenho</p>
                            <p className="text-xs font-medium truncate">{best.discipline.icon} {best.discipline.name}</p>
                            <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-0.5">{best.acc.percent}% acertos</p>
                            <p className="text-[10px] text-muted-foreground">{best.acc.answered - best.acc.correct} erros de {best.acc.answered}</p>
                          </div>
                          <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20 px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 dark:text-red-400 mb-1">Pior desempenho</p>
                            <p className="text-xs font-medium truncate">{worst.discipline.icon} {worst.discipline.name}</p>
                            <p className="text-xl font-bold text-red-500 dark:text-red-400 mt-0.5">{worst.acc.percent}% acertos</p>
                            <p className="text-[10px] text-muted-foreground">{worst.acc.answered - worst.acc.correct} erros de {worst.acc.answered}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mb-3 px-1">Responda ao menos {MIN_SAMPLE} questões em uma disciplina para ver o diagnóstico.</p>
                      )}

                      <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-3">
                        {reliable.length > 0 && (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground -mb-1">Taxa de acerto · pior → melhor</p>
                            {reliable.map(({ discipline, acc }) => {
                              const barColor = acc.percent >= 70 ? 'bg-green-500' : acc.percent >= 50 ? 'bg-amber-400' : 'bg-red-500'
                              const textColor = acc.percent >= 70 ? 'text-green-600' : acc.percent >= 50 ? 'text-amber-500' : 'text-red-500'
                              const errCount = acc.answered - acc.correct
                              return (
                                <div key={discipline.id}>
                                  <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="truncate max-w-[55%] font-medium">{discipline.icon} {discipline.name}</span>
                                    <span className="shrink-0 tabular-nums flex items-center gap-1.5">
                                      <span className="text-muted-foreground">{errCount} erro{errCount !== 1 ? 's' : ''}</span>
                                      <span className={cn('font-bold', textColor)}>{acc.percent}%</span>
                                    </span>
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                    <div className={cn('h-full rounded-full', barColor)} style={{ width: `${acc.percent}%` }} />
                                  </div>
                                </div>
                              )
                            })}
                          </>
                        )}
                        {lowSample.length > 0 && (
                          <>
                            <p className={cn('text-[10px] font-semibold uppercase tracking-wider text-muted-foreground -mb-1', reliable.length > 0 && 'border-t border-border pt-3')}>
                              Em observação (menos de {MIN_SAMPLE} respondidas)
                            </p>
                            {lowSample.map(({ discipline, acc }) => (
                              <div key={discipline.id} className="opacity-50">
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                  <span className="truncate max-w-[55%] font-medium">{discipline.icon} {discipline.name}</span>
                                  <span className="shrink-0 tabular-nums text-muted-foreground">{acc.answered} respondidas</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${acc.percent}%` }} />
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()}

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

                {/* Reinício geral */}
                <button
                  onClick={handleStatsBaseline}
                  className="w-full rounded-xl border border-dashed border-red-300 dark:border-red-900/50 px-4 py-2.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  Reinício geral das estatísticas
                </button>
              </div>
            )}
          </>
        )}

        {/* ══ ABA: SIMULADOS ════════════════════════════════════════════════ */}
        {activeTab === 'simulados' && (
          <>
            {simLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : simulados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="rounded-full bg-muted/60 p-5">
                  <ClipboardList size={32} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Nenhum simulado realizado ainda</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete seu primeiro simulado para ver o histórico aqui.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/simulado')}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Fazer primeiro simulado
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5 pt-1">

                {/* ── Resumo do histórico */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border bg-card p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{totalSimulados}</p>
                    <p className="text-xs text-muted-foreground">Simulados</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3 text-center">
                    <p className={cn(
                      'text-2xl font-bold',
                      avgAccuracy >= 70 ? 'text-green-500' : avgAccuracy >= 50 ? 'text-amber-500' : 'text-red-500'
                    )}>
                      {avgAccuracy}%
                    </p>
                    <p className="text-xs text-muted-foreground">Média geral</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3 text-center">
                    <p className={cn(
                      'text-2xl font-bold',
                      (bestSim?.accuracy_percentage ?? 0) >= 70 ? 'text-green-500' : 'text-amber-500'
                    )}>
                      {bestSim?.accuracy_percentage ?? 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Melhor nota</p>
                  </div>
                </div>

                {/* ── Lista de simulados */}
                <div>
                  <h2 className="font-semibold mb-3 flex items-center gap-2">
                    <ClipboardList size={16} className="text-primary" />
                    Histórico de simulados
                  </h2>
                  <div className="flex flex-col gap-2">
                    {simulados.map(sim => {
                      const duration = formatDuration(sim.duration_seconds)
                      const completedDate = new Date(sim.completed_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                      })

                      return (
                        <button
                          key={sim.id}
                          onClick={() => navigate(`/simulado/${sim.id}`)}
                          className="w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary/50 hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-start gap-3">
                              {/* Número do simulado */}
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary text-sm">
                                #{sim.simulado_number}
                              </div>

                              <div className="flex-1 min-w-0">
                                {/* Título e Trash */}
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-semibold truncate flex-1">{sim.title}</p>
                                  {sim.is_advanced && (
                                    <div className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary shrink-0">
                                      <BrainCircuit size={10} />
                                      <span className="text-[10px] font-medium">Adv</span>
                                    </div>
                                  )}
                                  <button 
                                    onClick={(e) => handleDeleteSimulado(e, sim.id)}
                                    disabled={deletingId === sim.id}
                                    className="p-1 rounded-md text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 transition-colors"
                                    title="Excluir Simulado"
                                  >
                                    {deletingId === sim.id ? (
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                                    ) : (
                                      <Trash2 size={16} />
                                    )}
                                  </button>
                                </div>

                              {/* Métricas inline */}
                              <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5">
                                <span className="text-xs text-muted-foreground">{completedDate}</span>
                                <span className="text-xs text-muted-foreground">
                                  {sim.total_correct}/{sim.total_answered} acertos
                                </span>
                                {duration && (
                                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                    <Clock size={10} />
                                    {duration}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Badge de aproveitamento + seta */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <AccuracyBadge percent={sim.accuracy_percentage} />
                              <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-2.5 ml-12">
                            <ProgressBar value={sim.total_correct} max={sim.total_answered || 1} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* CTA novo simulado */}
                <button
                  onClick={() => navigate('/simulado')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                >
                  <Target size={15} />
                  Fazer novo simulado
                </button>

              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
