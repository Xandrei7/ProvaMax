import { useNavigate } from 'react-router-dom'
import { ShieldX, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function AccessBlocked() {
  const { profile, authorizationMessage, authorizationReason, signOut } = useAuth()
  const navigate = useNavigate()

  const waitingMessage = authorizationReason === 'suspended_moved_back_to_pending'
    ? 'Seu acesso foi reenviado para aprovação do administrador.'
    : authorizationMessage || 'Seu acesso está aguardando aprovação do administrador.'

  const isRevoked = authorizationReason === 'denied_revoked' || profile?.status === 'revoked'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
        <ShieldX size={56} className="text-red-500" />
        <div>
          <h1 className="text-xl font-bold">Acesso não autorizado</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Sua conta <strong>{profile?.email}</strong> ainda não tem acesso liberado.
          </p>
        </div>

        <div className="w-full rounded-xl border border-border bg-card p-4 text-left text-sm flex flex-col gap-2">
          <p className="font-medium">Status atual:</p>
          <p className="text-muted-foreground">{isRevoked ? 'Acesso revogado.' : waitingMessage}</p>
        </div>

        <div className="w-full rounded-xl border border-border bg-card p-4 text-left text-sm flex flex-col gap-2">
          <p className="font-medium">Possíveis motivos:</p>
          <ul className="text-muted-foreground space-y-1 list-disc list-inside">
            <li>Seu acesso ainda não foi liberado pelo administrador</li>
            <li>Você usou um e-mail diferente do cadastrado</li>
            <li>Seu acesso foi suspenso ou revogado</li>
          </ul>
        </div>

        <p className="text-sm text-muted-foreground">
          Entre em contato com o administrador para liberar seu acesso.
        </p>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted/50"
        >
          <LogOut size={16} />
          Sair da conta
        </button>
      </div>
    </div>
  )
}
