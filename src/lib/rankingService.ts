import { supabase } from './supabase'
import { getActivityWindowBounds } from './activityWindow'

export interface RankingEntry {
  user_id: string
  user_name: string
  total_answered: number
  total_correct: number
  total_wrong: number
  accuracy_percentage: number
}

export async function getDailyRanking(): Promise<RankingEntry[]> {
  const { todayStartIso, nextDayStartIso } = getActivityWindowBounds()

  const { data, error } = await supabase.rpc('get_daily_ranking', {
    p_start: todayStartIso,
    p_end: nextDayStartIso,
  })
  if (error) {
    console.error('Erro ao buscar ranking do dia:', error)
    return []
  }
  return (data ?? []) as RankingEntry[]
}

export async function getGeneralRanking(): Promise<RankingEntry[]> {
  const { data, error } = await supabase.rpc('get_general_ranking')
  if (error) {
    console.error('Erro ao buscar ranking geral:', error)
    return []
  }
  return (data ?? []) as RankingEntry[]
}
