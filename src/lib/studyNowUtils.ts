import type { Discipline, Subject, SubjectPart } from '@/types'
import { studyPlan, getDayPlan } from '@/data/studyPlan'
import type { StudyTask, StudyDayKey, StudyDayPlan } from '@/data/studyPlan'

// ---------------------------------------------------------------------------
// Configuração de datas do plano
// ---------------------------------------------------------------------------

export const PLAN_START_DATE = '2026-04-01'
export const PLAN_TOTAL_WEEKS = 13

// ---------------------------------------------------------------------------
// Semana e dia atuais
// ---------------------------------------------------------------------------

export function getCurrentWeek(): number {
  const start = new Date(PLAN_START_DATE)
  const now = new Date()
  // zera horas para comparar apenas datas
  start.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)

  const diffMs = now.getTime() - start.getTime()
  if (diffMs < 0) return 1

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const week = Math.floor(diffDays / 7) + 1

  return Math.min(Math.max(week, 1), PLAN_TOTAL_WEEKS)
}

const JS_DAY_TO_KEY: Record<number, StudyDayKey> = {
  0: 'dom',
  1: 'seg',
  2: 'ter',
  3: 'qua',
  4: 'qui',
  5: 'sex',
  6: 'sab',
}

export function getCurrentDayKey(): StudyDayKey {
  return JS_DAY_TO_KEY[new Date().getDay()]
}

export function getTodayStudyPlan(): StudyDayPlan | undefined {
  const week = getCurrentWeek()
  const day = getCurrentDayKey()
  return getDayPlan(week, day)
}

export function getPlanForDay(semana: number, dia: StudyDayKey): StudyDayPlan | undefined {
  return getDayPlan(semana, dia)
}

export function getWeeksForManualSelect(): number[] {
  return Array.from({ length: PLAN_TOTAL_WEEKS }, (_, i) => i + 1)
}

export const DAY_OPTIONS: { key: StudyDayKey; label: string }[] = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
]

// ---------------------------------------------------------------------------
// Mapeamento runtime: casar tarefa do plano → disciplina/assunto do banco
// ---------------------------------------------------------------------------

// Alias canônicos: nome no plano → substrings que identificam a disciplina no banco
const DISCIPLINE_ALIASES: Record<string, string[]> = {
  'Português': ['português', 'lingua portuguesa', 'língua portuguesa'],
  'Regimento Interno ALE-RR': ['regimento interno'],
  'Direito Constitucional': ['direito constitucional', 'constitucional'],
  'Processo Legislativo': ['processo legislativo'],
  'Legislação Institucional': ['constituição do estado', 'código de ética', 'resolução', 'lei complementar', 'legislação institucional', 'legis'],
  'Direito Administrativo': ['direito administrativo', 'administrativo'],
  'AFO': ['administração financeira', 'afo', 'orçamento'],
  'Administração Pública': ['administração pública', 'adm. pública', 'adm publica'],
  'Legística': ['legística', 'legistica'],
  'Geografia e História de Roraima': ['geografia', 'história de roraima', 'historia de roraima', 'geo/hist'],
  'Geral': [], // tarefas gerais (simulados, revisões mistas) — sem disciplina específica
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').trim()
}

export function matchDiscipline(planDisciplinaName: string, disciplines: Discipline[]): Discipline | null {
  if (planDisciplinaName === 'Geral') return null

  const aliases = DISCIPLINE_ALIASES[planDisciplinaName]
  if (!aliases) {
    // fallback: substring direto
    const n = normalize(planDisciplinaName)
    return disciplines.find(d => normalize(d.name).includes(n) || n.includes(normalize(d.name))) ?? null
  }

  for (const alias of aliases) {
    const a = normalize(alias)
    const found = disciplines.find(d => normalize(d.name).includes(a))
    if (found) return found
  }
  return null
}

export function matchSubject(assunto: string, subjects: Subject[], disciplineId: string): Subject | null {
  const filtered = subjects.filter(s => s.discipline_id === disciplineId)
  if (filtered.length === 0) return null

  const n = normalize(assunto)
  // tentativa 1: substring exato no assunto
  let found = filtered.find(s => n.includes(normalize(s.name)) || normalize(s.name).includes(n))
  if (found) return found

  // tentativa 2: primeiras palavras significativas (≥4 chars) do assunto
  const keywords = n.split(/[\s\-\+\/,]+/).filter(w => w.length >= 4)
  for (const kw of keywords) {
    found = filtered.find(s => normalize(s.name).includes(kw))
    if (found) return found
  }
  return null
}

