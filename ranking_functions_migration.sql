-- ── Funções de ranking público ───────────────────────────────────────────────
-- As funções abaixo usam SECURITY DEFINER para contornar o RLS e retornar
-- dados agregados (sem expor linhas individuais de outros usuários).
-- Execute no SQL Editor do Supabase.
-- Criado em: 2026-04-12

-- Evita erro de assinatura ao alterar colunas de retorno (OUT params)
DROP FUNCTION IF EXISTS get_daily_ranking(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_daily_ranking();
DROP FUNCTION IF EXISTS get_general_ranking();

-- 1. Ranking do dia — conta questões respondidas hoje (via activity log)
-- A janela do dia deve ser a mesma calculada no Admin (Hoje), enviada pelo cliente.
CREATE OR REPLACE FUNCTION get_daily_ranking(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(
  user_id uuid,
  user_name text,
  total_answered bigint,
  total_correct bigint,
  total_wrong bigint,
  accuracy_percentage integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH counts AS (
    SELECT
      al.user_id,
      COUNT(*) AS total_answered
    FROM question_activity_log al
    WHERE al.logged_at >= p_start
      AND al.logged_at <  p_end
    GROUP BY al.user_id
  ),
  performance AS (
    SELECT
      ua.user_id,
      COUNT(*) FILTER (WHERE ua.is_correct)     AS total_correct,
      COUNT(*) FILTER (WHERE NOT ua.is_correct) AS total_wrong,
      COUNT(*)                                  AS total_answers
    FROM user_answers ua
    WHERE ua.answered_at >= p_start
      AND ua.answered_at <  p_end
    GROUP BY ua.user_id
  ),
  profile_name AS (
    SELECT
      p.user_id,
      p.name,
      ROW_NUMBER() OVER (
        PARTITION BY p.user_id
        ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST
      ) AS rn
    FROM profiles p
  )
  SELECT
    c.user_id,
    COALESCE(
      NULLIF(trim(pn.name), ''),
      'Usuário ' || left(c.user_id::text, 6)
    ) AS user_name,
    c.total_answered,
    COALESCE(perf.total_correct, 0) AS total_correct,
    COALESCE(perf.total_wrong, 0) AS total_wrong,
    CASE
      WHEN COALESCE(perf.total_answers, 0) = 0 THEN 0
      ELSE ROUND((perf.total_correct::numeric * 100.0) / perf.total_answers)::integer
    END AS accuracy_percentage
  FROM counts c
  LEFT JOIN profile_name pn
    ON pn.user_id = c.user_id
   AND pn.rn = 1
  LEFT JOIN performance perf
    ON perf.user_id = c.user_id
  ORDER BY c.total_answered DESC
  LIMIT 10;
$$;

-- Garante que qualquer usuário autenticado pode chamar a função
GRANT EXECUTE ON FUNCTION get_daily_ranking(timestamptz, timestamptz) TO authenticated;

-- 2. Ranking geral — questões únicas respondidas (via user_answers)
CREATE OR REPLACE FUNCTION get_general_ranking()
RETURNS TABLE(
  user_id uuid,
  user_name text,
  total_answered bigint,
  total_correct bigint,
  total_wrong bigint,
  accuracy_percentage integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH performance AS (
    SELECT
      ua.user_id,
      COUNT(*) FILTER (WHERE ua.is_correct)     AS total_correct,
      COUNT(*) FILTER (WHERE NOT ua.is_correct) AS total_wrong,
      COUNT(*)                                  AS total_answers
    FROM user_answers ua
    GROUP BY ua.user_id
  ),
  profile_name AS (
    SELECT
      p.user_id,
      p.name,
      ROW_NUMBER() OVER (
        PARTITION BY p.user_id
        ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST
      ) AS rn
    FROM profiles p
  )
  SELECT
    ua.user_id,
    COALESCE(
      NULLIF(trim(pn.name), ''),
      'Usuário ' || left(ua.user_id::text, 6)
    ) AS user_name,
    COUNT(*) AS total_answered,
    COALESCE(perf.total_correct, 0) AS total_correct,
    COALESCE(perf.total_wrong, 0) AS total_wrong,
    CASE
      WHEN COALESCE(perf.total_answers, 0) = 0 THEN 0
      ELSE ROUND((perf.total_correct::numeric * 100.0) / perf.total_answers)::integer
    END AS accuracy_percentage
  FROM user_answers ua
  LEFT JOIN profile_name pn
    ON pn.user_id = ua.user_id
   AND pn.rn = 1
  LEFT JOIN performance perf
    ON perf.user_id = ua.user_id
  GROUP BY ua.user_id, pn.name, perf.total_correct, perf.total_wrong, perf.total_answers
  HAVING COUNT(*) > 50
  ORDER BY total_answered DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION get_general_ranking() TO authenticated;
