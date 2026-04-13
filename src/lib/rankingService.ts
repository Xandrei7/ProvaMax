import { supabase } from './supabase'

export interface RankingEntry {
  user_id: string
  user_name: string
  total_answered: number
}

export async function getDailyRanking(): Promise<RankingEntry[]> {
  const { data, error } = await supabase.rpc('get_daily_ranking')
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
