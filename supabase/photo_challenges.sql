-- nenehome — Photo challenges schema
-- Run AFTER photos.sql and achievements.sql

-- ─────────────────────────────────────────────
-- photo_challenges
-- ─────────────────────────────────────────────
create table if not exists photo_challenges (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references profiles(id),
  title         text not null,
  description   text,
  points_reward int  not null default 30,
  starts_at     timestamptz not null default now(),
  deadline      timestamptz not null,
  created_at    timestamptz default now()
);

alter table photo_challenges enable row level security;

create policy "photo_challenges: authenticated can read"
  on photo_challenges for select using (auth.role() = 'authenticated');

create policy "photo_challenges: creator can insert"
  on photo_challenges for insert with check (auth.uid() = creator_id);

-- ─────────────────────────────────────────────
-- photo_challenge_completions
-- ─────────────────────────────────────────────
create table if not exists photo_challenge_completions (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references photo_challenges(id) on delete cascade,
  user_id       uuid not null references profiles(id),
  submission_id uuid not null references photo_submissions(id) on delete cascade,
  completed_at  timestamptz default now(),
  unique (challenge_id, user_id)
);

alter table photo_challenge_completions enable row level security;

create policy "photo_challenge_completions: authenticated can read"
  on photo_challenge_completions for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- Add challenge_id to photo_submissions
-- ─────────────────────────────────────────────
alter table photo_submissions
  add column if not exists challenge_id uuid references photo_challenges(id) on delete set null;

-- ─────────────────────────────────────────────
-- New achievements for challenges
-- ─────────────────────────────────────────────
insert into achievements (key, title, description, icon, points_reward, sort_order) values
  ('challenger_1', 'Desafiante',         'Completou o primeiro desafio fotográfico', '🏆', 25, 12),
  ('challenger_3', 'Caçador de desafios','Completou 3 desafios fotográficos',        '🎯', 50, 13)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────
-- RPC: complete_challenge_submission
-- Called when a challenge-linked photo is approved.
-- Awards challenge points and checks achievements.
-- ─────────────────────────────────────────────
create or replace function complete_challenge_submission(
  p_challenge_id  uuid,
  p_user_id       uuid,
  p_submission_id uuid
)
returns json[]
language plpgsql
security definer
as $$
declare
  v_challenge       photo_challenges%rowtype;
  v_completion_count int;
  v_achievements    json[] := '{}';
  v_a               json;
begin
  select * into v_challenge from photo_challenges where id = p_challenge_id;
  if not found then return v_achievements; end if;

  -- don't complete if challenge has expired
  if now() > v_challenge.deadline then return v_achievements; end if;

  -- don't complete if not yet started
  if now() < v_challenge.starts_at then return v_achievements; end if;

  -- insert completion (unique constraint prevents duplicates)
  begin
    insert into photo_challenge_completions (challenge_id, user_id, submission_id)
    values (p_challenge_id, p_user_id, p_submission_id);
  exception when unique_violation then
    return v_achievements;
  end;

  -- award challenge points to submitter
  insert into points_log (user_id, amount, reason, ref_id)
  values (p_user_id, v_challenge.points_reward, 'challenge_completed', p_challenge_id);

  -- check challenger achievements
  select count(*) into v_completion_count
    from photo_challenge_completions where user_id = p_user_id;

  if v_completion_count = 1 then
    v_a := grant_achievement(p_user_id, 'challenger_1');
    if v_a is not null then v_achievements := v_achievements || v_a; end if;
  end if;
  if v_completion_count = 3 then
    v_a := grant_achievement(p_user_id, 'challenger_3');
    if v_a is not null then v_achievements := v_achievements || v_a; end if;
  end if;

  perform check_points_achievements(p_user_id);

  return v_achievements;
end;
$$;

-- ─────────────────────────────────────────────
-- Updated: vote_on_submission (adds challenge completion)
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
  v_new_status    text := 'pending';
  v_vote_count    int;
  v_photo_count   int;
  v_achievements  json[] := '{}';
  v_challenge_achievements json[];
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

    -- challenge completion (new)
    if v_submission.challenge_id is not null then
      v_challenge_achievements := complete_challenge_submission(
        v_submission.challenge_id, v_submission.submitter_id, p_submission_id
      );
      v_achievements := array_cat(v_achievements, v_challenge_achievements);
    end if;

  elsif v_reject_count >= v_submission.votes_to_approve then
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

-- ─────────────────────────────────────────────
-- RPC: delete_photo_challenge
-- Creator-only. Undoes everything the challenge put into the points
-- system before removing it:
--   • the 'challenge_completed' points each completer earned
--   • the 'challenger_1' / 'challenger_3' achievements (and their points)
--     for any completer who, without this challenge, no longer meets the
--     threshold
-- Linked photo submissions survive (challenge_id is set to null via the FK)
-- so their independently-earned 'photo_approved' points are left intact.
-- ─────────────────────────────────────────────
create or replace function delete_photo_challenge(p_challenge_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id   uuid := auth.uid();
  v_challenge photo_challenges%rowtype;
  v_affected  uuid[];
  v_uid       uuid;
  v_remaining int;
begin
  select * into v_challenge from photo_challenges where id = p_challenge_id;
  if not found then
    return json_build_object('error', 'Desafio não encontrado');
  end if;

  -- only the creator may delete their challenge
  if v_challenge.creator_id != v_user_id then
    return json_build_object('error', 'Apenas o criador pode excluir o desafio');
  end if;

  -- capture everyone who completed it before we remove the completions
  select array_agg(distinct user_id) into v_affected
    from photo_challenge_completions where challenge_id = p_challenge_id;

  -- undo the challenge-completion points awarded for this challenge
  delete from points_log
    where reason = 'challenge_completed' and ref_id = p_challenge_id;

  -- remove the completions (also handled by the FK cascade, but we need
  -- them gone before recomputing achievement eligibility below)
  delete from photo_challenge_completions where challenge_id = p_challenge_id;

  -- re-evaluate the challenger achievements for every affected user: keep
  -- the badge only if their remaining completions still meet the threshold
  if v_affected is not null then
    foreach v_uid in array v_affected loop
      select count(*) into v_remaining
        from photo_challenge_completions where user_id = v_uid;
      if v_remaining < 1 then perform revoke_achievement(v_uid, 'challenger_1'); end if;
      if v_remaining < 3 then perform revoke_achievement(v_uid, 'challenger_3'); end if;
    end loop;
  end if;

  -- finally drop the challenge itself (linked submissions are unlinked, not deleted)
  delete from photo_challenges where id = p_challenge_id;

  return json_build_object(
    'deleted', true,
    'completions_undone', coalesce(array_length(v_affected, 1), 0)
  );
end;
$$;
