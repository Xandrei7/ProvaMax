-- Execute no SQL Editor do Supabase para adicionar campos complementares às teorias.
-- Seguro para rodar em tabelas já existentes (usa IF NOT EXISTS via DO block).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theories' AND column_name = 'youtube_url'
  ) THEN
    ALTER TABLE theories ADD COLUMN youtube_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theories' AND column_name = 'complementary_text'
  ) THEN
    ALTER TABLE theories ADD COLUMN complementary_text text;
  END IF;
END;
$$;
