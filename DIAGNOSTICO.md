# Diagnóstico Técnico — ProvaMax

## PROBLEMA 1: Gabarito Errado — Causa Raiz

O código de comparação está **correto** em todos os lugares:
- `StudyMode`: `isCorrect: selected === q.correct_answer`
- `Simulado`: `isCorrect: selected === q.correct_answer`
- `Errors`: `isCorrect: selected === q.correct_answer`
- `QuestionCard`: `const isCorrect = selected === question.correct_answer`

**O problema real é que a tabela `user_answers` provavelmente não existe no banco.** Isso faz com que:
1. O `recordAnswer()` salva via upsert → Supabase retorna erro silencioso
2. Na próxima carga da página, `user_answers` retorna vazio
3. O histórico some, aparentando "gabarito errado" quando na verdade o estado foi perdido

## PROBLEMA 2: Estatísticas Somem ao Atualizar — Causa Raiz

O `StudyContext` carrega do banco assim:
```ts
Promise.all([
  supabase.from('user_answers').select('*').eq('user_id', user.id),
  supabase.from('flashcards').select('id').eq('user_id', user.id),
]).then(([answersRes, flashcardsRes]) => {
  setAnswers((answersRes.data ?? []).map(...))
```

Se qualquer tabela não existe → `data = null` → array fica vazio → sem tratamento de erro → sem log → falha silenciosa.

## PROBLEMA 3: Simulados Não Persistem

Tabelas `simulados` e `simulado_questions` ainda não existem no banco.
SQL de migração foi gerado (`supabase_simulados_migration.sql`) mas ainda não executado.

## SOLUÇÃO COMPLETA

O SQL abaixo cria TODAS as tabelas necessárias de uma vez.
Execute no Supabase → SQL Editor → New Query → Cole → Run.
