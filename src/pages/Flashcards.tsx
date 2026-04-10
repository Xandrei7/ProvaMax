import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Brain,
  Check,
  Clock3,
  Flame,
  Gauge,
  Layers,
  ShieldAlert,
  SkipForward,
  Star,
  Target,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { getDisciplines, getFlashcards, getSubjects, reviewFlashcard } from '@/lib/dataService'
import { useAuth } from '@/contexts/AuthContext'
import type { Discipline, Flashcard, Subject } from '@/types'

type Phase = 'overview' | 'reviewing' | 'finished'
type ReviewMode = 'smart' | 'errors_only' | 'vespera' | 'hard_only' | 'critical'
type DisplayMode = 'quick' | 'deep'
type QuickSection = 'all' | 'new' | 'reviewing' | 'mastered' | 'simulado' | 'study'
type ReviewAction = 'correct' | 'easy' | 'wrong' | 'skip' | 'mastered'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getDifficultyScore(card: Flashcard): number {
  const total = card.times_correct + card.times_wrong
  if (total === 0) return 0
  return card.times_wrong / total
}

function getDifficultyInfo(card: Flashcard): { label: string; color: string; dot: string } {
  const score = getDifficultyScore(card)
  const total = card.times_correct + card.times_wrong
  if (total === 0) return { label: 'Novo', color: 'text-muted-foreground', dot: 'bg-muted-foreground' }
  if (score === 0) return { label: 'Fácil', color: 'text-green-500', dot: 'bg-green-500' }
  if (score <= 0.3) return { label: 'Médio', color: 'text-amber-500', dot: 'bg-amber-500' }
  return { label: 'Difícil', color: 'text-red-500', dot: 'bg-red-500' }
}

// Palavras-chave FCC que indicam pegadinhas clássicas
const FCC_TRAP_WORDS = ['SEMPRE', 'NUNCA', 'EXCETO', 'SALVO', 'APENAS', 'SOMENTE', 'EXCLUSIVAMENTE', 'VEDADO', 'PROIBIDO', 'OBRIGATORIAMENTE']

function hasFccTrap(text: string): boolean {
  const upper = text.toUpperCase()
  return FCC_TRAP_WORDS.some(kw => upper.includes(kw))
}

// ─── Fila Inteligente (O Cérebro do Sistema) ────────────────────────────────

