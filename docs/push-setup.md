# Push Notifications — Setup

Web Push para avisar o grupo quando alguém cria uma **pergunta**, um **desafio de
foto** ou envia uma **foto para votar**. Funciona com o app fechado em
Android/desktop Chrome; no iPhone, só depois de **Adicionar à Tela de Início**
(iOS 16.4+).

## Peças (já no repositório)

| Camada | Arquivo |
|--------|---------|
| Service worker | `public/sw.js` |
| Manifest PWA | `public/manifest.json` (+ tags em `index.html`) |
| Registro do SW | `src/main.tsx` |
| Opt-in (perfil + banner home) | `src/components/PushToggle.tsx`, `src/components/PushBanner.tsx`, `src/hooks/usePushSubscription.ts`, `src/lib/push.ts` |
| Tabela + triggers | `supabase/push_subscriptions.sql` |
| Envio | `supabase/functions/send-push/index.ts` |

## Passo a passo

### 1. Ícones do PWA (necessário p/ instalar no iPhone)

Adicione em `public/icons/`:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `badge-72.png` (72×72, monocromático — badge Android)

### 2. Gerar as chaves VAPID

```bash
npx web-push generate-vapid-keys
```

Guarde a **public** e a **private** key.

### 3. Variável de ambiente do front (Vercel + `.env`)

```
VITE_VAPID_PUBLIC_KEY=<public key>
```

Redeploy depois de adicionar.

### 4. Criar a tabela e os triggers

Rode `supabase/push_subscriptions.sql` no SQL Editor do Supabase.

### 5. Deploy da Edge Function

```bash
supabase functions deploy send-push --no-verify-jwt

supabase secrets set \
  VAPID_PUBLIC_KEY=<public key> \
  VAPID_PRIVATE_KEY=<private key> \
  VAPID_SUBJECT=mailto:alf.rodrigo@gmail.com
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente.

### 6. Apontar os triggers para a função

No SQL Editor (substitua os valores):

```sql
alter database postgres
  set app.settings.edge_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push';
alter database postgres
  set app.settings.service_key = '<SERVICE_ROLE_KEY>';
```

> Os triggers usam `pg_net`. Se preferir a UI, dá pra trocar por **Database
> Webhooks** (Database → Webhooks) — uma por tabela (`questions`,
> `photo_challenges`, `photo_submissions`), todas apontando para `send-push`.
> Nesse caso, os `create trigger` do SQL ficam desnecessários.

### 7. Testar

1. Abra o app (HTTPS — em dev, `localhost` também serve), perfil → **Ativar**.
2. Aceite a permissão.
3. Em outra conta/navegador, crie uma pergunta.
4. A notificação deve chegar.

Logs da função: `supabase functions logs send-push`.

## Notas

- O criador do conteúdo **não** recebe notificação do próprio post.
- Endpoints mortos (HTTP 410/404) são removidos automaticamente no envio.
- iPhone: sem "Adicionar à Tela de Início" o navegador nem expõe a API — o
  toggle mostra um aviso nesse caso.
