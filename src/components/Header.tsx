import { useNavigate } from 'react-router-dom'
import { Settings, LogOut, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  className?: string
}

export function Header({ title, subtitle, showBack, className }: HeaderProps) {
  const { isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className={cn('sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur', className)}>
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Painel admin"
            >
              <Settings size={18} />
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Sair da conta"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
