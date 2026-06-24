-- nenehome — Loja de Power-ups (sink de nenecoins)
-- Run LAST, AFTER scoring_v2.sql, nenecoins.sql, worldcup.sql.
-- Redefines submit_answer and settle_question (previously in scoring_v2.sql)
-- to support assisted answers, sabotage decoys, second chance and double-or-nothing.

-- ─────────────────────────────────────────────
-- nenecoins_ledger tx_type: add powerup tx types
-- ─────────────────────────────────────────────
alter table nenecoins_ledger drop constraint if exists nenecoins_ledger_tx_type_check;
alter table nenecoins_ledger add constraint nenecoins_ledger_tx_type_check
  check (tx_type in (
    'initial', 'weekly_bonus', 'points_conversion',
    'bet_placed', 'bet_won', 'bet_refund',
    'gift_sent', 'gift_received',
    'fire_conversion_out', 'fire_conversion_in',
    'wc_bet_placed', 'wc_bet_won', 'wc_bet_refund', 'wc_bet_clawback',
    'powerup_purchase', 'powerup_payout'
  ));

-- ─────────────────────────────────────────────
-- powerups — catalog (server-authoritative pricing)
-- ─────────────────────────────────────────────
create table if not exists powerups (
  key         text primary key,
  title       text not null,
  description text not null,
  price       integer not null check (price > 0),
  icon        text not null,
  active      boolean not null default true,
  sort        integer not null default 0
);

alter table powerups enable row level security;
drop policy if exists "powerups: authenticated can read" on powerups;
create policy "powerups: authenticated can read"
  on powerups for select using (auth.role() = 'authenticated');

insert into powerups (key, title, description, price, icon, sort) values
  ('eliminate',        'Eliminar Alternativa', 'Remove uma alternativa errada de uma pergunta de múltipla escolha antes de responder. 1 por pergunta.', 30, '✂️', 1),
  ('second_chance',    'Segunda Chance',       'Errou? Descarta a tentativa e deixa você responder de novo, uma vez.',                                 40, '🔁', 2),
  ('double_or_nothing','Dobro ou Nada',        'Aposte: se sua resposta estiver certa, ganha nenecoins; se errar, perde o token.',                    25, '🎲', 3),
  ('sabotage',         'Sabotagem',            'Injeta uma 5ª alternativa falsa (escrita por você) numa pergunta, só para um alvo que ainda não respondeu.', 80, '😈', 4),
  ('wc_reveal',        'Revelar Distribuição', 'Revela a distribuição anônima dos palpites do grupo num jogo da Copa antes do fechamento.',            35, '🔭', 5)
on conflict (key) do update set
  title = excluded.title, description = excluded.description,
  price = excluded.price, icon = excluded.icon, sort = excluded.sort;

-- ─────────────────────────────────────────────
-- powerup_ledger — inventory as a derived ledger (mirrors nenecoins)
-- qty(user, key) = sum(delta)
-- ─────────────────────────────────────────────
create table if not exists powerup_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id),
  powerup_key  text not null references powerups(key),
  delta        integer not null,
  reason       text not null check (reason in ('purchase', 'use', 'refund')),
  ref_id       uuid,
  created_at   timestamptz not null default now()
);

alter table powerup_ledger enable row level security;
drop policy if exists "powerup_ledger: owner reads own" on powerup_ledger;
create policy "powerup_ledger: owner reads own"
  on powerup_ledger for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- question_assists — records power-ups used on a question by a user.
-- kind in eliminate/second_chance counts as "assisted" (excluded from difficulty).
-- double_or_nothing is a coin bet, resolved at settle (not assisted).
-- ─────────────────────────────────────────────
create table if not exists question_assists (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  user_id     uuid not null references profiles(id),
  kind        text not null check (kind in ('eliminate', 'second_chance', 'double_or_nothing')),
  meta        jsonb,
  created_at  timestamptz not null default now(),
  unique (question_id, user_id, kind)
);

alter table question_assists enable row level security;
drop policy if exists "question_assists: owner reads own" on question_assists;
create policy "question_assists: owner reads own"
  on question_assists for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- question_sabotages — a fake 5th option injected for one target.
