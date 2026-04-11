import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Discipline, Subject, Question, Profile, SimuladoRecord, SimuladoQuestion, Flashcard } from '@/types'

export const ADMIN_EMAIL = 'alexandregoncalvespmrr@gmail.com'

export type UserStatus = 'pending' | 'approved' | 'suspended' | 'revoked'

export type AuthorizationDecisionReason =
  | 'admin_auto_approved'
  | 'created_pending_first_access'
  | 'allowed_approved'
  | 'suspended_moved_back_to_pending'
  | 'denied_revoked'
  | 'waiting_profile_resolution'
  | 'authorization_loading'
  | 'denied_pending'

export interface AuthorizationResolution {
  profile: Profile | null
  isAdmin: boolean
  isAuthorized: boolean
  reason: AuthorizationDecisionReason
  message: string
}

interface AuthUserLike {
  id: string
  email?: string | null
  user_metadata?: User['user_metadata']
}

const VALID_STATUSES: UserStatus[] = ['pending', 'approved', 'suspended', 'revoked']

const WAITING_APPROVAL_MESSAGE = 'Seu acesso está aguardando aprovação do administrador.'
const RESUBMITTED_APPROVAL_MESSAGE = 'Seu acesso foi reenviado para aprovação do administrador.'
const REVOKED_MESSAGE = 'Seu acesso foi revogado permanentemente.'
const MISSING_PROFILE_MESSAGE = 'Não foi possível carregar seu perfil agora. Tente novamente em instantes.'

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase()
}

function getSafeName(authUser: AuthUserLike, normalizedEmail: string) {
  const metadataName = typeof authUser.user_metadata?.name === 'string'
    ? authUser.user_metadata.name.trim()
    : ''

  if (metadataName) return metadataName
  if (normalizedEmail.includes('@')) return normalizedEmail.split('@')[0]
  return 'usuario'
}

function hasManualApproval(profile: Profile) {
  if (!profile.approved_at) return false

  const approvedAt = Date.parse(profile.approved_at)
  const createdAt = Date.parse(profile.created_at)

  if (Number.isNaN(approvedAt) || Number.isNaN(createdAt)) return false

  return approvedAt > createdAt
}

async function getProfileByUserId(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return (data as Profile | null) ?? null
}

async function getProfileByEmail(email: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (error) throw error
  return (data as Profile | null) ?? null
}

async function syncProfileIdentity(profile: Profile, authUser: AuthUserLike, normalizedEmail: string) {
  const nextName = getSafeName(authUser, normalizedEmail)
  const patch: Partial<Profile> = {}

  if (profile.email !== normalizedEmail) patch.email = normalizedEmail
  if (!profile.name?.trim()) patch.name = nextName

  if (Object.keys(patch).length === 0) return profile

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', authUser.id)
    .select('*')
    .single()

  if (error) throw error
  return data as Profile
}

async function moveProfileToPending(userId: string, extraPatch?: { approved_at?: null; suspended_at?: null }) {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('profiles')
    .update({
      status: 'pending',
      requested_access_at: now,
      suspended_at: null,
      approved_at: null,
      updated_at: now,
      is_validated: false,
      ...(extraPatch ?? {}),
    })
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw error
  return data as Profile
}

async function enforceNonAdminConsistency(authUser: AuthUserLike, profile: Profile) {
  const normalizedProfileEmail = normalizeEmail(profile.email)
  const now = new Date().toISOString()
  const patch: {
    role?: 'user'
    status?: UserStatus
    requested_access_at?: string
    approved_at?: null
    suspended_at?: null
    updated_at?: string
    is_validated?: boolean
  } = {}

  if (profile.role !== 'user') {
    patch.role = 'user'
  }

  if (!VALID_STATUSES.includes(profile.status)) {
    patch.status = 'pending'
    patch.requested_access_at = now
    patch.approved_at = null
    patch.suspended_at = null
    patch.is_validated = false
  }

  if (profile.status === 'approved' && !profile.approved_at) {
    patch.status = 'pending'
    patch.requested_access_at = now
    patch.approved_at = null
    patch.is_validated = false
  }

  if (profile.status === 'pending' && !profile.requested_access_at) {
    patch.requested_access_at = now
  }

  if (normalizedProfileEmail !== normalizeEmail(authUser.email)) {
    patch.updated_at = now
  }

  if (Object.keys(patch).length === 0) return profile

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: now })
    .eq('user_id', authUser.id)
    .select('*')
    .single()

  if (error) throw error
  return data as Profile
}

