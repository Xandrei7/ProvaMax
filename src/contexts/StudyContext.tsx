import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { UserAnswer, SubjectProgress } from '@/types'

interface StudyContextType {
  answers: UserAnswer[]
  studyLoading: boolean
  recordAnswer: (answer: UserAnswer) => Promise<void>
  resetByQuestionIds: (ids: string[]) => Promise<void>
  resetAllProgress: () => Promise<void>
  getSubjectProgress: (subjectId: string, questionIds: string[]) => SubjectProgress
  getWrongAnswers: () => UserAnswer[]
  clearAnswer: (questionId: string) => Promise<void>
}

const StudyContext = createContext<StudyContextType | null>(null)

export function StudyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [answers, setAnswers] = useState<UserAnswer[]>([])
  const [studyLoading, setStudyLoading] = useState(false)

  // ── Carrega dados do banco sempre que o usuário muda ──────────────────────
  useEffect(() => {
    if (!user) {
      setAnswers([])
      return
    }

    setStudyLoading(true)

    Promise.all([
      supabase.from('user_answers').select('*').eq('user_id', user.id),
    ]).then(([answersRes]) => {
      // Erros explícitos — sem silenciar falhas de banco
      if (answersRes.error) {
        console.error('[StudyContext] Erro ao carregar respostas:', answersRes.error.message)
      }

      setAnswers(
        (answersRes.data ?? []).map(row => ({
          questionId: row.question_id as string,
          selectedAnswer: row.selected_answer as string,
          isCorrect: row.is_correct as boolean,
          answeredAt: row.answered_at as string,
        }))
      )
    }).catch(err => {
      console.error('[StudyContext] Erro inesperado ao carregar:', err)
    }).finally(() => setStudyLoading(false))
  }, [user?.id])

  // ── Persiste uma resposta no banco ────────────────────────────────────────
  async function recordAnswer(answer: UserAnswer) {
    if (!user) return

    // Atualização otimista (state imediato)
    setAnswers(prev => {
      const idx = prev.findIndex(a => a.questionId === answer.questionId)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = answer
        return updated
      }
      return [...prev, answer]
    })

    // Persiste no banco com upsert (CRITICAL — usa constraint declarada no SQL)
    const { error } = await supabase.from('user_answers').upsert(
      {
        user_id: user.id,
        question_id: answer.questionId,
        selected_answer: answer.selectedAnswer,
        is_correct: answer.isCorrect,
        answered_at: answer.answeredAt,
      },
      { onConflict: 'user_id,question_id' }
    )

    if (error) {
      console.error('[StudyContext] Erro ao salvar resposta:', error.message)
    }
  }

  // ── Reset por IDs ─────────────────────────────────────────────────────────
  async function resetByQuestionIds(ids: string[]) {
    if (!user) return
    setAnswers(prev => prev.filter(a => !ids.includes(a.questionId)))
    const { error } = await supabase.from('user_answers')
      .delete()
      .eq('user_id', user.id)
      .in('question_id', ids)
    if (error) console.error('[StudyContext] Erro ao resetar questões:', error.message)
  }

  // ── Reset total ───────────────────────────────────────────────────────────
  async function resetAllProgress() {
    if (!user) return
    setAnswers([])
    const { error } = await supabase.from('user_answers').delete().eq('user_id', user.id)
    if (error) console.error('[StudyContext] Erro ao resetar progresso:', error.message)
  }



  // ── Progresso por assunto ────────────────────────────────────────────────
  function getSubjectProgress(subjectId: string, questionIds: string[]): SubjectProgress {
    const subjectAnswers = answers.filter(a => questionIds.includes(a.questionId))
    return {
      subjectId,
      total: questionIds.length,
      answered: subjectAnswers.length,
      correct: subjectAnswers.filter(a => a.isCorrect).length,
    }
  }

  // ── Erros gerais ─────────────────────────────────────────────────────────
  function getWrongAnswers(): UserAnswer[] {
    return answers.filter(a => !a.isCorrect)
  }

  // ── Limpar uma questão específica ────────────────────────────────────────
  async function clearAnswer(questionId: string) {
    if (!user) return
    setAnswers(prev => prev.filter(a => a.questionId !== questionId))
    const { error } = await supabase.from('user_answers')
      .delete().eq('user_id', user.id).eq('question_id', questionId)
    if (error) console.error('[StudyContext] Erro ao limpar resposta:', error.message)
  }

  return (
    <StudyContext.Provider value={{
      answers, studyLoading,
      recordAnswer, resetByQuestionIds, resetAllProgress,
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
