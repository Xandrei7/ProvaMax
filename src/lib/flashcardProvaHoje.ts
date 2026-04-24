/**
 * flashcardProvaHoje.ts
 * Monta a sessão diária "Prova Hoje" — até 80 cards distribuídos por disciplina
 * como uma prova FCC difícil para Assistente Legislativo ALE-RR.
 *
 * Regras principais:
 * - Distribuição fixa por disciplina (Pareto do edital)
 * - Erros recentes (últimas 48h) aparecem primeiro dentro de cada bucket
 * - Variação diária por seed baseado na data
 * - Português: exclui interpretação longa de texto
 * - Sem chamadas de IA, sem efeitos colaterais
 */

import type { Flashcard } from '@/types'

// ── Buckets e distribuição alvo (total = 80) ─────────────────────────────────

type PhBucket =
  | 'leg_institucional'
  | 'portugues'
  | 'constitucional'
  | 'administrativo'
  | 'afo'
  | 'adm_publica'
  | 'proc_legislativo'
  | 'legistica'
  | 'geo_rr'

const BUCKET_TARGETS: Record<PhBucket, number> = {
  leg_institucional:  14,
  portugues:          12,
  constitucional:     10,
  administrativo:     12,
  afo:                10,
  adm_publica:         8,
  proc_legislativo:    8,
  legistica:           4,
  geo_rr:              2,
}

// Ordem de prioridade ao redistribuir slots vazios (Pareto do cargo)
const BUCKET_PRIORITY: PhBucket[] = [
  'leg_institucional',
  'proc_legislativo',
  'administrativo',
  'constitucional',
  'portugues',
  'afo',
  'adm_publica',
  'legistica',
  'geo_rr',
]

const TOTAL_TARGET = 80

// ── Classificação de disciplinas (mesmos padrões usados em Flashcards.tsx) ───

function classifyDisc(discName: string): PhBucket | null {
  const n = discName.toLowerCase()
  if (/legisla[çc][aã]o\s+institucional|regimento\s+interno/.test(n)) return 'leg_institucional'
  if (/portugu|l[íi]ngua\s*portugu/.test(n)) return 'portugues'
  if (/constitucional/.test(n)) return 'constitucional'
  if (/administrativo/.test(n)) return 'administrativo'
  if (/or[çc]ament|financ[ei]|\bafo\b/.test(n)) return 'afo'
  if (/administra[çc][aã]o\s+p[úu]blica|gest[aã]o\s+p/.test(n)) return 'adm_publica'
  if (/processo\s*legisl/.test(n)) return 'proc_legislativo'
  if (/leg[íi]stica/.test(n)) return 'legistica'
  if (/geografia|hist[oó]ria.*(roraima|rr)|roraima.*(hist[oó]ria|geografia)/.test(n)) return 'geo_rr'
  return null
}

// ── Seed diário para variação ─────────────────────────────────────────────────

export function getDailyProvaHojeSeed(date: Date): number {
  const s = date.toISOString().slice(0, 10).replace(/-/g, '')
  return parseInt(s, 10) % 2147483647
}

