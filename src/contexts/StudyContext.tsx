import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { UserAnswer, SubjectProgress } from '@/types'

interface StudyContextType {
  answers: UserAnswer[]
  favorites: string[]
  studyLoading: boolean
  recordAnswer: (answer: UserAnswer) => Promise<void>
  resetByQuestionIds: (ids: string[]) => Promise<void>
  resetAllProgress: () => Promise<void>
  toggleFavorite: (questionId: string) => Promise<void>
  isFavorite: (questionId: string) => boolean
  getSubjectProgress: (subjectId: string, questionIds: string[]) => SubjectProgress
  getWrongAnswers: () => UserAnswer[]
  clearAnswer: (questionId: string) => Promise<void>
}

const StudyContext = createContext<StudyContextType | null>(null)

export function StudyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [answers, setAnswers] = useState<UserAnswer[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [studyLoading, setStudyLoading] = useState(false)

  // Load user data from Supabase whenever user changes
  useEffect(() => {
    if (!user) {
      setAnswers([])
      setFavorites([])
      return
    }

    setStudyLoading(true)

    Promise.all([
      supabase.from('user_answers').select('*').eq('user_id', user.id),
      supabase.from('user_favorites').select('question_id').eq('user_id', user.id),
    ]).then(([answersRes, favsRes]) => {
      setAnswers(
        (answersRes.data ?? []).map(row => ({
          questionId: row.question_id as string,
          selectedAnswer: row.selected_answer as string,
          isCorrect: row.is_correct as boolean,
          answeredAt: row.answered_at as string,
        }))
      )
      setFavorites((favsRes.data ?? []).map(row => row.question_id as string))
    }).finally(() => setStudyLoading(false))
  }, [user?.id])

  async function recordAnswer(answer: UserAnswer) {
    if (!user) return
    // Optimistic update
    setAnswers(prev => {
      const idx = prev.findIndex(a => a.questionId === answer.questionId)
      if (idx >= 0) { const u = [...prev]; u[idx] = answer; return u }
      return [...prev, answer]
    })
    // Persist
    await supabase.from('user_answers').upsert({
      user_id: user.id,
      question_id: answer.questionId,
      selected_answer: answer.selectedAnswer,
      is_correct: answer.isCorrect,
      answered_at: answer.answeredAt,
    }, { onConflict: 'user_id,question_id' })
  }

  async function resetByQuestionIds(ids: string[]) {
    if (!user) return
    setAnswers(prev => prev.filter(a => !ids.includes(a.questionId)))
    await supabase.from('user_answers')
      .delete()
      .eq('user_id', user.id)
      .in('question_id', ids)
  }

  async function resetAllProgress() {
    if (!user) return
    setAnswers([])
    await supabase.from('user_answers').delete().eq('user_id', user.id)
  }

  async function toggleFavorite(questionId: string) {
    if (!user) return
    const isFav = favorites.includes(questionId)
    if (isFav) {
      setFavorites(prev => prev.filter(id => id !== questionId))
      await supabase.from('user_favorites')
        .delete().eq('user_id', user.id).eq('question_id', questionId)
    } else {
      setFavorites(prev => [...prev, questionId])
      await supabase.from('user_favorites')
        .insert({ user_id: user.id, question_id: questionId })
    }
  }

  function isFavorite(questionId: string) {
    return favorites.includes(questionId)
  }

  function getSubjectProgress(subjectId: string, questionIds: string[]): SubjectProgress {
    const subjectAnswers = answers.filter(a => questionIds.includes(a.questionId))
    return {
      subjectId,
      total: questionIds.length,
      answered: subjectAnswers.length,
      correct: subjectAnswers.filter(a => a.isCorrect).length,
    }
  }

  function getWrongAnswers(): UserAnswer[] {
    return answers.filter(a => !a.isCorrect)
  }

  async function clearAnswer(questionId: string) {
    if (!user) return
    setAnswers(prev => prev.filter(a => a.questionId !== questionId))
    await supabase.from('user_answers')
      .delete().eq('user_id', user.id).eq('question_id', questionId)
  }

  return (
    <StudyContext.Provider value={{
      answers, favorites, studyLoading,
      recordAnswer, resetByQuestionIds, resetAllProgress,
      toggleFavorite, isFavorite,
      getSubjectProgress, getWrongAnswers, clearAnswer,
    }}>
      {children}
    </StudyContext.Provider>
  )
}

export function useStudy() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error('useStudy must be used inside StudyProvider')
  return ctx
}
