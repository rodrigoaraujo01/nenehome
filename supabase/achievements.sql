-- nenehome — Achievements schema
-- Run AFTER schema.sql and photos.sql

-- ─────────────────────────────────────────────
-- achievements catalog (static)
-- ─────────────────────────────────────────────
create table if not exists achievements (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  title        text not null,
  description  text not null,
  icon         text not null,
  points_reward int not null default 0,
  sort_order   int not null default 0
);

alter table achievements enable row level security;
create policy "achievements: anyone can read"
  on achievements for select using (true);

-- ─────────────────────────────────────────────
-- user_achievements
-- ─────────────────────────────────────────────
create table if not exists user_achievements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id),
  achievement_id uuid not null references achievements(id),
  unlocked_at    timestamptz default now(),
  unique (user_id, achievement_id)
);

alter table user_achievements enable row level security;
create policy "user_achievements: authenticated can read"
  on user_achievements for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- Seed catalog
-- ─────────────────────────────────────────────
insert into achievements (key, title, description, icon, points_reward, sort_order) values
  ('welcome',        'Bem-vindo!',           'Entrou no nenehome pela primeira vez',   '🎉', 10,  1),
  ('first_correct',  'Primeira acertada',    'Acertou a primeira pergunta',            '✅', 10,  2),
  ('correct_5',      'Cabeça quente',        '5 respostas certas',                     '🔥', 20,  3),
  ('correct_25',     'Enciclopédia',         '25 respostas certas',                    '📚', 50,  4),
  ('question_1',     'Perguntador',          'Criou a primeira pergunta',              '❓', 15,  5),
  ('question_5',     'Mestre das perguntas', 'Criou 5 perguntas',                      '🎯', 30,  6),
  ('photographer_1', 'Fotógrafo',            'Teve uma foto aprovada pelo grupo',      '📸', 20,  7),
  ('photographer_3', 'Paparazzi',            'Teve 3 fotos aprovadas',                 '📷', 40,  8),
  ('voter_5',        'Jurado',               'Votou em 5 fotos',                       '🗳️', 15,  9),
  ('points_100',     'Pontuador',            'Chegou a 100 pontos',                    '⭐', 0,  10),
  ('points_500',     'Lenda',                'Chegou a 500 pontos',                    '👑', 0,  11)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────
-- Helper: grant_achievement
-- Inserts row, awards points if applicable.
-- Returns json descriptor if newly unlocked, null if already had it.
-- ─────────────────────────────────────────────
create or replace function grant_achievement(p_user_id uuid, p_key text)
returns json
language plpgsql
security definer
as $$
declare
  v_ach achievements%rowtype;
begin
  select * into v_ach from achievements where key = p_key;
  if not found then return null; end if;

  insert into user_achievements (user_id, achievement_id)
  values (p_user_id, v_ach.id)
  on conflict (user_id, achievement_id) do nothing;

  if not found then return null; end if;

  if v_ach.points_reward > 0 then
    insert into points_log (user_id, amount, reason, ref_id)
    values (p_user_id, v_ach.points_reward, 'achievement', v_ach.id);
  end if;

  return json_build_object('key', v_ach.key, 'title', v_ach.title, 'icon', v_ach.icon);
end;
$$;

-- ─────────────────────────────────────────────
-- Trigger: welcome achievement on first login
-- ─────────────────────────────────────────────
create or replace function on_profile_created()
returns trigger language plpgsql security definer as $$
begin
  perform grant_achievement(new.id, 'welcome');
  return new;
end;
$$;

drop trigger if exists profile_created_achievement on profiles;
create trigger profile_created_achievement
  after insert on profiles
  for each row execute function on_profile_created();

-- ─────────────────────────────────────────────
-- Helper: check points milestone achievements
-- ─────────────────────────────────────────────
create or replace function check_points_achievements(p_user_id uuid)
returns json[]
language plpgsql
security definer
as $$
declare
  v_total int;
  v_results json[] := '{}';
  v_a json;
begin
  select coalesce(sum(amount), 0) into v_total
    from points_log where user_id = p_user_id;

  if v_total >= 100 then
    v_a := grant_achievement(p_user_id, 'points_100');
    if v_a is not null then v_results := v_results || v_a; end if;
  end if;
  if v_total >= 500 then
    v_a := grant_achievement(p_user_id, 'points_500');
    if v_a is not null then v_results := v_results || v_a; end if;
  end if;

  return v_results;
end;
$$;

-- ─────────────────────────────────────────────
-- Updated: submit_answer (adds achievement checks)
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
  v_points       int := 0;
  v_answer_id    uuid;
  v_count        int;
  v_achievements json[] := '{}';
  v_a            json;
