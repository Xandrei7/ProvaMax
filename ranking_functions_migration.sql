-- ── Funções de ranking público ───────────────────────────────────────────────
-- As funções abaixo usam SECURITY DEFINER para contornar o RLS e retornar
-- dados agregados (sem expor linhas individuais de outros usuários).
-- Execute no SQL Editor do Supabase.
-- Criado em: 2026-04-12

-- 1. Ranking do dia — conta questões respondidas hoje (via activity log)
CREATE OR REPLACE FUNCTION get_daily_ranking()
RETURNS TABLE(user_id uuid, user_name text, total_answered bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    al.user_id,
    COALESCE(
      NULLIF(trim(p.name), ''),
      'Usuário ' || left(al.user_id::text, 6)
    ) AS user_name,
    COUNT(*) AS total_answered
  FROM question_activity_log al
  LEFT JOIN profiles p ON p.user_id = al.user_id
  WHERE al.logged_at >= (CURRENT_DATE AT TIME ZONE 'America/Manaus')
    AND al.logged_at <  (CURRENT_DATE AT TIME ZONE 'America/Manaus' + INTERVAL '1 day')
  GROUP BY al.user_id, p.name
  ORDER BY total_answered DESC
  LIMIT 10;
$$;

-- Garante que qualquer usuário autenticado pode chamar a função
GRANT EXECUTE ON FUNCTION get_daily_ranking() TO authenticated;

-- 2. Ranking geral — questões únicas respondidas (via user_answers)
CREATE OR REPLACE FUNCTION get_general_ranking()
RETURNS TABLE(user_id uuid, user_name text, total_answered bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ua.user_id,
    COALESCE(
      NULLIF(trim(p.name), ''),
      'Usuário ' || left(ua.user_id::text, 6)
    ) AS user_name,
    COUNT(*) AS total_answered
  FROM user_answers ua
  LEFT JOIN profiles p ON p.user_id = ua.user_id
  GROUP BY ua.user_id, p.name
  HAVING COUNT(*) > 50
  ORDER BY total_answered DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION get_general_ranking() TO authenticated;
