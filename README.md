# ProvaMax

Aplicacao React + Vite com Supabase e backend serverless para gerar Flashcards de recuperacao ativa.

## Rotas principais

- `/flashcards`: pagina oficial de Flashcards
- `/favorites`: compatibilidade legada (redireciona para `/flashcards`)

## Backend de Flashcards

Endpoint principal:

- `POST /api/generate-flashcard`

Fluxo:

1. Valida token e `user_id`
2. Busca flashcard existente por `(user_id, question_id)`
3. Se existir, atualiza prioridade/status/contadores sem chamar IA
4. Se nao existir, gera com IA (ou fallback), valida e salva no Supabase

## Variaveis de ambiente

Consulte `.env.example`.

Principais variaveis:

- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Backend: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`
- Opcional: `FLASHCARD_AI_DAILY_LIMIT`, `OPENAI_FLASHCARD_MODEL`

## SQL

Execute no Supabase SQL Editor:

- `supabase_flashcards_migration.sql`

Esse script cria/garante tabela de flashcards, unique `(user_id, question_id)`, indices e RLS com isolamento por usuario.

## Build

```bash
npm run build
```
