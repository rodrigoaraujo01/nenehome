-- nenehome — Nenecoins & Bets schema
-- Run AFTER schema.sql, photos.sql, and achievements.sql

-- ─────────────────────────────────────────────
-- nenecoins_ledger  (all coin movements)
-- ─────────────────────────────────────────────
create table if not exists nenecoins_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id),
  amount     integer not null,
  coin_type  text not null default 'nenecoin'
               check (coin_type in ('nenecoin', 'firecoin')),
  tx_type    text not null
               check (tx_type in (
                 'initial', 'weekly_bonus', 'points_conversion',
                 'bet_placed', 'bet_won',
                 'gift_sent', 'gift_received',
                 'fire_conversion_out', 'fire_conversion_in'
               )),
  ref_id     uuid,
  note       text,
  created_at timestamptz not null default now()
);

alter table nenecoins_ledger enable row level security;
create policy "nenecoins_ledger: authenticated can read"
  on nenecoins_ledger for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- nenecoins_state  (per-user tracking)
-- ─────────────────────────────────────────────
create table if not exists nenecoins_state (
  user_id               uuid primary key references profiles(id),
  last_activity_at      timestamptz not null default now(),
  last_weekly_bonus_at  timestamptz,
  firecoin_popup_shown  boolean not null default false,
  created_at            timestamptz not null default now()
);

alter table nenecoins_state enable row level security;
create policy "nenecoins_state: user reads own"
  on nenecoins_state for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- bets
