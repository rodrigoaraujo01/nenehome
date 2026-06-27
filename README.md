# nenehome

Web app que gamifica os encontros e interações de um grupo de 8 amigos. Sistema de pontos, conquistas, perguntas, fotos, desafios e bolão da Copa 2026.

## Stack

- React 19 + Vite + React Router v7 + TypeScript + Tailwind CSS v4
- Supabase (auth, database, storage)
- Framer Motion (animações)
- Vercel (deploy)

## Dev

```bash
bun install
bun dev
```

O app roda em `http://localhost:5173`.

### Variáveis de ambiente

Crie um `.env` na raiz:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Deploy

Push para o GitHub dispara deploy automático no Vercel. A configuração de framework e rewrites está em `vercel.json`.

As variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) devem estar configuradas no dashboard do Vercel.

## Database

O schema do Supabase está em `supabase/`:

- `schema.sql` — tabelas base (profiles, questions, answers, points_log, etc.)
- `photos.sql` — photo_submissions, photo_votes
- `photo_challenges.sql` — desafios de foto com time-gating
- `achievements.sql` — catálogo de conquistas e RPCs
- `nenecoins.sql` — sistema de moedas (nenecoins + firecoins)
- `bets.sql` — bolões/apostas
- `worldcup.sql` — bolão da Copa 2026
- `question_comments.sql` — comentários privados entre quem respondeu uma pergunta
- `family_only_impossible.sql` — classifica como impossíveis perguntas acertadas só pela família do criador
