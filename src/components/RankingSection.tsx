import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { getDailyRanking, getGeneralRanking, type RankingEntry } from '@/lib/rankingService'

type Tab = 'dia' | 'geral'

const MEDAL_COLORS = [
  { bg: 'bg-amber-100/70', text: 'text-amber-700', border: 'border-amber-300/70', label: '🥇' },
  { bg: 'bg-slate-100/70', text: 'text-slate-600', border: 'border-slate-300/65', label: '🥈' },
  { bg: 'bg-orange-200/35', text: 'text-orange-700', border: 'border-orange-400/45', label: '🥉' },
]

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getPerformanceStyle(accuracy: number) {
  if (accuracy >= 70) {
    return {
      rail: 'bg-rose-100/60',
      correctBar: 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]',
      wrongBar: 'bg-rose-300/70',
      percentText: 'text-emerald-500',
    }
  }

  if (accuracy >= 50) {
    return {
      rail: 'bg-rose-100/65 ring-1 ring-amber-300/30',
      correctBar: 'bg-gradient-to-r from-emerald-400 to-emerald-300',
      wrongBar: 'bg-rose-400/75',
      percentText: 'text-amber-500',
    }
  }

  return {
    rail: 'bg-rose-200/65',
    correctBar: 'bg-emerald-300/75',
    wrongBar: 'bg-rose-500/90',
    percentText: 'text-rose-500',
  }
}

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
        const totalCorrect = Number(entry.total_correct ?? 0)
        const totalWrong = Number(entry.total_wrong ?? 0)
        const perfTotal = totalCorrect + totalWrong
        const rawAccuracy = perfTotal > 0
          ? (totalCorrect * 100) / perfTotal
          : Number(entry.accuracy_percentage ?? 0)
        const accuracy = clampPercent(rawAccuracy)
        const wrongPercent = 100 - accuracy
        const performanceStyle = getPerformanceStyle(accuracy)

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

            {/* Nome + performance */}
            <div className="flex-1 min-w-0">
              <p className={`truncate text-sm font-medium leading-tight ${
                isTop3 ? medal.text : 'text-foreground'
              }`}>
                {entry.user_name}
              </p>

              <div className="mt-1 flex items-center gap-2">
                <div
                  className={`h-1.5 w-24 overflow-hidden rounded-full sm:w-28 ${performanceStyle.rail}`}
                  title={`${totalCorrect} acertos · ${totalWrong} erros`}
                >
                  <div className="flex h-full w-full">
                    <div
                      className={performanceStyle.correctBar}
                      style={{ width: `${accuracy}%` }}
                    />
                    <div
                      className={performanceStyle.wrongBar}
                      style={{ width: `${wrongPercent}%` }}
                    />
                  </div>
                </div>

                <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${performanceStyle.percentText}`}>
                  {accuracy}%
                </span>

                <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                  {totalCorrect}A · {totalWrong}E
                </span>
              </div>
            </div>

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
    let active = true

    const loadDaily = async () => {
      const data = await getDailyRanking()
      if (!active) return
      setDailyEntries(data)
      setLoadingDaily(false)
    }

    loadDaily()
    const intervalId = window.setInterval(loadDaily, 60_000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    getGeneralRanking().then(data => {
      setGeneralEntries(data)
      setLoadingGeneral(false)
    })
  }, [])

  const loading = tab === 'dia' ? loadingDaily : loadingGeneral
  const entries = tab === 'dia' ? dailyEntries : generalEntries

  const emptyMessage =
    tab === 'dia'
      ? 'BORA QUERER! Resolva Questões'
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
