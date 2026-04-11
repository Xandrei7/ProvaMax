import { useNavigate } from 'react-router-dom'
import { Settings, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import provamaxIcon from '@/assets/provamax-icon.png'

export function AppHeader() {
  const { isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        {/* Icon */}
        <img
          src={provamaxIcon}
          alt="ProvaMax"
          className="h-10 w-10 rounded-xl object-contain shrink-0"
        />

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight">ProvaMax</h1>
          <p className="text-xs text-muted-foreground leading-tight truncate">
            Questões Inéditas para concurso da ALE-RR
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Painel admin"
            >
              <Settings size={18} />
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Sair da conta"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
