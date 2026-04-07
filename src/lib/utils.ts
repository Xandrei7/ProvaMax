import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

/**
 * Normaliza resposta para comparação, respeitando o TIPO da questão.
 *
 * Questões CERTO/ERRADO (true_false):
 *   'C', 'c', 'Certo', 'certo' → 'certo'
 *   'E', 'e', 'Errado', 'errado' → 'errado'
 *
 * Questões MÚLTIPLA ESCOLHA (multiple_choice):
 *   'a' → 'A', 'b' → 'B', 'c' → 'C', 'd' → 'D', 'e' → 'E'
 *   (letras tratadas como simples identificadores de alternativa)
 */
export function normalizeAnswer(
  s: string | null | undefined,
  type?: string,
): string {
  if (type === 'multiple_choice') {
    return String(s ?? '').trim().toUpperCase()
  }
  // true_false (padrão quando tipo não informado)
  const v = String(s ?? '').trim().toLowerCase()
  if (v === 'c' || v === 'certo') return 'certo'
  if (v === 'e' || v === 'errado') return 'errado'
  return String(s ?? '').trim().toUpperCase()
}

/**
 * Versão legível para exibição ao usuário.
 *
 * true_false:      'C'/'Certo' → 'Certo',  'E'/'Errado' → 'Errado'
 * multiple_choice: 'a' → 'A', 'b' → 'B', etc.  (sem transformação semântica)
 */
export function displayAnswer(
  s: string | null | undefined,
  type?: string,
): string {
  if (type === 'multiple_choice') {
    return String(s ?? '').trim().toUpperCase()
  }
  // true_false
  const norm = normalizeAnswer(s, 'true_false')
  if (norm === 'certo') return 'Certo'
  if (norm === 'errado') return 'Errado'
  return norm
}

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