begin
  select * into v_question from questions where id = p_question_id;
  if not found then raise exception 'question not found'; end if;
  if v_question.status = 'closed' then raise exception 'question is closed'; end if;

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

  if v_is_correct then
    v_points := v_question.points_correct;
    insert into points_log (user_id, amount, reason, ref_id)
    values (v_user_id, v_points, 'correct_answer', v_answer_id);

    select count(*) into v_count from answers where user_id = v_user_id and is_correct = true;
    if v_count = 1  then v_a := grant_achievement(v_user_id, 'first_correct'); if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
    if v_count = 5  then v_a := grant_achievement(v_user_id, 'correct_5');     if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
    if v_count = 25 then v_a := grant_achievement(v_user_id, 'correct_25');    if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;

    select array_cat(v_achievements, check_points_achievements(v_user_id)) into v_achievements;
  end if;

  return json_build_object(
    'is_correct',   v_is_correct,
    'points_earned', v_points,
    'achievements', to_json(v_achievements)
  );
end;
$$;

-- ─────────────────────────────────────────────
-- Updated: create_question (returns json with id + achievements)
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
  v_user_id     uuid := auth.uid();
  v_question_id uuid;
  v_option      json;
  v_pos         int := 0;
  v_count       int;
  v_achievements json[] := '{}';
  v_a            json;
begin
  insert into questions (creator_id, type, content, subject_id)
  values (v_user_id, p_type, p_content, p_subject_id)
  returning id into v_question_id;

  if p_type = 'multiple_choice' and p_options is not null then
    for v_option in select * from json_array_elements(p_options) loop
      insert into question_options (question_id, text, is_correct, position)
      values (v_question_id, v_option->>'text', (v_option->>'is_correct')::boolean, v_pos);
      v_pos := v_pos + 1;
    end loop;
  end if;

  insert into points_log (user_id, amount, reason, ref_id)
  values (v_user_id, 5, 'question_created', v_question_id);

  select count(*) into v_count from questions where creator_id = v_user_id;
  if v_count = 1 then v_a := grant_achievement(v_user_id, 'question_1'); if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
  if v_count = 5 then v_a := grant_achievement(v_user_id, 'question_5'); if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;

  select array_cat(v_achievements, check_points_achievements(v_user_id)) into v_achievements;

  return json_build_object('id', v_question_id, 'achievements', to_json(v_achievements));
end;
$$;

-- ─────────────────────────────────────────────
-- Updated: vote_on_submission (adds achievement checks)
-- ─────────────────────────────────────────────
create or replace function vote_on_submission(
  p_submission_id uuid,
  p_approved      boolean
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id       uuid := auth.uid();
  v_submission    photo_submissions%rowtype;
  v_approve_count int;
  v_reject_count  int;
  v_eligible      int;
  v_new_status    text := 'pending';
  v_vote_count    int;
  v_photo_count   int;
  v_achievements  json[] := '{}';
  v_a             json;
begin
  select * into v_submission from photo_submissions where id = p_submission_id;
  if not found then raise exception 'submission not found'; end if;
  if v_submission.status <> 'pending' then raise exception 'submission is not pending'; end if;
  if v_submission.submitter_id = v_user_id then raise exception 'cannot vote on own submission'; end if;

  insert into photo_votes (submission_id, voter_id, approved)
  values (p_submission_id, v_user_id, p_approved);

  -- voter_5 achievement
  select count(*) into v_vote_count from photo_votes where voter_id = v_user_id;
  if v_vote_count = 5 then
    v_a := grant_achievement(v_user_id, 'voter_5');
    if v_a is not null then v_achievements := v_achievements || v_a; end if;
  end if;

  select count(*) into v_approve_count from photo_votes where submission_id = p_submission_id and approved = true;
  select count(*) into v_reject_count  from photo_votes where submission_id = p_submission_id and approved = false;
  select count(*) - 1 into v_eligible  from profiles where role = 'adult';

  if v_approve_count >= v_submission.votes_to_approve then
    v_new_status := 'approved';
    update photo_submissions set status = 'approved' where id = p_submission_id;
    insert into points_log (user_id, amount, reason, ref_id)
    values (v_submission.submitter_id, v_submission.points_reward, 'photo_approved', p_submission_id);

    -- photographer achievements for submitter
    select count(*) into v_photo_count
      from photo_submissions where submitter_id = v_submission.submitter_id and status = 'approved';
    if v_photo_count = 1 then
      perform grant_achievement(v_submission.submitter_id, 'photographer_1');
    end if;
    if v_photo_count = 3 then
      perform grant_achievement(v_submission.submitter_id, 'photographer_3');
    end if;
    perform check_points_achievements(v_submission.submitter_id);

  elsif v_reject_count > (v_eligible - v_submission.votes_to_approve) then
    v_new_status := 'rejected';
    update photo_submissions set status = 'rejected' where id = p_submission_id;
  end if;

  return json_build_object(
    'approve_count', v_approve_count,
    'reject_count',  v_reject_count,
    'status',        v_new_status,
    'achievements',  to_json(v_achievements)
  );
end;
$$;
