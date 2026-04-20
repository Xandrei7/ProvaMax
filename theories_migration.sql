-- Tabela de teorias para o módulo Teoria do ProvaMax
-- Execute no SQL Editor do Supabase antes de usar a feature.

CREATE TABLE IF NOT EXISTS theories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_id uuid NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  subject_id    uuid NOT NULL REFERENCES subjects(id)    ON DELETE CASCADE,
  title         text NOT NULL,
  content_html  text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices úteis para as queries do app
CREATE INDEX IF NOT EXISTS theories_discipline_id_idx ON theories(discipline_id);
CREATE INDEX IF NOT EXISTS theories_subject_id_idx    ON theories(subject_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS theories_set_updated_at ON theories;
CREATE TRIGGER theories_set_updated_at
  BEFORE UPDATE ON theories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: desabilitado para corresponder ao padrão das outras tabelas do projeto
-- (disciplines, subjects, questions — usadas pelo admin via chave anon/authenticated)
-- Se quiser RLS, habilite manualmente e adicione políticas adequadas.
ALTER TABLE theories DISABLE ROW LEVEL SECURITY;
