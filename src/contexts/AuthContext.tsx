import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { type User, type Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  normalizeEmail,
  resolveAuthorizationForUser,
  type AuthorizationDecisionReason,
} from '@/lib/dataService'
import type { Profile } from '@/types'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  isValidated: boolean
  loading: boolean
  authLoading: boolean
  profileLoading: boolean
  authorizationResolved: boolean
  authorizationReason: AuthorizationDecisionReason
  authorizationMessage: string
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function logAuthorization(input: {
  authUserId: string | null
  authEmail: string | null
  normalizedEmail: string
  profileFound: boolean
  role: string | null
  status: string | null
  reason: AuthorizationDecisionReason
  source: string
}) {
  console.info('[authz]', input)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isValidated, setIsValidated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [authorizationReason, setAuthorizationReason] = useState<AuthorizationDecisionReason>('authorization_loading')
  const [authorizationMessage, setAuthorizationMessage] = useState('Verificando autorizacao...')

  // Tracks the in-flight resolve run; stale runs are discarded.
  const authorizationRunRef = useRef(0)

  // Always holds the latest user object so background callbacks don't use
  // a stale closure from when the effect was registered.
  const latestUserRef = useRef<User | null>(null)
  latestUserRef.current = user

  // ── helpers ────────────────────────────────────────────────────────────────

  const clearAuthorizationState = useCallback(() => {
    authorizationRunRef.current += 1
    setProfile(null)
    setIsAdmin(false)
    setIsValidated(false)
    setAuthorizationReason('authorization_loading')
    setAuthorizationMessage('Verificando autorizacao...')
    setProfileLoading(false)
  }, [])

  /**
   * Resolves the user's authorization by reading/writing the profiles table.
   *
   * silent=true  → background check (polling, focus, realtime).
   *               Does NOT touch profileLoading, so ProtectedRoute never
   *               unmounts its children. On error, keeps last-known-good state.
   *
   * silent=false → foreground check (initial load, explicit sign-in).
   *               Sets profileLoading=true so the Spinner shows until resolved.
   */
  const resolveAuthorization = useCallback(async (
    currentUser: User,
    source: string,
    silent = false,
  ) => {
    const runId = ++authorizationRunRef.current
    const normalized = normalizeEmail(currentUser.email)

    if (!silent) {
      setProfileLoading(true)
      setAuthorizationReason('authorization_loading')
    }

    logAuthorization({
      authUserId: currentUser.id,
      authEmail: currentUser.email ?? null,
      normalizedEmail: normalized,
      profileFound: false,
      role: null,
      status: null,
      reason: 'authorization_loading',
      source,
    })

    try {
      const result = await resolveAuthorizationForUser({
        id: currentUser.id,
        email: currentUser.email,
        user_metadata: currentUser.user_metadata,
      })

      if (authorizationRunRef.current !== runId) return

      setProfile(result.profile)
      setIsAdmin(result.isAdmin)
      setIsValidated(result.isAuthorized)
      setAuthorizationReason(result.reason)
      setAuthorizationMessage(result.message)

      logAuthorization({
        authUserId: currentUser.id,
        authEmail: currentUser.email ?? null,
        normalizedEmail: normalized,
        profileFound: Boolean(result.profile),
        role: result.profile?.role ?? null,
        status: result.profile?.status ?? null,
        reason: result.reason,
        source,
      })
    } catch (error) {
      if (authorizationRunRef.current !== runId) return

      console.error('Erro ao resolver autorizacao:', error)

      if (!silent) {
        setProfile(null)
        setIsAdmin(false)
        setIsValidated(false)
        setAuthorizationReason('waiting_profile_resolution')
        setAuthorizationMessage('Nao foi possivel validar seu acesso agora. Tente novamente.')
      }

      logAuthorization({
        authUserId: currentUser.id,
        authEmail: currentUser.email ?? null,
        normalizedEmail: normalized,
        profileFound: false,
        role: null,
        status: null,
        reason: 'waiting_profile_resolution',
        source,
      })
    } finally {
      if (!silent && authorizationRunRef.current === runId) {
        setProfileLoading(false)
      }
    }
  }, [])

  // ── EFFECT 1: auth state only ──────────────────────────────────────────────
  // Runs once. Sets session/user/authLoading from Supabase Auth.
  // Does NOT call resolveAuthorization here — that is handled by Effect 2,
  // which is keyed on user.id and therefore immune to TOKEN_REFRESHED churn.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, []) // runs exactly once

  // ── EFFECT 2: profile resolution ───────────────────────────────────────────
  // Fires only when the user's identity changes (sign-in / sign-out).
  // TOKEN_REFRESHED keeps the same user.id → this effect does NOT re-run,
  // so there is no profileLoading flash from routine JWT renewal.
  useEffect(() => {
    if (authLoading) return // wait for auth to settle first

    if (!user) {
      clearAuthorizationState()
      return
    }

    void resolveAuthorization(user, 'user_id_change', false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]) // intentionally excludes full user object

  // ── EFFECT 3: background silent refresh ────────────────────────────────────
  // Polls every 60 s and on tab focus to pick up admin status changes.
  // Uses user.id as dep (not the full user object) so TOKEN_REFRESHED does
  // NOT cancel and re-register the interval or the focus listener.
  // Uses latestUserRef so the callback always has the current user object.
  useEffect(() => {
    if (!user) return

    const refresh = () => {
      const u = latestUserRef.current
      if (u) void resolveAuthorization(u, 'background_refresh', true)
    }

    const id = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)

    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', refresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // intentionally excludes full user object

  // ── EFFECT 4: realtime profile changes ─────────────────────────────────────
  // Subscribes to DB changes on this user's profile row.
  // Fires a silent resolve so the app reacts to admin approval/suspension
  // without unmounting the current page.
  // Uses user.id as dep so the channel is NOT torn down on TOKEN_REFRESHED.
  useEffect(() => {
    if (!user) return

    const userId = user.id

    const channel = supabase
      .channel(`profile_status_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          const u = latestUserRef.current
          if (u) void resolveAuthorization(u, 'realtime_profile_change', true)
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // intentionally excludes full user object

  // ── auth actions ───────────────────────────────────────────────────────────

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    })
    if (error) throw error
  }

  async function signUp(name: string, email: string, password: string) {
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: { data: { name } },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // ── derived ────────────────────────────────────────────────────────────────

  const loading = authLoading || profileLoading
  const authorizationResolved = !authLoading && !profileLoading

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        isValidated,
        loading,
        authLoading,
        profileLoading,
        authorizationResolved,
        authorizationReason,
        authorizationMessage,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
