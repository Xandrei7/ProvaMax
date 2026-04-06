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
  const authorizationRunRef = useRef(0)

  const clearAuthorizationState = useCallback(() => {
    authorizationRunRef.current += 1
    setProfile(null)
    setIsAdmin(false)
    setIsValidated(false)
    setAuthorizationReason('authorization_loading')
    setAuthorizationMessage('Verificando autorizacao...')
    setProfileLoading(false)
  }, [])

  const resolveAuthorization = useCallback(async (currentUser: User, source: string) => {
    const runId = ++authorizationRunRef.current
    const normalized = normalizeEmail(currentUser.email)

    setProfileLoading(true)
    setAuthorizationReason('authorization_loading')

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
      setProfile(null)
      setIsAdmin(false)
      setIsValidated(false)
      setAuthorizationReason('waiting_profile_resolution')
      setAuthorizationMessage('Nao foi possivel validar seu acesso agora. Tente novamente.')

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
      if (authorizationRunRef.current === runId) {
        setProfileLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      setAuthLoading(true)
      setProfileLoading(true)

      const { data: { session: currentSession } } = await supabase.auth.getSession()

      if (!mounted) return

      setSession(currentSession)
      const currentUser = currentSession?.user ?? null
      setUser(currentUser)
      setAuthLoading(false)

      if (currentUser) {
        await resolveAuthorization(currentUser, 'initial_session')
      } else {
        clearAuthorizationState()
      }
    }

    void bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      const nextUser = nextSession?.user ?? null
      setUser(nextUser)
      setAuthLoading(false)

      if (nextUser) {
        void resolveAuthorization(nextUser, `auth_state:${event}`)
      } else {
        clearAuthorizationState()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [clearAuthorizationState, resolveAuthorization])

  useEffect(() => {
    if (!user) return

    const refresh = () => {
      void resolveAuthorization(user, 'visibility_refresh')
    }

    const intervalId = window.setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
    }
  }, [user, resolveAuthorization])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`profile_status_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void resolveAuthorization(user, 'realtime_profile_change')
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, resolveAuthorization])

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
