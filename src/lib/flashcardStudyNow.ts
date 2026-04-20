/**
 * flashcardStudyNow.ts
 * Regra de composição da fila "Estudar Agora".
 * Puro — sem acesso a estado, localStorage ou React.
 */

import type { Flashcard } from '@/types'

// ── Tipos exportados ────────────────────────────────────────────────────────

export interface StudyNowBreakdown {
  /** P1 — Críticos marcados manualmente pelo usuário */
  manualCritical: number
  /** P2 — Críticos automáticos: ≥ 3 erros, sistema detectou */
  autoCritical: number
  /** P3 — Erros de simulados */
  simuladoErrors: number
  /** P4 — Revisões com schedule vencido */
  overdueReviews: number
  /** P5 — Acertos frágeis: ease baixo / intervalo curto (C/P) */
  weakCorrect: number
  /** P6 — Difíceis + novos pendentes */
  hardAndPending: number
}

export interface StudyNowResult {
  queue: Flashcard[]
  breakdown: StudyNowBreakdown
  total: number
}

// ── Helpers internos ────────────────────────────────────────────────────────

function difficultyScore(card: Flashcard): number {
  const total = card.times_correct + card.times_wrong
  if (total === 0) return 0
  return card.times_wrong / total
}

/**
 * Desempate padrão (aplicado dentro de cada camada):
 * 1. Mais urgente — next_review_at mais antigo
 * 2. Mais erros — times_wrong decrescente
 * 3. Revisado mais recentemente — last_reviewed_at decrescente
 */
function tiebreak(a: Flashcard, b: Flashcard): number {
  const aNext = a.next_review_at ? new Date(a.next_review_at).getTime() : 0
  const bNext = b.next_review_at ? new Date(b.next_review_at).getTime() : 0
  if (aNext !== bNext) return aNext - bNext

  if (b.times_wrong !== a.times_wrong) return b.times_wrong - a.times_wrong

  const aLast = a.last_reviewed_at ? new Date(a.last_reviewed_at).getTime() : 0
  const bLast = b.last_reviewed_at ? new Date(b.last_reviewed_at).getTime() : 0
  return bLast - aLast
}

// ── Função principal ────────────────────────────────────────────────────────

/**
 * Monta a fila "Estudar Agora" com as 6 camadas de prioridade.
 *
 * @param cards          Todos os flashcards do usuário (já filtrados pela disciplina, se houver)
 * @param disciplineId   'all' ou ID de disciplina específica
 * @param manualCritIds  Set de question_ids marcados como críticos pelo usuário
 * @param limit          Tamanho máximo da fila (padrão: 20)
 */