-- NOT readable by the target (decoy delivered via get_question_sabotage RPC
-- so its "fake" nature isn't leaked); the saboteur can read their own.
-- ─────────────────────────────────────────────
create table if not exists question_sabotages (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references questions(id) on delete cascade,
  target_user_id  uuid not null references profiles(id),
  saboteur_id     uuid not null references profiles(id),
  decoy_text      text not null,
  hit             boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (question_id, target_user_id)
);

alter table question_sabotages enable row level security;
drop policy if exists "question_sabotages: saboteur reads own" on question_sabotages;
create policy "question_sabotages: saboteur reads own"
  on question_sabotages for select using (auth.uid() = saboteur_id);

-- ─────────────────────────────────────────────
-- wc_distribution_reveals — records that a user unlocked a match's distribution
-- ─────────────────────────────────────────────
create table if not exists wc_distribution_reveals (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references wc_matches(id) on delete cascade,
  revealer_id  uuid not null references profiles(id),
  created_at   timestamptz not null default now(),
  unique (match_id, revealer_id)
);

alter table wc_distribution_reveals enable row level security;
drop policy if exists "wc_distribution_reveals: owner reads own" on wc_distribution_reveals;
create policy "wc_distribution_reveals: owner reads own"
  on wc_distribution_reveals for select using (auth.uid() = revealer_id);

-- ─────────────────────────────────────────────
-- answers.assisted — flags answers that used eliminate/second_chance,
-- so they don't distort the difficulty %-correct.
-- ─────────────────────────────────────────────
alter table answers add column if not exists assisted boolean not null default false;

-- ─────────────────────────────────────────────
-- Helper: current inventory quantity of a power-up for a user
-- ─────────────────────────────────────────────
create or replace function powerup_qty(p_user_id uuid, p_key text)
returns integer
language sql
security definer
as $$
  select coalesce(sum(delta), 0)::integer
  from powerup_ledger
  where user_id = p_user_id and powerup_key = p_key;
$$;

-- ─────────────────────────────────────────────
-- RPC: get_powerup_inventory — qty per power-up for the current user
-- ─────────────────────────────────────────────
create or replace function get_powerup_inventory()
returns json
language sql
security definer
as $$
  select coalesce(json_agg(json_build_object('powerup_key', powerup_key, 'qty', qty)), '[]'::json)
  from (
    select powerup_key, sum(delta)::integer as qty
    from powerup_ledger
    where user_id = auth.uid()
    group by powerup_key
    having sum(delta) > 0
  ) t;
$$;

-- ─────────────────────────────────────────────
-- RPC: buy_powerup
-- ─────────────────────────────────────────────
create or replace function buy_powerup(p_key text, p_qty integer)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_pw      powerups%rowtype;
  v_cost    integer;
  v_balance integer;
  v_new_bal integer;
begin
  if p_qty is null or p_qty < 1 then
    return json_build_object('error', 'Quantidade inválida');
  end if;

  select * into v_pw from powerups where key = p_key and active = true;
  if not found then
    return json_build_object('error', 'Power-up indisponível');
  end if;

  v_cost := v_pw.price * p_qty;

  select coalesce(sum(amount), 0) into v_balance
  from nenecoins_ledger where user_id = v_user_id and coin_type = 'nenecoin';

  if v_balance < v_cost then
    return json_build_object('error', 'Nenecoins insuficientes');
  end if;

  insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, note)
  values (v_user_id, -v_cost, 'nenecoin', 'powerup_purchase',
    'Loja: ' || p_qty || '× ' || v_pw.title);

  insert into powerup_ledger (user_id, powerup_key, delta, reason)
  values (v_user_id, p_key, p_qty, 'purchase');

  insert into nenecoins_state (user_id, last_activity_at)
  values (v_user_id, now())
  on conflict (user_id) do update set last_activity_at = now();

  select coalesce(sum(amount), 0) into v_new_bal
  from nenecoins_ledger where user_id = v_user_id and coin_type = 'nenecoin';

  return json_build_object(
    'success', true,
    'key', p_key,
    'qty', powerup_qty(v_user_id, p_key),
    'nenecoin_balance', v_new_bal
  );
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: use_eliminate_option
-- Consumes 1 'eliminate', returns one wrong option_id to hide. Cap 1 per question.
-- ─────────────────────────────────────────────
create or replace function use_eliminate_option(p_question_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id  uuid := auth.uid();
  v_question questions%rowtype;
  v_option   uuid;
begin
  select * into v_question from questions where id = p_question_id;
  if not found then return json_build_object('error', 'Pergunta não encontrada'); end if;
  if v_question.type != 'multiple_choice' then
    return json_build_object('error', 'Só funciona em múltipla escolha');
  end if;
  if v_question.status = 'closed' then return json_build_object('error', 'Pergunta encerrada'); end if;
  if v_user_id = v_question.creator_id then
    return json_build_object('error', 'O criador não responde a própria pergunta');
  end if;
  if exists (select 1 from answers where question_id = p_question_id and user_id = v_user_id) then
    return json_build_object('error', 'Você já respondeu');
  end if;
  if exists (select 1 from question_assists
             where question_id = p_question_id and user_id = v_user_id and kind = 'eliminate') then
    return json_build_object('error', 'Você já usou eliminar nesta pergunta');
  end if;
  if powerup_qty(v_user_id, 'eliminate') < 1 then
    return json_build_object('error', 'Sem Eliminar Alternativa no inventário');
  end if;

  select id into v_option
  from question_options
  where question_id = p_question_id and is_correct = false
  order by random()
  limit 1;

  if v_option is null then
    return json_build_object('error', 'Nada para eliminar');
  end if;

  insert into question_assists (question_id, user_id, kind)
  values (p_question_id, v_user_id, 'eliminate');

  insert into powerup_ledger (user_id, powerup_key, delta, reason, ref_id)
  values (v_user_id, 'eliminate', -1, 'use', p_question_id);

  return json_build_object('option_id', v_option, 'qty', powerup_qty(v_user_id, 'eliminate'));
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: deploy_sabotage
-- ─────────────────────────────────────────────
create or replace function deploy_sabotage(
  p_question_id    uuid,
  p_target_user_id uuid,
  p_decoy_text     text
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id  uuid := auth.uid();
  v_question questions%rowtype;
  v_target   profiles%rowtype;
begin
  if p_decoy_text is null or btrim(p_decoy_text) = '' then
    return json_build_object('error', 'Escreva a alternativa falsa');
  end if;

  select * into v_question from questions where id = p_question_id;
  if not found then return json_build_object('error', 'Pergunta não encontrada'); end if;
  if v_question.type != 'multiple_choice' then
    return json_build_object('error', 'Só funciona em múltipla escolha');
  end if;
  if v_question.status = 'closed' then return json_build_object('error', 'Pergunta encerrada'); end if;

  if p_target_user_id = v_user_id then
    return json_build_object('error', 'Não pode sabotar a si mesmo');
  end if;

  select * into v_target from profiles where id = p_target_user_id;
  if not found or v_target.role != 'adult' then
    return json_build_object('error', 'Alvo inválido');
  end if;
  if p_target_user_id = v_question.creator_id then
    return json_build_object('error', 'O criador não responde a própria pergunta');
  end if;
  if exists (select 1 from answers where question_id = p_question_id and user_id = p_target_user_id) then
    return json_build_object('error', 'O alvo já respondeu');
  end if;
  if exists (select 1 from question_sabotages where question_id = p_question_id and target_user_id = p_target_user_id) then
    return json_build_object('error', 'Esse alvo já foi sabotado nesta pergunta');
  end if;
  if powerup_qty(v_user_id, 'sabotage') < 1 then
    return json_build_object('error', 'Sem Sabotagem no inventário');
  end if;

  insert into question_sabotages (question_id, target_user_id, saboteur_id, decoy_text)
  values (p_question_id, p_target_user_id, v_user_id, btrim(p_decoy_text));

  insert into powerup_ledger (user_id, powerup_key, delta, reason, ref_id)
  values (v_user_id, 'sabotage', -1, 'use', p_question_id);

  return json_build_object('success', true, 'qty', powerup_qty(v_user_id, 'sabotage'));
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: get_question_sabotage — decoy targeting the current user (or null)
-- ─────────────────────────────────────────────
create or replace function get_question_sabotage(p_question_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_sab     question_sabotages%rowtype;
begin
  select * into v_sab from question_sabotages
  where question_id = p_question_id and target_user_id = v_user_id;
  if not found then return null; end if;
  -- Não entrega para quem já respondeu (a opção só importa antes de responder)
  if exists (select 1 from answers where question_id = p_question_id and user_id = v_user_id) then
    return null;
  end if;
  return json_build_object('id', v_sab.id, 'text', v_sab.decoy_text);
end;
$$;

-- ─────────────────────────────────────────────
-- Helper: anonymous aggregate of a match's current predictions
-- ─────────────────────────────────────────────
create or replace function wc_match_distribution(p_match_id uuid)
returns json
language sql
security definer
as $$
  with preds as (
    select home_score, away_score from wc_predictions where match_id = p_match_id
  )
  select json_build_object(
    'total',    (select count(*) from preds),
    'home_win', (select count(*) from preds where home_score > away_score),
    'draw',     (select count(*) from preds where home_score = away_score),
    'away_win', (select count(*) from preds where home_score < away_score),
    'scorelines', coalesce((
      select json_agg(s) from (
        select (home_score || '-' || away_score) as score, count(*)::integer as count
        from preds
        group by home_score, away_score
        order by count(*) desc, home_score desc
        limit 5
      ) s
    ), '[]'::json)
  );
$$;

-- ─────────────────────────────────────────────
-- RPC: reveal_wc_distribution — consume token, unlock + return aggregate
-- ─────────────────────────────────────────────
create or replace function reveal_wc_distribution(p_match_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_match   wc_matches%rowtype;
begin
  select * into v_match from wc_matches where id = p_match_id;
  if not found then return json_build_object('error', 'Jogo não encontrado'); end if;
  if v_match.status != 'scheduled' or now() > v_match.date - interval '10 minutes' then
    return json_build_object('error', 'A distribuição já é pública (palpites fechados)');
  end if;

  if exists (select 1 from wc_distribution_reveals where match_id = p_match_id and revealer_id = v_user_id) then
    return json_build_object('error', 'Você já revelou este jogo');
  end if;
  if powerup_qty(v_user_id, 'wc_reveal') < 1 then
    return json_build_object('error', 'Sem Revelar Distribuição no inventário');
  end if;

  insert into wc_distribution_reveals (match_id, revealer_id)
  values (p_match_id, v_user_id);

  insert into powerup_ledger (user_id, powerup_key, delta, reason, ref_id)
  values (v_user_id, 'wc_reveal', -1, 'use', p_match_id);

  return json_build_object('distribution', wc_match_distribution(p_match_id), 'qty', powerup_qty(v_user_id, 'wc_reveal'));
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: get_wc_distribution — returns aggregate if already revealed, else null
-- ─────────────────────────────────────────────
create or replace function get_wc_distribution(p_match_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not exists (select 1 from wc_distribution_reveals where match_id = p_match_id and revealer_id = v_user_id) then
    return null;
  end if;
  return wc_match_distribution(p_match_id);
end;
$$;

-- ═════════════════════════════════════════════
-- submit_answer (redefinido) — suporta sabotagem, segunda chance, dobro ou nada,
-- e marca respostas assistidas.
-- ═════════════════════════════════════════════
create or replace function submit_answer(
  p_question_id          uuid,
  p_selected_option_id   uuid    default null,
  p_subject_guess_id     text    default null,
  p_use_second_chance    boolean default false,
  p_use_double_or_nothing boolean default false,
  p_sabotage_option_id   uuid    default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id      uuid := auth.uid();
  v_question     questions%rowtype;
  v_is_correct   boolean := false;
  v_is_decoy     boolean := false;
  v_assisted     boolean := false;
  v_answer_id    uuid;
  v_count        int;
  v_answer_count int;
  v_eligible     int;
  v_achievements json[] := '{}';
  v_a            json;
begin
  select * into v_question from questions where id = p_question_id;
  if not found then raise exception 'question not found'; end if;
  if v_question.status = 'closed' then raise exception 'question is closed'; end if;
  if v_user_id = v_question.creator_id then raise exception 'creator cannot answer own question'; end if;

  -- O alvo escolheu a alternativa-decoy da sabotagem? (sempre errada)
  if p_sabotage_option_id is not null then
    if exists (
      select 1 from question_sabotages
      where id = p_sabotage_option_id
        and question_id = p_question_id
        and target_user_id = v_user_id
    ) then
      v_is_decoy   := true;
      v_is_correct := false;
    end if;
  end if;

  -- Correção normal (se não foi a decoy)
  if not v_is_decoy then
    if v_question.type = 'multiple_choice' then
      select coalesce(is_correct, false) into v_is_correct
        from question_options
        where id = p_selected_option_id and question_id = p_question_id;
      if not found then v_is_correct := false; end if;
    elsif v_question.type = 'story' then
      v_is_correct := coalesce(p_subject_guess_id = v_question.subject_id, false);
    end if;
  end if;

  -- Segunda Chance: errou + tem token + ainda não usou → descarta a tentativa
  -- (não persiste, não liquida) e libera nova resposta.
  if not v_is_correct and p_use_second_chance
     and powerup_qty(v_user_id, 'second_chance') >= 1
     and not exists (
       select 1 from question_assists
       where question_id = p_question_id and user_id = v_user_id and kind = 'second_chance'
     )
  then
    insert into question_assists (question_id, user_id, kind)
    values (p_question_id, v_user_id, 'second_chance');
    insert into powerup_ledger (user_id, powerup_key, delta, reason, ref_id)
    values (v_user_id, 'second_chance', -1, 'use', p_question_id);
    return json_build_object('is_correct', false, 'retry_granted', true, 'pending', true, 'achievements', '[]'::json);
  end if;

  -- assistida (p/ excluir do cálculo de dificuldade): usou eliminate/second_chance
  v_assisted := exists (
    select 1 from question_assists
    where question_id = p_question_id and user_id = v_user_id
      and kind in ('eliminate', 'second_chance')
  );

  insert into answers (question_id, user_id, selected_option_id, subject_guess_id, is_correct, assisted)
  values (p_question_id, v_user_id,
          case when v_is_decoy then null else p_selected_option_id end,
          p_subject_guess_id, v_is_correct, v_assisted)
  returning id into v_answer_id;

  if v_is_decoy then
    update question_sabotages set hit = true
    where id = p_sabotage_option_id and target_user_id = v_user_id;
  end if;

  -- Dobro ou Nada: aposta de coins, resolvida no settle conforme acerto
  if p_use_double_or_nothing
     and powerup_qty(v_user_id, 'double_or_nothing') >= 1
     and not exists (
       select 1 from question_assists
       where question_id = p_question_id and user_id = v_user_id and kind = 'double_or_nothing'
     )
  then
    insert into question_assists (question_id, user_id, kind)
    values (p_question_id, v_user_id, 'double_or_nothing');
    insert into powerup_ledger (user_id, powerup_key, delta, reason, ref_id)
    values (v_user_id, 'double_or_nothing', -1, 'use', p_question_id);
  end if;

  -- conquistas de contagem (pontos de acerto ficam para o settle)
  if v_is_correct then
    select count(*) into v_count from answers where user_id = v_user_id and is_correct = true;
    if v_count = 1  then v_a := grant_achievement(v_user_id, 'first_correct'); if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
    if v_count = 5  then v_a := grant_achievement(v_user_id, 'correct_5');     if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
    if v_count = 25 then v_a := grant_achievement(v_user_id, 'correct_25');    if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
    select array_cat(v_achievements, check_points_achievements(v_user_id)) into v_achievements;
  end if;

  -- liquida quando todos os elegíveis responderam
  select count(*) into v_answer_count from answers where question_id = p_question_id;
  select count(*) into v_eligible
    from profiles
    where role = 'adult' and id <> v_question.creator_id;
  if v_eligible > 0 and v_answer_count >= v_eligible then
    perform settle_question(p_question_id);
  end if;

  return json_build_object(
    'is_correct',    v_is_correct,
    'points_earned', 0,
    'pending',       true,
    'achievements',  to_json(v_achievements)
  );
end;
$$;

-- ═════════════════════════════════════════════
-- settle_question (redefinido) — dificuldade pelo subconjunto NÃO assistido;
-- paga Dobro ou Nada no acerto.
-- ═════════════════════════════════════════════
create or replace function settle_question(p_question_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_question     questions%rowtype;
  v_total        int;
  v_correct      int;
  v_un_total     int;
  v_un_correct   int;
  v_diff_total   int;
  v_diff_correct int;
  v_eligible     int;
  v_ratio        numeric;
  v_difficulty   text;
  v_per_pts      int := 0;
  v_don_payout   constant int := 60;  -- Dobro ou Nada (stake 25 → payout 60)
  v_ans          record;
  v_affected     uuid[];
  v_uid          uuid;
begin
  select * into v_question from questions where id = p_question_id;
  if not found then return json_build_object('settled', false); end if;
  if v_question.status = 'closed' then
    return json_build_object('settled', false, 'already', true);
  end if;

  select count(*) into v_total from answers where question_id = p_question_id;
  select count(*) into v_eligible
    from profiles where role = 'adult' and id <> v_question.creator_id;
  if v_eligible <= 0 or v_total < v_eligible then
    return json_build_object('settled', false, 'not_ready', true);
  end if;

  update questions set status = 'closed', closed_at = now() where id = p_question_id;

  select count(*) into v_correct from answers where question_id = p_question_id and is_correct = true;

  -- dificuldade: só conta respostas NÃO assistidas (fallback p/ todas se ninguém sem ajuda)
  select count(*) into v_un_total   from answers where question_id = p_question_id and assisted = false;
  select count(*) into v_un_correct from answers where question_id = p_question_id and assisted = false and is_correct = true;
  if v_un_total = 0 then
    v_diff_total := v_total;   v_diff_correct := v_correct;
  else
    v_diff_total := v_un_total; v_diff_correct := v_un_correct;
  end if;

  if v_diff_total = 0 or v_diff_correct = 0 then
    v_difficulty := 'impossible';
    v_per_pts := 0;
  else
    v_ratio := v_diff_correct::numeric / v_diff_total::numeric;
    if v_ratio <= 1.0/3.0 then
      v_difficulty := 'hard';   v_per_pts := 20;
    elsif v_ratio <= 2.0/3.0 then
      v_difficulty := 'medium'; v_per_pts := 12;
    else
      v_difficulty := 'easy';   v_per_pts := 5;
    end if;
  end if;

  update questions set difficulty = v_difficulty where id = p_question_id;

  -- pontos por acerto (por tier) — pra todos os corretos, assistidos inclusive
  if v_per_pts > 0 then
    for v_ans in
      select id, user_id from answers
      where question_id = p_question_id and is_correct = true
    loop
      insert into points_log (user_id, amount, reason, ref_id)
      values (v_ans.user_id, v_per_pts, 'correct_answer', v_ans.id);
    end loop;
  end if;

  -- ajuste do criador
  if v_difficulty = 'impossible' then
    delete from points_log where reason = 'question_created' and ref_id = p_question_id;
  elsif v_difficulty = 'hard' then
    insert into points_log (user_id, amount, reason, ref_id)
    values (v_question.creator_id, 10, 'question_hard_bonus', p_question_id);
  end if;

  -- Dobro ou Nada: paga coins a quem apostou e acertou
  for v_ans in
    select qa.user_id from question_assists qa
    join answers a on a.question_id = qa.question_id and a.user_id = qa.user_id
    where qa.question_id = p_question_id and qa.kind = 'double_or_nothing' and a.is_correct = true
  loop
    insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
    values (v_ans.user_id, v_don_payout, 'nenecoin', 'powerup_payout', p_question_id,
      'Dobro ou Nada: acertou!');
  end loop;

  -- re-checa milestones
  select array_agg(distinct uid) into v_affected from (
    select v_question.creator_id as uid
    union
    select user_id from answers where question_id = p_question_id
  ) u;
  if v_affected is not null then
    foreach v_uid in array v_affected loop
      perform check_points_achievements(v_uid);
    end loop;
  end if;

  -- notifica todos
  perform post_push(jsonb_build_object(
    'event',          'question_settled',
    'target_user_id', v_question.creator_id,
    'question_id',    p_question_id,
    'content',        v_question.content,
    'role',           'creator',
    'difficulty',     v_difficulty
  ));
  for v_ans in
    select id, user_id, is_correct from answers where question_id = p_question_id
  loop
    perform post_push(jsonb_build_object(
      'event',          'question_settled',
      'target_user_id', v_ans.user_id,
      'question_id',    p_question_id,
      'content',        v_question.content,
      'role',           'answerer',
      'is_correct',     v_ans.is_correct,
      'points',         case when v_ans.is_correct then v_per_pts else 0 end,
      'difficulty',     v_difficulty
    ));
  end loop;

  return json_build_object(
    'settled',     true,
    'difficulty',  v_difficulty,
    'correct',     v_correct,
    'total',       v_total,
    'points_each', v_per_pts
  );
end;
$$;
