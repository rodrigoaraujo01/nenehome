-- nenehome — World Cup 2026 Bolao schema
-- Run AFTER nenecoins.sql and achievements.sql

-- ─────────────────────────────────────────────
-- Update nenecoins_ledger tx_type constraint
-- ─────────────────────────────────────────────
alter table nenecoins_ledger drop constraint if exists nenecoins_ledger_tx_type_check;
alter table nenecoins_ledger add constraint nenecoins_ledger_tx_type_check
  check (tx_type in (
    'initial', 'weekly_bonus', 'points_conversion',
    'bet_placed', 'bet_won', 'bet_refund',
    'gift_sent', 'gift_received',
    'fire_conversion_out', 'fire_conversion_in',
    'wc_bet_placed', 'wc_bet_won', 'wc_bet_refund', 'wc_bet_clawback'
  ));

-- ─────────────────────────────────────────────
-- wc_matches
-- ─────────────────────────────────────────────
create table if not exists wc_matches (
  id              uuid primary key default gen_random_uuid(),
  match_number    integer not null,
  stage           text not null check (stage in (
                    'group', 'round_of_32', 'round_of_16',
                    'quarter', 'semi', 'third_place', 'final'
                  )),
  group_name      text,
  date            timestamptz not null,
  home_team       text not null,
  away_team       text not null,
  home_code       text not null,
  away_code       text not null,
  home_flag       text not null,
  away_flag       text not null,
  home_score      integer,
  away_score      integer,
  home_penalties  integer,
  away_penalties  integer,
  status          text not null default 'scheduled'
                    check (status in ('scheduled', 'live', 'finished')),
  created_at      timestamptz not null default now()
);

alter table wc_matches enable row level security;
drop policy if exists "wc_matches: authenticated can read" on wc_matches;
create policy "wc_matches: authenticated can read"
  on wc_matches for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- wc_predictions
-- ─────────────────────────────────────────────
create table if not exists wc_predictions (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references wc_matches(id) on delete cascade,
  user_id         uuid not null references profiles(id),
  home_score      integer not null,
  away_score      integer not null,
  coins_wagered   integer not null default 0,
  points_earned   integer,
  coins_won       integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (match_id, user_id)
);

alter table wc_predictions enable row level security;
drop policy if exists "wc_predictions: authenticated can read" on wc_predictions;
create policy "wc_predictions: authenticated can read"
  on wc_predictions for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- View: wc_leaderboard
-- ─────────────────────────────────────────────
create or replace view wc_leaderboard as
select
  p.user_id,
  pr.nickname,
  pr.name,
  pr.avatar_url,
  pr.couple_group,
  coalesce(sum(p.points_earned), 0)::integer as total_points,
  count(p.id)::integer as predictions_count,
  count(case when p.points_earned = 25 then 1 end)::integer as exact_scores
from wc_predictions p
join profiles pr on pr.id = p.user_id
where p.points_earned is not null
group by p.user_id, pr.nickname, pr.name, pr.avatar_url, pr.couple_group;

-- ─────────────────────────────────────────────
-- Seed: World Cup achievements
-- ─────────────────────────────────────────────
insert into achievements (key, title, description, icon, points_reward, sort_order) values
  ('wc_first_prediction', 'Palpiteiro',        'Fez seu primeiro palpite na Copa',              '⚽', 5,  30),
  ('wc_oracle',           'Oráculo',           'Acertou o placar exato de um jogo',             '🔮', 15, 31),
  ('wc_streak_3',         'Em Chamas',         'Acertou o resultado de 3 jogos seguidos',       '🔥', 20, 32),
  ('wc_champion',         'Campeão do Bolão',  'Terminou em 1o lugar no bolão da Copa',         '🏆', 50, 33),
  ('wc_all_in',           'Apostador Total',   'Apostou nenecoins em todos os jogos da Copa',   '💎', 25, 34)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────
