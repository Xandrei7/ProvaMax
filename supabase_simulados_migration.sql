-- ═══════════════════════════════════════════════════════════════════════════
-- ProvaMax — Migração COMPLETA e DEFINITIVA
-- Execute em: Supabase → SQL Editor → New Query → Run
--
-- INCLUI:
--   1. user_answers      (respostas gerais — FIX da persistência)
--   2. simulados         (histórico de simulados)
--   3. simulado_questions (questões de cada simulado)
--
-- Seguro rodar múltiplas vezes: usa CREATE TABLE IF NOT EXISTS e DROP POLICY IF EXISTS
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. user_answers  ← CAUSA RAIZ das estatísticas sumindo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_answers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id     uuid        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer text        NOT NULL,
  is_correct      boolean     NOT NULL DEFAULT false,
  answered_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_answers_unique UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS user_answers_user_id_idx ON public.user_answers(user_id);
CREATE INDEX IF NOT EXISTS user_answers_question_id_idx ON public.user_answers(question_id);
CREATE INDEX IF NOT EXISTS user_answers_is_correct_idx ON public.user_answers(user_id, is_correct);

ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_answers_select_own" ON public.user_answers;
CREATE POLICY "user_answers_select_own"
  ON public.user_answers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_answers_insert_own" ON public.user_answers;
CREATE POLICY "user_answers_insert_own"
  ON public.user_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_answers_update_own" ON public.user_answers;
CREATE POLICY "user_answers_update_own"
  ON public.user_answers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_answers_delete_own" ON public.user_answers;
CREATE POLICY "user_answers_delete_own"
  ON public.user_answers FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. simulados
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.simulados (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulado_number     integer     NOT NULL,
  title               text        NOT NULL,
  is_advanced         boolean     NOT NULL DEFAULT false,
  total_questions     integer     NOT NULL DEFAULT 0,
  total_answered      integer     NOT NULL DEFAULT 0,
  total_correct       integer     NOT NULL DEFAULT 0,
  total_wrong         integer     NOT NULL DEFAULT 0,
  accuracy_percentage integer     NOT NULL DEFAULT 0,
  duration_seconds    integer,
  completed_at        timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS simulados_user_id_idx       ON public.simulados(user_id);
CREATE INDEX IF NOT EXISTS simulados_user_number_idx   ON public.simulados(user_id, simulado_number);
CREATE INDEX IF NOT EXISTS simulados_completed_at_idx  ON public.simulados(user_id, completed_at DESC);

ALTER TABLE public.simulados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulados_select_own" ON public.simulados;
CREATE POLICY "simulados_select_own"
  ON public.simulados FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "simulados_insert_own" ON public.simulados;
CREATE POLICY "simulados_insert_own"
  ON public.simulados FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "simulados_update_own" ON public.simulados;
CREATE POLICY "simulados_update_own"
  ON public.simulados FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "simulados_delete_own" ON public.simulados;
CREATE POLICY "simulados_delete_own"
  ON public.simulados FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. simulado_questions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.simulado_questions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id         uuid        NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  question_id         uuid        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer     text,               -- null = pulou
  correct_answer      text        NOT NULL,
  is_correct          boolean     NOT NULL DEFAULT false,
  discipline_id       uuid        NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  subject_id          uuid        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sim_q_simulado_id_idx    ON public.simulado_questions(simulado_id);
CREATE INDEX IF NOT EXISTS sim_q_question_id_idx    ON public.simulado_questions(question_id);
CREATE INDEX IF NOT EXISTS sim_q_is_correct_idx     ON public.simulado_questions(simulado_id, is_correct);

ALTER TABLE public.simulado_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulado_questions_select_own" ON public.simulado_questions;
CREATE POLICY "simulado_questions_select_own"
  ON public.simulado_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.simulados s
      WHERE s.id = simulado_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "simulado_questions_insert_own" ON public.simulado_questions;
CREATE POLICY "simulado_questions_insert_own"
  ON public.simulado_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.simulados s
      WHERE s.id = simulado_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "simulado_questions_delete_own" ON public.simulado_questions;
CREATE POLICY "simulado_questions_delete_own"
  ON public.simulado_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.simulados s
      WHERE s.id = simulado_id AND s.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificação final — deve mostrar as 3 tabelas com 0 linhas
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'user_answers'       AS tabela, COUNT(*) AS total FROM public.user_answers
UNION ALL
SELECT 'simulados',           COUNT(*) FROM public.simulados
UNION ALL
SELECT 'simulado_questions',  COUNT(*) FROM public.simulado_questions;