async function createPendingProfile(authUser: AuthUserLike, normalizedEmail: string) {
  const now = new Date().toISOString()
  const payload = {
    user_id: authUser.id,
    email: normalizedEmail,
    name: getSafeName(authUser, normalizedEmail),
    role: 'user',
    status: 'pending' as const,
    requested_access_at: now,
    approved_at: null,
    suspended_at: null,
    updated_at: now,
    is_validated: false,
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) throw error
  return data as Profile
}

async function ensureAdminProfile(authUser: AuthUserLike, normalizedEmail: string, currentProfile: Profile | null) {
  const now = new Date().toISOString()

  if (!currentProfile) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: authUser.id,
          email: normalizedEmail,
          name: getSafeName(authUser, normalizedEmail),
          role: 'admin',
          status: 'approved',
          requested_access_at: now,
          approved_at: now,
          suspended_at: null,
          updated_at: now,
          is_validated: true,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single()

    if (error) throw error
    return data as Profile
  }

  // Only patch what actually needs to change.
  // NEVER include updated_at unconditionally — doing so would write on every
  // call, triggering Supabase Realtime, which calls this function again,
  // creating an infinite write→Realtime→write loop.
  const patch: Partial<Profile> & { updated_at?: string } = {}

  if (currentProfile.email !== normalizedEmail)    patch.email = normalizedEmail
  if (!currentProfile.name?.trim())                patch.name  = getSafeName(authUser, normalizedEmail)
  if (currentProfile.role !== 'admin')             patch.role  = 'admin' as const
  if (currentProfile.status !== 'approved')        patch.status = 'approved' as const
  if (currentProfile.suspended_at !== null)        patch.suspended_at = null
  if (!currentProfile.is_validated)               patch.is_validated = true
  if (!currentProfile.approved_at)                patch.approved_at  = now

  // Nothing to do — profile is already in the correct state
  if (Object.keys(patch).length === 0) return currentProfile

  patch.updated_at = now

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', authUser.id)
    .select('*')
    .single()

  if (error) throw error
  return data as Profile
}

