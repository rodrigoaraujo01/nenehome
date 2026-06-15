-- nenehome — Scoring v2: criação mais interessante, sem incentivar flooding.
--
-- Run LAST (after schema.sql, achievements.sql, photos.sql, photo_challenges.sql,
-- fix_challenge_single_award.sql, delete_user_content.sql and notifications_v2.sql),
-- since it redefines functions those files also define.
--
-- O que muda:
--   1. Perguntas: 1 pergunta "premium" por criador por dia (+20 ao criar); extras
--      no mesmo dia valem o padrão (+5).
--   2. Perguntas: o payout de quem acerta passa a ser dinâmico por dificuldade,
--      liquidado quando todo mundo responde (settle_question). Perguntas
--      impossíveis (0 acertos) fazem o criador perder o bônus de criação;
--      perguntas difíceis (mas com acertos) dão +10 ao criador.
--   3. Desafios: o criador ganha um prêmio (8 + 3×submitters_únicos, cap 8),
--      liquidado após o deadline (settle_challenge).
--
-- Tiers de payout por acerto: Fácil 5 / Médio 12 / Difícil 20.
-- Reasons novos em points_log: 'question_hard_bonus', 'challenge_created'.

-- ─────────────────────────────────────────────
-- Colunas novas
-- ─────────────────────────────────────────────
alter table questions
  add column if not exists difficulty text
    check (difficulty in ('easy', 'medium', 'hard', 'impossible'));

alter table photo_challenges
  add column if not exists settled_at timestamptz;

