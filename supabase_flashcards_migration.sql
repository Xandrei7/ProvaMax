-- Flashcards system (table + RLS + indexes)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  simulado_id UUID REFERENCES public.simulados(id) ON DELETE SET NULL,
  discipline_id UUID NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  front_text TEXT NOT NULL,
  back_answer TEXT NOT NULL,
  back_trap TEXT NOT NULL,
  back_antidote TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  priority INTEGER NOT NULL DEFAULT 0,
  times_seen INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  times_wrong INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT flashcards_user_question_unique UNIQUE (user_id, question_id),
  CONSTRAINT flashcards_source_type_check CHECK (source_type IN ('study', 'simulado', 'review', 'import')),
  CONSTRAINT flashcards_status_check CHECK (status IN ('new', 'reviewing', 'mastered'))
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS flashcards_user_status_next_review_idx
  ON public.flashcards (user_id, status, next_review_at);

CREATE INDEX IF NOT EXISTS flashcards_user_priority_idx
  ON public.flashcards (user_id, priority DESC, updated_at DESC);

CREATE OR REPLACE FUNCTION public.is_current_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.status = 'approved'
  )
$$;

DROP POLICY IF EXISTS "flashcards_select_own" ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_insert_own" ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_update_own" ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_delete_own" ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_admin_select" ON public.flashcards;
DROP POLICY IF EXISTS "Users can view their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can insert their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can update their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can delete their own flashcards" ON public.flashcards;

CREATE POLICY "flashcards_select_own"
  ON public.flashcards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "flashcards_insert_own"
  ON public.flashcards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "flashcards_update_own"
  ON public.flashcards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "flashcards_delete_own"
  ON public.flashcards FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "flashcards_admin_select"
  ON public.flashcards FOR SELECT
  USING (public.is_current_admin());

CREATE OR REPLACE FUNCTION public.set_flashcards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_flashcards_updated_at ON public.flashcards;
CREATE TRIGGER trigger_flashcards_updated_at
BEFORE UPDATE ON public.flashcards
FOR EACH ROW EXECUTE FUNCTION public.set_flashcards_updated_at();
