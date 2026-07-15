-- nenehome — Votação da melhor foto do desafio
-- Rodar DEPOIS de photo_challenges.sql e scoring_v2.sql.
--
-- Encerrado o desafio (deadline), abre-se uma votação de 48h entre as fotos
-- APROVADAS pra eleger a melhor. Quem vence DOBRA os pontos que recebeu naquele
-- desafio (photo_approved da foto vencedora + challenge_completed do desafio),
-- via reason 'challenge_best_photo'.
--
-- A janela é puramente temporal (deadline → deadline + 48h): não depende de
-- ninguém abrir a página, senão um desafio esquecido teria a votação aberta e
-- fechada sem ninguém poder votar. Só a apuração é preguiçosa.

-- ─────────────────────────────────────────────
-- Colunas novas
-- ─────────────────────────────────────────────
alter table photo_challenges
  add column if not exists best_settled_at timestamptz;

-- Backfill: desafios que já venceram há mais de 48h nunca tiveram janela de
-- votação (a feature não existia), então entram como já apurados. Sem isso o
-- primeiro sweep os "apuraria" com zero votos e a UI mostraria uma seção de
-- melhor foto vazia em desafio de meses atrás.
update photo_challenges
  set best_settled_at = now()
  where best_settled_at is null
    and now() >= deadline + interval '48 hours';

-- marca a(s) foto(s) vencedora(s) — usada pela UI (medalha no card)
alter table photo_submissions
  add column if not exists best_photo boolean not null default false;

