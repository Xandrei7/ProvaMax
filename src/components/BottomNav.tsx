import { NavLink } from 'react-router-dom'
import { House, BookOpen, Timer, Heart, ChartColumn } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/', icon: House, label: 'Início', end: true },
  { to: '/disciplines', icon: BookOpen, label: 'Matérias' },
  { to: '/simulado', icon: Timer, label: 'Simulado' },
  { to: '/favorites', icon: Heart, label: 'Favoritos' },
  { to: '/stats', icon: ChartColumn, label: 'Stats' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-2 py-2 text-xs transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} fill={isActive ? 'currentColor' : 'none'} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
