-- nenehome — Power-up "Robin Hood" (revanche coletiva / raid)
-- Run AFTER powerups.sql, cosmetics.sql, nenecoins.sql, achievements.sql.
--
-- Robin Hood é o primeiro power-up COLETIVO: em vez de um efeito instantâneo de
-- um jogador, ele abre uma "revanche" (lobby) que precisa de 4 membros para
-- disparar. Cada participante gasta 1 token 'robin_hood' (comprado na loja).
-- Quando o 4º entra, a revanche dispara na hora sobre TODOS os saldos do grupo:
--   • média do grupo = avg(saldo de nenecoins dos adultos)
--   • quem está ACIMA da média paga 25% do que tem acima dela (inclusive os
--     próprios participantes — não há isenção)
--   • esse bolo é redistribuído para quem está ABAIXO da média,
--     proporcionalmente ao quanto cada um está abaixo (quem é mais pobre, ganha
--     mais)
-- Limite: 1 revanche por semana (America/Sao_Paulo, semana começa na segunda),
-- válido para o grupo todo.

-- ─────────────────────────────────────────────
-- nenecoins_ledger tx_type: add robin hood tx types
-- ─────────────────────────────────────────────
alter table nenecoins_ledger drop constraint if exists nenecoins_ledger_tx_type_check;
alter table nenecoins_ledger add constraint nenecoins_ledger_tx_type_check
  check (tx_type in (
    'initial', 'weekly_bonus', 'points_conversion',
    'bet_placed', 'bet_won', 'bet_refund',
    'gift_sent', 'gift_received',
    'fire_conversion_out', 'fire_conversion_in',
    'wc_bet_placed', 'wc_bet_won', 'wc_bet_refund', 'wc_bet_clawback',
    'powerup_purchase', 'question_bet_placed', 'question_bet_won',
    'cosmetic_purchase',
    'robin_hood_taxed', 'robin_hood_payout'
  ));

-- ─────────────────────────────────────────────
-- Catálogo: token Robin Hood
-- ─────────────────────────────────────────────
insert into powerups (key, title, description, price, icon, sort) values
  ('robin_hood', 'Robin Hood',
   'Revanche coletiva: junte 4 membros e tire 25% da fortuna de quem está acima da média do grupo pra dividir entre quem está abaixo. 1 token por participante · 1 revanche por semana.',
   40, '🏹', 3)
on conflict (key) do update set
  title = excluded.title, description = excluded.description,
  price = excluded.price, icon = excluded.icon, sort = excluded.sort;

-- ─────────────────────────────────────────────
-- Conquista
-- ─────────────────────────────────────────────
insert into achievements (key, title, description, icon, points_reward, sort_order) values
  ('robin_hood_raid', 'Robin Hood',
   'Participou de uma revanche que tirou dos ricos pra dar aos pobres', '🏹', 10, 28)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────
-- robin_hood_raids — o lobby/evento da revanche
--   status: open (juntando gente) · fired (disparou) · expired (venceu sem 4)
--   week_start: segunda-feira (America/Sao_Paulo) da semana — trava semanal
--   result: snapshot json do que aconteceu (para exibir no reveal)
-- ─────────────────────────────────────────────
create table if not exists robin_hood_raids (
  id           uuid primary key default gen_random_uuid(),
  initiator_id uuid not null references profiles(id),
  status       text not null default 'open' check (status in ('open', 'fired', 'expired')),
  week_start   date not null,
  expires_at   timestamptz not null,
  fired_at     timestamptz,
  result       jsonb,
  created_at   timestamptz not null default now()
);

alter table robin_hood_raids enable row level security;
drop policy if exists "robin_hood_raids: authenticated can read" on robin_hood_raids;
create policy "robin_hood_raids: authenticated can read"
  on robin_hood_raids for select using (auth.role() = 'authenticated');

-- No máximo uma revanche aberta por vez (grupo pequeno; um lobby só).
create unique index if not exists robin_hood_one_open
  on robin_hood_raids ((status)) where status = 'open';

-- ─────────────────────────────────────────────
-- robin_hood_participants — quem entrou (1 por pessoa por raid)
-- ─────────────────────────────────────────────
create table if not exists robin_hood_participants (
  id         uuid primary key default gen_random_uuid(),
  raid_id    uuid not null references robin_hood_raids(id) on delete cascade,
  user_id    uuid not null references profiles(id),
  joined_at  timestamptz not null default now(),
  unique (raid_id, user_id)
);

