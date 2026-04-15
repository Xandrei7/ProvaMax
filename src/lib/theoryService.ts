import { supabase } from '@/lib/supabase'
import type { Theory } from '@/types'

export async function getTheoriesBySubject(subjectId: string): Promise<Theory[]> {
  const { data, error } = await supabase
    .from('theories')
    .select('*')
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getTheoriesByDiscipline(disciplineId: string): Promise<Theory[]> {
  const { data, error } = await supabase
    .from('theories')
    .select('*')
    .eq('discipline_id', disciplineId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getAllTheories(): Promise<Theory[]> {
  const { data, error } = await supabase
    .from('theories')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createTheory(
  data: Omit<Theory, 'id' | 'created_at' | 'updated_at'>
): Promise<Theory> {
  const { data: created, error } = await supabase
    .from('theories')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return created
}

export async function updateTheory(
  id: string,
  data: Partial<Omit<Theory, 'id' | 'created_at' | 'updated_at'>>
): Promise<Theory> {
  const { data: updated, error } = await supabase
    .from('theories')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return updated
}

export async function deleteTheory(id: string): Promise<void> {
  const { error } = await supabase.from('theories').delete().eq('id', id)
  if (error) throw error
}
