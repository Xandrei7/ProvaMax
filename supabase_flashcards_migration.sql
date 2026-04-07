-- Migration: flashcards_system
-- Add table and RLS policies for the Flashcards system

-- Create flashcards table
CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('study', 'simulado', 'review', 'import')),
    simulado_id UUID REFERENCES public.simulados(id) ON DELETE SET NULL,
    discipline_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    front_text TEXT NOT NULL,
    back_answer TEXT NOT NULL,
    back_trap TEXT NOT NULL,
    back_antidote TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'mastered')),
    priority INTEGER NOT NULL DEFAULT 0,
    times_seen INTEGER NOT NULL DEFAULT 0,
    times_correct INTEGER NOT NULL DEFAULT 0,
    times_wrong INTEGER NOT NULL DEFAULT 0,
    last_reviewed_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, question_id)
);

-- Enable RLS
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view their own flashcards" 
    ON public.flashcards FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flashcards" 
    ON public.flashcards FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flashcards" 
    ON public.flashcards FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flashcards" 
    ON public.flashcards FOR DELETE 
    USING (auth.uid() = user_id);

-- Optional trigger to auto-update 'updated_at'
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_flashcards_updated_at
BEFORE UPDATE ON public.flashcards
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Drop Favorites if requested or just keep it around.
-- The user didn't ask to drop favorites from DB, they just asked to remove the route, but said "Troque a aba Favoritos por Flashcards".
-- I will just leave the user_favorites table as it is in case they want a backup, but remove it from the frontend.
