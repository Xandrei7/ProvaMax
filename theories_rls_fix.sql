-- Execute este arquivo no SQL Editor do Supabase
-- se a tabela theories já existir com RLS habilitado.
-- Isso corrige o erro "Erro ao salvar teoria" no admin.

ALTER TABLE theories DISABLE ROW LEVEL SECURITY;

-- Remove policies antigas se existirem
DROP POLICY IF EXISTS "theories_select_authenticated" ON theories;
DROP POLICY IF EXISTS "theories_all_admin"            ON theories;
