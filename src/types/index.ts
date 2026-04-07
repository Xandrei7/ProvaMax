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

export type StudyMode = 'sequential' | 'random' | 'discipline' | 'errors'

export interface SimuladoRecord {
  id: string
  user_id: string
  simulado_number: number
  title: string
  is_advanced: boolean
  total_questions: number
  total_answered: number
  total_correct: number
  total_wrong: number
  accuracy_percentage: number
  duration_seconds: number | null
  completed_at: string
  created_at: string
}

export interface SimuladoQuestion {
  id: string
  simulado_id: string
  question_id: string
  selected_answer: string | null
  correct_answer: string
  is_correct: boolean
  discipline_id: string
  subject_id: string
}

export interface Flashcard {
  id: string
  user_id: string
  question_id: string
  source_type: 'study' | 'simulado' | 'review' | 'import'
  simulado_id: string | null
  discipline_id: string
  subject_id: string
  front_text: string
  back_answer: string
  back_trap: string
  back_antidote: string
  status: 'new' | 'reviewing' | 'mastered'
  priority: number
  times_seen: number
  times_correct: number
  times_wrong: number
  last_reviewed_at: string | null
  next_review_at: string | null
  interval_days: number
  ease_factor: number
  created_at: string
  updated_at: string
}
