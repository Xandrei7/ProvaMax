const DAY_MS = 24 * 60 * 60 * 1000

export function getActivityWindowBounds(now: Date = new Date()) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const nextDayStart = new Date(todayStart.getTime() + DAY_MS)
  const weekStart = new Date(now.getTime() - 6 * DAY_MS)
  const monthStart = new Date(now.getTime() - 29 * DAY_MS)

  return {
    todayStartIso: todayStart.toISOString(),
    nextDayStartIso: nextDayStart.toISOString(),
    weekStartIso: weekStart.toISOString(),
    monthStartIso: monthStart.toISOString(),
  }
}
