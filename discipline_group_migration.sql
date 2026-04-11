-- ============================================================
-- Migration 1: coluna associated_text em questions
-- Execute PRIMEIRO se ainda não rodou
-- ============================================================
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS associated_text TEXT NULL;

-- ============================================================
-- Migration 2: coluna group_name em disciplines
-- Vincula cada matéria a uma pasta/grupo administrável
-- Valores válidos: 'gerais' | 'especificos' | NULL
-- ============================================================
ALTER TABLE public.disciplines
  ADD COLUMN IF NOT EXISTS group_name TEXT NULL;

-- ============================================================
-- Verificação — deve retornar as duas colunas abaixo
-- ============================================================
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('questions', 'disciplines')
  AND column_name IN ('associated_text', 'group_name')
ORDER BY table_name, column_name;