function buildEliteQueue(cards: Flashcard[], mode: ReviewMode, disciplineId: string): Flashcard[] {
  const now = new Date()

  let base = disciplineId !== 'all'
    ? cards.filter(c => c.discipline_id === disciplineId)
    : cards

  // Score de prioridade composto
  const priorityScore = (c: Flashcard): number => {
    let s = 0
    s += c.times_wrong * 4              // erros = prioridade máxima
    s += hasFccTrap(c.front_text) ? 3 : 0  // pegadinhas FCC = bônus
    const interval = c.interval_days ?? 1
    if (interval <= 1) s += 6
    else if (interval <= 3) s += 3
    else if (interval <= 7) s += 1
    return s
  }

  if (mode === 'errors_only') {
    // Só cards com erro, do mais errado para o menos errado
    return base
      .filter(c => c.times_wrong > 0 && c.status !== 'mastered')
      .sort((a, b) => b.times_wrong - a.times_wrong || priorityScore(b) - priorityScore(a))
  }

  if (mode === 'hard_only') {
    // Só difíceis (difficulty_score > 0.3)
    return base
      .filter(c => getDifficultyScore(c) > 0.3 && c.status !== 'mastered')
      .sort((a, b) => getDifficultyScore(b) - getDifficultyScore(a) || b.times_wrong - a.times_wrong)
  }

  if (mode === 'vespera') {
    // Modo Véspera: todos os cards problemáticos, sem respeitar schedule
    return base
      .filter(c => c.status !== 'mastered')
      .filter(c => c.times_wrong > 0 || (c.interval_days ?? 1) <= 7 || c.times_seen > 2)
      .map(c => ({ card: c, score: priorityScore(c) + (c.times_seen * 0.2) }))
      .sort((a, b) => b.score - a.score)
      .map(({ card }) => card)
  }

  // Smart mode: VENCIDOS + ordenados por prioridade inteligente
  const nonMastered = base.filter(c => c.status !== 'mastered')
  const due = nonMastered.filter(c => !c.next_review_at || new Date(c.next_review_at) <= now)

  if (due.length === 0) return []

  // Ordena: erros > FCC traps > intervalo curto
  return [...due].sort((a, b) => priorityScore(b) - priorityScore(a) || b.times_wrong - a.times_wrong)
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function Flashcards() {
  const { user } = useAuth()

  const [phase, setPhase] = useState<Phase>('overview')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  const [quickSection, setQuickSection] = useState<QuickSection>('all')
  const [disciplineFilter, setDisciplineFilter] = useState('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | Flashcard['status']>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | Flashcard['source_type']>('all')

  const [displayMode, setDisplayMode] = useState<DisplayMode>('deep')
  const [reviewDiscipline, setReviewDiscipline] = useState('all')

  const [dueCards, setDueCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [activeReviewMode, setActiveReviewMode] = useState<ReviewMode>('smart')
  const [reviewError, setReviewError] = useState<string | null>(null)

  async function reloadFlashcards() {
    if (!user) return
    try {
      const loaded = await getFlashcards(user.id)
      setFlashcards(loaded)
    } catch (error) {
      console.error('[flashcards] reload failed:', error)
    }
  }

  useEffect(() => {
    async function loadData() {
      if (!user) return
      setLoading(true)
      try {
        const [loadedFlashcards, loadedDisciplines, loadedSubjects] = await Promise.all([
          getFlashcards(user.id),
          getDisciplines(),
          getSubjects(),
        ])
        setFlashcards(loadedFlashcards)
        setDisciplines(loadedDisciplines)
        setSubjects(loadedSubjects)
      } catch (error) {
        console.error('[flashcards] failed to load:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user])

  const disciplineNameById = useMemo(
    () => new Map(disciplines.map(d => [d.id, d.name])),
    [disciplines],
  )

  const subjectNameById = useMemo(
    () => new Map(subjects.map(s => [s.id, s.name])),
    [subjects],
  )

  // ── Base filtrada pelo seletor de disciplina do Modo Elite ─────────────────
  const eliteCards = useMemo(
    () => reviewDiscipline === 'all'
      ? flashcards
      : flashcards.filter(c => c.discipline_id === reviewDiscipline),
    [flashcards, reviewDiscipline],
  )

  // ── Contadores (todos dependem de eliteCards para refletir a disciplina) ────
  const now = new Date()
  const dueCount = eliteCards.filter(
    c => c.status !== 'mastered' && (!c.next_review_at || new Date(c.next_review_at) <= now),
  ).length
  const newCount = eliteCards.filter(c => c.status === 'new').length
  const reviewingCount = eliteCards.filter(c => c.status === 'reviewing').length
  const masteredCount = eliteCards.filter(c => c.status === 'mastered').length
  const simuladoCount = flashcards.filter(c => c.source_type === 'simulado').length
  const studyCount = flashcards.filter(c => c.source_type === 'study').length
  const errorsOnlyCount = eliteCards.filter(c => c.times_wrong > 0 && c.status !== 'mastered').length
  const hardCount = eliteCards.filter(c => getDifficultyScore(c) > 0.3 && c.status !== 'mastered').length
  const vesperaCount = eliteCards.filter(
    c => c.status !== 'mastered' && (c.times_wrong > 0 || (c.interval_days ?? 1) <= 7),
  ).length
  const criticalCount = (() => {
    try {
      const crits = new Set<string>(JSON.parse(localStorage.getItem('provamax_critical_qids') ?? '[]'))
      return eliteCards.filter(c => crits.has(c.question_id) && c.status !== 'mastered').length
    } catch { return 0 }
  })()

  // ── Filtros da lista ────────────────────────────────────────────────────────
  const sectionFiltered = useMemo(() => {
    return flashcards.filter(card => {
      if (quickSection === 'new') return card.status === 'new'
      if (quickSection === 'reviewing') return card.status === 'reviewing'
      if (quickSection === 'mastered') return card.status === 'mastered'
      if (quickSection === 'simulado') return card.source_type === 'simulado'
      if (quickSection === 'study') return card.source_type === 'study'
      return true
    })
  }, [flashcards, quickSection])

  const filteredFlashcards = useMemo(() => {
    return sectionFiltered.filter(card => {
      if (disciplineFilter !== 'all' && card.discipline_id !== disciplineFilter) return false
      if (subjectFilter !== 'all' && card.subject_id !== subjectFilter) return false
      if (statusFilter !== 'all' && card.status !== statusFilter) return false
      if (sourceFilter !== 'all' && card.source_type !== sourceFilter) return false
      return true
    })
  }, [sectionFiltered, disciplineFilter, subjectFilter, statusFilter, sourceFilter])

  // ── Adaptação automática: performance por disciplina ────────────────────────
  const disciplinePerformance = useMemo(() => {
    const map = new Map<string, { errors: number; total: number; name: string }>()
    for (const card of eliteCards) {
      const entry = map.get(card.discipline_id) ?? {
        errors: 0,
        total: 0,
        name: disciplineNameById.get(card.discipline_id) ?? 'Sem disciplina',
      }
      entry.total++
      if (card.times_wrong > 0) entry.errors += card.times_wrong
      map.set(card.discipline_id, entry)
    }
    return [...map.entries()]
      .map(([id, data]) => ({ id, ...data, errorRate: data.total > 0 ? data.errors / data.total : 0 }))
      .filter(d => d.errors > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5)
  }, [eliteCards, disciplineNameById])

  const groupedByDiscipline = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of flashcards) {
      counts.set(card.discipline_id, (counts.get(card.discipline_id) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([disciplineId, total]) => ({
        disciplineId,
        total,
        name: disciplineNameById.get(disciplineId) || 'Sem disciplina',
      }))
      .sort((a, b) => b.total - a.total)
  }, [flashcards, disciplineNameById])

  // ── Ações ────────────────────────────────────────────────────────────────────

  function getCriticalIds(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem('provamax_critical_qids') ?? '[]')) } catch { return new Set() }
  }

  function startReview(mode: ReviewMode, discId = reviewDiscipline) {
    let queue: Flashcard[]
    if (mode === 'critical') {
      const crits = getCriticalIds()
      const base = discId !== 'all' ? flashcards.filter(c => c.discipline_id === discId) : flashcards
      queue = base.filter(c => crits.has(c.question_id) && c.status !== 'mastered')
    } else {
      queue = buildEliteQueue(flashcards, mode, discId)
    }
    if (queue.length === 0) {
      setPhase('finished')
      return
    }
    setActiveReviewMode(mode)
    setDueCards(queue)
    setCurrentIndex(0)
    setShowAnswer(false)
    setPhase('reviewing')
  }

  async function handleReviewAction(action: ReviewAction) {
    if (!user || updating) return
    const card = dueCards[currentIndex]
    if (!card) return

    setUpdating(true)
    setReviewError(null)
    try {
      const updated = await reviewFlashcard(card.id, action, user.id)
      if (updated) {
        setFlashcards(prev => prev.map(item => (item.id === updated.id ? updated : item)))
      }
      setShowAnswer(false)
      if (action === 'wrong') {
        // Requeue card at end of session (Anki-style)
        setDueCards(prev => [...prev, card])
        setCurrentIndex(prev => prev + 1)
      } else if (currentIndex < dueCards.length - 1) {
        setCurrentIndex(prev => prev + 1)
      } else {
        setPhase('finished')
      }
    } catch (error) {
      console.error('[flashcards] review update failed:', error)
      setReviewError('Falha ao salvar resposta. Tente novamente.')
    } finally {
      setUpdating(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // ── Finished ─────────────────────────────────────────────────────────────────
  if (phase === 'finished') {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header title="Revisão concluída" showBack={false} />
        <main className="mx-auto flex-1 w-full max-w-lg px-4 pb-24 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-green-500/10 p-6 mb-5">
            <Trophy size={46} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Boa revisão!</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Você finalizou a sessão. O sistema já agendou os próximos cards no tempo certo.
          </p>
          <button
            onClick={() => { void reloadFlashcards(); setPhase('overview') }}
            className="rounded-xl border border-border bg-card px-6 py-3 font-semibold hover:bg-muted/50"
          >
            Voltar para Flashcards
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Reviewing ────────────────────────────────────────────────────────────────
  if (phase === 'reviewing') {
    const currentCard = dueCards[currentIndex]
    const isQuick = displayMode === 'quick'

    if (!currentCard) {
      return (
        <div className="flex min-h-screen flex-col bg-background">
          <Header title="Flashcards" showBack={false} />
          <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 flex items-center justify-center">
            <button
              onClick={() => { void reloadFlashcards(); setPhase('overview') }}
              className="rounded-xl border border-border bg-card px-6 py-3 font-semibold"
            >
              Voltar ao painel
            </button>
          </main>
          <BottomNav />
        </div>
      )
    }

    const cardDifficulty = getDifficultyInfo(currentCard)
    const isFccTrap = hasFccTrap(currentCard.front_text)
    const progress = Math.round(((currentIndex + 1) / dueCards.length) * 100)

    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Header da revisão */}
        <div className="sticky top-0 z-20 border-b border-border bg-background px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => { void reloadFlashcards(); setPhase('overview') }}
            className="text-sm text-muted-foreground hover:text-foreground shrink-0"
          >
            Sair
          </button>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Rápido/Profundo */}
            <button
              onClick={() => setDisplayMode(isQuick ? 'deep' : 'quick')}
              className={`text-xs px-2 py-1 rounded-full border font-semibold transition-colors ${
                isQuick
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-600'
                  : 'border-primary/40 bg-primary/10 text-primary'
              }`}
            >
              {isQuick ? 'Rápido' : 'Profundo'}
            </button>
            <span className="text-xs font-semibold text-muted-foreground w-12 text-right">
              {currentIndex + 1}/{dueCards.length}
            </span>
          </div>
        </div>

        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 pb-36 flex flex-col gap-4">
          {/* Badges do card */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`text-xs font-semibold flex items-center gap-1 ${cardDifficulty.color}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${cardDifficulty.dot}`} />
              {cardDifficulty.label}
            </span>
            {currentCard.times_wrong > 0 && (
              <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                <X size={11} /> {currentCard.times_wrong} erro{currentCard.times_wrong > 1 ? 's' : ''}
              </span>
            )}
            {isFccTrap && (
              <span className="text-xs text-orange-500 font-semibold flex items-center gap-1">
                <AlertTriangle size={11} /> Pegadinha FCC
              </span>
            )}
            {activeReviewMode === 'vespera' && (
              <span className="text-xs text-purple-500 font-semibold">Véspera</span>
            )}
          </div>

          {/* Frente do card */}
          <div className="rounded-2xl border border-border bg-card p-6 min-h-[200px] flex items-center justify-center text-center">
            <h2 className="text-lg font-semibold leading-relaxed">{currentCard.front_text}</h2>
          </div>

          {!showAnswer && (
            <button
              onClick={() => setShowAnswer(true)}
              className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Mostrar resposta
            </button>
          )}

          {showAnswer && (
            <div className="flex flex-col gap-3 animate-in fade-in duration-300">
              {/* Resposta (sempre visível) */}
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold mb-1">Resposta direta</p>
                <p className="text-sm text-muted-foreground">{currentCard.back_answer}</p>
              </div>

              {/* Modo Profundo: mostra pegadinha e antídoto */}
              {!isQuick && (
                <>
                  <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert size={15} className="text-red-500" />
                      <p className="text-sm font-semibold text-red-500">A pegadinha</p>
                    </div>
                    <p className="text-sm text-red-900/80 dark:text-red-100/80">{currentCard.back_trap}</p>
                  </div>

                  <div className="rounded-xl border border-green-500/25 bg-green-500/5 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap size={15} className="text-green-500" />
                      <p className="text-sm font-semibold text-green-600">Antídoto (SE → ENTÃO)</p>
                    </div>
                    <p className="text-sm text-green-900/80 dark:text-green-100/80">{currentCard.back_antidote}</p>
                  </div>
                </>
              )}

              {/* Próxima revisão estimada */}
              <p className="text-center text-xs text-muted-foreground">
                Intervalo atual: {Math.round(currentCard.interval_days ?? 1)}d · ease: {(currentCard.ease_factor ?? 2.5).toFixed(1)}
              </p>
            </div>
          )}
        </main>

        {/* Botões de ação */}
        {showAnswer && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-3 z-30">
            <div className="mx-auto max-w-lg flex flex-col gap-2">
              {reviewError && (
                <p className="text-center text-xs text-red-500 font-semibold py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                  {reviewError}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleReviewAction('wrong')}
                  disabled={updating}
                  className="rounded-lg border border-red-500/35 bg-red-500/10 text-red-500 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2"><X size={16} /> Errei</span>
                </button>
                <button
                  onClick={() => handleReviewAction('correct')}
                  disabled={updating}
                  className="rounded-lg bg-green-600 text-white py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2"><Check size={16} /> Acertei</span>
                </button>
                <button
                  onClick={() => handleReviewAction('skip')}
                  disabled={updating}
                  className="rounded-lg border border-border bg-card py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2"><SkipForward size={16} /> Pular</span>
                </button>
                <button
                  onClick={() => handleReviewAction('mastered')}
                  disabled={updating}
                  className="rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-600 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2"><Star size={16} /> Dominado</span>
                </button>
              </div>
              <button
                onClick={() => handleReviewAction('easy')}
                disabled={updating}
                className="rounded-lg border border-primary/30 bg-primary/5 text-primary py-2 text-sm font-semibold disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2"><Zap size={14} /> Muito fácil (aumenta intervalo)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Overview ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Flashcards" showBack={false} />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 pb-28">
        <div className="flex flex-col gap-5">

          {/* MODO ELITE Banner */}
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="text-primary" size={20} />
              <p className="font-bold text-primary text-sm uppercase tracking-wide">Modo Elite</p>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Repetição espaçada + priorização por erro + adaptação automática
            </p>

            {/* Filtro de disciplina para revisão */}
            <select
              value={reviewDiscipline}
              onChange={e => setReviewDiscipline(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs mb-3"
            >
              <option value="all">Todas as disciplinas</option>
              {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            {/* 4 modos de revisão */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => startReview('smart', reviewDiscipline)}
                disabled={dueCount === 0}
                className="rounded-xl bg-primary text-primary-foreground px-3 py-3 text-xs font-semibold disabled:opacity-40 flex flex-col items-center gap-1"
              >
                <Target size={16} />
                <span>Revisão Inteligente</span>
                <span className="opacity-80">{dueCount} agendados</span>
              </button>

              <button
                onClick={() => startReview('errors_only', reviewDiscipline)}
                disabled={errorsOnlyCount === 0}
                className="rounded-xl bg-red-500 text-white px-3 py-3 text-xs font-semibold disabled:opacity-40 flex flex-col items-center gap-1"
              >
                <Flame size={16} />
                <span>Só Erros</span>
                <span className="opacity-80">{errorsOnlyCount} cards</span>
              </button>

              <button
                onClick={() => startReview('vespera', reviewDiscipline)}
                disabled={vesperaCount === 0}
                className="rounded-xl bg-purple-600 text-white px-3 py-3 text-xs font-semibold disabled:opacity-40 flex flex-col items-center gap-1"
              >
                <AlertTriangle size={16} />
                <span>Véspera de Prova</span>
                <span className="opacity-80">{vesperaCount} cards</span>
              </button>

              <button
                onClick={() => startReview('hard_only', reviewDiscipline)}
                disabled={hardCount === 0}
                className="rounded-xl bg-orange-500 text-white px-3 py-3 text-xs font-semibold disabled:opacity-40 flex flex-col items-center gap-1"
              >
                <Gauge size={16} />
                <span>Só Difíceis</span>
                <span className="opacity-80">{hardCount} cards</span>
              </button>

              <button
                onClick={() => startReview('critical', reviewDiscipline)}
                disabled={criticalCount === 0}
                className="col-span-2 rounded-xl bg-rose-700 text-white px-3 py-3 text-xs font-semibold disabled:opacity-40 flex flex-col items-center gap-1"
              >
                <ShieldAlert size={16} />
                <span>Críticos (P / C)</span>
                <span className="opacity-80">{criticalCount} cards</span>
              </button>
            </div>

            {/* Toggle Rápido/Profundo */}
            <div className="mt-3 flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Modo de exibição:</p>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setDisplayMode('quick')}
                  className={`px-3 py-1.5 text-xs font-semibold ${displayMode === 'quick' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}
                >
                  Rápido
                </button>
                <button
                  onClick={() => setDisplayMode('deep')}
                  className={`px-3 py-1.5 text-xs font-semibold ${displayMode === 'deep' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}
                >
                  Profundo
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{eliteCards.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Novos</p>
              <p className="text-2xl font-bold text-amber-500">{newCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Em revisão</p>
              <p className="text-2xl font-bold text-sky-500">{reviewingCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Dominados</p>
              <p className="text-2xl font-bold text-green-500">{masteredCount}</p>
            </div>
          </div>

          {/* Adaptação automática: disciplinas com mais erros */}
          {disciplinePerformance.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={15} className="text-red-500" />
                <p className="font-semibold text-sm text-red-600">Precisa de atenção</p>
              </div>
              <div className="flex flex-col gap-2">
                {disciplinePerformance.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-medium">{item.name}</p>
                      <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden w-full">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${Math.min(100, item.errorRate * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <span className="text-xs text-red-500 font-bold">{item.errors} erros</span>
                      <button
                        onClick={() => {
                          setReviewDiscipline(item.id)
                          startReview('errors_only', item.id)
                        }}
                        className="text-[11px] rounded-full bg-red-500 text-white px-2 py-0.5 font-semibold"
                      >
                        Focar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seções rápidas */}
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Seções</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'new', label: 'Novos' },
                { key: 'reviewing', label: 'Em revisão' },
                { key: 'mastered', label: 'Dominados' },
                { key: 'simulado', label: `Simulados (${simuladoCount})` },
                { key: 'study', label: `Estudo (${studyCount})` },
              ].map(section => (
                <button
                  key={section.key}
                  onClick={() => setQuickSection(section.key as QuickSection)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${quickSection === section.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros */}
          <div className="rounded-xl border border-border bg-card p-3 grid grid-cols-2 gap-2">
            <select
              value={disciplineFilter}
              onChange={e => { setDisciplineFilter(e.target.value); setSubjectFilter('all') }}
              className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
            >
              <option value="all">Disciplina: todas</option>
              {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
            >
              <option value="all">Assunto: todos</option>
              {subjects
                .filter(s => disciplineFilter === 'all' || s.discipline_id === disciplineFilter)
                .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'all' | Flashcard['status'])}
              className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
            >
              <option value="all">Status: todos</option>
              <option value="new">Novos</option>
              <option value="reviewing">Em revisão</option>
              <option value="mastered">Dominados</option>
            </select>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value as 'all' | Flashcard['source_type'])}
              className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
            >
              <option value="all">Origem: todas</option>
              <option value="study">Estudo</option>
              <option value="simulado">Simulado</option>
              <option value="review">Revisão</option>
              <option value="import">Importação</option>
            </select>
          </div>

          {/* Lista de flashcards */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold">Lista de flashcards</p>
              <span className="text-xs text-muted-foreground">{filteredFlashcards.length} itens</span>
            </div>

            {filteredFlashcards.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Layers size={22} className="mx-auto mb-2 opacity-60" />
                <p className="text-sm">Nenhum flashcard para esse filtro.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredFlashcards.map(card => {
                  const diff = getDifficultyInfo(card)
                  const fccTrap = hasFccTrap(card.front_text)
                  return (
                    <div key={card.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-relaxed flex-1">{card.front_text}</p>
                        <span className={`text-[11px] font-bold shrink-0 flex items-center gap-1 ${diff.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${diff.dot}`} />
                          {diff.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{card.back_answer}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full border border-border px-2 py-0.5">{card.status}</span>
                        <span className="rounded-full border border-border px-2 py-0.5">
                          {Math.round(card.interval_days ?? 1)}d intervalo
                        </span>
                        {card.times_wrong > 0 && (
                          <span className="rounded-full border border-red-500/30 bg-red-500/10 text-red-500 px-2 py-0.5">
                            {card.times_wrong} erro{card.times_wrong > 1 ? 's' : ''}
                          </span>
                        )}
                        {fccTrap && (
                          <span className="rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-500 px-2 py-0.5">
                            FCC trap
                          </span>
                        )}
                        <span className="rounded-full border border-border px-2 py-0.5 inline-flex items-center gap-1">
                          <Clock3 size={10} /> {formatDate(card.last_reviewed_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {disciplineNameById.get(card.discipline_id) || 'Sem disciplina'} · {subjectNameById.get(card.subject_id) || 'Sem assunto'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Por disciplina */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={14} className="text-muted-foreground" />
              <p className="font-semibold">Por disciplina</p>
            </div>
            {groupedByDiscipline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {groupedByDiscipline.map(item => (
                  <div key={item.disciplineId} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{item.total}</span>
                      <button
                        onClick={() => {
                          setReviewDiscipline(item.disciplineId)
                          startReview('smart', item.disciplineId)
                        }}
                        className="text-[10px] rounded-full border border-primary/30 text-primary px-2 py-0.5"
                      >
                        Revisar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
      <BottomNav />
    </div>
  )
}
