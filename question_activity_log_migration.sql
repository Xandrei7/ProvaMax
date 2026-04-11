-- ── Monitoramento de atividade dos usuários ─────────────────────────────────
-- Tabela de log de eventos: cada resposta gera uma linha nova (sem upsert).
-- Dados históricos de user_answers não migram — começa zerada.
-- Criado em: 2026-04-11

CREATE TABLE IF NOT EXISTS question_activity_log (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL,
  question_id UUID       NOT NULL,
  logged_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Índice para queries por usuário + período (painel admin)
CREATE INDEX IF NOT EXISTS idx_activity_log_user_logged
  ON question_activity_log (user_id, logged_at);

-- RLS: usuário só insere as próprias linhas; admin lê tudo
ALTER TABLE question_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_insert_own"
  ON question_activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activity_log_admin_read"
  ON question_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