export function matchPart(subjectId: string, parts: SubjectPart[]): SubjectPart | null {
  // retorna a primeira parte se houver apenas uma, caso contrário null (deixa usuário escolher)
  const ps = parts.filter(p => p.subject_id === subjectId)
  return ps.length === 1 ? ps[0] : null
}

export interface ResolvedTask extends StudyTask {
  mappedDisciplineId: string | null
  mappedSubjectId: string | null
  mappedPartId: string | null
  mappedPathLabel: string | null
  requiresManualSetup: boolean
  setupHint: string | null
}

export function resolveTaskMapping(
  task: StudyTask,
  disciplines: Discipline[],
  subjects: Subject[],
  parts: SubjectPart[],
): ResolvedTask {
  // Tarefas gerais (simulados, questões mistas) — sem disciplina específica
  if (task.disciplina === 'Geral') {
    if (task.tipo === 'teoria' || task.tipo === 'lei_seca') {
      return {
        ...task,
        mappedDisciplineId: null,
        mappedSubjectId: null,
        mappedPartId: null,
        mappedPathLabel: null,
        requiresManualSetup: true,
        setupHint: 'Tarefa teórica geral sem vínculo de assunto. Crie o conteúdo teórico/lei seca para habilitar abertura direta.',
      }
    }

    return {
      ...task,
      mappedDisciplineId: null,
      mappedSubjectId: null,
      mappedPartId: null,
      mappedPathLabel: null,
      requiresManualSetup: false,
      setupHint: null,
    }
  }

  const discipline = matchDiscipline(task.disciplina, disciplines)
  if (!discipline) {
    return {
      ...task,
      mappedDisciplineId: null,
      mappedSubjectId: null,
      mappedPartId: null,
      mappedPathLabel: null,
      requiresManualSetup: true,
      setupHint: `Cadastre a disciplina "${task.disciplina}" no painel Admin para habilitar navegação direta.`,
    }
  }

  // Para tarefas de revisão/flashcards, a disciplina é suficiente — não exige assunto literal
  if (task.tipo === 'revisao') {
    return {
      ...task,
      mappedDisciplineId: discipline.id,
      mappedSubjectId: null,
      mappedPartId: null,
      mappedPathLabel: `Flashcards — ${discipline.name}`,
      requiresManualSetup: false,
      setupHint: null,
    }
  }

  const subject = matchSubject(task.assunto, subjects, discipline.id)
  if (!subject) {
    // Baterias acumuladas não dependem de um assunto literal no banco
    const isAccumulatedBattery = normalize(task.assunto).includes('acumulad')
    return {
      ...task,
      mappedDisciplineId: discipline.id,
      mappedSubjectId: null,
      mappedPartId: null,
      mappedPathLabel: isAccumulatedBattery
        ? `${discipline.name} — Acumulado`
        : `${discipline.name} (todos os assuntos)`,
      requiresManualSetup: !isAccumulatedBattery,
      setupHint: isAccumulatedBattery
        ? null
        : `Disciplina "${discipline.name}" encontrada, mas o assunto "${task.assunto.split(' — ')[0]}" ainda não está cadastrado. Admin: adicione via Admin para link direto.`,
    }
  }

  const part = matchPart(subject.id, parts)

  return {
    ...task,
    mappedDisciplineId: discipline.id,
    mappedSubjectId: subject.id,
    mappedPartId: part?.id ?? null,
    mappedPathLabel: `${discipline.name} › ${subject.name}${part ? ` › ${part.name}` : ''}`,
    requiresManualSetup: false,
    setupHint: null,
  }
}

export function resolveAllTasks(
  tasks: StudyTask[],
  disciplines: Discipline[],
  subjects: Subject[],
  parts: SubjectPart[],
): ResolvedTask[] {
  return tasks.map(t => resolveTaskMapping(t, disciplines, subjects, parts))
}

// ---------------------------------------------------------------------------
// Semana do plano escolhida manualmente — persiste entre visitas
// ---------------------------------------------------------------------------

export const PLAN_WEEK_KEY = 'provamax_plan_selected_week'

export function loadSavedPlanWeek(): number | null {
  try {
    const raw = localStorage.getItem(PLAN_WEEK_KEY)
    if (!raw) return null
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n >= 1 && n <= PLAN_TOTAL_WEEKS ? n : null
  } catch {
    return null
  }
}

