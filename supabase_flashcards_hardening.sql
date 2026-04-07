-- Flashcards hardening (safe to run multiple times)

ALTER TABLE IF EXISTS public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS flashcards_user_question_unique_idx
  ON public.flashcards (user_id, question_id);

CREATE INDEX IF NOT EXISTS flashcards_user_status_review_idx
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
