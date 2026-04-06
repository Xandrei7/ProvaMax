export interface Discipline {
  id: string
  name: string
  icon: string
  created_at: string
}

export interface Subject {
  id: string
  name: string
  discipline_id: string
  sort_order: number
  created_at: string
}

export interface QuestionOption {
  letter: string
  text: string
}

export type QuestionType = 'multiple_choice' | 'true_false'

export interface Question {
  id: string
  statement: string
  type: QuestionType
  options: QuestionOption[] | null
  correct_answer: string
  comment: string
  legal_basis: string | null
  exam_tips: string | null
  subject_id: string
  discipline_id: string
  sort_order: number
  created_at: string
}

export interface Profile {
  id?: string
  user_id: string
  email: string
  name: string
  is_validated?: boolean
  status: 'pending' | 'approved' | 'suspended' | 'revoked'
  role: 'admin' | 'user'
  created_at: string
  updated_at?: string
  requested_access_at?: string | null
  approved_at?: string | null
  suspended_at?: string | null
}

export interface UserAnswer {
  questionId: string
  selectedAnswer: string
  isCorrect: boolean
  answeredAt: string
}

export interface SubjectProgress {
  subjectId: string
  total: number
  answered: number
  correct: number
}

export interface DisciplineProgress {
  disciplineId: string
  totalSubjects: number
  completedSubjects: number
  totalQuestions: number
  answeredQuestions: number
  correctAnswers: number
}

export type StudyMode = 'sequential' | 'random' | 'discipline' | 'favorites' | 'errors'
