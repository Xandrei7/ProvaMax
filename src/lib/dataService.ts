import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Discipline, Subject, Question, Profile } from '@/types'

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

  const patch: Partial<Profile> = {
    email: normalizedEmail,
    name: currentProfile.name || getSafeName(authUser, normalizedEmail),
    role: 'admin',
    status: 'approved',
    suspended_at: null,
    updated_at: now,
    is_validated: true,
  }

  if (!currentProfile.approved_at) patch.approved_at = now

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
      .update({ name: discipline.name, icon: discipline.icon })
      .eq('id', discipline.id)

    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('disciplines')
    .insert({ name: discipline.name, icon: discipline.icon ?? '📚' })

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
  let query = supabase.from('questions').select('*').order('sort_order').order('created_at')

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
