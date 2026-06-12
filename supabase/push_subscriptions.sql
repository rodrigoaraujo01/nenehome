-- Push notifications: browser subscriptions + triggers that fan out to the
-- `send-push` Edge Function whenever new content is created.
--
-- Run order:
--   1. This file (creates table, RLS, trigger function + triggers).
--   2. Deploy the Edge Function `send-push` (see docs/push-setup.md).
--   3. Set the two DB settings below so the trigger knows where to POST.

-- ─── Subscriptions table ────────────────────────────────────────────────────────

create table if not exists push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now()
);

create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Each member manages only their own device subscriptions. The Edge Function
-- reads them with the service role key, which bypasses RLS.
drop policy if exists "own push subscriptions: select" on push_subscriptions;
create policy "own push subscriptions: select" on push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists "own push subscriptions: insert" on push_subscriptions;
create policy "own push subscriptions: insert" on push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists "own push subscriptions: update" on push_subscriptions;
create policy "own push subscriptions: update" on push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own push subscriptions: delete" on push_subscriptions;
create policy "own push subscriptions: delete" on push_subscriptions
  for delete using (user_id = auth.uid());

-- ─── Fan-out trigger ────────────────────────────────────────────────────────────
-- Uses pg_net to POST the new row to the Edge Function. The function URL is not
-- secret, so it is hard-coded below. The service-role key is read from Supabase
-- Vault. Store it once with:
--
--   select vault.create_secret(
--     '<SERVICE_ROLE_KEY>',
--     'edge_service_key',
--     'Service role key used by the send-push trigger'
--   );
--
-- (To rotate later: select vault.update_secret(
--    (select id from vault.secrets where name = 'edge_service_key'),
--    '<NEW_SERVICE_ROLE_KEY>'); )

create extension if not exists pg_net;

create or replace function notify_new_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fn_url  text := 'https://xyzlwovifblungfegoda.supabase.co/functions/v1/send-push';
  svc_key text;
begin
  select decrypted_secret into svc_key
    from vault.decrypted_secrets
    where name = 'edge_service_key'
    limit 1;

  if svc_key is null then
    return new; -- secret not set yet; do nothing
  end if;

  perform net.http_post(
    url     := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := jsonb_build_object(
      'table',  tg_table_name,
      'record', row_to_json(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_question_created on questions;
create trigger on_question_created
  after insert on questions
  for each row execute function notify_new_content();

drop trigger if exists on_photo_challenge_created on photo_challenges;
create trigger on_photo_challenge_created
  after insert on photo_challenges
  for each row execute function notify_new_content();

drop trigger if exists on_photo_submission_created on photo_submissions;
create trigger on_photo_submission_created
  after insert on photo_submissions
  for each row execute function notify_new_content();