alter table robin_hood_participants enable row level security;
drop policy if exists "robin_hood_participants: authenticated can read" on robin_hood_participants;
create policy "robin_hood_participants: authenticated can read"
  on robin_hood_participants for select using (auth.role() = 'authenticated');

-- Quórum necessário para disparar.
create or replace function robin_hood_quorum()
returns integer language sql immutable as $$ select 4 $$;

-- Início da semana atual (segunda 00:00, America/Sao_Paulo) como date.
create or replace function robin_hood_week_start()
returns date language sql stable as $$
  select (date_trunc('week', (now() at time zone 'America/Sao_Paulo')))::date;
$$;

-- ─────────────────────────────────────────────
-- fire_robin_hood_raid — executa a redistribuição e fecha o raid.
-- Interno (chamado por commit_robin_hood_raid quando bate o quórum).
-- ─────────────────────────────────────────────
create or replace function fire_robin_hood_raid(p_raid_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_avg       numeric;
  v_pool      int;
  v_total_def numeric;
  v_remainder int;
  v_result    json;
  v_part      record;
begin
  -- saldos de todos os adultos (0 se nunca movimentou)
  drop table if exists rh_bals;
  create temporary table rh_bals as
    select p.id, p.nickname,
           coalesce(sum(nl.amount) filter (where nl.coin_type = 'nenecoin'), 0)::int as bal,
           0::int     as tax,
           0::numeric as deficit,
           0::int     as payout
    from profiles p
    left join nenecoins_ledger nl on nl.user_id = p.id
    where p.role = 'adult'
    group by p.id, p.nickname;

  select avg(bal) into v_avg from rh_bals;

  -- ricos pagam 25% do que têm acima da média; pobres têm um "déficit" (peso)
  update rh_bals set tax     = floor((bal - v_avg) * 0.25)::int where bal > v_avg;
  update rh_bals set deficit = (v_avg - bal)               where bal < v_avg;

  select coalesce(sum(tax), 0)     into v_pool      from rh_bals;
  select coalesce(sum(deficit), 0) into v_total_def from rh_bals;

  if v_pool > 0 and v_total_def > 0 then
    -- reparte proporcional ao déficit (floor); sobra vai pro mais pobre
    update rh_bals set payout = floor(v_pool * deficit / v_total_def)::int where deficit > 0;
    select v_pool - coalesce(sum(payout), 0) into v_remainder from rh_bals;
    if v_remainder > 0 then
      update rh_bals set payout = payout + v_remainder
      where id = (select id from rh_bals order by deficit desc, bal asc limit 1);
    end if;

    insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
    select id, -tax, 'nenecoin', 'robin_hood_taxed', p_raid_id, 'Robin Hood: os ricos pagam 🏹'
    from rh_bals where tax > 0;

    insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
    select id, payout, 'nenecoin', 'robin_hood_payout', p_raid_id, 'Robin Hood: pros pobres 🏹'
    from rh_bals where payout > 0;
  end if;

  select json_build_object(
    'pool', v_pool,
    'avg',  round(v_avg, 1),
    'taxed', coalesce((
      select json_agg(json_build_object('nick', nickname, 'amount', tax) order by tax desc)
      from rh_bals where tax > 0), '[]'::json),
    'paid', coalesce((
      select json_agg(json_build_object('nick', nickname, 'amount', payout) order by payout desc)
      from rh_bals where payout > 0), '[]'::json)
  ) into v_result;

  update robin_hood_raids
  set status = 'fired', fired_at = now(), result = v_result
  where id = p_raid_id;

  -- conquista para os participantes da revanche
  for v_part in select user_id from robin_hood_participants where raid_id = p_raid_id loop
    perform grant_achievement(v_part.user_id, 'robin_hood_raid');
  end loop;

  drop table if exists rh_bals;

  return v_result;
end;
$$;

-- ─────────────────────────────────────────────
-- settle_expired_robin_hood_raids — sweep preguiçoso: revanches abertas que
-- venceram o prazo sem juntar 4 são expiradas e os tokens são devolvidos.
-- Idempotente. Roda na Home e ao abrir a Loja.
-- ─────────────────────────────────────────────
create or replace function settle_expired_robin_hood_raids()
returns json
language plpgsql
security definer
as $$
declare
  v_raid   record;
  v_expired int := 0;
begin
  for v_raid in
    select id from robin_hood_raids where status = 'open' and expires_at < now()
  loop
    -- devolve o token de cada participante
    insert into powerup_ledger (user_id, powerup_key, delta, reason, ref_id)
    select user_id, 'robin_hood', 1, 'refund', v_raid.id
    from robin_hood_participants where raid_id = v_raid.id;

    update robin_hood_raids set status = 'expired' where id = v_raid.id;
    v_expired := v_expired + 1;
  end loop;

  return json_build_object('expired', v_expired);
end;
$$;

-- ─────────────────────────────────────────────
-- commit_robin_hood_raid — entra na revanche aberta, ou abre uma nova se não
-- houver. Gasta 1 token. Dispara quando bate o quórum (4).
-- ─────────────────────────────────────────────
create or replace function commit_robin_hood_raid()
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_raid    robin_hood_raids%rowtype;
  v_count   int;
  v_week    date := robin_hood_week_start();
  v_quorum  int := robin_hood_quorum();
  v_result  json;
begin
  -- expira lobbies vencidos antes de olhar o estado
  perform settle_expired_robin_hood_raids();

  if powerup_qty(v_user_id, 'robin_hood') < 1 then
    return json_build_object('error', 'Você precisa de um token Robin Hood 🏹 (compre na loja)');
  end if;

  select * into v_raid from robin_hood_raids where status = 'open' limit 1;

  if found then
    -- entra na revanche em andamento
    if exists (select 1 from robin_hood_participants
               where raid_id = v_raid.id and user_id = v_user_id) then
      return json_build_object('error', 'Você já está nessa revanche');
    end if;
  else
    -- abre uma nova — respeitando a trava semanal
    if exists (select 1 from robin_hood_raids
               where status = 'fired' and week_start = v_week) then
      return json_build_object('error', 'Já rolou uma revanche esta semana');
    end if;

    insert into robin_hood_raids (initiator_id, week_start, expires_at)
    values (v_user_id, v_week, now() + interval '24 hours')
    returning * into v_raid;
  end if;

  insert into robin_hood_participants (raid_id, user_id)
  values (v_raid.id, v_user_id);

  insert into powerup_ledger (user_id, powerup_key, delta, reason, ref_id)
  values (v_user_id, 'robin_hood', -1, 'use', v_raid.id);

  insert into nenecoins_state (user_id, last_activity_at)
  values (v_user_id, now())
  on conflict (user_id) do update set last_activity_at = now();

  select count(*) into v_count from robin_hood_participants where raid_id = v_raid.id;

  if v_count >= v_quorum then
    v_result := fire_robin_hood_raid(v_raid.id);
    return json_build_object('fired', true, 'count', v_count, 'result', v_result);
  end if;

  return json_build_object(
    'joined', not (v_raid.initiator_id = v_user_id and v_count = 1),
    'opened', v_raid.initiator_id = v_user_id and v_count = 1,
    'count',  v_count,
    'quorum', v_quorum
  );
end;
$$;

-- ─────────────────────────────────────────────
-- get_robin_hood_state — estado da revanche para a Loja.
-- ─────────────────────────────────────────────
create or replace function get_robin_hood_state()
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_week    date := robin_hood_week_start();
  v_raid    robin_hood_raids%rowtype;
  v_raid_json json := null;
  v_last    robin_hood_raids%rowtype;
  v_last_json json := null;
begin
  perform settle_expired_robin_hood_raids();

  select * into v_raid from robin_hood_raids where status = 'open' limit 1;
  if found then
    v_raid_json := json_build_object(
      'id',         v_raid.id,
      'initiator',  (select nickname from profiles where id = v_raid.initiator_id),
      'expires_at', v_raid.expires_at,
      'count',      (select count(*) from robin_hood_participants where raid_id = v_raid.id),
      'participants', coalesce((
        select json_agg(pr.nickname order by rp.joined_at)
        from robin_hood_participants rp
        join profiles pr on pr.id = rp.user_id
        where rp.raid_id = v_raid.id), '[]'::json),
      'i_joined', exists (
        select 1 from robin_hood_participants
        where raid_id = v_raid.id and user_id = v_user_id)
    );
  end if;

  select * into v_last from robin_hood_raids
  where status = 'fired' order by fired_at desc limit 1;
  if found then
    v_last_json := jsonb_set(
      v_last.result::jsonb, '{fired_at}', to_jsonb(v_last.fired_at)
    )::json;
  end if;

  return json_build_object(
    'quorum',      robin_hood_quorum(),
    'my_tokens',   powerup_qty(v_user_id, 'robin_hood'),
    'week_locked', exists (select 1 from robin_hood_raids
                           where status = 'fired' and week_start = v_week),
    'raid',        v_raid_json,
    'last_result', v_last_json
  );
end;
$$;