function seededRng(seed: number): () => number {
  let s = (seed >>> 0) || 1
  return (): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Filtros de qualidade ──────────────────────────────────────────────────────

function isPortuguesValido(card: Flashcard): boolean {
  const text = card.front_text.trim()
  if (text.length > 350) return false
  if (/^(leia|o texto (a seguir|abaixo)|consider(e|ando) o texto|com base no texto|no trecho|no fragmento|a partir do texto)/i.test(text)) return false
  return true
}

// ── Score interno de prioridade dentro do bucket ──────────────────────────────

function bucketScore(card: Flashcard): number {
  let s = 0
  s += card.times_wrong * 5
  if (card.times_wrong >= 3) s += 3
  s += Math.max(0, (2.5 - (card.ease_factor ?? 2.5)) * 3)
  // Palavras-chave FCC
  if (/SEMPRE|NUNCA|EXCETO|SALVO|APENAS|SOMENTE|EXCLUSIVAMENTE|VEDADO|PROIBIDO|OBRIGATORIAMENTE/i.test(card.front_text)) s += 3
  // Tipos objetivos de alto valor
  if (/qu[oó]rum|maioria\s+(absoluta|simples|qualificada)/i.test(card.front_text)) s += 4
  if (/\bprazo[s]?\b|\b\d+\s*dias?\b|\b\d+\s*horas?\b|\bvigência\b/i.test(card.front_text)) s += 4
  if (/\bcompetência[s]?\b|\batribui[çc][õo]es?\b|\bcompete\b|\bprivativa\b|\bexclusiva\b/i.test(card.front_text)) s += 4
  if (/\bexce[çc][aã]o\b|\bvedado\b|\bproibido\b|\bsalvo\b/i.test(card.front_text)) s += 3
  if (/\bdiferença\b|\bdistinção\b|\bdistinguir\b/i.test(card.front_text)) s += 3
  return s
}

// ── Função principal ──────────────────────────────────────────────────────────

export function buildProvaHojeQueue(
  cards: Flashcard[],
  disciplineNameById: Map<string, string>,
  date: Date = new Date(),
): Flashcard[] {
  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000)
  const seed = getDailyProvaHojeSeed(date)
  const rng = seededRng(seed)

  const active = cards.filter(c => c.status !== 'mastered')

  // Distribui por bucket com filtro de qualidade
  const buckets = new Map<PhBucket, Flashcard[]>()
  for (const c of active) {
    const discName = disciplineNameById.get(c.discipline_id) ?? ''
    const bucket = classifyDisc(discName)
    if (!bucket) continue
    if (bucket === 'portugues' && !isPortuguesValido(c)) continue
    if (!buckets.has(bucket)) buckets.set(bucket, [])
    buckets.get(bucket)!.push(c)
  }

  const selectedByBucket = new Map<PhBucket, Flashcard[]>()
  const leftoverByBucket = new Map<PhBucket, Flashcard[]>()

  for (const bucket of BUCKET_PRIORITY) {
    const pool = buckets.get(bucket) ?? []
    const target = BUCKET_TARGETS[bucket]

    // 1º prioridade: erros das últimas 48h (voltam garantidos em até 2 dias)
    const recentErrors = pool
      .filter(c => c.times_wrong > 0 && c.last_reviewed_at != null && new Date(c.last_reviewed_at) >= twoDaysAgo)
      .sort((a, b) => bucketScore(b) - bucketScore(a))

    const recentIds = new Set(recentErrors.map(c => c.id))

    // 2º prioridade: devidos pelo SRS
    const due = pool
      .filter(c => !recentIds.has(c.id) && c.next_review_at != null && new Date(c.next_review_at) <= now)
      .sort((a, b) => bucketScore(b) - bucketScore(a))

    const dueIds = new Set(due.map(c => c.id))

    // 3º: restante — embaralhado com seed para variar diariamente
    const rest = seededShuffle(
      pool
        .filter(c => !recentIds.has(c.id) && !dueIds.has(c.id))
        .sort((a, b) => bucketScore(b) - bucketScore(a)),
      rng,
    )

    const ordered = [...recentErrors, ...due, ...rest]
    selectedByBucket.set(bucket, ordered.slice(0, target))
    leftoverByBucket.set(bucket, ordered.slice(target))
  }

  let selected: Flashcard[] = []
  for (const bucket of BUCKET_PRIORITY) {
    selected.push(...(selectedByBucket.get(bucket) ?? []))
  }

  // Preenche shortfall com leftovers de outras disciplinas (mesma ordem Pareto)
  if (selected.length < TOTAL_TARGET) {
    const leftovers: Flashcard[] = []
    for (const bucket of BUCKET_PRIORITY) {
      leftovers.push(...(leftoverByBucket.get(bucket) ?? []))
    }
    const fill = seededShuffle(leftovers, rng).slice(0, TOTAL_TARGET - selected.length)
    selected = [...selected, ...fill]
  }

  selected = selected.slice(0, TOTAL_TARGET)

  // Embaralha final com seed diferente: distribui disciplinas como numa prova real
  return seededShuffle(selected, seededRng(seed + 7919))
}
