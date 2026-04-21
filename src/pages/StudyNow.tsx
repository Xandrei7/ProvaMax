import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BookOpen, CheckCircle2, Clock, ChevronRight, ChevronLeft, AlertTriangle,
  SkipForward, RotateCcw, Target, XCircle, Play, Zap, ExternalLink,
  ListChecks, Settings, Pencil, Plus, ChevronUp, ChevronDown, Trash2,
} from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { getDisciplines, getSubjects, getSubjectParts, saveSubject } from '@/lib/dataService'
import type { Discipline, Subject, SubjectPart } from '@/types'
import {
  getCurrentWeek, getCurrentDayKey, getPlanForDay, getWeeksForManualSelect,
  DAY_OPTIONS, resolveAllTasks, resolveTaskMapping, loadSession, saveSession, clearSession,
  createSession, markTaskCompleted, markTaskPendingSetup, skipTask,
  getSessionProgress, getWeekMeta, buildStudyPath, matchDiscipline,
  loadSavedPlanWeek, savePlanWeek,
  loadDayOverrides, saveDayOverrides, applyDayOverrides, buildResolvedTaskFromAdmin,
} from '@/lib/studyNowUtils'
import type {
  ResolvedTask, StudyDayKey, StudyNowSession, StudyNowMode,
  DayTaskOverrides, AdminTaskData, BateriaConfig, BateriaMode,
} from '@/lib/studyNowUtils'
import { DAY_LABELS, TASK_TYPE_LABELS, TASK_TYPE_COLORS } from '@/data/studyPlan'
import type { StudyTaskType } from '@/data/studyPlan'
import { useAuth } from '@/contexts/AuthContext'
import { createTheory } from '@/lib/theoryService'
import { toast } from 'sonner'

type TheoryQuickSetup = {
  disciplineId: string
  subjectName: string
  title: string
  content: string
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .trim()
}

function getBaseSubjectName(value: string): string {
  return value.split(' — ')[0].trim()
}

  function isTheoryLikeTask(task: ResolvedTask | null): boolean {
    return !!task && (task.tipo === 'teoria' || task.tipo === 'lei_seca')
  }

function isMixedMiniSimuladoTask(task: ResolvedTask): boolean {
  if (task.disciplina !== 'Geral' || task.tipo !== 'questoes') return false
  const assunto = normalizeText(task.assunto)
  return /bloco\s*c|mista|misto|cronometr/.test(assunto)
}

function isAccumulatedQuestionTask(task: ResolvedTask): boolean {
  if (task.tipo !== 'questoes' || task.disciplina === 'Geral') return false
  return normalizeText(task.assunto).includes('acumulad')
}

function extractTimeMinutesFromAssunto(assunto: string): number {
  const match = normalizeText(assunto).match(/(\d+)\s*min/)
  if (!match) return 30
  const value = Number.parseInt(match[1], 10)
  return Number.isFinite(value) && value > 0 ? value : 30
}

