function getCountdown() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // Usar construtor (ano, mês, dia) — mês é 0-indexed: 3=abril, 5=junho
  // Evita o bug de timezone: new Date('YYYY-MM-DD') parseia como UTC midnight,
  // causando off-by-1 em fusos UTC+ após setHours(0,0,0,0) local.
  const target = new Date(2026, 5, 28)  // 28 Jun 2026, meia-noite local
  const start  = new Date(2026, 3, 1)   // 1 Abr 2026, meia-noite local

  const totalPrepDays = Math.round((target.getTime() - start.getTime()) / 86_400_000)
  const elapsedDays   = Math.max(0, Math.round((now.getTime() - start.getTime()) / 86_400_000))
  const totalDays     = Math.max(0, Math.round((target.getTime() - now.getTime()) / 86_400_000))
  const weeks         = Math.floor(totalDays / 7)
  const dayRemainder  = totalDays % 7
  const progressPct   = Math.min(100, Math.round((elapsedDays / totalPrepDays) * 100))

  return { totalDays, weeks, dayRemainder, progressPct }
}

function getMotivationalPhrase(days: number): string {
  if (days > 60) return 'O topo é de quem não para. Mantenha o ritmo.'
  if (days > 45) return 'Cada dia conta. Você está no caminho certo.'
  if (days > 30) return 'A virada está próxima. Continue firme.'
  if (days > 14) return 'A reta final chegou. Não recue agora.'
  if (days > 0)  return 'Chegou a hora. Você está pronto para isso.'
  return 'Dia da prova. Confie no seu preparo. Boa sorte!'
}

export function ExamCountdownCard() {
  const { totalDays, weeks, dayRemainder, progressPct } = getCountdown()

  const phrase = getMotivationalPhrase(totalDays)

  const weeksLabel = weeks > 0
    ? `${weeks} semana${weeks > 1 ? 's' : ''}${dayRemainder > 0 ? ` e ${dayRemainder} dia${dayRemainder > 1 ? 's' : ''}` : ''}`
    : dayRemainder > 0
    ? `${dayRemainder} dia${dayRemainder > 1 ? 's' : ''}`
    : 'Hoje!'

  return (
    <div className="rounded-2xl border border-primary/20 bg-card overflow-hidden shadow-sm">

      {/* Faixa de destaque superior */}
      <div className="h-[3px] w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

      <div className="px-5 pt-4 pb-5">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none select-none">🎯</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
              Contagem regressiva
            </span>
          </div>
          <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
            28 Jun 2026
          </span>
        </div>

        {/* Número principal */}
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-[64px] font-black tabular-nums text-foreground leading-none tracking-tight">
            {totalDays}
          </span>
          <div className="flex flex-col pb-1 leading-snug">
            <span className="text-xl font-bold text-muted-foreground">dias</span>
            <span className="text-[11px] text-muted-foreground/60 font-medium">restantes</span>
          </div>
        </div>

        {/* Breakdown semanas */}
        <p className="text-sm font-semibold text-primary/80 mb-4">
          {weeksLabel} para a prova
        </p>

        {/* Barra de progresso do plano */}
        <div className="mb-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 font-medium mb-1.5">
            <span>1 Abr</span>
            <span className="text-primary font-semibold">{progressPct}% do plano</span>
            <span>28 Jun</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Divisor */}
        <div className="h-px bg-border my-4" />

        {/* Frase motivacional */}
        <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
          <span className="text-primary font-bold mr-1.5">›</span>
          {phrase}
        </p>

      </div>
    </div>
  )
}
