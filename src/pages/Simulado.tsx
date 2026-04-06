import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, CheckCircle2, ChevronRight, Shuffle, BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { ProgressBar } from '@/components/ProgressBar'
import { getDisciplines, getSubjects, getQuestions } from '@/lib/dataService'
import { useStudy } from '@/contexts/StudyContext'
import { shuffle, cn } from '@/lib/utils'
import type { Discipline, Subject, Question } from '@/types'

type SimTab = 'basico' | 'avancado'
type Phase = 'setup' | 'running' | 'result'

interface SimAnswer {
  questionId: string
  selected: string | null
  isCorrect: boolean
  disciplineId: string
  subjectId: string
}

// ─── Interleaving algorithm ─────────────────────────────────────────────────
// Mini-blocked interleaving (2+3+2+3…): cycles through subjects taking
// alternating block sizes of 2 and 3 questions before switching topic.
// This matches the Rohrer & Taylor (2007) optimal interleaving pattern.
function buildInterleavedQuestions(
  questionsBySubject: Map<string, Question[]>,
  totalCount: number
): Question[] {
  const pools = new Map<string, Question[]>()
  for (const [sid, qs] of questionsBySubject) {
    pools.set(sid, shuffle([...qs]))
  }

  const subjectIds = shuffle(Array.from(pools.keys()))
  const pointers = new Map<string, number>()
  subjectIds.forEach(id => pointers.set(id, 0))

  const result: Question[] = []
  const blockPattern = [2, 3]
  let blockPatternIdx = 0
  let subjectCursor = 0
  let rounds = 0

  while (result.length < totalCount && rounds < subjectIds.length * 200) {
    rounds++
    const subjectId = subjectIds[subjectCursor % subjectIds.length]
    const pool = pools.get(subjectId)!
    const ptr = pointers.get(subjectId) ?? 0

    if (ptr >= pool.length) {
      // pool exhausted — skip this subject
      subjectCursor++
      const allDone = subjectIds.every(sid => (pointers.get(sid) ?? 0) >= (pools.get(sid)?.length ?? 0))
      if (allDone) break
      continue
    }

    const blockSize = blockPattern[blockPatternIdx % blockPattern.length]
    let taken = 0
    while (taken < blockSize && result.length < totalCount && ptr + taken < pool.length) {
      result.push(pool[ptr + taken])
      taken++
    }
    pointers.set(subjectId, ptr + taken)
    blockPatternIdx++
    subjectCursor++
  }

  return result
}

