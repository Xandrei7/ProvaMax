-- Migration: adiciona tabela subject_parts (camada opcional dentro de um assunto)
-- e coluna part_id nas questions
--
-- REGRA: se o assunto não tiver partes, tudo continua exatamente como está.
-- Se tiver partes, ao clicar no assunto o usuário vê as partes antes das questões.

-- 1. Tabela de partes
CREATE TABLE IF NOT EXISTS subject_parts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  subject_id UUID        NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subject_parts_subject_id_idx ON subject_parts(subject_id);

-- 2. Coluna opcional nas questions (NULL = questão pertence ao assunto geral, sem parte)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS part_id UUID REFERENCES subject_parts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS questions_part_id_idx ON questions(part_id);

-- RLS: mesma política das outras tabelas (leitura pública, escrita admin)
ALTER TABLE subject_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subject_parts_read_all" ON subject_parts;
CREATE POLICY "subject_parts_read_all"
  ON subject_parts FOR SELECT USING (true);

DROP POLICY IF EXISTS "subject_parts_write_admin" ON subject_parts;
CREATE POLICY "subject_parts_write_admin"
  ON subject_parts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