export function buildStudyNowQueue(
  cards: Flashcard[],
  disciplineId: string,
  manualCritIds: Set<string>,
  limit: number,
): StudyNowResult {
  const now = new Date()
  const base = disciplineId !== 'all' ? cards.filter(c => c.discipline_id === disciplineId) : cards
  const active = base.filter(c => c.status !== 'mastered')

  // Evita repetição do mesmo enunciado dentro da sessão
  const seenQIds = new Set<string>()

  // ── Camada 1: Críticos MANUAIS ─────────────────────────────────────────────
  // Marcados explicitamente pelo usuário via "Críticos (P/C)"
  const p1 = active
    .filter(c => manualCritIds.has(c.question_id))
    .sort(tiebreak)

  // ── Camada 2: Críticos AUTOMÁTICOS ────────────────────────────────────────
  // Detectados pelo sistema: ≥ 3 erros, não marcados manualmente
  const p2 = active
    .filter(c => !manualCritIds.has(c.question_id) && c.times_wrong >= 3)
    .sort(tiebreak)

  // ── Camada 3: Erros de simulados ──────────────────────────────────────────
  // Erros cometidos em simulados que não atingiram threshold de crítico
  const p3 = active
    .filter(c =>
      c.source_type === 'simulado' &&
      c.times_wrong > 0 &&
      c.times_wrong < 3 &&
      !manualCritIds.has(c.question_id),
    )
    .sort(tiebreak)

  // ── Camada 4: Revisões vencidas ────────────────────────────────────────────
  // Schedule expirado, cards que o SRS já pedia revisar
  const p4 = active
    .filter(c =>
      !manualCritIds.has(c.question_id) &&
      c.times_wrong < 3 &&
      c.next_review_at != null &&
      new Date(c.next_review_at) <= now,
    )
    .sort(tiebreak)

  // ── Camada 5: Acertos frágeis (C/P) ───────────────────────────────────────
  // Cards respondidos corretamente mas com ease baixo (≤ 2.0) ou intervalo
  // curto (≤ 2d): o usuário "acertou por pouco" — ainda não consolidado
  const p5 = active
    .filter(c =>
      !manualCritIds.has(c.question_id) &&
      c.times_correct > 0 &&
      c.times_wrong === 0 &&
      ((c.ease_factor ?? 2.5) <= 2.0 || (c.interval_days ?? 1) <= 2),
    )
    .sort((a, b) => (a.ease_factor ?? 2.5) - (b.ease_factor ?? 2.5))

  // ── Camada 6: Difíceis + pendentes ────────────────────────────────────────
  // Novos sem histórico + cards com difficulty_score alto e sem urgência imediata
  const p6 = active
    .filter(c =>
      !manualCritIds.has(c.question_id) &&
      c.times_wrong === 0 &&
      (c.status === 'new' || difficultyScore(c) > 0.3),
    )
    .sort((a, b) => difficultyScore(b) - difficultyScore(a) || tiebreak(a, b))

  // ── Montagem com deduplicação ──────────────────────────────────────────────
  const queue: Flashcard[] = []
  const counts: StudyNowBreakdown = {
    manualCritical: 0,
    autoCritical: 0,
    simuladoErrors: 0,
    overdueReviews: 0,
    weakCorrect: 0,
    hardAndPending: 0,
  }

  function take(source: Flashcard[], key: keyof StudyNowBreakdown) {
    for (const c of source) {
      if (queue.length >= limit) break
      if (seenQIds.has(c.question_id)) continue
      seenQIds.add(c.question_id)
      queue.push(c)
      counts[key]++
    }
  }

  take(p1, 'manualCritical')
  take(p2, 'autoCritical')
  take(p3, 'simuladoErrors')
  take(p4, 'overdueReviews')
  take(p5, 'weakCorrect')
  take(p6, 'hardAndPending')

  return { queue, breakdown: counts, total: queue.length }
}

// ── Helpers de display ──────────────────────────────────────────────────────

/**
 * Retorna a linha de apoio do banner no formato:
 * "20 cards • 6 críticos • 8 erros • 4 revisões • 2 simulados"
 */
export function formatStudyNowLine(total: number, b: StudyNowBreakdown): string {
  const critical = b.manualCritical + b.autoCritical
  const parts: string[] = [`${total} card${total !== 1 ? 's' : ''}`]
  if (critical > 0) parts.push(`${critical} crítico${critical !== 1 ? 's' : ''}`)
  const errors = b.autoCritical > 0 ? 0 : 0  // já contado em críticos
  void errors
  if (b.simuladoErrors > 0) parts.push(`${b.simuladoErrors} simulado${b.simuladoErrors !== 1 ? 's' : ''}`)
  if (b.overdueReviews > 0) parts.push(`${b.overdueReviews} revisã${b.overdueReviews !== 1 ? 'ões' : 'o'}`)
  if (b.weakCorrect > 0) parts.push(`${b.weakCorrect} C/P`)
  if (b.hardAndPending > 0) parts.push(`${b.hardAndPending} pendente${b.hardAndPending !== 1 ? 's' : ''}`)
  return parts.join(' • ')
}
