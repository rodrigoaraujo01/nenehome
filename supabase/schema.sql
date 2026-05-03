-- nenehome database schema
-- Run this in the Supabase SQL editor

-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  nickname     text not null unique,
  name         text not null,
  couple_group int  not null,
  role         text not null check (role in ('adult', 'child')),
  avatar_url   text,
  created_at   timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles: anyone authenticated can read"
  on profiles for select using (auth.role() = 'authenticated');

create policy "profiles: owner can update"
  on profiles for update using (auth.uid() = id);

create policy "profiles: owner can insert"
  on profiles for insert with check (auth.uid() = id);

-- ─────────────────────────────────────────────
-- questions
-- ─────────────────────────────────────────────
create table if not exists questions (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references profiles(id),
  type             text not null check (type in ('story', 'multiple_choice')),
  content          text not null,
  -- for 'story': nickname of who the story is about
  subject_id       text,
  status           text not null default 'active' check (status in ('active', 'closed')),
  points_creator   int  not null default 5,
  points_correct   int  not null default 10,
  closed_at        timestamptz,
  created_at       timestamptz default now()
);

alter table questions enable row level security;

create policy "questions: authenticated can read"
  on questions for select using (auth.role() = 'authenticated');

create policy "questions: authenticated can insert"
  on questions for insert with check (auth.uid() = creator_id);

create policy "questions: creator can update"
  on questions for update using (auth.uid() = creator_id);

-- ─────────────────────────────────────────────
-- question_options  (múltipla escolha)
-- ─────────────────────────────────────────────
create table if not exists question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  text        text not null,
  is_correct  boolean not null default false,
  position    int  not null
);

alter table question_options enable row level security;

create policy "options: authenticated can read"
  on question_options for select using (auth.role() = 'authenticated');

create policy "options: question creator can insert"
  on question_options for insert with check (
    auth.uid() = (select creator_id from questions where id = question_id)
  );

-- ─────────────────────────────────────────────
-- answers
-- ─────────────────────────────────────────────
create table if not exists answers (
  id                  uuid primary key default gen_random_uuid(),
  question_id         uuid not null references questions(id),
  user_id             uuid not null references profiles(id),
  selected_option_id  uuid references question_options(id),
  subject_guess_id    text,
  is_correct          boolean not null,
  created_at          timestamptz default now(),
  unique (question_id, user_id)
);

alter table answers enable row level security;

create policy "answers: owner can insert"
  on answers for insert with check (auth.uid() = user_id);

-- Users can always see their own answers.
-- They can also see all answers to a question once it's closed.
-- Aggregate counts for active questions are exposed through
-- get_question_answer_counts below without exposing individual rows.
create policy "answers: owner can read own"
  on answers for select using (auth.uid() = user_id);

create policy "answers: anyone can read closed question answers"
  on answers for select using (
    (select status from questions where id = question_id) = 'closed'
  );

-- ─────────────────────────────────────────────
-- RPC: get_question_answer_counts
-- Returns aggregate answer counts without exposing active answer rows.
-- ─────────────────────────────────────────────
create or replace function get_question_answer_counts(p_question_ids uuid[])
returns table(question_id uuid, answer_count int)
language plpgsql
security definer
as $$
begin
  if auth.role() <> 'authenticated' then
    return;
  end if;

  return query
    select a.question_id, count(*)::int as answer_count
    from answers a
    where a.question_id = any(p_question_ids)
    group by a.question_id;
end;
$$;

-- ─────────────────────────────────────────────
-- points_log
-- ─────────────────────────────────────────────
create table if not exists points_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id),
  amount     int  not null,
  reason     text not null,  -- 'question_created' | 'correct_answer' | 'creator_penalty'
  ref_id     uuid,            -- question or answer id
  created_at timestamptz default now()
);

alter table points_log enable row level security;

create policy "points_log: authenticated can read"
  on points_log for select using (auth.role() = 'authenticated');

-- Only server/service role can insert (via RPC below)
create policy "points_log: service role can insert"
  on points_log for insert with check (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- view: member_points
-- ─────────────────────────────────────────────
create or replace view member_points as
  select
    p.id          as user_id,
    p.nickname,
    p.name,
    p.avatar_url,
    p.couple_group,
    coalesce(sum(pl.amount), 0)::int as total_points
  from profiles p
  left join points_log pl on pl.user_id = p.id
  where p.role = 'adult'
  group by p.id, p.nickname, p.name, p.avatar_url, p.couple_group
  order by total_points desc;

-- ─────────────────────────────────────────────
-- RPC: submit_answer
-- Inserts an answer, awards points, handles penalty.
-- Called from the client with anon key.
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
  v_user_id    uuid := auth.uid();
  v_question   questions%rowtype;
  v_is_correct boolean := false;
  v_points     int := 0;
  v_answer_id  uuid;
begin
  -- fetch question
  select * into v_question from questions where id = p_question_id;
  if not found then
    raise exception 'question not found';
  end if;
  if v_question.status = 'closed' then
    raise exception 'question is closed';
  end if;

  -- determine correctness
  if v_question.type = 'multiple_choice' then
    select coalesce(is_correct, false) into v_is_correct
      from question_options
      where id = p_selected_option_id and question_id = p_question_id;
    if not found then v_is_correct := false; end if;
  elsif v_question.type = 'story' then
    v_is_correct := coalesce(p_subject_guess_id = v_question.subject_id, false);
  end if;

  -- insert answer
  insert into answers (question_id, user_id, selected_option_id, subject_guess_id, is_correct)
  values (p_question_id, v_user_id, p_selected_option_id, p_subject_guess_id, v_is_correct)
  returning id into v_answer_id;

  -- award points if correct
  if v_is_correct then
    v_points := v_question.points_correct;
    insert into points_log (user_id, amount, reason, ref_id)
    values (v_user_id, v_points, 'correct_answer', v_answer_id);
  end if;

  return json_build_object(
    'is_correct', v_is_correct,
    'points_earned', v_points
  );
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: create_question
-- Inserts question + options + awards creator points.
-- ─────────────────────────────────────────────
create or replace function create_question(
  p_type       text,
  p_content    text,
  p_subject_id text default null,
  p_options    json default null   -- [{text, is_correct}, ...]
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_user_id    uuid := auth.uid();
  v_question_id uuid;
  v_option     json;
  v_pos        int := 0;
begin
  insert into questions (creator_id, type, content, subject_id)
  values (v_user_id, p_type, p_content, p_subject_id)
  returning id into v_question_id;

  -- insert options for multiple_choice
  if p_type = 'multiple_choice' and p_options is not null then
    for v_option in select * from json_array_elements(p_options) loop
      insert into question_options (question_id, text, is_correct, position)
      values (
        v_question_id,
        v_option->>'text',
        (v_option->>'is_correct')::boolean,
        v_pos
      );
      v_pos := v_pos + 1;
    end loop;
  end if;

  -- award creator points
  insert into points_log (user_id, amount, reason, ref_id)
  values (v_user_id, 5, 'question_created', v_question_id);

  return v_question_id;
end;
$$;