export function Simulado() {
  const navigate = useNavigate()
  const { recordAnswer } = useStudy()

  const [simTab, setSimTab] = useState<SimTab>('basico')
  const [phase, setPhase] = useState<Phase>('setup')
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  // ── Básico setup ─────────────────────────────────────────────────────────
  const [basicDiscs, setBasicDiscs] = useState<Set<string>>(new Set())
  const [questionCount, setQuestionCount] = useState(20)
  const [timeMinutes, setTimeMinutes] = useState(30)

  // ── Avançado setup ───────────────────────────────────────────────────────
  const [advDiscs, setAdvDiscs] = useState<Set<string>>(new Set())
  const [advSubjects, setAdvSubjects] = useState<Set<string>>(new Set())
  const [advQuestionCount, setAdvQuestionCount] = useState(20)
  const [advTimeMinutes, setAdvTimeMinutes] = useState(30)
  const [expandedDisc, setExpandedDisc] = useState<string | null>(null)

  // ── Running state ────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [simAnswers, setSimAnswers] = useState<SimAnswer[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [activeTime, setActiveTime] = useState(0)
  const [isAdvancedRun, setIsAdvancedRun] = useState(false)
  const simAnswersRef = useRef<SimAnswer[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishedRef = useRef(false)
  simAnswersRef.current = simAnswers

  useEffect(() => {
    async function load() {
      const [discs, subs, qs] = await Promise.all([getDisciplines(), getSubjects(), getQuestions()])
      setDisciplines(discs)
      setSubjects(subs)
      setAllQuestions(qs)
      setLoading(false)
    }
    load()
  }, [])

  // Timer
  useEffect(() => {
    if (phase !== 'running' || activeTime === 0) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          if (!finishedRef.current) {
            finishedRef.current = true
            doFinish(simAnswersRef.current)
          }
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, activeTime])

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── Básico ────────────────────────────────────────────────────────────────
  function getBasicPool() {
    if (basicDiscs.size > 0) return allQuestions.filter(q => basicDiscs.has(q.discipline_id))
    return allQuestions
  }

  function startBasico() {
    const pool = getBasicPool()
    const qs = shuffle(pool).slice(0, Math.min(questionCount, pool.length))
    launchRun(qs, timeMinutes, false)
  }

  // ── Avançado ─────────────────────────────────────────────────────────────
  function getAdvPool() {
    let qs = allQuestions
    if (advDiscs.size > 0) qs = qs.filter(q => advDiscs.has(q.discipline_id))
    if (advSubjects.size > 0) qs = qs.filter(q => advSubjects.has(q.subject_id))
    return qs
  }

  const advPool = getAdvPool()
  const advEligibleDiscs = disciplines.filter(d =>
    allQuestions.some(q => q.discipline_id === d.id)
  )
  const canStartAdv = (advDiscs.size === 0 ? advEligibleDiscs.length : advDiscs.size) >= 2

  function startAvancado() {
    const pool = getAdvPool()
    const bySubject = new Map<string, Question[]>()
    for (const q of pool) {
      if (!bySubject.has(q.subject_id)) bySubject.set(q.subject_id, [])
      bySubject.get(q.subject_id)!.push(q)
    }
    const total = Math.min(advQuestionCount, pool.length)
    const qs = buildInterleavedQuestions(bySubject, total)
    launchRun(qs, advTimeMinutes, true)
  }

  function launchRun(qs: Question[], mins: number, isAdv: boolean) {
    finishedRef.current = false
    setQuestions(qs)
    setSimAnswers([])
    setCurrentIndex(0)
    setSelected(null)
    setActiveTime(mins * 60)
    setTimeLeft(mins * 60)
    setIsAdvancedRun(isAdv)
    setPhase('running')
  }

  function handleNext() {
    const q = questions[currentIndex]
    const newAnswer: SimAnswer = {
      questionId: q.id,
      selected,
      isCorrect: selected === q.correct_answer,
      disciplineId: q.discipline_id,
      subjectId: q.subject_id,
    }
    const updated = [...simAnswersRef.current, newAnswer]
    setSimAnswers(updated)
    setSelected(null)

    if (currentIndex === questions.length - 1) {
      finishedRef.current = true
      doFinish(updated)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  function doFinish(answers: SimAnswer[]) {
    if (timerRef.current) clearInterval(timerRef.current)
    for (const a of answers) {
      if (a.selected !== null) {
        recordAnswer({
          questionId: a.questionId,
          selectedAnswer: a.selected,
          isCorrect: a.isCorrect,
          answeredAt: new Date().toISOString(),
        })
      }
    }
    setPhase('result')
  }

  // ── Discipline/subject selectors ─────────────────────────────────────────
  function toggleAdvDisc(id: string) {
    setAdvDiscs(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        // also deselect all subjects of this discipline
        const discSubIds = subjects.filter(s => s.discipline_id === id).map(s => s.id)
        setAdvSubjects(ps => { const ns = new Set(ps); discSubIds.forEach(sid => ns.delete(sid)); return ns })
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAdvSubject(id: string, disciplineId: string) {
    setAdvSubjects(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    // auto-select discipline if not yet selected
    setAdvDiscs(prev => { const next = new Set(prev); next.add(disciplineId); return next })
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // ── RUNNING ───────────────────────────────────────────────────────────────
  if (phase === 'running') {
    const currentQuestion = questions[currentIndex]
    if (!currentQuestion) return null
    const options =
      currentQuestion.type === 'true_false'
        ? [{ letter: 'C', text: 'Certo' }, { letter: 'E', text: 'Errado' }]
        : (currentQuestion.options ?? [])
    const isLow = activeTime > 0 && timeLeft > 0 && timeLeft <= 60
    const currentSubject = subjects.find(s => s.id === currentQuestion.subject_id)
    const currentDisc = disciplines.find(d => d.id === currentQuestion.discipline_id)

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-2">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{currentIndex + 1}/{questions.length}</span>
            <div className="flex-1"><ProgressBar value={currentIndex} max={questions.length} /></div>
            {activeTime > 0 && (
              <div className={cn(
                'flex items-center gap-1 text-sm font-mono font-semibold shrink-0',
                isLow ? 'text-red-500 animate-pulse' : 'text-muted-foreground'
              )}>
                <Clock size={13} />
                {formatTime(timeLeft)}
              </div>
            )}
          </div>
          {isAdvancedRun && currentSubject && (
            <p className="text-xs text-muted-foreground">
              {currentDisc?.icon} {currentDisc?.name} › {currentSubject.name}
            </p>
          )}
        </div>

        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Questão {currentIndex + 1} de {questions.length}</span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                currentQuestion.type === 'true_false' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
              )}>
                {currentQuestion.type === 'true_false' ? 'C/E' : 'Múltipla escolha'}
              </span>
            </div>

            <p className="text-base leading-relaxed">{currentQuestion.statement}</p>

            <div className={cn('flex flex-col gap-2', currentQuestion.type === 'true_false' && 'flex-row')}>
              {options.map(opt => (
                <button
                  key={opt.letter}
                  onClick={() => setSelected(opt.letter)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                    currentQuestion.type === 'true_false' && 'flex-1 justify-center',
                    selected === opt.letter
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary hover:bg-primary/5'
                  )}
                >
                  {currentQuestion.type !== 'true_false' && <span className="font-bold shrink-0">{opt.letter}.</span>}
                  <span>{opt.text}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={!selected}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {currentIndex === questions.length - 1 ? 'Finalizar Simulado' : 'Próxima questão'}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Gabarito e comentários aparecem apenas no resultado final.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const answered = simAnswers.filter(a => a.selected !== null).length
    const correct = simAnswers.filter(a => a.isCorrect).length
    const wrong = answered - correct
    const skipped = questions.length - answered
    const percent = answered === 0 ? 0 : Math.round((correct / answered) * 100)

    const discBreakdown = disciplines
      .map(d => {
        const dQs = questions.filter(q => q.discipline_id === d.id)
        if (dQs.length === 0) return null
        const dAns = simAnswers.filter(a => dQs.some(q => q.id === a.questionId) && a.selected !== null)
        if (dAns.length === 0) return null
        const dCorrect = dAns.filter(a => a.isCorrect).length
        const dPercent = Math.round((dCorrect / dAns.length) * 100)

        const subBreakdown = subjects
          .filter(s => s.discipline_id === d.id)
          .map(s => {
            const sQs = dQs.filter(q => q.subject_id === s.id)
            const sAns = simAnswers.filter(a => sQs.some(q => q.id === a.questionId) && a.selected !== null)
            if (sAns.length === 0) return null
            const sC = sAns.filter(a => a.isCorrect).length
            return { subject: s, answered: sAns.length, correct: sC, percent: Math.round((sC / sAns.length) * 100) }
          })
          .filter(Boolean) as { subject: Subject; answered: number; correct: number; percent: number }[]

        return { discipline: d, answered: dAns.length, correct: dCorrect, percent: dPercent, subBreakdown }
      })
      .filter(Boolean) as { discipline: Discipline; answered: number; correct: number; percent: number; subBreakdown: { subject: Subject; answered: number; correct: number; percent: number }[] }[]

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header title="Resultado do Simulado" showBack={false} />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
          <div className="flex flex-col gap-5">
            {isAdvancedRun && (
              <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-2">
                <BrainCircuit size={16} className="text-primary shrink-0" />
                <p className="text-xs text-primary font-medium">Simulado Avançado — treino interleaved aplicado</p>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className={cn(
                'text-5xl font-bold mb-1',
                percent >= 70 ? 'text-green-500' : percent >= 50 ? 'text-amber-500' : 'text-red-500'
              )}>
                {percent}%
              </p>
              <p className="text-muted-foreground text-sm">Aproveitamento</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-green-500">{correct}</p>
                <p className="text-xs text-muted-foreground">Acertos</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{wrong}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{skipped}</p>
                <p className="text-xs text-muted-foreground">Puladas</p>
              </div>
            </div>

            {discBreakdown.length > 0 && (
              <div>
                <h2 className="font-semibold mb-2">Desempenho por matéria</h2>
                <div className="flex flex-col gap-2">
                  {discBreakdown.map(b => (
                    <div key={b.discipline.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{b.discipline.icon}</span>
                        <span className="flex-1 font-medium text-sm">{b.discipline.name}</span>
                        <span className={cn(
                          'font-bold text-sm',
                          b.percent >= 70 ? 'text-green-500' : b.percent >= 50 ? 'text-amber-500' : 'text-red-500'
                        )}>
                          {b.percent}%
                        </span>
                      </div>
                      <ProgressBar value={b.correct} max={b.answered} showLabel />
                      {b.subBreakdown.length > 1 && (
                        <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                          {b.subBreakdown.map(s => (
                            <div key={s.subject.id} className="flex items-center gap-2 text-xs">
                              <span className="flex-1 text-muted-foreground truncate">{s.subject.name}</span>
                              <span className="text-muted-foreground">{s.correct}/{s.answered}</span>
                              <span className={cn(
                                'font-semibold w-8 text-right',
                                s.percent >= 70 ? 'text-green-500' : s.percent >= 50 ? 'text-amber-500' : 'text-red-500'
                              )}>
                                {s.percent}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {wrong > 0 && (
                <button onClick={() => navigate('/errors')} className="rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted/50">
                  Revisar {wrong} erro{wrong > 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={() => { setPhase('setup'); setSimAnswers([]) }}
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted/50"
              >
                Novo simulado
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Voltar ao início <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── SETUP ─────────────────────────────────────────────────────────────────
  const basicPool = getBasicPool()
  const basicMax = basicPool.length

  const timeOptions = [
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '1h', value: 60 },
    { label: '2h', value: 120 },
    { label: 'Sem limite', value: 0 },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Simulado" subtitle="Treine como se fosse a prova" />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-xl bg-muted/50 p-1 mb-5">
          <button
            onClick={() => setSimTab('basico')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all',
              simTab === 'basico' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Shuffle size={15} />
            Básico
          </button>
          <button
            onClick={() => setSimTab('avancado')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all',
              simTab === 'avancado' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <BrainCircuit size={15} />
            Avançado
          </button>
        </div>

        {/* ── BÁSICO ─────────────────────────────────────────────────── */}
        {simTab === 'basico' && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">
              Questões aleatórias em modo prova — sem gabarito durante. Resultado e comentários apenas no final.
            </p>

            {/* Disciplines */}
            <div>
              <h2 className="font-semibold mb-1">Matérias</h2>
              <p className="text-xs text-muted-foreground mb-2">Sem seleção = todas as matérias.</p>
              <div className="flex flex-col gap-2">
                {disciplines.map(d => {
                  const count = allQuestions.filter(q => q.discipline_id === d.id).length
                  const sel = basicDiscs.has(d.id)
                  return (
                    <button
                      key={d.id}
                      onClick={() => {
                        setBasicDiscs(prev => { const n = new Set(prev); if (sel) n.delete(d.id); else n.add(d.id); return n })
                      }}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                        sel ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                      )}
                    >
                      <span className="text-xl">{d.icon}</span>
                      <span className="flex-1 font-medium text-sm">{d.name}</span>
                      <span className="text-xs text-muted-foreground">{count} questões</span>
                      {sel && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Count */}
            <div>
              <h2 className="font-semibold mb-2">Número de questões</h2>
              <div className="flex gap-2 flex-wrap">
                {[10, 20, 30, 50].filter(n => n <= basicMax).concat(basicMax > 50 ? [basicMax] : []).map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={cn(
                      'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                      questionCount === n ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {n === basicMax && n > 50 ? `Todas (${n})` : n}
                  </button>
                ))}
              </div>
            </div>

            {/* Time */}
            <div>
              <h2 className="font-semibold mb-2">Tempo disponível</h2>
              <div className="flex gap-2 flex-wrap">
                {timeOptions.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTimeMinutes(t.value)}
                    className={cn(
                      'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                      timeMinutes === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {basicMax === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Importe questões primeiro.</p>
            ) : (
              <button onClick={startBasico} className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Iniciar Simulado — {Math.min(questionCount, basicMax)} questões
                {timeMinutes > 0 ? ` · ${timeMinutes} min` : ''}
              </button>
            )}
          </div>
        )}

        {/* ── AVANÇADO ───────────────────────────────────────────────── */}
        {simTab === 'avancado' && (
          <div className="flex flex-col gap-5">
            {/* Explanation card */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <BrainCircuit size={16} className="text-primary shrink-0" />
                <p className="text-sm font-semibold text-primary">Treino Interleaved (Mini-Blocked)</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Baseado em Rohrer & Taylor (2007): alternar 2-3 questões por assunto antes de trocar aumenta a retenção em até <strong>65%</strong> comparado a estudar um assunto de cada vez. O cérebro é forçado a identificar qual estratégia usar — exatamente o que a prova exige.
              </p>
              {!canStartAdv && (
                <p className="text-xs text-amber-600 font-medium">
                  Selecione ao menos 2 matérias (ou deixe todas) para ativar o modo avançado.
                </p>
              )}
            </div>

            {/* Discipline + Subject selection */}
            <div>
              <h2 className="font-semibold mb-1">Matérias e assuntos</h2>
              <p className="text-xs text-muted-foreground mb-2">
                Sem seleção = todas as matérias. Expanda para escolher assuntos específicos.
              </p>
              <div className="flex flex-col gap-2">
                {advEligibleDiscs.map(d => {
                  const discQs = allQuestions.filter(q => q.discipline_id === d.id)
                  const discSubs = subjects.filter(s => s.discipline_id === d.id && discQs.some(q => q.subject_id === s.id))
                  const discSel = advDiscs.has(d.id)
                  const isExpanded = expandedDisc === d.id
                  const selectedSubCount = discSubs.filter(s => advSubjects.has(s.id)).length

                  return (
                    <div key={d.id} className={cn(
                      'rounded-xl border overflow-hidden transition-all',
                      discSel ? 'border-primary' : 'border-border'
                    )}>
                      <div className="flex items-center gap-0 px-1 py-1">
                        <button
                          onClick={() => toggleAdvDisc(d.id)}
                          className={cn(
                            'flex-1 flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-all',
                            discSel ? 'bg-primary/10' : 'hover:bg-muted/30'
                          )}
                        >
                          <span className="text-xl">{d.icon}</span>
                          <div className="flex-1">
                            <span className="font-medium text-sm">{d.name}</span>
                            {selectedSubCount > 0 && (
                              <span className="text-xs text-primary ml-2">{selectedSubCount} assunto{selectedSubCount > 1 ? 's' : ''} selecionado{selectedSubCount > 1 ? 's' : ''}</span>
                            )}
                          </div>
                          {discSel && <CheckCircle2 size={15} className="text-primary shrink-0" />}
                        </button>
                        <button
                          onClick={() => setExpandedDisc(isExpanded ? null : d.id)}
                          className="p-2 text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {isExpanded && discSubs.length > 0 && (
                        <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
                          <p className="text-xs text-muted-foreground mb-1">Selecione assuntos específicos (opcional):</p>
                          {discSubs.map(s => {
                            const sel = advSubjects.has(s.id)
                            const count = discQs.filter(q => q.subject_id === s.id).length
                            return (
                              <button
                                key={s.id}
                                onClick={() => toggleAdvSubject(s.id, d.id)}
                                className={cn(
                                  'flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all',
                                  sel ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                                )}
                              >
                                <span className="flex-1 text-sm">{s.name}</span>
                                <span className="text-xs text-muted-foreground">{count}q</span>
                                {sel && <CheckCircle2 size={14} className="text-primary shrink-0" />}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Count */}
            <div>
              <h2 className="font-semibold mb-2">Número de questões</h2>
              <div className="flex gap-2 flex-wrap">
                {[10, 20, 30, 50].filter(n => n <= advPool.length).concat(advPool.length > 50 ? [advPool.length] : []).map(n => (
                  <button
                    key={n}
                    onClick={() => setAdvQuestionCount(n)}
                    className={cn(
                      'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                      advQuestionCount === n ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {n === advPool.length && n > 50 ? `Todas (${n})` : n}
                  </button>
                ))}
              </div>
            </div>

            {/* Time */}
            <div>
              <h2 className="font-semibold mb-2">Tempo disponível</h2>
              <div className="flex gap-2 flex-wrap">
                {timeOptions.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setAdvTimeMinutes(t.value)}
                    className={cn(
                      'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                      advTimeMinutes === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {advPool.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhuma questão disponível com a seleção atual.</p>
            ) : (
              <button
                onClick={startAvancado}
                disabled={!canStartAdv}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                Iniciar Simulado Avançado — {Math.min(advQuestionCount, advPool.length)} questões
                {advTimeMinutes > 0 ? ` · ${advTimeMinutes} min` : ''}
              </button>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
