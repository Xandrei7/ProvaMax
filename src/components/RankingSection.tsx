import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { getDailyRanking, getGeneralRanking, type RankingEntry } from '@/lib/rankingService'

type Tab = 'dia' | 'geral'

const MEDAL_COLORS = [
  { bg: 'bg-amber-400/15', text: 'text-amber-500', border: 'border-amber-400/30', label: '🥇' },
  { bg: 'bg-slate-400/10', text: 'text-slate-400',  border: 'border-slate-400/25', label: '🥈' },
  { bg: 'bg-orange-400/12', text: 'text-orange-400', border: 'border-orange-400/25', label: '🥉' },
]

function RankingList({ entries, emptyMessage }: { entries: RankingEntry[]; emptyMessage: string }) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {entries.map((entry, idx) => {
        const medal = MEDAL_COLORS[idx]
        const isTop3 = idx < 3

        return (
          <li
            key={entry.user_id}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
              isTop3
                ? `border ${medal.border} ${medal.bg}`
                : 'bg-muted/40 border border-transparent'
            }`}
          >
            {/* Posição / medalha */}
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
              isTop3 ? `${medal.text}` : 'text-muted-foreground'
            }`}>
              {isTop3 ? medal.label : `#${idx + 1}`}
            </div>

            {/* Nome */}
            <span className={`flex-1 min-w-0 truncate text-sm font-medium leading-tight ${
              isTop3 ? medal.text : 'text-foreground'
            }`}>
              {entry.user_name}
            </span>

            {/* Quantidade */}
            <span className={`shrink-0 tabular-nums text-sm font-semibold ${
              isTop3 ? medal.text : 'text-muted-foreground'
            }`}>
              {entry.total_answered.toLocaleString('pt-BR')}
              <span className={`ml-1 text-[10px] font-normal ${
                isTop3 ? `${medal.text} opacity-70` : 'text-muted-foreground'
              }`}>
                {entry.total_answered === 1 ? 'questão' : 'questões'}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-11 rounded-xl bg-muted/50 animate-pulse"
          style={{ opacity: 1 - i * 0.18 }}
        />
      ))}
    </div>
  )
}

export function RankingSection() {
  const [tab, setTab] = useState<Tab>('dia')
  const [dailyEntries, setDailyEntries] = useState<RankingEntry[]>([])
  const [generalEntries, setGeneralEntries] = useState<RankingEntry[]>([])
  const [loadingDaily, setLoadingDaily] = useState(true)
  const [loadingGeneral, setLoadingGeneral] = useState(true)

  useEffect(() => {
    getDailyRanking().then(data => {
      setDailyEntries(data)
      setLoadingDaily(false)
    })
    getGeneralRanking().then(data => {
      setGeneralEntries(data)
      setLoadingGeneral(false)
    })
  }, [])

  const loading = tab === 'dia' ? loadingDaily : loadingGeneral
  const entries = tab === 'dia' ? dailyEntries : generalEntries

  const emptyMessage =
    tab === 'dia'
      ? 'Ainda não há respostas registradas hoje.'
      : 'Ainda não há usuários com mais de 50 questões respondidas.'

  return (
    <div className="mt-6 flex flex-col gap-3">
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-2 px-1">
        <Trophy size={14} className="text-amber-500 shrink-0" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ranking dos usuários
        </p>
      </div>

      {/* Card principal */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['dia', 'geral'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wide transition-colors ${
                tab === t
                  ? 'text-primary border-b-2 border-primary -mb-px bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'dia' ? 'Do dia' : 'Geral'}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="p-3">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <RankingList entries={entries} emptyMessage={emptyMessage} />
          )}
        </div>
      </div>
    </div>
  )
}