export async function resolveAuthorizationForUser(authUser: AuthUserLike): Promise<AuthorizationResolution> {
  const normalizedEmail = normalizeEmail(authUser.email)

  if (!normalizedEmail) {
    return {
      profile: null,
      isAdmin: false,
      isAuthorized: false,
      reason: 'waiting_profile_resolution',
      message: MISSING_PROFILE_MESSAGE,
    }
  }

  let profile = await getProfileByUserId(authUser.id)

  if (!profile) {
    const profileByEmail = await getProfileByEmail(normalizedEmail)

    if (profileByEmail) {
      const { data, error } = await supabase
        .from('profiles')
        .update({ user_id: authUser.id, email: normalizedEmail, updated_at: new Date().toISOString() })
        .eq('user_id', profileByEmail.user_id)
        .select('*')
        .single()

      if (error) throw error
      profile = data as Profile
    }
  }

  const isAdminEmail = normalizedEmail === ADMIN_EMAIL

  if (isAdminEmail) {
    const adminProfile = await ensureAdminProfile(authUser, normalizedEmail, profile)

    return {
      profile: adminProfile,
      isAdmin: true,
      isAuthorized: true,
      reason: 'admin_auto_approved',
      message: 'Acesso administrativo liberado.',
    }
  }

  if (!profile) {
    try {
      const pendingProfile = await createPendingProfile(authUser, normalizedEmail)
      return {
        profile: pendingProfile,
        isAdmin: false,
        isAuthorized: false,
        reason: 'created_pending_first_access',
        message: WAITING_APPROVAL_MESSAGE,
      }
    } catch {
      return {
        profile: null,
        isAdmin: false,
        isAuthorized: false,
        reason: 'waiting_profile_resolution',
        message: MISSING_PROFILE_MESSAGE,
      }
    }
  }

  profile = await syncProfileIdentity(profile, authUser, normalizedEmail)
  profile = await enforceNonAdminConsistency(authUser, profile)

  switch (profile.status) {
    case 'approved':
      if (!hasManualApproval(profile)) {
        const pendingProfile = await moveProfileToPending(authUser.id)
        return {
          profile: pendingProfile,
          isAdmin: false,
          isAuthorized: false,
          reason: 'created_pending_first_access',
          message: WAITING_APPROVAL_MESSAGE,
        }
      }

      return {
        profile,
        isAdmin: profile.role === 'admin',
        isAuthorized: true,
        reason: 'allowed_approved',
        message: 'Acesso liberado.',
      }

    case 'pending':
      return {
        profile,
        isAdmin: profile.role === 'admin',
        isAuthorized: false,
        reason: 'denied_pending',
        message: WAITING_APPROVAL_MESSAGE,
      }

    case 'suspended': {
      const pendingProfile = await moveProfileToPending(authUser.id)

      return {
        profile: pendingProfile,
        isAdmin: false,
        isAuthorized: false,
        reason: 'suspended_moved_back_to_pending',
        message: RESUBMITTED_APPROVAL_MESSAGE,
      }
    }

    case 'revoked':
      return {
        profile,
        isAdmin: false,
        isAuthorized: false,
        reason: 'denied_revoked',
        message: REVOKED_MESSAGE,
      }

    default: {
      const pendingProfile = await moveProfileToPending(authUser.id)

      return {
        profile: pendingProfile,
        isAdmin: false,
        isAuthorized: false,
        reason: 'created_pending_first_access',
        message: WAITING_APPROVAL_MESSAGE,
      }
    }
  }
}

// -- DISCIPLINES ---------------------------------------------------------------