-- RPC: place_wc_prediction
-- ─────────────────────────────────────────────
create or replace function place_wc_prediction(
  p_match_id    uuid,
  p_home_score  integer,
  p_away_score  integer,
  p_coins       integer default 0
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id     uuid := auth.uid();
  v_match       wc_matches%rowtype;
  v_existing    wc_predictions%rowtype;
  v_balance     integer;
  v_old_wager   integer;
  v_pred_id     uuid;
  v_achs        json[] := '{}';
  v_a           json;
begin
  select * into v_match from wc_matches where id = p_match_id;
  if not found then
    return json_build_object('error', 'Jogo não encontrado');
  end if;

  if v_match.status != 'scheduled' then
    return json_build_object('error', 'Jogo já começou');
  end if;

  if now() > v_match.date - interval '10 minutes' then
    return json_build_object('error', 'Palpites encerrados (menos de 10 min pro jogo)');
  end if;

  if p_home_score < 0 or p_away_score < 0 then
    return json_build_object('error', 'Placar inválido');
  end if;

  if p_coins < 0 then
    return json_build_object('error', 'Aposta inválida');
  end if;

  select * into v_existing
  from wc_predictions
  where match_id = p_match_id and user_id = v_user_id;

  v_old_wager := coalesce(v_existing.coins_wagered, 0);

  -- Handle coin changes
  if p_coins != v_old_wager then
    -- Refund old wager if any
    if v_old_wager > 0 then
      insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
      values (v_user_id, v_old_wager, 'nenecoin', 'wc_bet_refund', p_match_id,
        'Reembolso palpite: ' || v_match.home_team || ' x ' || v_match.away_team);
    end if;

    -- Deduct new wager if any
    if p_coins > 0 then
      select coalesce(sum(amount), 0) into v_balance
      from nenecoins_ledger where user_id = v_user_id and coin_type = 'nenecoin';

      if v_balance < p_coins then
        -- Re-deduct old wager since we already refunded
        if v_old_wager > 0 then
          insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
          values (v_user_id, -v_old_wager, 'nenecoin', 'wc_bet_placed', p_match_id,
            'Re-aposta: ' || v_match.home_team || ' x ' || v_match.away_team);
        end if;
        return json_build_object('error', 'Nenecoins insuficientes');
      end if;

      insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
      values (v_user_id, -p_coins, 'nenecoin', 'wc_bet_placed', p_match_id,
        'Palpite Copa: ' || v_match.home_team || ' x ' || v_match.away_team);
    end if;
  end if;

  -- Upsert prediction
  if v_existing.id is not null then
    update wc_predictions
    set home_score = p_home_score,
        away_score = p_away_score,
        coins_wagered = p_coins
    where id = v_existing.id
    returning id into v_pred_id;
  else
    insert into wc_predictions (match_id, user_id, home_score, away_score, coins_wagered)
    values (p_match_id, v_user_id, p_home_score, p_away_score, p_coins)
    returning id into v_pred_id;

    v_a := grant_achievement(v_user_id, 'wc_first_prediction');
    if v_a is not null then v_achs := v_achs || v_a; end if;
  end if;

  -- Update activity
  insert into nenecoins_state (user_id, last_activity_at)
  values (v_user_id, now())
  on conflict (user_id) do update set last_activity_at = now();

  return json_build_object('prediction_id', v_pred_id, 'achievements', to_json(v_achs));
end;
$$;

-- ─────────────────────────────────────────────
-- Helper: calculate prediction score
-- ─────────────────────────────────────────────
create or replace function calc_wc_prediction_score(
  pred_home integer, pred_away integer,
  real_home integer, real_away integer
)
returns integer
language plpgsql
immutable
as $$
begin
  -- Exact score
  if pred_home = real_home and pred_away = real_away then
    return 25;
  end if;

  -- Correct winner + winner's goals
  if (pred_home > pred_away and real_home > real_away and pred_home = real_home) or
     (pred_home < pred_away and real_home < real_away and pred_away = real_away) then
    return 18;
  end if;

  -- Correct winner + goal difference
  if (pred_home > pred_away and real_home > real_away and pred_home - pred_away = real_home - real_away) or
     (pred_home < pred_away and real_home < real_away and pred_home - pred_away = real_home - real_away) then
    return 15;
  end if;

  -- Correct winner + loser's goals
  if (pred_home > pred_away and real_home > real_away and pred_away = real_away) or
     (pred_home < pred_away and real_home < real_away and pred_home = real_home) then
    return 12;
  end if;

  -- Correct result (W/D/L)
  if (pred_home > pred_away and real_home > real_away) or
     (pred_home < pred_away and real_home < real_away) or
     (pred_home = pred_away and real_home = real_away) then
    return 10;
  end if;

  return 0;
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: score_wc_match
-- Admin-only: updates match result and scores all predictions
-- ─────────────────────────────────────────────
create or replace function score_wc_match(
  p_match_id    uuid,
  p_home_score  integer,
  p_away_score  integer,
  p_status      text default 'finished'
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id     uuid := auth.uid();
  v_user_email  text;
  v_match       wc_matches%rowtype;
  v_pred        wc_predictions%rowtype;
  v_points      integer;
  v_multiplier  numeric;
  v_payout      integer;
  v_scored      integer := 0;
begin
  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email != 'alf.rodrigo@gmail.com' then
    return json_build_object('error', 'Apenas o admin pode atualizar placares');
  end if;

  select * into v_match from wc_matches where id = p_match_id;
  if not found then
    return json_build_object('error', 'Jogo não encontrado');
  end if;

  -- Only allow finishing after expected end time (kickoff + 105 min)
  if p_status = 'finished' and now() < v_match.date + interval '105 minutes' then
    return json_build_object('error', 'Jogo ainda não terminou — aguarde pelo menos 1h45 após o início');
  end if;

  -- Update match
  update wc_matches
  set home_score = p_home_score,
      away_score = p_away_score,
      status = p_status
  where id = p_match_id;

  -- Score predictions only when match is finished
  if p_status = 'finished' then
    for v_pred in
      select * from wc_predictions where match_id = p_match_id
    loop
      v_points := calc_wc_prediction_score(
        v_pred.home_score, v_pred.away_score,
        p_home_score, p_away_score
      );

      -- Coin multiplier
      v_payout := 0;
      if v_pred.coins_wagered > 0 then
        v_multiplier := case v_points
          when 25 then 5.0
          when 18 then 3.0
          when 15 then 2.5
          when 12 then 2.0
          when 10 then 1.5
          else 0
        end;
        v_payout := floor(v_pred.coins_wagered * v_multiplier)::integer;

        if v_payout > 0 then
          insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
          values (v_pred.user_id, v_payout, 'nenecoin', 'wc_bet_won', p_match_id,
            'Ganhou Copa: ' || v_match.home_team || ' x ' || v_match.away_team ||
            ' (' || v_points || 'pts, ' || v_multiplier || 'x)');
        end if;
      end if;

      update wc_predictions
      set points_earned = v_points, coins_won = v_payout
      where id = v_pred.id;

      -- Achievement: exact score
      if v_points = 25 then
        perform grant_achievement(v_pred.user_id, 'wc_oracle');
      end if;

      v_scored := v_scored + 1;
    end loop;
  end if;

  return json_build_object(
    'match_id', p_match_id,
    'status', p_status,
    'predictions_scored', v_scored
  );
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: revert_wc_match
-- Admin-only: undoes a finished match, reverting scores and coin payouts
-- ─────────────────────────────────────────────
create or replace function revert_wc_match(p_match_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id     uuid := auth.uid();
  v_user_email  text;
  v_match       wc_matches%rowtype;
  v_pred        wc_predictions%rowtype;
begin
  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email != 'alf.rodrigo@gmail.com' then
    return json_build_object('error', 'Apenas o admin pode reverter jogos');
  end if;

  select * into v_match from wc_matches where id = p_match_id;
  if not found then
    return json_build_object('error', 'Jogo não encontrado');
  end if;

  if v_match.status != 'finished' then
    return json_build_object('error', 'Jogo não está finalizado');
  end if;

  -- Reverse coin payouts for each prediction
  for v_pred in
    select * from wc_predictions where match_id = p_match_id
  loop
    if v_pred.coins_won > 0 then
      insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
      values (v_pred.user_id, -v_pred.coins_won, 'nenecoin', 'wc_bet_clawback', p_match_id,
        'Reverte Copa: ' || v_match.home_team || ' x ' || v_match.away_team);
    end if;

    update wc_predictions
    set points_earned = null, coins_won = 0
    where id = v_pred.id;
  end loop;

  -- Reset match to scheduled
  update wc_matches
  set home_score = null,
      away_score = null,
      status = 'scheduled'
  where id = p_match_id;

  return json_build_object('match_id', p_match_id, 'status', 'scheduled');
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: finalize_wc_tournament
-- Grants bonus points to main leaderboard
-- ─────────────────────────────────────────────
create or replace function finalize_wc_tournament()
returns json
language plpgsql
security definer
as $$
declare
  v_user_id    uuid := auth.uid();
  v_user_email text;
  v_entry      record;
  v_rank       integer := 0;
  v_bonus      integer;
begin
  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email != 'alf.rodrigo@gmail.com' then
    return json_build_object('error', 'Apenas o admin pode finalizar o torneio');
  end if;

  for v_entry in
    select user_id, coalesce(sum(points_earned), 0) as total
    from wc_predictions
    where points_earned is not null
    group by user_id
    order by total desc
  loop
    v_rank := v_rank + 1;
    v_bonus := case
      when v_rank = 1 then 100
      when v_rank = 2 then 75
      when v_rank = 3 then 50
      else 25
    end;

    insert into points_log (user_id, amount, reason, ref_id)
    values (v_entry.user_id, v_bonus, 'wc_tournament_bonus', null);

    if v_rank = 1 then
      perform grant_achievement(v_entry.user_id, 'wc_champion');
    end if;
  end loop;

  return json_build_object('ranked', v_rank);
end;
$$;