export function savePlanWeek(week: number): void {
  try {
    localStorage.setItem(PLAN_WEEK_KEY, String(week))
  } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Sessão de estudo persistida em localStorage
// ---------------------------------------------------------------------------

export const SESSION_KEY = 'provamax_study_now_session'

export type StudyNowMode = 'rigido' | 'flexivel'

export interface StudyNowSession {
  semana: number
  dia: StudyDayKey
  currentTaskIndex: number
  taskIds: string[]
  completedTaskIds: string[]
  pendingSetupTaskIds: string[]
  skippedTaskIds: string[]
  startedAt: string
  finishedAt: string | null
  finished: boolean
  mode: StudyNowMode
}

export function loadSession(): StudyNowSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StudyNowSession
  } catch {
    return null
  }
}

export function saveSession(session: StudyNowSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function createSession(semana: number, dia: StudyDayKey, mode: StudyNowMode = 'flexivel'): StudyNowSession {
  const plan = getDayPlan(semana, dia)
  const taskIds = plan?.tarefas.map(t => t.id) ?? []
  return {
    semana,
    dia,
    currentTaskIndex: 0,
    taskIds,
    completedTaskIds: [],
    pendingSetupTaskIds: [],
    skippedTaskIds: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    finished: false,
    mode,
  }
}

export function markTaskCompleted(session: StudyNowSession, taskId: string): StudyNowSession {
  const completed = session.completedTaskIds.includes(taskId)
    ? session.completedTaskIds
    : [...session.completedTaskIds, taskId]

  const nextIndex = Math.min(session.currentTaskIndex + 1, session.taskIds.length - 1)
  const allDone = completed.length + session.skippedTaskIds.length >= session.taskIds.length

  return {
    ...session,
    completedTaskIds: completed,
    currentTaskIndex: nextIndex,
    finished: allDone,
    finishedAt: allDone ? new Date().toISOString() : null,
  }
}

export function markTaskPendingSetup(session: StudyNowSession, taskId: string): StudyNowSession {
  const pending = session.pendingSetupTaskIds.includes(taskId)
    ? session.pendingSetupTaskIds
    : [...session.pendingSetupTaskIds, taskId]

  const nextIndex = Math.min(session.currentTaskIndex + 1, session.taskIds.length - 1)
  return { ...session, pendingSetupTaskIds: pending, currentTaskIndex: nextIndex }
}

export function skipTask(session: StudyNowSession, taskId: string): StudyNowSession {
  const skipped = session.skippedTaskIds.includes(taskId)
    ? session.skippedTaskIds
    : [...session.skippedTaskIds, taskId]

  const nextIndex = Math.min(session.currentTaskIndex + 1, session.taskIds.length - 1)
  const allDone = session.completedTaskIds.length + skipped.length >= session.taskIds.length

  return {
    ...session,
    skippedTaskIds: skipped,
    currentTaskIndex: nextIndex,
    finished: allDone,
    finishedAt: allDone ? new Date().toISOString() : null,
  }
}

// ---------------------------------------------------------------------------
// Helpers de UI
// ---------------------------------------------------------------------------

export function getSessionProgress(session: StudyNowSession) {
  const total = session.taskIds.length
  const done = session.completedTaskIds.length
  const skipped = session.skippedTaskIds.length
  const pending = session.pendingSetupTaskIds.length
  const remaining = total - done - skipped
  return { total, done, skipped, pending, remaining }
}

export function getWeekMeta(semana: number): { questoesMeta: number; acertoMeta: string } {
  const metas: Record<number, { questoesMeta: number; acertoMeta: string }> = {
    1: { questoesMeta: 95, acertoMeta: '60%' },
    2: { questoesMeta: 105, acertoMeta: '63%' },
    3: { questoesMeta: 115, acertoMeta: '65%' },
    4: { questoesMeta: 120, acertoMeta: '68%' },
    5: { questoesMeta: 125, acertoMeta: '70%' },
    6: { questoesMeta: 130, acertoMeta: '72%' },
    7: { questoesMeta: 135, acertoMeta: '74%' },
    8: { questoesMeta: 145, acertoMeta: '76%' },
    9: { questoesMeta: 155, acertoMeta: '78%' },
    10: { questoesMeta: 160, acertoMeta: '80%' },
    11: { questoesMeta: 165, acertoMeta: '82%' },
    12: { questoesMeta: 140, acertoMeta: '83%' },
    13: { questoesMeta: 80, acertoMeta: '85%' },
  }
  return metas[semana] ?? { questoesMeta: 0, acertoMeta: '-' }
}

export function buildStudyPath(task: ResolvedTask): string | null {
  if (task.tipo === 'simulado') return '/simulado'

  // Revisão/flashcards: link direto para a disciplina de flashcards
  if (task.tipo === 'revisao') {
    if (task.mappedDisciplineId) return `/flashcards?disciplineId=${task.mappedDisciplineId}`
    return '/flashcards'
  }

  // Tarefas Geral+questoes → simulado como fallback de misto
  if (task.disciplina === 'Geral' && task.tipo === 'questoes') return '/simulado'

  // Questões/teoria/lei_seca sem assunto mas com disciplina → fallback por disciplina
  if (!task.mappedSubjectId && task.mappedDisciplineId) {
    if (task.tipo === 'questoes') return `/study-discipline/${task.mappedDisciplineId}`
    return null // teoria/lei_seca precisam de assunto específico
  }

  if (!task.mappedSubjectId) return null

  if (task.tipo === 'teoria') return `/theory/${task.mappedSubjectId}`
  if (task.tipo === 'lei_seca') return `/theory/${task.mappedSubjectId}`

  // questoes com assunto
  if (task.mappedPartId) return `/study/${task.mappedSubjectId}/part/${task.mappedPartId}`
  return `/study/${task.mappedSubjectId}`
}

// ---------------------------------------------------------------------------
// Resumo do dia para o card da Home
// ---------------------------------------------------------------------------

export interface DaySummary {
  semana: number
  dia: StudyDayKey
  totalTasks: number
  readyTasks: number      // mapeadas e prontas
  missingTasks: number    // faltam cadastro
  questoesTotal: number
  hasActiveSession: boolean
  nextTaskLabel: string | null
}

export function buildDaySummary(
  disciplines: Discipline[],
  subjects: Subject[],
  parts: SubjectPart[],
): DaySummary {
  const semana = getCurrentWeek()
  const dia = getCurrentDayKey()
  const plan = getDayPlan(semana, dia)
  const session = loadSession()

  if (!plan) {
    return {
      semana, dia, totalTasks: 0, readyTasks: 0, missingTasks: 0,
      questoesTotal: 0, hasActiveSession: false, nextTaskLabel: null,
    }
  }

  const resolved = resolveAllTasks(plan.tarefas, disciplines, subjects, parts)
  const readyTasks = resolved.filter(t => !t.requiresManualSetup).length
  const missingTasks = resolved.filter(t => t.requiresManualSetup).length
  const questoesTotal = resolved.reduce((s, t) => s + (t.quantidade ?? 0), 0)

  const hasActiveSession = !!(
    session &&
    !session.finished &&
    session.semana === semana &&
    session.dia === dia
  )

  const nextTask = hasActiveSession && session
    ? resolved[session.currentTaskIndex]
    : resolved[0]

  return {
    semana, dia, totalTasks: plan.tarefas.length, readyTasks, missingTasks,
    questoesTotal, hasActiveSession,
    nextTaskLabel: nextTask ? `${nextTask.disciplina} — ${nextTask.assunto.slice(0, 50)}` : null,
  }
}

// Versão que aceita semana e dia manuais (para seletor no card)
export function buildDaySummaryForWeek(
  semana: number,
  dia: StudyDayKey,
  disciplines: Discipline[],
  subjects: Subject[],
  parts: SubjectPart[],
): DaySummary {
  const plan = getDayPlan(semana, dia)
  const session = loadSession()

  if (!plan) {
    return {
      semana, dia, totalTasks: 0, readyTasks: 0, missingTasks: 0,
      questoesTotal: 0, hasActiveSession: false, nextTaskLabel: null,
    }
  }

  const resolved = resolveAllTasks(plan.tarefas, disciplines, subjects, parts)
  const readyTasks = resolved.filter(t => !t.requiresManualSetup).length
  const missingTasks = resolved.filter(t => t.requiresManualSetup).length
  const questoesTotal = resolved.reduce((s, t) => s + (t.quantidade ?? 0), 0)

  const hasActiveSession = !!(
    session &&
    !session.finished &&
    session.semana === semana &&
    session.dia === dia
  )

  const nextTask = hasActiveSession && session
    ? resolved[session.currentTaskIndex]
    : resolved[0]

  return {
    semana, dia, totalTasks: plan.tarefas.length, readyTasks, missingTasks,
    questoesTotal, hasActiveSession,
    nextTaskLabel: nextTask ? `${nextTask.disciplina} — ${nextTask.assunto.slice(0, 50)}` : null,
  }
}

// Re-exports convenientes
export { studyPlan, getDayPlan }
export type { StudyTask, StudyDayKey, StudyDayPlan, ResolvedTask as ResolvedStudyTask }