-- ─────────────────────────────────────────────
create table if not exists bets (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references profiles(id),
  title        text not null,
  description  text,
  type         text not null check (type in ('pool', 'closest_guess')),
  guess_kind   text check (guess_kind in ('date', 'number')),
  unit         text,
  deadline     timestamptz not null,
  status       text not null default 'open' check (status in ('open', 'resolved')),
  result_value text,
  resolved_by  uuid references profiles(id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table bets enable row level security;
create policy "bets: authenticated can read"
  on bets for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- bet_options  (only for pool-type bets)
-- ─────────────────────────────────────────────
create table if not exists bet_options (
  id       uuid primary key default gen_random_uuid(),
  bet_id   uuid not null references bets(id) on delete cascade,
  label    text not null,
  position integer not null default 0
);

alter table bet_options enable row level security;
create policy "bet_options: authenticated can read"
  on bet_options for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- bet_entries  (one per user per bet)
-- ─────────────────────────────────────────────
create table if not exists bet_entries (
  id            uuid primary key default gen_random_uuid(),
  bet_id        uuid not null references bets(id) on delete cascade,
  user_id       uuid not null references profiles(id),
  option_id     uuid references bet_options(id),
  guess_value   text,
  coins_wagered integer not null check (coins_wagered > 0),
  is_winner     boolean,
  coins_won     integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (bet_id, user_id)
);

alter table bet_entries enable row level security;
create policy "bet_entries: authenticated can read"
  on bet_entries for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- View: nenecoin_balances (public totals)
-- ─────────────────────────────────────────────
create or replace view nenecoin_balances as
select
  user_id,
  coalesce(sum(case when coin_type = 'nenecoin' then amount else 0 end), 0) as nenecoin_balance,
  coalesce(sum(case when coin_type = 'firecoin' then amount else 0 end), 0) as firecoin_balance
from nenecoins_ledger
group by user_id;

-- ─────────────────────────────────────────────
-- Seed: nenecoin achievements
-- ─────────────────────────────────────────────
insert into achievements (key, title, description, icon, points_reward, sort_order) values
  ('nenecoin_first_bet',  'Primeira Aposta',   'Apostou nenecoins pela primeira vez',           '🎲', 5,  20),
  ('nenecoin_first_win',  'Sortudo!',          'Venceu sua primeira aposta de nenecoins',        '🏆', 10, 21),
  ('nenecoin_high_roller','High Roller',        'Venceu um pote de 100+ nenecoins',              '💰', 20, 22),
  ('nenecoin_generous',   'Generoso',          'Deu nenecoins para outro membro',               '🎁', 5,  23),
  ('nenecoin_beloved',    'Querido',           'Recebeu nenecoins de outro membro como presente','❤️', 5,  24),
  ('nenecoin_whale',      'Baleia',            'Acumulou 500 ou mais nenecoins',                '🐋', 15, 25),
  ('nenecoin_fire',       'Aposentado',        'Suas nenecoins dormiram e viraram firecoins',    '🔥', 5,  26),
  ('nenecoin_all_in',     'All In',            'Apostou todas as suas nenecoins de uma vez',    '🎰', 10, 27)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────
-- Helper: initialize nenecoins for a user
-- ─────────────────────────────────────────────
create or replace function initialize_nenecoins(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into nenecoins_state (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  if not exists (select 1 from nenecoins_ledger where user_id = p_user_id) then
    insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, note)
    values (p_user_id, 100, 'nenecoin', 'initial', 'Saldo inicial de boas-vindas 🪙');
  end if;
end;
$$;

-- Update on_profile_created trigger to also init nenecoins
create or replace function on_profile_created()
returns trigger language plpgsql security definer as $$
begin
  perform grant_achievement(new.id, 'welcome');
  perform initialize_nenecoins(new.id);
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: get_nenecoin_balance
-- Returns balances + popup flag for current user.
-- ─────────────────────────────────────────────
create or replace function get_nenecoin_balance()
returns json
language plpgsql
security definer
as $$
declare
  v_user_id  uuid := auth.uid();
  v_nene     integer;
  v_fire     integer;
  v_state    nenecoins_state%rowtype;
begin
  select
    coalesce(sum(case when coin_type = 'nenecoin' then amount else 0 end), 0),
    coalesce(sum(case when coin_type = 'firecoin' then amount else 0 end), 0)
  into v_nene, v_fire
  from nenecoins_ledger
  where user_id = v_user_id;

  select * into v_state from nenecoins_state where user_id = v_user_id;

  return json_build_object(
    'nenecoin_balance',    v_nene,
    'firecoin_balance',    v_fire,
    'firecoin_popup_shown', coalesce(v_state.firecoin_popup_shown, true)
  );
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: claim_weekly_bonuses
-- Grants 50 coins per complete 7-day period since last bonus. Called on login.
-- ─────────────────────────────────────────────
create or replace function claim_weekly_bonuses()
returns json
language plpgsql
security definer
as $$
declare
  v_user_id    uuid := auth.uid();
  v_state      nenecoins_state%rowtype;
  v_last_bonus timestamptz;
  v_weeks      integer;
  v_total      integer;
begin
  insert into nenecoins_state (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_state from nenecoins_state where user_id = v_user_id;
  v_last_bonus := coalesce(v_state.last_weekly_bonus_at, v_state.created_at);

  -- Count complete 7-day periods elapsed since last bonus
  v_weeks := floor(extract(epoch from (now() - v_last_bonus)) / (7 * 86400))::integer;

  if v_weeks <= 0 then
    return json_build_object('bonus_received', 0, 'weeks', 0);
  end if;

  v_total := v_weeks * 50;

  insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, note)
  values (v_user_id, v_total, 'nenecoin', 'weekly_bonus',
    'Mesada dominical (' || v_weeks || 'x semanas)');

  update nenecoins_state
  set last_weekly_bonus_at = now()
  where user_id = v_user_id;

  return json_build_object('bonus_received', v_total, 'weeks', v_weeks);
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: check_firecoin_conversion
-- Converts idle nenecoins to firecoins after 3 months of inactivity.
-- ─────────────────────────────────────────────
create or replace function check_firecoin_conversion()
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_state   nenecoins_state%rowtype;
  v_balance integer;
begin
  select * into v_state from nenecoins_state where user_id = v_user_id;
  if not found then
    return json_build_object('converted', 0, 'show_popup', false);
  end if;

  if v_state.last_activity_at > now() - interval '3 months' then
    return json_build_object('converted', 0, 'show_popup', false);
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from nenecoins_ledger
  where user_id = v_user_id and coin_type = 'nenecoin';

  if v_balance <= 0 then
    return json_build_object('converted', 0, 'show_popup', false);
  end if;

  insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, note)
  values (v_user_id, -v_balance, 'nenecoin', 'fire_conversion_out',
    'Convertido em firecoins por inatividade de 3 meses');

  insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, note)
  values (v_user_id, v_balance, 'firecoin', 'fire_conversion_in',
    'Nenecoins aposentadas 🔥');

  update nenecoins_state
  set last_activity_at = now(), firecoin_popup_shown = false
  where user_id = v_user_id;

  perform grant_achievement(v_user_id, 'nenecoin_fire');

  return json_build_object('converted', v_balance, 'show_popup', true);
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: mark_firecoin_popup_shown
-- ─────────────────────────────────────────────
create or replace function mark_firecoin_popup_shown()
returns void
language plpgsql
security definer
as $$
begin
  update nenecoins_state
  set firecoin_popup_shown = true
  where user_id = auth.uid();
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: convert_points_to_nenecoins
-- Rate: 10 pts = 1 nenecoin. Minimum: 10 pts in multiples of 10.
-- ─────────────────────────────────────────────
create or replace function convert_points_to_nenecoins(p_points integer)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id   uuid := auth.uid();
  v_available integer;
  v_nenecoins integer;
  v_new_bal   integer;
begin
  if p_points < 10 or p_points % 10 != 0 then
    return json_build_object('error', 'Mínimo de 10 pontos, em múltiplos de 10');
  end if;

  select coalesce(sum(amount), 0) into v_available
  from points_log where user_id = v_user_id;

  if v_available < p_points then
    return json_build_object('error', 'Pontos insuficientes');
  end if;

  v_nenecoins := p_points / 10;

  insert into points_log (user_id, amount, reason)
  values (v_user_id, -p_points, 'nenecoin_conversion');

  insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, note)
  values (v_user_id, v_nenecoins, 'nenecoin', 'points_conversion',
    p_points || ' pontos convertidos');

  update nenecoins_state set last_activity_at = now() where user_id = v_user_id;

  select coalesce(sum(amount), 0) into v_new_bal
  from nenecoins_ledger where user_id = v_user_id and coin_type = 'nenecoin';
  if v_new_bal >= 500 then
    perform grant_achievement(v_user_id, 'nenecoin_whale');
  end if;

  return json_build_object('nenecoins_received', v_nenecoins, 'points_spent', p_points);
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: gift_nenecoins
-- ─────────────────────────────────────────────
create or replace function gift_nenecoins(
  p_to_user_id uuid,
  p_amount     integer,
  p_note       text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_from_id   uuid := auth.uid();
  v_balance   integer;
  v_to_nick   text;
  v_from_nick text;
  v_new_bal   integer;
begin
  if v_from_id = p_to_user_id then
    return json_build_object('error', 'Não pode dar moedas para si mesmo');
  end if;
  if p_amount <= 0 then
    return json_build_object('error', 'Quantidade deve ser positiva');
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from nenecoins_ledger where user_id = v_from_id and coin_type = 'nenecoin';

  if v_balance < p_amount then
    return json_build_object('error', 'Nenecoins insuficientes');
  end if;

  select nickname into v_to_nick   from profiles where id = p_to_user_id;
  select nickname into v_from_nick from profiles where id = v_from_id;

  insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
  values (v_from_id, -p_amount, 'nenecoin', 'gift_sent', p_to_user_id,
    coalesce(p_note, 'Presente para ' || v_to_nick));

  insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
  values (p_to_user_id, p_amount, 'nenecoin', 'gift_received', v_from_id,
    coalesce(p_note, 'Presente de ' || v_from_nick));

  update nenecoins_state set last_activity_at = now() where user_id = v_from_id;

  perform grant_achievement(v_from_id, 'nenecoin_generous');
  perform grant_achievement(p_to_user_id, 'nenecoin_beloved');

  select coalesce(sum(amount), 0) into v_new_bal
  from nenecoins_ledger where user_id = p_to_user_id and coin_type = 'nenecoin';
  if v_new_bal >= 500 then
    perform grant_achievement(p_to_user_id, 'nenecoin_whale');
  end if;

  return json_build_object('success', true, 'amount', p_amount, 'to', v_to_nick);
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: create_bet
-- ─────────────────────────────────────────────
create or replace function create_bet(
  p_title       text,
  p_description text        default null,
  p_type        text        default 'pool',
  p_guess_kind  text        default null,
  p_unit        text        default null,
  p_deadline    timestamptz default null,
  p_options     json        default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_bet_id  uuid;
  v_opt     json;
  v_pos     int := 0;
begin
  if p_deadline is null or p_deadline <= now() then
    return json_build_object('error', 'Prazo inválido');
  end if;

  insert into bets (creator_id, title, description, type, guess_kind, unit, deadline)
  values (v_user_id, p_title, p_description, p_type, p_guess_kind, p_unit, p_deadline)
  returning id into v_bet_id;

  if p_type = 'pool' and p_options is not null then
    for v_opt in select * from json_array_elements(p_options) loop
      insert into bet_options (bet_id, label, position)
      values (v_bet_id, v_opt->>'label', v_pos);
      v_pos := v_pos + 1;
    end loop;
  end if;

  return json_build_object('id', v_bet_id);
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: place_bet
-- ─────────────────────────────────────────────
create or replace function place_bet(
  p_bet_id      uuid,
  p_coins       integer,
  p_option_id   uuid default null,
  p_guess_value text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id  uuid := auth.uid();
  v_bet      bets%rowtype;
  v_balance  integer;
  v_entry_id uuid;
  v_achs     json[] := '{}';
  v_a        json;
begin
  select * into v_bet from bets where id = p_bet_id;
  if not found                    then return json_build_object('error', 'Aposta não encontrada'); end if;
  if v_bet.status != 'open'       then return json_build_object('error', 'Aposta já encerrada'); end if;
  if now() > v_bet.deadline       then return json_build_object('error', 'Prazo encerrado'); end if;

  if exists (select 1 from bet_entries where bet_id = p_bet_id and user_id = v_user_id) then
    return json_build_object('error', 'Você já apostou nesse bolão');
  end if;

  if p_coins < 1 then return json_build_object('error', 'Mínimo de 1 nenecoin'); end if;

  select coalesce(sum(amount), 0) into v_balance
  from nenecoins_ledger where user_id = v_user_id and coin_type = 'nenecoin';

  if v_balance < p_coins then return json_build_object('error', 'Nenecoins insuficientes'); end if;

  if v_bet.type = 'pool'          and p_option_id   is null then return json_build_object('error', 'Selecione uma opção'); end if;
  if v_bet.type = 'closest_guess' and p_guess_value is null then return json_build_object('error', 'Digite seu palpite'); end if;

  insert into bet_entries (bet_id, user_id, option_id, guess_value, coins_wagered)
  values (p_bet_id, v_user_id, p_option_id, p_guess_value, p_coins)
  returning id into v_entry_id;

  insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
  values (v_user_id, -p_coins, 'nenecoin', 'bet_placed', p_bet_id,
    'Aposta: ' || v_bet.title);

  insert into nenecoins_state (user_id, last_activity_at)
  values (v_user_id, now())
  on conflict (user_id) do update set last_activity_at = now();

  v_a := grant_achievement(v_user_id, 'nenecoin_first_bet');
  if v_a is not null then v_achs := v_achs || v_a; end if;

  if p_coins = v_balance then
    v_a := grant_achievement(v_user_id, 'nenecoin_all_in');
    if v_a is not null then v_achs := v_achs || v_a; end if;
  end if;

  return json_build_object('entry_id', v_entry_id, 'achievements', to_json(v_achs));
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: resolve_bet
-- Only the creator can resolve.
-- Pool:          p_result_value = winning option uuid (text)
-- Closest guess: p_result_value = actual value (YYYY-MM-DD for date, numeric string for number)
-- ─────────────────────────────────────────────
create or replace function resolve_bet(
  p_bet_id       uuid,
  p_result_value text
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id     uuid := auth.uid();
  v_bet         bets%rowtype;
  v_total_pot   integer;
  v_winner_count integer;
  v_per_winner  integer;
  v_remainder   integer;
  v_entry       bet_entries%rowtype;
  v_payout      integer;
  v_min_dist    numeric;
  v_new_bal     integer;
  v_first       boolean := true;
begin
  select * into v_bet from bets where id = p_bet_id;
  if not found             then return json_build_object('error', 'Aposta não encontrada'); end if;
  if v_bet.status != 'open' then return json_build_object('error', 'Aposta já resolvida'); end if;
  if v_bet.creator_id != v_user_id then
    return json_build_object('error', 'Apenas o criador pode resolver a aposta');
  end if;

  select coalesce(sum(coins_wagered), 0) into v_total_pot
  from bet_entries where bet_id = p_bet_id;

  -- Mark winners
  if v_bet.type = 'pool' then
    update bet_entries
    set is_winner = (option_id = p_result_value::uuid)
    where bet_id = p_bet_id;

  elsif v_bet.type = 'closest_guess' then
    if v_bet.guess_kind = 'date' then
      select min(abs(p_result_value::date - guess_value::date))
      into v_min_dist
      from bet_entries where bet_id = p_bet_id;

      update bet_entries
      set is_winner = (abs(p_result_value::date - guess_value::date) = v_min_dist)
      where bet_id = p_bet_id;

    else  -- number
      select min(abs(p_result_value::numeric - guess_value::numeric))
      into v_min_dist
      from bet_entries where bet_id = p_bet_id;

      update bet_entries
      set is_winner = (abs(p_result_value::numeric - guess_value::numeric) = v_min_dist)
      where bet_id = p_bet_id;
    end if;
  end if;

  select count(*) into v_winner_count
  from bet_entries where bet_id = p_bet_id and is_winner = true;

  -- Distribute pot
  if v_winner_count > 0 and v_total_pot > 0 then
    v_per_winner := v_total_pot / v_winner_count;
    v_remainder  := v_total_pot % v_winner_count;

    for v_entry in
      select * from bet_entries where bet_id = p_bet_id and is_winner = true
    loop
      v_payout := v_per_winner;
      if v_first then
        v_payout := v_payout + v_remainder;
        v_first  := false;
      end if;

      update bet_entries set coins_won = v_payout where id = v_entry.id;

      insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
      values (v_entry.user_id, v_payout, 'nenecoin', 'bet_won', p_bet_id,
        'Ganhou aposta: ' || v_bet.title);

      perform grant_achievement(v_entry.user_id, 'nenecoin_first_win');
      if v_payout >= 100 then
        perform grant_achievement(v_entry.user_id, 'nenecoin_high_roller');
      end if;

      select coalesce(sum(amount), 0) into v_new_bal
      from nenecoins_ledger where user_id = v_entry.user_id and coin_type = 'nenecoin';
      if v_new_bal >= 500 then
        perform grant_achievement(v_entry.user_id, 'nenecoin_whale');
      end if;
    end loop;
  end if;

  update bets
  set status = 'resolved', result_value = p_result_value,
      resolved_by = v_user_id, resolved_at = now()
  where id = p_bet_id;

  return json_build_object('winners', v_winner_count, 'pot', v_total_pot);
end;
$$;
