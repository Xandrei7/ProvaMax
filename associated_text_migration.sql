-- ============================================================
-- Migration: adiciona associated_text à tabela questions
-- Execute no Supabase SQL Editor antes de usar o importador
-- ============================================================

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS associated_text TEXT NULL;

-- Confirmar
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'questions'
  AND column_name = 'associated_text';