export async function getDisciplines(): Promise<Discipline[]> {
  const { data, error } = await supabase
    .from('disciplines')
    .select('*')
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function saveDiscipline(discipline: Partial<Discipline> & { name: string }) {
  if (discipline.id) {
    const { error } = await supabase
      .from('disciplines')
      .update({ name: discipline.name, icon: discipline.icon, group_name: discipline.group_name ?? null })
      .eq('id', discipline.id)

    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('disciplines')
    .insert({ name: discipline.name, icon: discipline.icon ?? '📚', group_name: discipline.group_name ?? null })

  if (error) throw error
}

export async function deleteDiscipline(id: string) {
  const { error } = await supabase.from('disciplines').delete().eq('id', id)
  if (error) throw error
}

// -- SUBJECTS -----------------------------------------------------------------

export async function getSubjects(disciplineId?: string): Promise<Subject[]> {
  let query = supabase.from('subjects').select('*').order('sort_order').order('name')
  if (disciplineId) query = query.eq('discipline_id', disciplineId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function saveSubject(subject: Partial<Subject> & { name: string; discipline_id: string }) {
  if (subject.id) {
    const { error } = await supabase
      .from('subjects')
      .update({ name: subject.name, discipline_id: subject.discipline_id, sort_order: subject.sort_order ?? 0 })
      .eq('id', subject.id)

    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('subjects')
    .insert({ name: subject.name, discipline_id: subject.discipline_id, sort_order: subject.sort_order ?? 0 })

  if (error) throw error
}

export async function deleteSubject(id: string) {
  const { error } = await supabase.from('subjects').delete().eq('id', id)
  if (error) throw error
}

// -- QUESTIONS ----------------------------------------------------------------

export async function getQuestions(filter?: { subjectId?: string; disciplineId?: string }): Promise<Question[]> {
  let query = supabase
    .from('questions')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (filter?.subjectId) query = query.eq('subject_id', filter.subjectId)
  if (filter?.disciplineId) query = query.eq('discipline_id', filter.disciplineId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function saveQuestion(question: Partial<Question> & { statement: string; subject_id: string; discipline_id: string }) {
  const payload = {
    statement: question.statement,
    type: question.type ?? 'true_false',
    options: question.options ?? null,
    correct_answer: question.correct_answer ?? 'C',
    comment: question.comment ?? '',
    legal_basis: question.legal_basis ?? null,
    exam_tips: question.exam_tips ?? null,
    associated_text: question.associated_text ?? null,
    subject_id: question.subject_id,
    discipline_id: question.discipline_id,
    sort_order: question.sort_order ?? 0,
  }

  if (question.id) {
    const { error } = await supabase.from('questions').update(payload).eq('id', question.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('questions').insert(payload)
  if (error) throw error
}

export async function deleteQuestion(id: string) {
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) throw error
}

// -- PROFILES -----------------------------------------------------------------

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as Profile[]) ?? []
}

export async function getUserActivityCounts(): Promise<Record<string, { today: number; week: number; month: number; total: number }>> {
  const now = new Date()
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart   = new Date(now.getTime() -  6 * 24 * 60 * 60 * 1000).toISOString()
  const monthStart  = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('question_activity_log')
    .select('user_id, logged_at')

  if (error) {
    console.error('[getUserActivityCounts] erro no SELECT:', error.message, error.details, error.code)
    return {}
  }

  console.log('[getUserActivityCounts] linhas retornadas:', data?.length ?? 0, data?.slice(0, 3))

  const result: Record<string, { today: number; week: number; month: number; total: number }> = {}
  for (const row of (data ?? [])) {
    const uid = row.user_id as string
    if (!result[uid]) result[uid] = { today: 0, week: 0, month: 0, total: 0 }
    const ts = row.logged_at as string
    result[uid].total++
    if (ts >= monthStart) result[uid].month++
    if (ts >= weekStart)  result[uid].week++
    if (ts >= todayStart) result[uid].today++
  }
  return result
}

export async function updateUserStatus(userId: string, newStatus: UserStatus) {
  const now = new Date().toISOString()

  const patch: {
    status: UserStatus
    updated_at: string
    is_validated: boolean
    approved_at?: string | null
    suspended_at?: string | null
    requested_access_at?: string
  } = {
    status: newStatus,
    updated_at: now,
    is_validated: newStatus === 'approved',
  }

  if (newStatus === 'approved') {
    patch.approved_at = now
    patch.suspended_at = null
  }

  if (newStatus === 'suspended') {
    patch.suspended_at = now
  }

  if (newStatus === 'pending') {
    patch.requested_access_at = now
    patch.approved_at = null
    patch.suspended_at = null
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw error
  return data as Profile
}

// -- REPORTS ------------------------------------------------------------------

export async function submitReport(questionId: string, userId: string, message: string) {
  const { error } = await supabase
    .from('question_reports')
    .insert({ question_id: questionId, user_id: userId, message })

  if (error) throw error
}

export async function getReports() {
  const { data, error } = await supabase
    .from('question_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// -- QUESTIONS BY IDS ---------------------------------------------------------

export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .in('id', ids)

  if (error) throw error
  return (data ?? []) as Question[]
}

// -- SIMULADOS ----------------------------------------------------------------

export async function saveSimulado({
  userId,
  isAdvanced,
  answers,
  durationSeconds,
}: {
  userId: string
  isAdvanced: boolean
  answers: Array<{
    questionId: string
    selected: string | null
    isCorrect: boolean
    disciplineId: string
    subjectId: string
    correctAnswer: string
  }>
  durationSeconds: number | null
}): Promise<SimuladoRecord> {
  // We'll insert it first, then trigger a re-numbering to guarantee perfect sequence
  const completedAt = new Date()
  
  const totalAnswered = answers.filter(a => a.selected !== null).length
  const totalCorrect  = answers.filter(a => a.isCorrect).length
  const totalWrong    = totalAnswered - totalCorrect
  const accuracy      = totalAnswered === 0 ? 0 : Math.round((totalCorrect / totalAnswered) * 100)

  const { data: simulado, error: insError } = await supabase
    .from('simulados')
    .insert({
      user_id:             userId,
      simulado_number:     0, // Will be updated by renumber
      title:               'Temp', // Will be updated by renumber
      is_advanced:         isAdvanced,
      total_questions:     answers.length,
      total_answered:      totalAnswered,
      total_correct:       totalCorrect,
      total_wrong:         totalWrong,
      accuracy_percentage: accuracy,
      duration_seconds:    durationSeconds,
      completed_at:        completedAt.toISOString(),
    })
    .select('*')
    .single()

  if (insError) throw insError

  if (answers.length > 0) {
    const rows = answers.map(a => ({
      simulado_id:      simulado.id,
      question_id:      a.questionId,
      selected_answer:  a.selected,
      correct_answer:   a.correctAnswer,
      is_correct:       a.isCorrect,
      discipline_id:    a.disciplineId,
      subject_id:       a.subjectId,
    }))
    const { error: qError } = await supabase.from('simulado_questions').insert(rows)
    if (qError) throw qError
  }

  // Renumber everything for this user to guarantee sequence
  await renumberSimulados(userId)

  // Return the fetched renumbered version
  return (await getSimuladoById(simulado.id, userId)) as SimuladoRecord
}

export async function deleteSimulado(userId: string, simuladoId: string): Promise<void> {
  // Delete the simulado (simulado_questions will be cascade deleted if setup, but let's be safe)
  await supabase.from('simulado_questions').delete().eq('simulado_id', simuladoId)
  
  const { error } = await supabase.from('simulados').delete().eq('id', simuladoId).eq('user_id', userId)
  if (error) throw error

  // Renumber the remaining simulados
  await renumberSimulados(userId)
}

// Internal helper to renumber simulados dynamically based on completed_at
async function renumberSimulados(userId: string) {
  const { data, error } = await supabase
    .from('simulados')
    .select('id, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: true })

  if (error || !data) return

  for (let i = 0; i < data.length; i++) {
    const sim = data[i]
    const num = i + 1
    const dateStr = new Date(sim.completed_at).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
    const title = `${num} - Simulado ALE-RR (${dateStr})`
    
    await supabase.from('simulados')
      .update({ simulado_number: num, title })
      .eq('id', sim.id)
  }
}

export async function getSimulados(userId: string): Promise<SimuladoRecord[]> {
  const { data, error } = await supabase
    .from('simulados')
    .select('*')
    .eq('user_id', userId)
    .order('simulado_number', { ascending: false })

  if (error) throw error
  return (data ?? []) as SimuladoRecord[]
}

export async function getSimuladoById(simuladoId: string, userId: string): Promise<SimuladoRecord | null> {
  const { data, error } = await supabase
    .from('simulados')
    .select('*')
    .eq('id', simuladoId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return (data as SimuladoRecord | null) ?? null
}

export async function getSimuladoQuestions(simuladoId: string, userId: string): Promise<SimuladoQuestion[]> {
  const simulado = await getSimuladoById(simuladoId, userId)
  if (!simulado) return []

  const { data, error } = await supabase
    .from('simulado_questions')
    .select('*')
    .eq('simulado_id', simuladoId)

  if (error) throw error
  return (data ?? []) as SimuladoQuestion[]
}

// -- FLASHCARDS ---------------------------------------------------------------

const flashcardGenerationInFlight = new Map<string, Promise<boolean>>()

export type FlashcardReviewAction = 'correct' | 'easy' | 'wrong' | 'skip' | 'mastered'

function resolveFlashcardEndpoint(route: 'generate-flashcard' | 'generate-flashcards-from-errors') {
  const explicitSingleEndpoint = (import.meta.env.VITE_FLASHCARD_API_URL as string | undefined)?.trim()
  if (route === 'generate-flashcard' && explicitSingleEndpoint) {
    return explicitSingleEndpoint
  }

  if (explicitSingleEndpoint?.includes('/generate-flashcard')) {
    const inferredBase = explicitSingleEndpoint.replace(/\/generate-flashcard\/?$/, '')
    if (inferredBase) {
      return `${inferredBase}/${route}`
    }
  }

  const baseEndpoint = (import.meta.env.VITE_FLASHCARD_API_BASE_URL as string | undefined)?.trim()
  if (baseEndpoint) {
    return `${baseEndpoint.replace(/\/$/, '')}/${route}`
  }

  return `/api/${route}`
}

export interface GenerateFromErrorsResult {
  generated: number
  skipped: number
  failed: number
  total_candidates: number
}

export async function generateFlashcard(params: {
  question: Question
  selectedAnswer: string
  sourceType: 'study' | 'simulado' | 'review' | 'import'
  simuladoId?: string
}): Promise<boolean> {
  const requestKey = `${params.question.id}:${params.sourceType}:${params.simuladoId ?? 'none'}`
  const runningRequest = flashcardGenerationInFlight.get(requestKey)
  if (runningRequest) {
    return runningRequest
  }

  const request = (async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const userId = sessionData?.session?.user?.id

      if (!token || !userId) {
        return false
      }

      const endpoint = resolveFlashcardEndpoint('generate-flashcard')

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          question_id: params.question.id,
          bank: 'FCC',
          question_type: params.question.type,
          statement: params.question.statement,
          alternatives: params.question.options,
          correct_answer: params.question.correct_answer,
          source_type: params.sourceType,
          simulado_id: params.simuladoId,
          discipline_id: params.question.discipline_id,
          subject_id: params.question.subject_id,
          user_wrong_answer: params.selectedAnswer,
          explanation: params.question.comment,
          legal_basis: params.question.legal_basis,
        }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        console.error(`[generateFlashcard] HTTP ${response.status} ${errText}`)
        return false
      }

      await response.json().catch(() => ({}))
      return true
    } catch (error) {
      console.error('[generateFlashcard] Erro inesperado no frontend:', error)
      return false
    }
  })()

  flashcardGenerationInFlight.set(requestKey, request)
  try {
    return await request
  } finally {
    flashcardGenerationInFlight.delete(requestKey)
  }
}

export async function generateFlashcardsFromErrors(limit = 5): Promise<GenerateFromErrorsResult | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    if (!token) {
      return null
    }

    const endpoint = resolveFlashcardEndpoint('generate-flashcards-from-errors')
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ limit }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error(`[generateFlashcardsFromErrors] HTTP ${response.status} ${errText}`)
      return null
    }

    const payload = await response.json().catch(() => null)
    if (!payload || typeof payload !== 'object') {
      return null
    }

    return {
      generated: Number((payload as { generated?: unknown }).generated) || 0,
      skipped: Number((payload as { skipped?: unknown }).skipped) || 0,
      failed: Number((payload as { failed?: unknown }).failed) || 0,
      total_candidates: Number((payload as { total_candidates?: unknown }).total_candidates) || 0,
    }
  } catch (error) {
    console.error('[generateFlashcardsFromErrors] Erro inesperado no frontend:', error)
    return null
  }
}

export async function getFlashcards(userId: string): Promise<Flashcard[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('user_id', userId)
    .order('next_review_at', { ascending: true })
    .order('priority', { ascending: false })

  if (error) throw error
  return (data ?? []) as Flashcard[]
}

// --- MODO ELITE: Algoritmo Anki SRS ---

function addDays(base: Date, days: number): string {
  const next = new Date(base)
  next.setDate(next.getDate() + Math.round(days))
  return next.toISOString()
}

function addHours(base: Date, hours: number): string {
  const next = new Date(base)
  next.setHours(next.getHours() + hours)
  return next.toISOString()
}

export async function reviewFlashcard(id: string, action: FlashcardReviewAction, userId: string): Promise<Flashcard> {
  const { data: flashcard, error: fetchError } = await supabase
    .from('flashcards')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !flashcard) {
    throw fetchError ?? new Error('Flashcard nao encontrado')
  }

  const now = new Date()
  const timesSeen = (flashcard.times_seen || 0) + 1
  let timesCorrect = flashcard.times_correct || 0
  let timesWrong = flashcard.times_wrong || 0
  let priority = flashcard.priority || 1
  let status: Flashcard['status'] = flashcard.status
  let intervalDays: number = flashcard.interval_days ?? 1
  let easeFactor: number = flashcard.ease_factor ?? 2.5
  let nextReviewAt: string

  if (action === 'easy') {
    // Acertou com facilidade: aumenta ease_factor e dobra intervalo
    timesCorrect++
    easeFactor = Math.min(easeFactor + 0.15, 3.0)
    intervalDays = Math.max(1, Math.round(intervalDays * easeFactor * 1.3))
    nextReviewAt = addDays(now, intervalDays)
    priority = Math.max(1, priority - 2)
    const difficultyScore = timesWrong / (timesCorrect + timesWrong)
    status = timesCorrect >= 3 && difficultyScore < 0.3 ? 'mastered' : 'reviewing'

  } else if (action === 'correct') {
    // Acertou normalmente: aplica Anki SRS
    timesCorrect++
    intervalDays = Math.max(1, Math.round(intervalDays * easeFactor))
    nextReviewAt = addDays(now, intervalDays)
    priority = Math.max(1, priority - 1)
    const difficultyScore = timesWrong / (timesCorrect + timesWrong)
    status = timesCorrect >= 3 && difficultyScore < 0.3 ? 'mastered' : 'reviewing'

  } else if (action === 'wrong') {
    // Errou: REGRA CRÍTICA - volta rapidamente (1 dia), ease_factor cai
    timesWrong++
    intervalDays = 1
    easeFactor = Math.max(1.3, easeFactor - 0.2)
    nextReviewAt = addDays(now, 1)
    priority = Math.min(priority + 2, 100)
    status = 'reviewing'

  } else if (action === 'skip') {
    // Pulou: volta em 4h sem penalidade
    nextReviewAt = addHours(now, 4)
    priority = Math.min(priority + 1, 100)
    if (status === 'mastered') status = 'reviewing'

  } else {
    // mastered manual: intervalo longo de 21 dias
    status = 'mastered'
    intervalDays = 21
    easeFactor = Math.min(easeFactor + 0.1, 3.0)
    nextReviewAt = addDays(now, 21)
    priority = Math.max(1, priority - 2)
  }

  const { data: updated, error } = await supabase
    .from('flashcards')
    .update({
      times_seen: timesSeen,
      times_correct: timesCorrect,
      times_wrong: timesWrong,
      priority,
      status,
      interval_days: intervalDays,
      ease_factor: easeFactor,
      last_reviewed_at: now.toISOString(),
      next_review_at: nextReviewAt,
      updated_at: now.toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw error
  return updated as Flashcard
}

export async function updateFlashcardReview(id: string, isCorrect: boolean, userId: string): Promise<Flashcard> {
  return reviewFlashcard(id, isCorrect ? 'correct' : 'wrong', userId)
}

