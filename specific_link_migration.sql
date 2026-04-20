-- Migration: adiciona coluna specific_link na tabela questions
-- Essa coluna é opcional e armazena um link específico para o recurso da questão
-- (vídeo, mapa mental, artigo, etc.)

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS specific_link TEXT DEFAULT NULL;
