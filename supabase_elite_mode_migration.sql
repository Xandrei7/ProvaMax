-- MODO ELITE: Adiciona campos para repetição espaçada (modelo Anki)
-- Execute no Supabase SQL Editor

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS interval_days FLOAT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ease_factor FLOAT NOT NULL DEFAULT 2.5;

-- Backfill: ajusta cards existentes que já foram revisados
-- Cards com acertos têm intervalo calculado retroativamente
UPDATE public.flashcards
SET
  interval_days = CASE
    WHEN times_correct = 0 THEN 1
    WHEN times_correct = 1 THEN 1
    WHEN times_correct = 2 THEN 3
    WHEN times_correct = 3 THEN 7
    ELSE 15
  END,
  ease_factor = GREATEST(1.3, 2.5 - (times_wrong * 0.2))
WHERE times_seen > 0;

-- Índice para consultas SRS (vencidos + erros)
CREATE INDEX IF NOT EXISTS flashcards_elite_queue_idx
  ON public.flashcards (user_id, next_review_at, times_wrong DESC, interval_days ASC);

-- Índice para "só difíceis" (difficulty_score = times_wrong / (times_correct + times_wrong))
CREATE INDEX IF NOT EXISTS flashcards_elite_difficulty_idx
  ON public.flashcards (user_id, times_wrong DESC, times_correct ASC)
  WHERE status != 'mastered';
