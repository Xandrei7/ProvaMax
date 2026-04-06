import { useNavigate } from 'react-router-dom'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-5xl font-bold text-primary">404</h1>
      <p className="mt-2 text-lg font-medium">Página não encontrada</p>
      <p className="mt-1 text-muted-foreground">Oops! A página que você procura não existe.</p>
      <button onClick={() => navigate('/')} className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Voltar ao início
      </button>
    </div>
  )
}