-- ─────────────────────────────────────────────
-- challenge_best_votes — 1 voto por pessoa por desafio.
-- Dá pra trocar o voto enquanto a janela está aberta (update do mesmo row).
-- ─────────────────────────────────────────────
create table if not exists challenge_best_votes (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references photo_challenges(id) on delete cascade,
  voter_id      uuid not null references profiles(id),
  submission_id uuid not null references photo_submissions(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (challenge_id, voter_id)
);

alter table challenge_best_votes enable row level security;

drop policy if exists "challenge_best_votes: authenticated can read" on challenge_best_votes;
create policy "challenge_best_votes: authenticated can read"
  on challenge_best_votes for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- Helper: fotos aprovadas de um desafio (as candidatas)
-- ─────────────────────────────────────────────
create or replace function challenge_best_candidates(p_challenge_id uuid)
returns integer
language sql
security definer
as $$
  select count(*)::integer
  from photo_submissions
  where challenge_id = p_challenge_id and status = 'approved';
$$;

-- ─────────────────────────────────────────────
-- RPC: vote_best_photo — vota (ou troca o voto) na melhor foto.
-- ─────────────────────────────────────────────
create or replace function vote_best_photo(p_submission_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id    uuid := auth.uid();
  v_sub        photo_submissions%rowtype;
  v_challenge  photo_challenges%rowtype;
  v_role       text;
begin
  select role into v_role from profiles where id = v_user_id;
  if v_role is distinct from 'adult' then
    return json_build_object('error', 'Só adultos votam');
  end if;

  select * into v_sub from photo_submissions where id = p_submission_id;
  if not found then return json_build_object('error', 'Foto não encontrada'); end if;
  if v_sub.challenge_id is null then
    return json_build_object('error', 'Essa foto não é de um desafio');
  end if;
  if v_sub.status <> 'approved' then
    return json_build_object('error', 'Só fotos aprovadas concorrem');
  end if;
  if v_sub.submitter_id = v_user_id then
    return json_build_object('error', 'Não pode votar na própria foto');
  end if;

  select * into v_challenge from photo_challenges where id = v_sub.challenge_id;
  if not found then return json_build_object('error', 'Desafio não encontrado'); end if;

  if now() < v_challenge.deadline then
    return json_build_object('error', 'A votação abre quando o desafio encerrar');
  end if;
  if now() >= v_challenge.deadline + interval '48 hours' then
    return json_build_object('error', 'A votação da melhor foto já encerrou');
  end if;
  if challenge_best_candidates(v_challenge.id) < 2 then
    return json_build_object('error', 'Precisa de pelo menos 2 fotos aprovadas');
  end if;

  insert into challenge_best_votes (challenge_id, voter_id, submission_id)
  values (v_challenge.id, v_user_id, p_submission_id)
  on conflict (challenge_id, voter_id)
    do update set submission_id = excluded.submission_id, created_at = now();

  return json_build_object('success', true, 'submission_id', p_submission_id);
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: settle_challenge_best — apura a melhor foto. Idempotente, roda depois de
-- deadline + 48h. Empate: todos os empatados dobram. Menos de 2 fotos aprovadas
-- ou zero votos: fecha sem dobrar nada.
-- ─────────────────────────────────────────────
create or replace function settle_challenge_best(p_challenge_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_challenge  photo_challenges%rowtype;
  v_max        int;
  v_win        record;
  v_paid_users uuid[] := '{}';
  v_photo_pts  int;
  v_compl_pts  int;
  v_amount     int;
  v_winners    int := 0;
begin
  select * into v_challenge from photo_challenges where id = p_challenge_id;
  if not found then return json_build_object('settled', false); end if;
  if v_challenge.best_settled_at is not null then
    return json_build_object('settled', false, 'already', true);
  end if;
  if now() < v_challenge.deadline + interval '48 hours' then
    return json_build_object('settled', false, 'not_ready', true);
  end if;

  update photo_challenges set best_settled_at = now() where id = p_challenge_id;

  -- sem disputa (0 ou 1 foto aprovada) → ninguém dobra
  if challenge_best_candidates(p_challenge_id) < 2 then
    return json_build_object('settled', true, 'no_contest', true, 'winners', 0);
  end if;

  select max(c) into v_max from (
    select count(*) as c
    from challenge_best_votes
    where challenge_id = p_challenge_id
    group by submission_id
  ) t;

  -- ninguém votou → ninguém dobra
  if v_max is null or v_max = 0 then
    return json_build_object('settled', true, 'no_votes', true, 'winners', 0);
  end if;

  for v_win in
    select v.submission_id, count(*)::int as votes, s.submitter_id
    from challenge_best_votes v
    join photo_submissions s on s.id = v.submission_id
    where v.challenge_id = p_challenge_id
    group by v.submission_id, s.submitter_id
    having count(*) = v_max
  loop
    update photo_submissions set best_photo = true where id = v_win.submission_id;

    -- dobra = repete os pontos que a pessoa recebeu NESTE desafio: os da
    -- aprovação da foto vencedora + os de completar o desafio.
    select coalesce(sum(amount), 0) into v_photo_pts
      from points_log
      where reason = 'photo_approved' and ref_id = v_win.submission_id
        and user_id = v_win.submitter_id;

    -- a parte do challenge_completed é por pessoa: se alguém vencer com duas
    -- fotos suas empatadas, ela não recebe os 30 do desafio duas vezes.
    if v_win.submitter_id = any(v_paid_users) then
      v_compl_pts := 0;
    else
      select coalesce(sum(amount), 0) into v_compl_pts
        from points_log
        where reason = 'challenge_completed' and ref_id = p_challenge_id
          and user_id = v_win.submitter_id;
      v_paid_users := v_paid_users || v_win.submitter_id;
    end if;

    v_amount := v_photo_pts + v_compl_pts;
    if v_amount > 0 then
      insert into points_log (user_id, amount, reason, ref_id)
      values (v_win.submitter_id, v_amount, 'challenge_best_photo', v_win.submission_id);
      perform check_points_achievements(v_win.submitter_id);
    end if;
    v_winners := v_winners + 1;
  end loop;

  return json_build_object(
    'settled', true,
    'winners', v_winners,
    'top_votes', v_max
  );
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: settle_expired_challenge_bests — sweep preguiçoso (chamado na Home).
-- ─────────────────────────────────────────────
create or replace function settle_expired_challenge_bests()
returns json
language plpgsql
security definer
as $$
declare
  v_id      uuid;
  v_settled int := 0;
  v_res     json;
begin
  for v_id in
    select id from photo_challenges
    where best_settled_at is null
      and now() >= deadline + interval '48 hours'
    order by deadline
  loop
    v_res := settle_challenge_best(v_id);
    if coalesce((v_res->>'settled')::boolean, false) then
      v_settled := v_settled + 1;
    end if;
  end loop;
  return json_build_object('settled', v_settled);
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: get_challenge_best — estado da votação pra UI.
-- state: 'not_open' | 'open' | 'closed' | 'no_contest'
-- ─────────────────────────────────────────────
create or replace function get_challenge_best(p_challenge_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id   uuid := auth.uid();
  v_challenge photo_challenges%rowtype;
  v_cands     int;
  v_state     text;
  v_my_vote   uuid;
  v_votes     json;
begin
  select * into v_challenge from photo_challenges where id = p_challenge_id;
  if not found then return null; end if;

  v_cands := challenge_best_candidates(p_challenge_id);

  if now() < v_challenge.deadline then
    v_state := 'not_open';
  elsif v_cands < 2 then
    v_state := 'no_contest';
  elsif now() < v_challenge.deadline + interval '48 hours' then
    v_state := 'open';
  else
    v_state := 'closed';
  end if;

  select submission_id into v_my_vote
    from challenge_best_votes
    where challenge_id = p_challenge_id and voter_id = v_user_id;

  select coalesce(json_agg(json_build_object(
    'submission_id', submission_id, 'votes', votes
  )), '[]'::json) into v_votes
  from (
    select submission_id, count(*)::int as votes
    from challenge_best_votes
    where challenge_id = p_challenge_id
    group by submission_id
    order by count(*) desc
  ) t;

  return json_build_object(
    'state',      v_state,
    'opens_at',   v_challenge.deadline,
    'closes_at',  v_challenge.deadline + interval '48 hours',
    'candidates', v_cands,
    'my_vote',    v_my_vote,
    'settled',    v_challenge.best_settled_at is not null,
    'votes',      v_votes
  );
end;
$$;
