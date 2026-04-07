import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { StudyProvider } from '@/contexts/StudyContext'

import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { AccessBlocked } from '@/pages/AccessBlocked'
import { Home } from '@/pages/Home'
import { DisciplineDetail } from '@/pages/DisciplineDetail'
import { StudyMode } from '@/pages/StudyMode'
import { StudyComplete } from '@/pages/StudyComplete'
import { Flashcards } from '@/pages/Flashcards'
import { Errors } from '@/pages/Errors'
import { Stats } from '@/pages/Stats'
import { Admin } from '@/pages/Admin'
import { Import } from '@/pages/Import'
import { Simulado } from '@/pages/Simulado'
import { SimuladoDetail } from '@/pages/SimuladoDetail'
import { NotFound } from '@/pages/NotFound'

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

/** Requer login. Se não validado → /access-blocked */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isValidated, authLoading, profileLoading, authorizationResolved } = useAuth()
  if (authLoading || profileLoading || !authorizationResolved) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isValidated) return <Navigate to="/access-blocked" replace />
  return <>{children}</>
}

/** Requer login mas NÃO exige validação (para /access-blocked funcionar) */
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, authLoading, profileLoading, authorizationResolved } = useAuth()
  if (authLoading || profileLoading || !authorizationResolved) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Requer ser admin */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, authLoading, profileLoading, authorizationResolved } = useAuth()
  if (authLoading || profileLoading || !authorizationResolved) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Requer login, sem precisar de validação */}
      <Route path="/access-blocked" element={<AuthRoute><AccessBlocked /></AuthRoute>} />

      {/* Requer login + acesso validado */}
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/disciplines" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/discipline/:disciplineId" element={<ProtectedRoute><DisciplineDetail /></ProtectedRoute>} />
      <Route path="/study/:subjectId" element={<ProtectedRoute><StudyMode /></ProtectedRoute>} />
      <Route path="/study/:subjectId/complete" element={<ProtectedRoute><StudyComplete /></ProtectedRoute>} />
      <Route path="/study-discipline/:disciplineId" element={<ProtectedRoute><StudyMode /></ProtectedRoute>} />
      <Route path="/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>} />
      <Route path="/favorites" element={<Navigate to="/flashcards" replace />} />
      <Route path="/errors" element={<ProtectedRoute><Errors /></ProtectedRoute>} />
      <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
      <Route path="/simulado" element={<ProtectedRoute><Simulado /></ProtectedRoute>} />
      <Route path="/simulado/:simuladoId" element={<ProtectedRoute><SimuladoDetail /></ProtectedRoute>} />

      {/* Admin only */}
      <Route path="/import" element={<ProtectedRoute><AdminRoute><Import /></AdminRoute></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminRoute><Admin /></AdminRoute></ProtectedRoute>} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StudyProvider>
          <AppRoutes />
          <Toaster richColors position="top-center" />
        </StudyProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