function buildTheoryContentHtml(rawText: string): string {
  const escaped = rawText
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  return escaped
    .split(/\n{2,}/)
    .map(block => `<p>${block.replace(/\n/g, '<br />')}</p>`)
    .join('')
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function StudyNow() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useAuth()

  // Lê semana/dia do state de navegação (ex.: vindo do card da Home)
  const initState = location.state as { semana?: number; dia?: StudyDayKey } | null
  const currentPlanWeek = getCurrentWeek()
  const currentPlanDay = getCurrentDayKey()

  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [parts, setParts] = useState<SubjectPart[]>([])
  const [loading, setLoading] = useState(true)

  // Seleção de semana/dia — sempre visível, sem manualMode
  // Prioridade: semana salva pelo usuário > state de navegação > Semana 1
  const [selectedWeek, setSelectedWeek] = useState(() =>
    loadSavedPlanWeek() ?? initState?.semana ?? 1
  )
  const [selectedDay, setSelectedDay] = useState<StudyDayKey>(() => initState?.dia ?? currentPlanDay)

  const weekScrollRef = useRef<HTMLDivElement>(null)

  const [showAdminPanel, setShowAdminPanel] = useState(false)

  const [theorySetupTask, setTheorySetupTask] = useState<ResolvedTask | null>(null)
  const [theorySetupForm, setTheorySetupForm] = useState<TheoryQuickSetup>({
    disciplineId: '',
    subjectName: '',
    title: '',
    content: '',
  })
  const [savingTheorySetup, setSavingTheorySetup] = useState(false)

  const [resolvedTasks, setResolvedTasks] = useState<ResolvedTask[]>([])
  const [session, setSession] = useState<StudyNowSession | null>(null)
  const [sessionMode, setSessionMode] = useState<StudyNowMode>('flexivel')
  const [view, setView] = useState<'overview' | 'task'>('overview')
  const [showPendingPanel, setShowPendingPanel] = useState(false)
  const [showAddTaskModal, setShowAddTaskModal] = useState(false)
  const [addTaskForm, setAddTaskForm] = useState<{
    tipo: StudyTaskType
    disciplinaId: string
    subjectId: string
    partId: string
    quantidade: string
  }>({ tipo: 'questoes', disciplinaId: '', subjectId: '', partId: '', quantidade: '' })
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null)
  const [editTaskForm, setEditTaskForm] = useState<{
    tipo: StudyTaskType
    disciplinaId: string
    subjectId: string
    partId: string
    quantidade: string
  }>({ tipo: 'questoes', disciplinaId: '', subjectId: '', partId: '', quantidade: '' })

  const defaultBateriaConfig: BateriaConfig = { mode: 'escopo', selecoes: [], quantidade: 10 }
  const [bateriaConfig, setBateriaConfig] = useState<BateriaConfig>(defaultBateriaConfig)
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null)
  const [dayOverrides, setDayOverrides] = useState<DayTaskOverrides>({ edited: {}, removed: [], extras: [], order: null })

  // Carrega dados do banco
  useEffect(() => {
    async function load() {
      const [d, s, p] = await Promise.all([getDisciplines(), getSubjects(), getSubjectParts()])
      setDisciplines(d)
      setSubjects(s)
      setParts(p)
      setLoading(false)
    }
    load()
  }, [])

  // Carrega overrides do admin ao trocar semana/dia
  useEffect(() => {
    setDayOverrides(loadDayOverrides(selectedWeek, selectedDay))
  }, [selectedWeek, selectedDay])

  // Resolve tarefas do dia selecionado + aplica overrides do admin
  useEffect(() => {
    if (loading) return
    const plan = getPlanForDay(selectedWeek, selectedDay)
    const planTasks = plan ? resolveAllTasks(plan.tarefas, disciplines, subjects, parts) : []
    setResolvedTasks(applyDayOverrides(planTasks, dayOverrides, disciplines, subjects, parts))
  }, [loading, selectedWeek, selectedDay, disciplines, subjects, parts, dayOverrides])

  // Carrega sessão salva ao abrir — NÃO sobrescreve semana/dia escolhidos manualmente.
  // O banner "sessão em andamento" já oferece "Ir para aquele dia" se o usuário quiser.
  useEffect(() => {
    if (loading) return
    const saved = loadSession()
    if (saved && !saved.finished) {
      setSession(saved)
    }
  }, [loading])

  // Persiste a semana selecionada para que ao reabrir o app continue no mesmo ponto
  useEffect(() => {
    savePlanWeek(selectedWeek)
  }, [selectedWeek])

  // Scroll automático para semana selecionada no seletor manual
  useEffect(() => {
    const container = weekScrollRef.current
    if (!container) return
    const btn = container.querySelector<HTMLElement>('[data-selected="true"]')
    if (btn) btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [selectedWeek])

  // Sincroniza sessão com dia selecionado
  const currentTask: ResolvedTask | null =
    session && resolvedTasks.length > 0
      ? (resolvedTasks[session.currentTaskIndex] ?? null)
      : null

  const progress = session ? getSessionProgress(session) : null
  const weekMeta = getWeekMeta(selectedWeek)

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------

  function handleWeekSelection(week: number) {
    setSelectedWeek(week)
    savePlanWeek(week)
  }

  function handleStartSession() {
    const newSession = createSession(selectedWeek, selectedDay, sessionMode)
    // Usa os IDs reais (inclui extras do admin, respeita ordem e remoções)
    newSession.taskIds = resolvedTasks.map(t => t.id)
    saveSession(newSession)
    setSession(newSession)
    setView('task')
  }

  function handleContinueSession() {
    if (session) setView('task')
  }

  function handleResetSession() {
    clearSession()
    setSession(null)
    setView('overview')
  }

  const updateSession = useCallback((updated: StudyNowSession) => {
    saveSession(updated)
    setSession(updated)
    if (updated.finished) setView('overview')
  }, [])

  function handleCompleteTask() {
    if (!session || !currentTask) return
    updateSession(markTaskCompleted(session, currentTask.id))
  }

  function handlePendingSetup() {
    if (!session || !currentTask) return
    updateSession(markTaskPendingSetup(session, currentTask.id))
  }

  function handleSkipTask() {
    if (!session || !currentTask) return
    updateSession(skipTask(session, currentTask.id))
  }

  function updateOverrides(newOverrides: DayTaskOverrides) {
    saveDayOverrides(selectedWeek, selectedDay, newOverrides)
    setDayOverrides(newOverrides)
  }

  // Calcula todos os subjects/disciplines cobertos pelo plano até (e incluindo) upToWeek/upToDay.
  // Se filterDisciplineId for passado, filtra só por aquela disciplina.
  function getAccumulatedSubjects(
    upToWeek: number,
    upToDay: StudyDayKey,
    filterDisciplineId?: string,
  ): { disciplineIds: string[]; subjectIds: string[] } {
    const dayOrder: StudyDayKey[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
    const targetDayIndex = dayOrder.indexOf(upToDay)
    const accSubjectIds = new Set<string>()
    const accDisciplineIds = new Set<string>()
    // Rastreia se a disciplina filtrada tem QUALQUER tarefa no plano até esta data
    let disciplineHasPlanCoverage = false

    for (let week = 1; week <= upToWeek; week++) {
      const daysToProcess = week === upToWeek
        ? dayOrder.slice(0, targetDayIndex + 1)
        : dayOrder

      for (const day of daysToProcess) {
        const plan = getPlanForDay(week, day)
        if (!plan) continue

        for (const rawTask of plan.tarefas) {
          if (rawTask.disciplina === 'Geral') continue
          if (rawTask.tipo !== 'questoes' && rawTask.tipo !== 'teoria' && rawTask.tipo !== 'lei_seca') continue

          const resolved = resolveTaskMapping(rawTask, disciplines, subjects, parts)
          if (!resolved.mappedDisciplineId) continue
          if (filterDisciplineId && resolved.mappedDisciplineId !== filterDisciplineId) continue

          accDisciplineIds.add(resolved.mappedDisciplineId)
          if (resolved.mappedSubjectId) accSubjectIds.add(resolved.mappedSubjectId)
          // Marca cobertura da disciplina mesmo que o assunto específico não tenha sido mapeado
          if (filterDisciplineId) disciplineHasPlanCoverage = true
        }
      }
    }

    // Bateria acumulada por disciplina: se a disciplina aparece no plano até aqui,
    // usa TODOS os subjects do banco para ela (o banco é curado pelo admin
    // e só contém o que já foi ensinado). Isso garante resiliência ao matching impreciso.
    if (filterDisciplineId && disciplineHasPlanCoverage) {
      subjects.filter(s => s.discipline_id === filterDisciplineId).forEach(s => accSubjectIds.add(s.id))
      accDisciplineIds.add(filterDisciplineId)
    } else if (filterDisciplineId && accSubjectIds.size === 0) {
      // Fallback final: disciplina no banco mas sem tarefas encontradas no plano
      subjects.filter(s => s.discipline_id === filterDisciplineId).forEach(s => accSubjectIds.add(s.id))
      if (accDisciplineIds.size === 0) accDisciplineIds.add(filterDisciplineId)
    }

    // Simulado geral: poucos subjects → complementa com todos das disciplinas encontradas
    if (!filterDisciplineId && accSubjectIds.size < 5) {
      for (const discId of accDisciplineIds) {
        subjects.filter(s => s.discipline_id === discId).forEach(s => accSubjectIds.add(s.id))
      }
    }

    return { disciplineIds: Array.from(accDisciplineIds), subjectIds: Array.from(accSubjectIds) }
  }

  function handleNavigateToTask(task: ResolvedTask) {
    if (task.tipo === 'bateria' && task.bateriaConfig) {
      const { selecoes, quantidade, tempo } = task.bateriaConfig
      const disciplineIds = [...new Set(selecoes.map(s => s.disciplineId).filter(Boolean))]
      const subjectIds = selecoes.flatMap(s => s.subjectIds)
      navigate('/simulado', {
        state: {
          fromStudyNow: true,
          autoStartAdvanced: true,
          sourceTaskId: task.id,
          week: selectedWeek,
          day: selectedDay,
          disciplineIds,
          subjectIds: subjectIds.length > 0 ? subjectIds : undefined,
          questionCount: quantidade,
          timeMinutes: tempo,
        },
      })
      return
    }

    if (isMixedMiniSimuladoTask(task)) {
      const daySubjectIds = Array.from(new Set(
        resolvedTasks
          .filter(t => t.disciplina !== 'Geral' && !!t.mappedSubjectId)
          .map(t => t.mappedSubjectId as string)
      ))

      if (daySubjectIds.length === 0) {
        toast.warning('Nenhum assunto do dia foi mapeado ainda. Abrindo Simulado para seleção manual.')
        navigate('/simulado')
        return
      }

      const dayDisciplineIds = Array.from(new Set(
        subjects
          .filter(subject => daySubjectIds.includes(subject.id))
          .map(subject => subject.discipline_id)
      ))

      navigate('/simulado', {
        state: {
          fromStudyNow: true,
          autoStartAdvanced: true,
          sourceTaskId: task.id,
          week: selectedWeek,
          day: selectedDay,
          disciplineIds: dayDisciplineIds,
          subjectIds: daySubjectIds,
          questionCount: task.quantidade ?? 25,
          timeMinutes: extractTimeMinutesFromAssunto(task.assunto),
        },
      })
      return
    }

    // Simulado geral acumulado (fim de fase, simulado técnico, etc.)
    if (task.tipo === 'simulado' && task.disciplina === 'Geral') {
      const { disciplineIds, subjectIds } = getAccumulatedSubjects(selectedWeek, selectedDay)
      if (subjectIds.length > 0) {
        navigate('/simulado', {
          state: {
            fromStudyNow: true,
            autoStartAdvanced: true,
            sourceTaskId: task.id,
            week: selectedWeek,
            day: selectedDay,
            disciplineIds,
            subjectIds,
            questionCount: task.quantidade ?? 60,
            timeMinutes: 90,
          },
        })
        return
      }
      // Fallback: banco vazio, abre simulado manual
      navigate('/simulado')
      return
    }

    if (isAccumulatedQuestionTask(task)) {
      const disciplineId = task.mappedDisciplineId ?? matchDiscipline(task.disciplina, disciplines)?.id
      if (disciplineId) {
        const { disciplineIds, subjectIds } = getAccumulatedSubjects(selectedWeek, selectedDay, disciplineId)
        navigate('/simulado', {
          state: {
            fromStudyNow: true,
            autoStartAdvanced: true,
            sourceTaskId: task.id,
            week: selectedWeek,
            day: selectedDay,
            disciplineIds: disciplineIds.length > 0 ? disciplineIds : [disciplineId],
            subjectIds,
            questionCount: task.quantidade ?? 50,
            timeMinutes: extractTimeMinutesFromAssunto(task.assunto),
          },
        })
        return
      }
    }

    const path = buildStudyPath(task)
    if (path) navigate(path, { state: { partId: task.mappedPartId, tipo: task.tipo } })
  }

  function openTheorySetup(task: ResolvedTask) {
    const disciplineId = task.mappedDisciplineId
      ?? matchDiscipline(task.disciplina, disciplines)?.id
      ?? ''
    const baseSubject = getBaseSubjectName(task.assunto)
    const isLeiSeca = task.tipo === 'lei_seca'

    setTheorySetupTask(task)
    setTheorySetupForm({
      disciplineId,
      subjectName: baseSubject,
      title: isLeiSeca ? `Lei seca - ${baseSubject}` : baseSubject,
      content: isLeiSeca
        ? `Trechos da lei seca: ${baseSubject}\n\nPontos de atencao:\n-\n\nObservacoes:`
        : `Resumo teorico: ${baseSubject}\n\nPontos-chave:\n-\n\nObservacoes:`,
    })
  }

  function closeTheorySetup() {
    if (savingTheorySetup) return
    setTheorySetupTask(null)
  }

  async function handleCreateTheorySetup() {
    if (!theorySetupTask) return

    const disciplineId = theorySetupForm.disciplineId
    const subjectName = theorySetupForm.subjectName.trim()
    const title = theorySetupForm.title.trim()
    const content = theorySetupForm.content.trim()

    if (!disciplineId || !subjectName || !title || !content) {
      toast.error('Preencha disciplina, assunto, titulo e conteudo.')
      return
    }

    try {
      setSavingTheorySetup(true)

      const normalizedSubjectName = normalizeText(subjectName)
      let latestSubjects = subjects
      let targetSubject = latestSubjects.find(s =>
        s.discipline_id === disciplineId && normalizeText(s.name) === normalizedSubjectName
      )

      if (!targetSubject) {
        await saveSubject({ name: subjectName, discipline_id: disciplineId, sort_order: 0 })
        latestSubjects = await getSubjects()
        setSubjects(latestSubjects)
        targetSubject = latestSubjects.find(s =>
          s.discipline_id === disciplineId && normalizeText(s.name) === normalizedSubjectName
        )
      }

      if (!targetSubject) {
        toast.error('Assunto criado, mas nao foi possivel localiza-lo. Tente novamente.')
        return
      }

      await createTheory({
        discipline_id: disciplineId,
        subject_id: targetSubject.id,
        title,
        content_html: buildTheoryContentHtml(content),
        youtube_url: null,
        complementary_text: null,
      })

      toast.success(theorySetupTask.tipo === 'lei_seca' ? 'Conteudo de lei seca criado!' : 'Teoria criada!')
      setTheorySetupTask(null)
      navigate(`/theory/${targetSubject.id}`)
    } catch (error) {
      console.error('[study-now] erro ao criar conteudo teorico:', error)
      toast.error('Nao foi possivel criar o conteudo agora.')
    } finally {
      setSavingTheorySetup(false)
    }
  }

  function handleGoToTask(index: number) {
    if (!session) return
    const updated = { ...session, currentTaskIndex: index }
    saveSession(updated)
    setSession(updated)
    setView('task')
  }

  function handleDirectTaskClick(task: ResolvedTask, index: number) {
    const isActiveSession = !!(session && !session.finished && session.semana === selectedWeek && session.dia === selectedDay)
    if (isActiveSession) {
      handleGoToTask(index)
      return
    }
    // Baterias acumuladas nunca devem ir para o importador — usam simulado com acumulado
    if (isAccumulatedQuestionTask(task)) {
      handleNavigateToTask(task)
      return
    }
    if (task.requiresManualSetup) {
      if (isTheoryLikeTask(task)) {
        if (isAdmin) openTheorySetup(task)
      } else if (isAdmin) {
        navigate('/import', {
          state: { fromStudyNow: true, semana: selectedWeek, dia: selectedDay, disciplina: task.disciplina, assunto: task.assunto },
        })
      }
      return
    }
    handleNavigateToTask(task)
  }

  function handleAddTask() {
    const { disciplinaId, subjectId, tipo } = addTaskForm

    if (tipo === 'bateria') {
      if (!bateriaConfig.selecoes.length || !bateriaConfig.selecoes[0]?.disciplineId) {
        toast.error('Selecione ao menos uma disciplina para a bateria.')
        return
      }
      if (!bateriaConfig.quantidade) {
        toast.error('Informe a quantidade de questões.')
        return
      }
      const id = `admin-extra-${Date.now()}`
      const data: AdminTaskData = {
        id, tipo: 'bateria',
        disciplinaId: bateriaConfig.selecoes[0].disciplineId,
        subjectId: '', partId: '',
        quantidade: String(bateriaConfig.quantidade),
        bateriaConfig: { ...bateriaConfig },
      }
      const newTask = buildResolvedTaskFromAdmin(data, disciplines, subjects, parts)
      const newOverrides: DayTaskOverrides = { ...dayOverrides, extras: [...dayOverrides.extras, data] }
      if (session && !session.finished) {
        const updated = { ...session, taskIds: [...session.taskIds, newTask.id] }
        saveSession(updated)
        setSession(updated)
      }
      updateOverrides(newOverrides)
      setAddTaskForm({ tipo: 'questoes', disciplinaId: '', subjectId: '', partId: '', quantidade: '' })
      setBateriaConfig(defaultBateriaConfig)
      setShowAddTaskModal(false)
      toast.success('Bateria adicionada ao dia.')
      return
    }

    const needsSubject = tipo !== 'simulado' && tipo !== 'revisao'
    if (!disciplinaId || (needsSubject && !subjectId)) {
      toast.error(needsSubject ? 'Selecione disciplina e assunto.' : 'Selecione a disciplina.')
      return
    }
    const id = `admin-extra-${Date.now()}`
    const data: AdminTaskData = { id, tipo, disciplinaId, subjectId, partId: addTaskForm.partId, quantidade: addTaskForm.quantidade }
    const newTask = buildResolvedTaskFromAdmin(data, disciplines, subjects, parts)
    const newOverrides: DayTaskOverrides = { ...dayOverrides, extras: [...dayOverrides.extras, data] }
    if (session && !session.finished) {
      const updated = { ...session, taskIds: [...session.taskIds, newTask.id] }
      saveSession(updated)
      setSession(updated)
    }
    updateOverrides(newOverrides)
    setAddTaskForm({ tipo: 'questoes', disciplinaId: '', subjectId: '', partId: '', quantidade: '' })
    setBateriaConfig(defaultBateriaConfig)
    setShowAddTaskModal(false)
    toast.success('Tarefa adicionada ao dia.')
  }

  function openEditTask(index: number) {
    const task = resolvedTasks[index]
    if (!task) return
    setEditingTaskIndex(index)
    setEditTaskForm({
      tipo: task.tipo,
      disciplinaId: task.mappedDisciplineId ?? '',
      subjectId: task.mappedSubjectId ?? '',
      partId: task.mappedPartId ?? '',
      quantidade: task.quantidade?.toString() ?? '',
    })
    if (task.tipo === 'bateria' && task.bateriaConfig) {
      setBateriaConfig({ ...task.bateriaConfig })
    } else {
      setBateriaConfig(defaultBateriaConfig)
    }
  }

  function handleSaveEditTask() {
    if (editingTaskIndex === null) return
    const original = resolvedTasks[editingTaskIndex]
    const { disciplinaId, subjectId, tipo } = editTaskForm
    const isExtraTask = dayOverrides.extras.some(e => e.id === original.id)

    if (tipo === 'bateria') {
      if (!bateriaConfig.selecoes.length || !bateriaConfig.selecoes[0]?.disciplineId) {
        toast.error('Selecione ao menos uma disciplina para a bateria.')
        return
      }
      const data: AdminTaskData = {
        id: original.id, tipo: 'bateria',
        disciplinaId: bateriaConfig.selecoes[0].disciplineId,
        subjectId: '', partId: '',
        quantidade: String(bateriaConfig.quantidade),
        bateriaConfig: { ...bateriaConfig },
      }
      const newOverrides: DayTaskOverrides = isExtraTask
        ? { ...dayOverrides, extras: dayOverrides.extras.map(e => e.id === original.id ? data : e) }
        : { ...dayOverrides, edited: { ...dayOverrides.edited, [original.id]: data } }
      updateOverrides(newOverrides)
      setEditingTaskIndex(null)
      setBateriaConfig(defaultBateriaConfig)
      toast.success('Bateria atualizada.')
      return
    }

    const needsSubject = tipo !== 'simulado' && tipo !== 'revisao'
    if (!disciplinaId || (needsSubject && !subjectId)) {
      toast.error(needsSubject ? 'Selecione disciplina e assunto.' : 'Selecione a disciplina.')
      return
    }
    const data: AdminTaskData = {
      id: original.id, tipo, disciplinaId, subjectId,
      partId: editTaskForm.partId, quantidade: editTaskForm.quantidade,
    }
    const newOverrides: DayTaskOverrides = isExtraTask
      ? { ...dayOverrides, extras: dayOverrides.extras.map(e => e.id === original.id ? data : e) }
      : { ...dayOverrides, edited: { ...dayOverrides.edited, [original.id]: data } }
    updateOverrides(newOverrides)
    setEditingTaskIndex(null)
    toast.success('Tarefa atualizada.')
  }

  function handleDeleteTask(index: number) {
    const task = resolvedTasks[index]
    if (!task) return
    const isExtra = dayOverrides.extras.some(e => e.id === task.id)
    const newOrder = dayOverrides.order?.filter(id => id !== task.id) ?? null
    const newOverrides: DayTaskOverrides = isExtra
      ? { ...dayOverrides, extras: dayOverrides.extras.filter(e => e.id !== task.id), order: newOrder }
      : { ...dayOverrides, removed: [...dayOverrides.removed, task.id], order: newOrder }
    updateOverrides(newOverrides)
    setConfirmDeleteIndex(null)
    toast.success('Tarefa removida.')
  }

  function handleMoveTask(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= resolvedTasks.length) return
    const newOrder = resolvedTasks.map(t => t.id)
    ;[newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]]
    updateOverrides({ ...dayOverrides, order: newOrder })
  }

  function taskStatus(task: ResolvedTask): 'completed' | 'pending_setup' | 'skipped' | 'current' | 'pending' {
    if (!session) return 'pending'
    if (session.completedTaskIds.includes(task.id)) return 'completed'
    if (session.pendingSetupTaskIds.includes(task.id)) return 'pending_setup'
    if (session.skippedTaskIds.includes(task.id)) return 'skipped'
    if (resolvedTasks[session.currentTaskIndex]?.id === task.id) return 'current'
    return 'pending'
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderStatusIcon(status: ReturnType<typeof taskStatus>) {
    if (status === 'completed') return <CheckCircle2 size={16} className="text-green-500 shrink-0" />
    if (status === 'pending_setup') return <AlertTriangle size={16} className="text-amber-500 shrink-0" />
    if (status === 'skipped') return <SkipForward size={16} className="text-muted-foreground shrink-0" />
    if (status === 'current') return <Play size={16} className="text-primary shrink-0" />
    return <Clock size={16} className="text-muted-foreground/50 shrink-0" />
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="mx-auto w-full max-w-lg flex-1 flex items-center justify-center px-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Vista TAREFA ATUAL
  // ---------------------------------------------------------------------------

  if (view === 'task' && session && currentTask) {
    const path = buildStudyPath(currentTask)
    const statusIsDone = taskStatus(currentTask) === 'completed'
    const isTheoryFallbackTask = isTheoryLikeTask(currentTask) && currentTask.requiresManualSetup
    const isMixedMiniTask = isMixedMiniSimuladoTask(currentTask)
    const theoryActionLabel = currentTask.tipo === 'lei_seca' ? 'Nova lei seca' : 'Nova teoria'
    const manualSetupTitle = isTheoryFallbackTask
      ? (currentTask.tipo === 'lei_seca' ? 'Vinculo de lei seca pendente' : 'Vinculo de teoria pendente')
      : (currentTask.mappedDisciplineId ? 'Assunto incompleto - usando fallback' : 'Falta cadastro no ProvaMax')
    const manualSetupHint = isTheoryFallbackTask
      ? 'Esta tarefa e de conteudo teorico. Use "Nova teoria" para criar conteudo compativel e evitar o fluxo de importacao de questoes.'
      : currentTask.setupHint
    const importFallbackState = {
      fromStudyNow: true,
      semana: session.semana,
      dia: session.dia,
      disciplina: currentTask.disciplina,
      assunto: currentTask.assunto,
    }

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">

          {/* Header da tarefa */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setView('overview')}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={14} />
              Visao geral
            </button>
            <span className="text-muted-foreground/50 text-xs">·</span>
            <span className="text-xs text-muted-foreground">
              Sem {session.semana} · {DAY_LABELS[session.dia]}
            </span>
          </div>

          {/* Progresso */}
          {progress && (
            <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground">Progresso do dia</span>
                <span className="text-xs font-bold tabular-nums">
                  {progress.done}/{progress.total} tarefas
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-green-500" /> {progress.done} concluidas
                </span>
                {progress.pending > 0 && isAdmin && (
                  <button
                    onClick={() => setShowPendingPanel(true)}
                    className="flex items-center gap-1 text-amber-600 hover:text-amber-700 underline decoration-dotted"
                  >
                    <AlertTriangle size={11} className="text-amber-500" /> {progress.pending} faltam cadastro
                  </button>
                )}
                {progress.pending > 0 && !isAdmin && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle size={11} className="text-amber-500" /> {progress.pending} faltam cadastro
                  </span>
                )}
                {progress.skipped > 0 && (
                  <span className="flex items-center gap-1">
                    <SkipForward size={11} /> {progress.skipped} puladas
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Card da tarefa atual */}
          <div className="rounded-xl border-2 border-primary/30 bg-card px-5 py-5 mb-4">
            {/* Badge tipo + botao admin */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TASK_TYPE_COLORS[currentTask.tipo]}`}>
                {TASK_TYPE_LABELS[currentTask.tipo]}
              </span>
              {currentTask.quantidade && (
                <span className="text-xs text-muted-foreground">{currentTask.quantidade} questoes</span>
              )}
              {isAdmin && (
                <button
                  onClick={() => setShowAdminPanel(v => !v)}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Pencil size={12} />
                  Editar
                </button>
              )}
            </div>

            {/* Painel admin (colapsavel) */}
            {isAdmin && showAdminPanel && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-50/50 px-3 py-3 mb-3">
                <p className="text-xs font-semibold text-blue-700 mb-2">Acoes rapidas do admin</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(currentTask.tipo === 'teoria' || currentTask.tipo === 'lei_seca') && currentTask.requiresManualSetup ? (
                    <button
                      onClick={() => openTheorySetup(currentTask)}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {theoryActionLabel}
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/import', { state: importFallbackState })}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Importar questoes
                    </button>
                  )}
                  {currentTask.mappedSubjectId && (
                    <button
                      onClick={() => navigate(`/theory/${currentTask.mappedSubjectId}`)}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Ir para Teoria
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Abrir Admin
                  </button>
                </div>
                <p className="text-[10px] text-blue-500/70">
                  {currentTask.disciplina} › {currentTask.assunto.split(' — ')[0]}
                  <br />Apos editar, volte com ← do navegador para continuar a sessao.
                </p>
              </div>
            )}

            {/* Disciplina */}
            <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">
              {currentTask.disciplina}
            </p>

            {/* Assunto */}
            <h2 className="text-base font-bold text-foreground mb-3 leading-tight">
              {currentTask.assunto}
            </h2>

            {/* Caminho mapeado */}
            {currentTask.mappedPathLabel && !currentTask.requiresManualSetup && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-3">
                <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                <span className="truncate">{currentTask.mappedPathLabel}</span>
              </div>
            )}

            {/* Aviso falta de cadastro */}
            {currentTask.requiresManualSetup && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3 mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-1">
                      {manualSetupTitle}
                    </p>
                    <p className="text-xs text-amber-600/80 mb-2">{manualSetupHint}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono select-all">
                        {currentTask.disciplina}
                      </span>
                      <span className="text-xs text-amber-600">›</span>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono select-all">
                        {currentTask.assunto.split(' — ')[0]}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {isTheoryLikeTask(currentTask) && isAdmin ? (
                    <button
                      onClick={() => openTheorySetup(currentTask)}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Settings size={12} />
                      {theoryActionLabel}
                    </button>
                  ) : isAdmin ? (
                    <button
                      onClick={() => navigate('/import', { state: importFallbackState })}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Settings size={12} />
                      Importar / Cadastrar
                    </button>
                  ) : null}
                  <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Settings size={12} />
                    Ir para Admin
                  </button>
                  <button
                    onClick={handlePendingSetup}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Marcar como pendente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Acoes da tarefa */}
          <div className="flex flex-col gap-2 mb-4">

            {/* Navegar direto — mostra sempre que houver path, independente de requiresManualSetup */}
            {path && (
              <button
                onClick={() => handleNavigateToTask(currentTask)}
                className={`flex items-center justify-between rounded-xl px-5 py-4 font-semibold transition-all ${
                  currentTask.requiresManualSetup
                    ? 'bg-amber-500/80 text-white hover:bg-amber-500'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap size={16} />
                  <span>
                    {currentTask.tipo === 'bateria' ? 'Iniciar Bateria' :
                     currentTask.tipo === 'simulado' ? 'Abrir Simulado' :
                     isMixedMiniTask ? 'Iniciar Mini Simulado do Dia' :
                     currentTask.tipo === 'revisao' ? 'Abrir Flashcards' :
                     currentTask.tipo === 'teoria' || currentTask.tipo === 'lei_seca' ? 'Abrir Teoria' :
                     currentTask.requiresManualSetup ? 'Abrir disciplina (fallback)' :
                     'Iniciar Questoes'}
                  </span>
                </div>
                <ExternalLink size={15} />
              </button>
            )}

            {!path && isTheoryFallbackTask && isAdmin && (
              <button
                onClick={() => openTheorySetup(currentTask)}
                className="flex items-center justify-between rounded-xl px-5 py-4 font-semibold transition-all bg-amber-500/85 text-white hover:bg-amber-500"
              >
                <div className="flex items-center gap-2">
                  <Zap size={16} />
                  <span>{theoryActionLabel}</span>
                </div>
                <ExternalLink size={15} />
              </button>
            )}

            {/* Concluir manualmente */}
            <button
              onClick={handleCompleteTask}
              disabled={statusIsDone}
              className={`flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-all
                ${statusIsDone
                  ? 'border-green-500/30 bg-green-500/10 text-green-700'
                  : 'border-green-500/30 bg-green-500/5 text-green-700 hover:bg-green-500/15'
                }`}
            >
              <CheckCircle2 size={16} />
              {statusIsDone ? 'Concluida ✓' : 'Marcar como concluida'}
            </button>

            {/* Pular */}
            <button
              onClick={handleSkipTask}
              className="flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm text-muted-foreground hover:bg-muted/50 transition-all"
            >
              <SkipForward size={15} />
              Pular tarefa
            </button>
          </div>

          {/* Navegacao entre tarefas */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                if (!session) return
                const prev = Math.max(0, session.currentTaskIndex - 1)
                const updated = { ...session, currentTaskIndex: prev }
                saveSession(updated)
                setSession(updated)
              }}
              disabled={!session || session.currentTaskIndex === 0}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
            >
              <ChevronLeft size={14} />
              Anterior
            </button>

            <span className="text-xs text-muted-foreground tabular-nums">
              {session ? session.currentTaskIndex + 1 : 1} / {resolvedTasks.length}
            </span>

            <button
              onClick={() => {
                if (!session) return
                const next = Math.min(session.taskIds.length - 1, session.currentTaskIndex + 1)
                const updated = { ...session, currentTaskIndex: next }
                saveSession(updated)
                setSession(updated)
              }}
              disabled={!session || session.currentTaskIndex >= session.taskIds.length - 1}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
            >
              Proxima
              <ChevronRight size={14} />
            </button>
          </div>

          {theorySetupTask && (
            <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 px-3 py-4 sm:items-center">
              <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-2xl">
                <p className="text-sm font-semibold text-foreground">
                  {theorySetupTask.tipo === 'lei_seca' ? 'Novo conteudo de lei seca' : 'Nova teoria'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {theorySetupTask.disciplina} · {getBaseSubjectName(theorySetupTask.assunto)}
                </p>

                <div className="mt-4 flex flex-col gap-2.5">
                  <select
                    value={theorySetupForm.disciplineId}
                    onChange={e => setTheorySetupForm(prev => ({ ...prev, disciplineId: e.target.value }))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Selecione a disciplina *</option>
                    {disciplines.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>

                  <input
                    value={theorySetupForm.subjectName}
                    onChange={e => setTheorySetupForm(prev => ({ ...prev, subjectName: e.target.value }))}
                    placeholder="Assunto *"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />

                  <input
                    value={theorySetupForm.title}
                    onChange={e => setTheorySetupForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Titulo do conteudo *"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />

                  <textarea
                    rows={7}
                    value={theorySetupForm.content}
                    onChange={e => setTheorySetupForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Cole ou escreva o conteudo teorico / lei seca *"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={closeTheorySetup}
                    disabled={savingTheorySetup}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { void handleCreateTheorySetup() }}
                    disabled={savingTheorySetup}
                    className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {savingTheorySetup ? 'Salvando...' : 'Salvar e abrir teoria'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* Modal de pendências (também acessível da vista task) */}
        {showPendingPanel && isAdmin && (() => {
          const pendingTasks = resolvedTasks.filter(t => t.requiresManualSetup)
          return (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 sm:items-center sm:px-3">
              <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <p className="text-sm font-semibold text-foreground">Pendências de cadastro</p>
                    <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5">
                      {pendingTasks.length}
                    </span>
                  </div>
                  <button onClick={() => setShowPendingPanel(false)} className="text-muted-foreground hover:text-foreground p-1">
                    <XCircle size={18} />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-3">
                  {pendingTasks.map(task => {
                    const isTheory = isTheoryLikeTask(task)
                    const label = task.tipo === 'lei_seca' ? 'Cadastrar lei seca' : isTheory ? 'Cadastrar teoria' : 'Importar / Cadastrar'
                    const hint = task.setupHint ?? (isTheory ? 'Teoria não encontrada para este assunto' : 'Assunto sem vínculo resolvido')
                    const fallbackState = { fromStudyNow: true, semana: selectedWeek, dia: selectedDay, disciplina: task.disciplina, assunto: task.assunto }
                    return (
                      <div key={task.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${TASK_TYPE_COLORS[task.tipo]}`}>
                            {TASK_TYPE_LABELS[task.tipo]}
                          </span>
                          {task.quantidade && <span className="text-xs text-muted-foreground">{task.quantidade}q</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 mb-1">
                          <span className="text-xs font-semibold text-amber-700">{task.disciplina}</span>
                          <span className="text-xs text-amber-500">›</span>
                          <span className="text-xs font-medium text-foreground">{getBaseSubjectName(task.assunto)}</span>
                          {task.mappedPartId && task.mappedPathLabel && (
                            <>
                              <span className="text-xs text-amber-500">›</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[140px]">{task.mappedPathLabel.split(' › ').pop()}</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-amber-600/80 mb-3">{hint}</p>
                        <button
                          onClick={() => { setShowPendingPanel(false); isTheory ? openTheorySetup(task) : navigate('/import', { state: fallbackState }) }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-2 rounded-lg transition-colors"
                        >
                          <Settings size={12} />{label}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="px-4 py-3 border-t border-border shrink-0">
                  <button onClick={() => setShowPendingPanel(false)} className="w-full text-sm text-muted-foreground hover:text-foreground py-2">Fechar</button>
                </div>
              </div>
            </div>
          )
        })()}

        <BottomNav />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Vista VISAO GERAL (overview)
  // ---------------------------------------------------------------------------

  const hasSavedSession = !!(session && !session.finished)
  const isCurrentDaySession = session?.semana === selectedWeek && session?.dia === selectedDay

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold">Estudar agora</h1>
            <p className="text-xs text-muted-foreground">Plano TOP1 - Tecnico ALE-RR</p>
          </div>
        </div>

        {/* Seletor semana/dia — sempre visivel */}
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-primary" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Semana {selectedWeek}
                {weekMeta.questoesMeta > 0 && (
                  <span className="font-normal normal-case"> · meta {weekMeta.questoesMeta}q · {weekMeta.acertoMeta}</span>
                )}
              </p>
            </div>
            {(selectedWeek !== currentPlanWeek || selectedDay !== currentPlanDay) && (
              <button
                onClick={() => { handleWeekSelection(currentPlanWeek); setSelectedDay(currentPlanDay) }}
                className="text-xs text-primary hover:underline"
              >
                Usar semana atual
              </button>
            )}
          </div>

          {/* Seletor de semana — scroll horizontal */}
          <div
            ref={weekScrollRef}
            className="flex gap-1 pb-1 mb-3"
            style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {getWeeksForManualSelect().map(w => (
              <button
                key={w}
                data-selected={selectedWeek === w ? 'true' : undefined}
                onClick={() => handleWeekSelection(w)}
                className={`shrink-0 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  selectedWeek === w
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                style={{ minWidth: 34 }}
              >
                {w}
              </button>
            ))}
          </div>

          {/* Seletor de dia — sempre visivel */}
          <div className="grid grid-cols-7 gap-1">
            {DAY_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSelectedDay(key)}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  selectedDay === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {label.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats do dia */}
        {resolvedTasks.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-card px-3 py-3 text-center">
              <p className="text-xl font-bold text-foreground">{resolvedTasks.length}</p>
              <p className="text-xs text-muted-foreground">tarefas</p>
            </div>
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-3 text-center">
              <p className="text-xl font-bold text-green-600">
                {resolvedTasks.filter(t => !t.requiresManualSetup).length}
              </p>
              <p className="text-xs text-green-700">prontas</p>
            </div>
            {resolvedTasks.filter(t => t.requiresManualSetup).length > 0 && isAdmin ? (
              <button
                onClick={() => setShowPendingPanel(true)}
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-center hover:bg-amber-500/10 transition-colors"
              >
                <p className="text-xl font-bold text-amber-600">
                  {resolvedTasks.filter(t => t.requiresManualSetup).length}
                </p>
                <p className="text-xs text-amber-700">faltam cadastro</p>
              </button>
            ) : (
              <div className={`rounded-xl border px-3 py-3 text-center ${
                resolvedTasks.filter(t => t.requiresManualSetup).length > 0
                  ? 'border-amber-500/20 bg-amber-500/5'
                  : 'border-border bg-card'
              }`}>
                <p className={`text-xl font-bold ${
                  resolvedTasks.filter(t => t.requiresManualSetup).length > 0 ? 'text-amber-600' : 'text-muted-foreground'
                }`}>
                  {resolvedTasks.filter(t => t.requiresManualSetup).length}
                </p>
                <p className={`text-xs ${
                  resolvedTasks.filter(t => t.requiresManualSetup).length > 0 ? 'text-amber-700' : 'text-muted-foreground'
                }`}>faltam cadastro</p>
              </div>
            )}
          </div>
        )}

        {/* Sessao ativa */}
        {hasSavedSession && isCurrentDaySession && progress && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-primary" />
                <span className="text-sm font-semibold text-primary">Sessao em andamento</span>
              </div>
              <button
                onClick={handleResetSession}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <RotateCcw size={12} />
                Reiniciar
              </button>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {progress.done}/{progress.total} concluidas
              {progress.pending > 0 && ` · ${progress.pending} pendentes de cadastro`}
            </p>
            <button
              onClick={handleContinueSession}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
            >
              <Play size={15} />
              Continuar sessao
            </button>
          </div>
        )}

        {/* Sessao de outro dia salva */}
        {hasSavedSession && !isCurrentDaySession && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-700">
                  Sessao salva: Sem {session!.semana} · {DAY_LABELS[session!.dia]}
                </p>
                <p className="text-xs text-amber-600/80">Voce tem uma sessao em andamento em outro dia.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  handleWeekSelection(session!.semana)
                  setSelectedDay(session!.dia)
                }}
                className="text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                Ir para aquele dia
              </button>
              <button
                onClick={handleResetSession}
                className="text-xs font-medium text-muted-foreground bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-lg transition-colors"
              >
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* Botao iniciar nova sessao */}
        {(!hasSavedSession || !isCurrentDaySession) && resolvedTasks.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => setSessionMode('flexivel')}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all
                  ${sessionMode === 'flexivel'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
              >
                Flexivel
                <p className="font-normal text-xs opacity-70 mt-0.5">Pular tarefas livremente</p>
              </button>
              <button
                onClick={() => setSessionMode('rigido')}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all
                  ${sessionMode === 'rigido'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
              >
                Rigido
                <p className="font-normal text-xs opacity-70 mt-0.5">Sequencia obrigatoria</p>
              </button>
            </div>
            <button
              onClick={handleStartSession}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all"
            >
              <Play size={18} />
              Iniciar sessao
            </button>
          </div>
        )}

        {/* Lista de tarefas */}
        {resolvedTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ListChecks size={14} className="text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tarefas do dia
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowAddTaskModal(true)}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-muted/50"
                >
                  <Plus size={12} />
                  Incluir tarefa
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {resolvedTasks.map((task, index) => {
                const status = taskStatus(task)
                const isCurrent = status === 'current'

                return (
                  <button
                    key={task.id}
                    onClick={() => handleDirectTaskClick(task, index)}
                    className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all cursor-pointer
                      ${isCurrent ? 'border-primary/40 bg-primary/5' :
                        status === 'completed' ? 'border-green-500/20 bg-green-500/5 opacity-70' :
                        status === 'pending_setup' ? 'border-amber-500/20 bg-amber-500/5 opacity-80' :
                        status === 'skipped' ? 'border-border bg-muted/30 opacity-50' :
                        'border-border bg-card hover:border-primary/20 hover:bg-muted/30'
                      }
                    `}
                  >
                    <div className="mt-0.5">{renderStatusIcon(status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0 text-xs font-medium ${TASK_TYPE_COLORS[task.tipo]}`}>
                          {TASK_TYPE_LABELS[task.tipo]}
                        </span>
                        {task.quantidade && (
                          <span className="text-xs text-muted-foreground">{task.quantidade}q</span>
                        )}
                        {task.requiresManualSetup && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle size={10} /> falta cadastro
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground">{task.disciplina}</p>
                      <p className="text-sm font-medium text-foreground leading-snug truncate">{task.assunto}</p>
                      {task.mappedPathLabel && !task.requiresManualSetup && (
                        <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{task.mappedPathLabel}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="shrink-0 flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleMoveTask(index, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-20"
                          title="Mover para cima"
                        >
                          <ChevronUp size={11} />
                        </button>
                        <button
                          onClick={() => handleMoveTask(index, 'down')}
                          disabled={index === resolvedTasks.length - 1}
                          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-20"
                          title="Mover para baixo"
                        >
                          <ChevronDown size={11} />
                        </button>
                      </div>
                    )}
                    {isAdmin && (
                      <div className="shrink-0 flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEditTask(index)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Editar tarefa"
                        >
                          <Pencil size={12} />
                        </button>
                        {confirmDeleteIndex === index ? (
                          <button
                            onClick={() => handleDeleteTask(index)}
                            className="p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                            title="Confirmar exclusão"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteIndex(index)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remover tarefa"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                    <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-1" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Sem plano para este dia */}
        {resolvedTasks.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <XCircle size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Sem tarefas para Semana {selectedWeek} · {DAY_LABELS[selectedDay]}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">Escolha outro dia manualmente.</p>
            {isAdmin && (
              <button
                onClick={() => setShowAddTaskModal(true)}
                className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 px-3 py-2 rounded-lg transition-colors"
              >
                <Plus size={13} />
                Incluir tarefa
              </button>
            )}
          </div>
        )}

      </main>

      {/* Modal Incluir nova tarefa (admin) */}
      {showAddTaskModal && isAdmin && (() => {
        const addSubjects = subjects.filter(s => s.discipline_id === addTaskForm.disciplinaId)
        const addParts = parts.filter(p => p.subject_id === addTaskForm.subjectId)
        const isBateria = addTaskForm.tipo === 'bateria'
        const showSubject = !isBateria && addTaskForm.tipo !== 'simulado'
        const showPart = showSubject && addTaskForm.subjectId !== '' && addParts.length > 0
        const showQtd = !isBateria && (addTaskForm.tipo === 'questoes' || addTaskForm.tipo === 'revisao')
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 py-4 sm:items-center">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <p className="text-sm font-semibold text-foreground">Incluir nova tarefa</p>
              <p className="mt-1 text-xs text-muted-foreground">Semana {selectedWeek} · {DAY_LABELS[selectedDay]}</p>
              <div className="mt-4 flex flex-col gap-2.5">
                <select
                  value={addTaskForm.tipo}
                  onChange={e => { setAddTaskForm({ tipo: e.target.value as StudyTaskType, disciplinaId: '', subjectId: '', partId: '', quantidade: '' }); setBateriaConfig(defaultBateriaConfig) }}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="questoes">Questoes</option>
                  <option value="teoria">Teoria</option>
                  <option value="lei_seca">Lei Seca</option>
                  <option value="revisao">Revisao / Flashcards</option>
                  <option value="simulado">Simulado</option>
                  <option value="bateria">Bateria</option>
                </select>

                {/* Config de bateria */}
                {isBateria && (
                  <div className="border border-cyan-500/20 rounded-lg p-3 bg-cyan-50/30 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-cyan-700">Configurar Bateria</p>
                    <div className="flex gap-2">
                      {(['escopo', 'mista'] as BateriaMode[]).map(mode => (
                        <button key={mode} type="button"
                          onClick={() => setBateriaConfig(prev => ({ ...prev, mode, selecoes: [] }))}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all border ${bateriaConfig.mode === mode ? 'border-cyan-500 bg-cyan-500/15 text-cyan-700' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
                        >
                          {mode === 'escopo' ? 'Mesmo Escopo' : 'Mista'}
                        </button>
                      ))}
                    </div>
                    {bateriaConfig.mode === 'escopo' && (
                      <div className="flex flex-col gap-2">
                        <select
                          value={bateriaConfig.selecoes[0]?.disciplineId ?? ''}
                          onChange={e => setBateriaConfig(prev => ({ ...prev, selecoes: [{ disciplineId: e.target.value, subjectIds: [] }] }))}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Selecione a disciplina *</option>
                          {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        {bateriaConfig.selecoes[0]?.disciplineId && (
                          <div className="border border-border rounded-lg p-2 max-h-32 overflow-y-auto flex flex-col gap-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Assuntos (vazio = todos):</p>
                            {subjects.filter(s => s.discipline_id === bateriaConfig.selecoes[0].disciplineId).map(s => (
                              <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input type="checkbox" className="accent-primary"
                                  checked={bateriaConfig.selecoes[0].subjectIds.includes(s.id)}
                                  onChange={e => {
                                    const ids = e.target.checked ? [...bateriaConfig.selecoes[0].subjectIds, s.id] : bateriaConfig.selecoes[0].subjectIds.filter(id => id !== s.id)
                                    setBateriaConfig(prev => ({ ...prev, selecoes: [{ ...prev.selecoes[0], subjectIds: ids }] }))
                                  }}
                                />
                                {s.name}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {bateriaConfig.mode === 'mista' && (
                      <div className="flex flex-col gap-2">
                        {bateriaConfig.selecoes.map((sel, i) => (
                          <div key={i} className="border border-border rounded-lg p-2 flex flex-col gap-1.5">
                            <div className="flex gap-2 items-center">
                              <select value={sel.disciplineId}
                                onChange={e => { const s = [...bateriaConfig.selecoes]; s[i] = { disciplineId: e.target.value, subjectIds: [] }; setBateriaConfig(prev => ({ ...prev, selecoes: s })) }}
                                className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none"
                              >
                                <option value="">Disciplina *</option>
                                {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                              <button type="button" onClick={() => setBateriaConfig(prev => ({ ...prev, selecoes: prev.selecoes.filter((_, j) => j !== i) }))} className="text-xs text-red-500 hover:text-red-700 px-1">✕</button>
                            </div>
                            {sel.disciplineId && (
                              <div className="border border-border rounded-lg p-1.5 max-h-24 overflow-y-auto flex flex-col gap-1">
                                <p className="text-xs text-muted-foreground mb-0.5">Assuntos (opcional):</p>
                                {subjects.filter(s => s.discipline_id === sel.disciplineId).map(s => (
                                  <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                    <input type="checkbox" className="accent-primary"
                                      checked={sel.subjectIds.includes(s.id)}
                                      onChange={e => {
                                        const ids = e.target.checked ? [...sel.subjectIds, s.id] : sel.subjectIds.filter(id => id !== s.id)
                                        const selecoes = [...bateriaConfig.selecoes]; selecoes[i] = { ...sel, subjectIds: ids }
                                        setBateriaConfig(prev => ({ ...prev, selecoes }))
                                      }}
                                    />
                                    {s.name}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        <button type="button"
                          onClick={() => setBateriaConfig(prev => ({ ...prev, selecoes: [...prev.selecoes, { disciplineId: '', subjectIds: [] }] }))}
                          className="flex items-center gap-1 text-xs text-cyan-700 hover:text-cyan-800 border border-cyan-300 rounded-lg px-2 py-1.5 transition-colors"
                        >
                          <Plus size={11} /> Adicionar disciplina
                        </button>
                      </div>
                    )}
                    <input type="number" min={1} value={bateriaConfig.quantidade || ''}
                      onChange={e => setBateriaConfig(prev => ({ ...prev, quantidade: Number(e.target.value) }))}
                      placeholder="Quantidade de questões *"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input type="number" min={1} value={bateriaConfig.tempo ?? ''}
                      onChange={e => setBateriaConfig(prev => ({ ...prev, tempo: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="Tempo em minutos (opcional)"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}

                {/* Campos normais (não bateria) */}
                {!isBateria && (
                  <>
                    <select
                      value={addTaskForm.disciplinaId}
                      onChange={e => setAddTaskForm(prev => ({ ...prev, disciplinaId: e.target.value, subjectId: '', partId: '' }))}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Selecione a disciplina *</option>
                      {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    {showSubject && addTaskForm.disciplinaId && (
                      <select
                        value={addTaskForm.subjectId}
                        onChange={e => setAddTaskForm(prev => ({ ...prev, subjectId: e.target.value, partId: '' }))}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">{addTaskForm.tipo === 'revisao' ? 'Assunto (opcional)' : 'Selecione o assunto *'}</option>
                        {addSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                    {showPart && (
                      <select
                        value={addTaskForm.partId}
                        onChange={e => setAddTaskForm(prev => ({ ...prev, partId: e.target.value }))}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Parte (opcional)</option>
                        {addParts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                    {showQtd && (
                      <input type="number" min={1} value={addTaskForm.quantidade}
                        onChange={e => setAddTaskForm(prev => ({ ...prev, quantidade: e.target.value }))}
                        placeholder="Quantidade (opcional)"
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    )}
                  </>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => { setShowAddTaskModal(false); setBateriaConfig(defaultBateriaConfig) }}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddTask}
                  className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal Editar tarefa (admin) */}
      {editingTaskIndex !== null && isAdmin && (() => {
        const editSubjects = subjects.filter(s => s.discipline_id === editTaskForm.disciplinaId)
        const editParts = parts.filter(p => p.subject_id === editTaskForm.subjectId)
        const isBateria = editTaskForm.tipo === 'bateria'
        const showSubject = !isBateria && editTaskForm.tipo !== 'simulado'
        const showPart = showSubject && editTaskForm.subjectId !== '' && editParts.length > 0
        const showQtd = !isBateria && (editTaskForm.tipo === 'questoes' || editTaskForm.tipo === 'revisao')
        const taskLabel = resolvedTasks[editingTaskIndex]
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 py-4 sm:items-center">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <p className="text-sm font-semibold text-foreground">Editar tarefa</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {taskLabel?.disciplina} · {taskLabel?.assunto.split(' — ')[0]}
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                <select
                  value={editTaskForm.tipo}
                  onChange={e => { setEditTaskForm(prev => ({ ...prev, tipo: e.target.value as StudyTaskType, disciplinaId: '', subjectId: '', partId: '', quantidade: '' })); setBateriaConfig(defaultBateriaConfig) }}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="questoes">Questoes</option>
                  <option value="teoria">Teoria</option>
                  <option value="lei_seca">Lei Seca</option>
                  <option value="revisao">Revisao / Flashcards</option>
                  <option value="simulado">Simulado</option>
                  <option value="bateria">Bateria</option>
                </select>

                {/* Config de bateria */}
                {isBateria && (
                  <div className="border border-cyan-500/20 rounded-lg p-3 bg-cyan-50/30 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-cyan-700">Configurar Bateria</p>
                    <div className="flex gap-2">
                      {(['escopo', 'mista'] as BateriaMode[]).map(mode => (
                        <button key={mode} type="button"
                          onClick={() => setBateriaConfig(prev => ({ ...prev, mode, selecoes: [] }))}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all border ${bateriaConfig.mode === mode ? 'border-cyan-500 bg-cyan-500/15 text-cyan-700' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
                        >
                          {mode === 'escopo' ? 'Mesmo Escopo' : 'Mista'}
                        </button>
                      ))}
                    </div>
                    {bateriaConfig.mode === 'escopo' && (
                      <div className="flex flex-col gap-2">
                        <select
                          value={bateriaConfig.selecoes[0]?.disciplineId ?? ''}
                          onChange={e => setBateriaConfig(prev => ({ ...prev, selecoes: [{ disciplineId: e.target.value, subjectIds: [] }] }))}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Selecione a disciplina *</option>
                          {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        {bateriaConfig.selecoes[0]?.disciplineId && (
                          <div className="border border-border rounded-lg p-2 max-h-32 overflow-y-auto flex flex-col gap-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Assuntos (vazio = todos):</p>
                            {subjects.filter(s => s.discipline_id === bateriaConfig.selecoes[0].disciplineId).map(s => (
                              <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input type="checkbox" className="accent-primary"
                                  checked={bateriaConfig.selecoes[0].subjectIds.includes(s.id)}
                                  onChange={e => {
                                    const ids = e.target.checked ? [...bateriaConfig.selecoes[0].subjectIds, s.id] : bateriaConfig.selecoes[0].subjectIds.filter(id => id !== s.id)
                                    setBateriaConfig(prev => ({ ...prev, selecoes: [{ ...prev.selecoes[0], subjectIds: ids }] }))
                                  }}
                                />
                                {s.name}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {bateriaConfig.mode === 'mista' && (
                      <div className="flex flex-col gap-2">
                        {bateriaConfig.selecoes.map((sel, i) => (
                          <div key={i} className="border border-border rounded-lg p-2 flex flex-col gap-1.5">
                            <div className="flex gap-2 items-center">
                              <select value={sel.disciplineId}
                                onChange={e => { const s = [...bateriaConfig.selecoes]; s[i] = { disciplineId: e.target.value, subjectIds: [] }; setBateriaConfig(prev => ({ ...prev, selecoes: s })) }}
                                className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none"
                              >
                                <option value="">Disciplina *</option>
                                {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                              <button type="button" onClick={() => setBateriaConfig(prev => ({ ...prev, selecoes: prev.selecoes.filter((_, j) => j !== i) }))} className="text-xs text-red-500 hover:text-red-700 px-1">✕</button>
                            </div>
                            {sel.disciplineId && (
                              <div className="border border-border rounded-lg p-1.5 max-h-24 overflow-y-auto flex flex-col gap-1">
                                <p className="text-xs text-muted-foreground mb-0.5">Assuntos (opcional):</p>
                                {subjects.filter(s => s.discipline_id === sel.disciplineId).map(s => (
                                  <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                    <input type="checkbox" className="accent-primary"
                                      checked={sel.subjectIds.includes(s.id)}
                                      onChange={e => {
                                        const ids = e.target.checked ? [...sel.subjectIds, s.id] : sel.subjectIds.filter(id => id !== s.id)
                                        const selecoes = [...bateriaConfig.selecoes]; selecoes[i] = { ...sel, subjectIds: ids }
                                        setBateriaConfig(prev => ({ ...prev, selecoes }))
                                      }}
                                    />
                                    {s.name}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        <button type="button"
                          onClick={() => setBateriaConfig(prev => ({ ...prev, selecoes: [...prev.selecoes, { disciplineId: '', subjectIds: [] }] }))}
                          className="flex items-center gap-1 text-xs text-cyan-700 hover:text-cyan-800 border border-cyan-300 rounded-lg px-2 py-1.5 transition-colors"
                        >
                          <Plus size={11} /> Adicionar disciplina
                        </button>
                      </div>
                    )}
                    <input type="number" min={1} value={bateriaConfig.quantidade || ''}
                      onChange={e => setBateriaConfig(prev => ({ ...prev, quantidade: Number(e.target.value) }))}
                      placeholder="Quantidade de questões *"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input type="number" min={1} value={bateriaConfig.tempo ?? ''}
                      onChange={e => setBateriaConfig(prev => ({ ...prev, tempo: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="Tempo em minutos (opcional)"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}

                {/* Campos normais (não bateria) */}
                {!isBateria && (
                  <>
                    <select
                      value={editTaskForm.disciplinaId}
                      onChange={e => setEditTaskForm(prev => ({ ...prev, disciplinaId: e.target.value, subjectId: '', partId: '' }))}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Selecione a disciplina *</option>
                      {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    {showSubject && editTaskForm.disciplinaId && (
                      <select
                        value={editTaskForm.subjectId}
                        onChange={e => setEditTaskForm(prev => ({ ...prev, subjectId: e.target.value, partId: '' }))}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">{editTaskForm.tipo === 'revisao' ? 'Assunto (opcional)' : 'Selecione o assunto *'}</option>
                        {editSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                    {showPart && (
                      <select
                        value={editTaskForm.partId}
                        onChange={e => setEditTaskForm(prev => ({ ...prev, partId: e.target.value }))}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Parte (opcional)</option>
                        {editParts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                    {showQtd && (
                      <input
                        type="number"
                        min={1}
                        value={editTaskForm.quantidade}
                        onChange={e => setEditTaskForm(prev => ({ ...prev, quantidade: e.target.value }))}
                        placeholder="Quantidade (opcional)"
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    )}
                  </>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setEditingTaskIndex(null)}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEditTask}
                  className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de pendências de cadastro */}
      {showPendingPanel && isAdmin && (() => {
        const pendingTasks = resolvedTasks.filter(t => t.requiresManualSetup)
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 sm:items-center sm:px-3">
            <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600" />
                  <p className="text-sm font-semibold text-foreground">
                    Pendências de cadastro
                  </p>
                  <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5">
                    {pendingTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowPendingPanel(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  <XCircle size={18} />
                </button>
              </div>

              {/* Lista de pendências */}
              <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-3">
                {pendingTasks.map(task => {
                  const isTheory = isTheoryLikeTask(task)
                  const label = task.tipo === 'lei_seca' ? 'Cadastrar lei seca' : isTheory ? 'Cadastrar teoria' : 'Importar / Cadastrar'
                  const setupHint = task.setupHint ?? (isTheory
                    ? 'Teoria não encontrada para este assunto'
                    : 'Assunto sem vínculo resolvido no sistema')
                  const fallbackState = {
                    fromStudyNow: true,
                    semana: selectedWeek,
                    dia: selectedDay,
                    disciplina: task.disciplina,
                    assunto: task.assunto,
                  }
                  return (
                    <div
                      key={task.id}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3"
                    >
                      {/* Tipo badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${TASK_TYPE_COLORS[task.tipo]}`}>
                          {TASK_TYPE_LABELS[task.tipo]}
                        </span>
                        {task.quantidade && (
                          <span className="text-xs text-muted-foreground">{task.quantidade}q</span>
                        )}
                      </div>

                      {/* Caminho: disciplina › assunto [› parte] */}
                      <div className="flex flex-wrap items-center gap-1 mb-1.5">
                        <span className="text-xs font-semibold text-amber-700">{task.disciplina}</span>
                        <span className="text-xs text-amber-500">›</span>
                        <span className="text-xs font-medium text-foreground">{getBaseSubjectName(task.assunto)}</span>
                        {task.mappedPartId && task.mappedPathLabel && (
                          <>
                            <span className="text-xs text-amber-500">›</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                              {task.mappedPathLabel.split(' › ').pop()}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Problema */}
                      <p className="text-xs text-amber-600/80 mb-3">{setupHint}</p>

                      {/* Ação rápida */}
                      <button
                        onClick={() => {
                          setShowPendingPanel(false)
                          if (isTheory) {
                            openTheorySetup(task)
                          } else {
                            navigate('/import', { state: fallbackState })
                          }
                        }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-2 rounded-lg transition-colors"
                      >
                        <Settings size={12} />
                        {label}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-border shrink-0">
                <button
                  onClick={() => setShowPendingPanel(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground py-2 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de teoria rápida — disponível na overview quando aberto via lista de pendências */}
      {theorySetupTask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 py-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-2xl">
            <p className="text-sm font-semibold text-foreground">
              {theorySetupTask.tipo === 'lei_seca' ? 'Novo conteudo de lei seca' : 'Nova teoria'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {theorySetupTask.disciplina} · {getBaseSubjectName(theorySetupTask.assunto)}
            </p>

            <div className="mt-4 flex flex-col gap-2.5">
              <select
                value={theorySetupForm.disciplineId}
                onChange={e => setTheorySetupForm(prev => ({ ...prev, disciplineId: e.target.value }))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecione a disciplina *</option>
                {disciplines.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <input
                value={theorySetupForm.subjectName}
                onChange={e => setTheorySetupForm(prev => ({ ...prev, subjectName: e.target.value }))}
                placeholder="Assunto *"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <input
                value={theorySetupForm.title}
                onChange={e => setTheorySetupForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Titulo do conteudo *"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <textarea
                rows={7}
                value={theorySetupForm.content}
                onChange={e => setTheorySetupForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Cole ou escreva o conteudo teorico / lei seca *"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={closeTheorySetup}
                disabled={savingTheorySetup}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => { void handleCreateTheorySetup() }}
                disabled={savingTheorySetup}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {savingTheorySetup ? 'Salvando...' : 'Salvar e abrir teoria'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