-- ─────────────────────────────────────────────
-- create_question — bônus de criação premium diário (20 / 5)
-- A primeira pergunta do criador no dia (fuso America/Sao_Paulo) vale 20;
-- as seguintes valem 5. Mantém as conquistas question_1/5 e milestones.
-- ─────────────────────────────────────────────
create or replace function create_question(
  p_type       text,
  p_content    text,
  p_subject_id text default null,
  p_options    json default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id      uuid := auth.uid();
  v_question_id  uuid;
  v_option       json;
  v_pos          int := 0;
  v_count        int;
  v_today_count  int;
  v_creator_pts  int;
  v_achievements json[] := '{}';
  v_a            json;
begin
  -- quantas perguntas o criador já fez hoje (fuso fixo p/ definir "hoje")
  select count(*) into v_today_count
    from questions
    where creator_id = v_user_id
      and (created_at at time zone 'America/Sao_Paulo')::date
          = (now() at time zone 'America/Sao_Paulo')::date;

  v_creator_pts := case when v_today_count = 0 then 20 else 5 end;

  insert into questions (creator_id, type, content, subject_id, points_creator)
  values (v_user_id, p_type, p_content, p_subject_id, v_creator_pts)
  returning id into v_question_id;

  if p_type = 'multiple_choice' and p_options is not null then
    for v_option in select * from json_array_elements(p_options) loop
      insert into question_options (question_id, text, is_correct, position)
      values (v_question_id, v_option->>'text', (v_option->>'is_correct')::boolean, v_pos);
      v_pos := v_pos + 1;
    end loop;
  end if;

  insert into points_log (user_id, amount, reason, ref_id)
  values (v_user_id, v_creator_pts, 'question_created', v_question_id);

  select count(*) into v_count from questions where creator_id = v_user_id;
  if v_count = 1 then v_a := grant_achievement(v_user_id, 'question_1'); if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
  if v_count = 5 then v_a := grant_achievement(v_user_id, 'question_5'); if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;

  select array_cat(v_achievements, check_points_achievements(v_user_id)) into v_achievements;

  return json_build_object(
    'id', v_question_id,
    'points_creator', v_creator_pts,
    'is_premium', v_today_count = 0,
    'achievements', to_json(v_achievements)
  );
end;
$$;

-- ─────────────────────────────────────────────
-- submit_answer — registra a resposta e as conquistas de contagem, MAS adia os
-- pontos de acerto: eles são concedidos no settle (por dificuldade). Quando o
-- último jogador elegível responde, dispara settle_question.
-- ─────────────────────────────────────────────
create or replace function submit_answer(
  p_question_id        uuid,
  p_selected_option_id uuid default null,
  p_subject_guess_id   text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id      uuid := auth.uid();
  v_question     questions%rowtype;
  v_is_correct   boolean := false;
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

  -- correção
  if v_question.type = 'multiple_choice' then
    select coalesce(is_correct, false) into v_is_correct
      from question_options
      where id = p_selected_option_id and question_id = p_question_id;
    if not found then v_is_correct := false; end if;
  elsif v_question.type = 'story' then
    v_is_correct := coalesce(p_subject_guess_id = v_question.subject_id, false);
  end if;

  insert into answers (question_id, user_id, selected_option_id, subject_guess_id, is_correct)
  values (p_question_id, v_user_id, p_selected_option_id, p_subject_guess_id, v_is_correct)
  returning id into v_answer_id;

  -- conquistas baseadas em contagem (correção é conhecida já); pontos de acerto
  -- ficam para o settle.
  if v_is_correct then
    select count(*) into v_count from answers where user_id = v_user_id and is_correct = true;
    if v_count = 1  then v_a := grant_achievement(v_user_id, 'first_correct'); if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
    if v_count = 5  then v_a := grant_achievement(v_user_id, 'correct_5');     if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
    if v_count = 25 then v_a := grant_achievement(v_user_id, 'correct_25');    if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
    select array_cat(v_achievements, check_points_achievements(v_user_id)) into v_achievements;
  end if;

  -- liquida quando todos os elegíveis responderam.
  -- elegíveis = adultos que NÃO são o criador (o criador não responde a própria
  -- pergunta), então com 8 adultos o settle acontece na 7ª resposta.
  select count(*) into v_answer_count from answers where question_id = p_question_id;
  select count(*) into v_eligible
    from profiles
    where role = 'adult' and id <> v_question.creator_id;
  if v_eligible > 0 and v_answer_count >= v_eligible then
    perform settle_question(p_question_id);
  end if;

  return json_build_object(
    'is_correct',    v_is_correct,
    'points_earned', 0,      -- pontos de acerto são concedidos no settle
    'pending',       true,
    'achievements',  to_json(v_achievements)
  );
end;
$$;

-- ─────────────────────────────────────────────
-- settle_question — idempotente. Fecha a pergunta, calcula a dificuldade pelo
-- % de acertos, concede os pontos por tier a quem acertou, ajusta o criador
-- (forfeit se impossível / +10 se difícil) e notifica todos os envolvidos.
-- Tiers (sobre os respondentes): impossível 0 acertos; difícil ratio<=1/3;
-- médio ratio<=2/3; fácil acima. (Com 7 respondentes: 1-2=difícil, 3-4=médio,
-- 5-7=fácil.)
-- ─────────────────────────────────────────────
create or replace function settle_question(p_question_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_question   questions%rowtype;
  v_total      int;
  v_correct    int;
  v_ratio      numeric;
  v_difficulty text;
  v_per_pts    int := 0;
  v_ans        record;
  v_affected   uuid[];
  v_uid        uuid;
begin
  select * into v_question from questions where id = p_question_id;
  if not found then return json_build_object('settled', false); end if;
  if v_question.status = 'closed' then
    return json_build_object('settled', false, 'already', true);
  end if;

  -- fecha (idempotência via guard de status acima)
  update questions set status = 'closed', closed_at = now() where id = p_question_id;

  select count(*) into v_total   from answers where question_id = p_question_id;
  select count(*) into v_correct from answers where question_id = p_question_id and is_correct = true;

  if v_total = 0 or v_correct = 0 then
    v_difficulty := 'impossible';
    v_per_pts := 0;
  else
    v_ratio := v_correct::numeric / v_total::numeric;
    if v_ratio <= 1.0/3.0 then
      v_difficulty := 'hard';  v_per_pts := 20;
    elsif v_ratio <= 2.0/3.0 then
      v_difficulty := 'medium'; v_per_pts := 12;
    else
      v_difficulty := 'easy';  v_per_pts := 5;
    end if;
  end if;

  update questions set difficulty = v_difficulty where id = p_question_id;

  -- pontos por acerto (por tier)
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
    -- forfeit: remove o bônus de criação (net zero, nunca negativo)
    delete from points_log
      where reason = 'question_created' and ref_id = p_question_id;
  elsif v_difficulty = 'hard' then
    insert into points_log (user_id, amount, reason, ref_id)
    values (v_question.creator_id, 10, 'question_hard_bonus', p_question_id);
  end if;

  -- re-checa milestones de todos os envolvidos
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

  -- notifica todos: criador + cada respondente (gate pela pref question_completed)
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

-- ─────────────────────────────────────────────
-- settle_challenge — idempotente. Após o deadline, concede ao criador um prêmio
-- escalado pelo nº de submitters únicos aprovados (8 + 3×n, cap 8 → 11..32).
-- Pode ser chamada por qualquer membro (settle preguiçoso ao abrir a página).
-- ─────────────────────────────────────────────
create or replace function settle_challenge(p_challenge_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_challenge  photo_challenges%rowtype;
  v_submitters int;
  v_reward     int;
begin
  select * into v_challenge from photo_challenges where id = p_challenge_id;
  if not found then return json_build_object('settled', false); end if;
  if v_challenge.settled_at is not null then
    return json_build_object('settled', false, 'already', true);
  end if;
  if now() <= v_challenge.deadline then
    return json_build_object('settled', false, 'not_due', true);
  end if;

  -- guard de corrida: só prossegue quem conseguir marcar settled_at
  update photo_challenges set settled_at = now()
    where id = p_challenge_id and settled_at is null;
  if not found then
    return json_build_object('settled', false, 'already', true);
  end if;

  select count(*) into v_submitters
    from photo_challenge_completions where challenge_id = p_challenge_id;

  v_reward := 8 + 3 * least(v_submitters, 8);

  insert into points_log (user_id, amount, reason, ref_id)
  values (v_challenge.creator_id, v_reward, 'challenge_created', p_challenge_id);

  perform check_points_achievements(v_challenge.creator_id);

  return json_build_object(
    'settled',    true,
    'submitters', v_submitters,
    'reward',     v_reward
  );
end;
$$;

-- ─────────────────────────────────────────────
-- get_question_answers — agora também retorna points_earned por respondente
-- (somatório de 'correct_answer' do answer; 0 enquanto não liquidado).
-- DROP necessário: o tipo de retorno (colunas OUT) mudou.
-- ─────────────────────────────────────────────
drop function if exists get_question_answers(uuid);

create or replace function get_question_answers(p_question_id uuid)
returns table (
  id                 uuid,
  user_id            uuid,
  selected_option_id uuid,
  subject_guess_id   text,
  is_correct         boolean,
  created_at         timestamptz,
  nickname           text,
  avatar_url         text,
  points_earned      int
)
language plpgsql
security definer
as $$
begin
  if auth.role() <> 'authenticated' then
    return;
  end if;

  if not exists (
    select 1 from answers a
    where a.question_id = p_question_id and a.user_id = auth.uid()
  ) and not exists (
    select 1 from questions q
    where q.id = p_question_id and q.creator_id = auth.uid()
  ) then
    return;
  end if;

  return query
    select
      a.id,
      a.user_id,
      a.selected_option_id,
      a.subject_guess_id,
      a.is_correct,
      a.created_at,
      pr.nickname,
      pr.avatar_url,
      coalesce((
        select sum(pl.amount)::int from points_log pl
        where pl.reason = 'correct_answer' and pl.ref_id = a.id
      ), 0) as points_earned
    from answers a
    join profiles pr on pr.id = a.user_id
    where a.question_id = p_question_id
    order by a.created_at asc;
end;
$$;

-- ─────────────────────────────────────────────
-- delete_question — agora também reverte o bônus de difícil ('question_hard_bonus').
-- (Resto idêntico ao delete_user_content.sql.)
-- ─────────────────────────────────────────────
create or replace function delete_question(p_question_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id   uuid := auth.uid();
  v_question  questions%rowtype;
  v_answer_ids uuid[];
  v_affected  uuid[];
  v_uid       uuid;
  v_remaining int;
  v_total     int;
begin
  select * into v_question from questions where id = p_question_id;
  if not found then
    return json_build_object('error', 'Pergunta não encontrada');
  end if;

  if v_question.creator_id != v_user_id then
    return json_build_object('error', 'Apenas o criador pode excluir a pergunta');
  end if;

  select array_agg(id) into v_answer_ids
    from answers where question_id = p_question_id;

  select array_agg(distinct uid) into v_affected from (
    select v_question.creator_id as uid
    union
    select user_id from answers where question_id = p_question_id
  ) u;

  -- undo points: bônus de criação + bônus de difícil + cada acerto
  delete from points_log
    where reason = 'question_created' and ref_id = p_question_id;
  delete from points_log
    where reason = 'question_hard_bonus' and ref_id = p_question_id;
  if v_answer_ids is not null then
    delete from points_log
      where reason = 'correct_answer' and ref_id = any(v_answer_ids);
  end if;

  delete from answers where question_id = p_question_id;
  delete from questions where id = p_question_id;

  if v_affected is not null then
    foreach v_uid in array v_affected loop
      select count(*) into v_remaining from questions where creator_id = v_uid;
      if v_remaining < 1 then perform revoke_achievement(v_uid, 'question_1'); end if;
      if v_remaining < 5 then perform revoke_achievement(v_uid, 'question_5'); end if;

      select count(*) into v_remaining
        from answers where user_id = v_uid and is_correct = true;
      if v_remaining < 1  then perform revoke_achievement(v_uid, 'first_correct'); end if;
      if v_remaining < 5  then perform revoke_achievement(v_uid, 'correct_5'); end if;
      if v_remaining < 25 then perform revoke_achievement(v_uid, 'correct_25'); end if;
    end loop;

    foreach v_uid in array v_affected loop
      select coalesce(sum(amount), 0) into v_total
        from points_log where user_id = v_uid;
      if v_total < 100 then perform revoke_achievement(v_uid, 'points_100'); end if;
      if v_total < 500 then perform revoke_achievement(v_uid, 'points_500'); end if;
    end loop;
  end if;

  return json_build_object('deleted', true);
end;
$$;

-- ─────────────────────────────────────────────
-- delete_photo_challenge — agora também reverte o prêmio do criador
-- ('challenge_created') e inclui o criador na re-checagem de milestones.
-- ─────────────────────────────────────────────
create or replace function delete_photo_challenge(p_challenge_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id        uuid := auth.uid();
  v_challenge      photo_challenges%rowtype;
  v_sub_ids        uuid[];
  v_paths          text[];
  v_affected       uuid[];
  v_uid            uuid;
  v_remaining      int;
  v_total          int;
  v_storage_error  text := null;
begin
  select * into v_challenge from photo_challenges where id = p_challenge_id;
  if not found then
    return json_build_object('error', 'Desafio não encontrado');
  end if;

  if v_challenge.creator_id != v_user_id then
    return json_build_object('error', 'Apenas o criador pode excluir o desafio');
  end if;

  select array_agg(id), array_agg(storage_path)
    into v_sub_ids, v_paths
    from photo_submissions where challenge_id = p_challenge_id;

  -- afetados: criador (prêmio), submitters, votantes e completers
  select array_agg(distinct uid) into v_affected from (
    select v_challenge.creator_id as uid
    union
    select submitter_id from photo_submissions where challenge_id = p_challenge_id
    union
    select voter_id from photo_votes
      where submission_id = any(coalesce(v_sub_ids, '{}'::uuid[]))
    union
    select user_id from photo_challenge_completions where challenge_id = p_challenge_id
  ) u;

  -- undo dos pontos que fluíram deste desafio
  delete from points_log
    where reason = 'challenge_completed' and ref_id = p_challenge_id;
  delete from points_log
    where reason = 'challenge_created' and ref_id = p_challenge_id;
  if v_sub_ids is not null then
    delete from points_log
      where reason = 'photo_approved' and ref_id = any(v_sub_ids);
  end if;

  if v_paths is not null then
    begin
      delete from storage.objects
        where bucket_id = 'photo-submissions' and name = any(v_paths);
    exception when others then
      v_storage_error := SQLERRM;
    end;
  end if;

  delete from photo_submissions where challenge_id = p_challenge_id;
  delete from photo_challenge_completions where challenge_id = p_challenge_id;
  delete from photo_challenges where id = p_challenge_id;

  if v_affected is not null then
    foreach v_uid in array v_affected loop
      select count(*) into v_remaining
        from photo_submissions where submitter_id = v_uid and status = 'approved';
      if v_remaining < 1 then perform revoke_achievement(v_uid, 'photographer_1'); end if;
      if v_remaining < 3 then perform revoke_achievement(v_uid, 'photographer_3'); end if;

      select count(*) into v_remaining from photo_votes where voter_id = v_uid;
      if v_remaining < 5 then perform revoke_achievement(v_uid, 'voter_5'); end if;

      select count(*) into v_remaining
        from photo_challenge_completions where user_id = v_uid;
      if v_remaining < 1 then perform revoke_achievement(v_uid, 'challenger_1'); end if;
      if v_remaining < 3 then perform revoke_achievement(v_uid, 'challenger_3'); end if;
    end loop;

    foreach v_uid in array v_affected loop
      select coalesce(sum(amount), 0) into v_total
        from points_log where user_id = v_uid;
      if v_total < 100 then perform revoke_achievement(v_uid, 'points_100'); end if;
      if v_total < 500 then perform revoke_achievement(v_uid, 'points_500'); end if;
    end loop;
  end if;

  return json_build_object(
    'deleted', true,
    'photos_removed', coalesce(array_length(v_sub_ids, 1), 0),
    'storage_error', v_storage_error
  );
end;
$$;
