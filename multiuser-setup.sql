-- ============================================================
-- PROVA MAX — Setup Multi-Usuário
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Tabela de respostas por usuário (substitui localStorage)
CREATE TABLE IF NOT EXISTS public.user_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  selected_answer text NOT NULL,
  is_correct boolean NOT NULL,
  answered_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, question_id)
);

-- 2. Tabela de favoritos por usuário (substitui localStorage)
CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

-- 3. Habilitar RLS
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- 4. Policies: cada usuário acessa apenas os próprios dados
DROP POLICY IF EXISTS "Users manage own answers" ON public.user_answers;
CREATE POLICY "Users manage own answers"
  ON public.user_answers FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own favorites" ON public.user_favorites;
CREATE POLICY "Users manage own favorites"
  ON public.user_favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. IMPORTANTE
-- Não sobrescreva mais o trigger handle_new_user por aqui.
-- O fluxo de autorização (pending/approved/suspended/revoked)
-- agora é centralizado no script authorization-hardening.sql.
