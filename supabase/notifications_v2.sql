-- Notifications v2 — targeted events + per-event preferences.
--
-- Adds:
--   1. notification_prefs: per-member opt-out flags (default: everything on).
--   2. post_push(jsonb): shared helper to POST a body to the send-push Edge Function.
--   3. submit_answer: notifies the question creator once every player has answered.
--   4. vote_on_submission: notifies the submitter when their photo is rejected.
--
-- Run after push_subscriptions.sql. Re-deploy the send-push Edge Function so it
-- reads notification_prefs and handles the new {event, target_user_id} payloads.

-- ─── Per-event preferences ──────────────────────────────────────────────────────
-- Opt-out model: a missing row (or null column) means "send". The Edge Function
-- treats only an explicit `false` as "don't send".

create table if not exists notification_prefs (
  user_id            uuid primary key references profiles(id) on delete cascade,
  new_question       boolean not null default true,
  new_challenge      boolean not null default true,
  new_photo          boolean not null default true,
  question_completed boolean not null default true,
  photo_rejected     boolean not null default true,
  updated_at         timestamptz not null default now()
);

alter table notification_prefs enable row level security;

drop policy if exists "own notification prefs: select" on notification_prefs;
create policy "own notification prefs: select" on notification_prefs
  for select using (user_id = auth.uid());

drop policy if exists "own notification prefs: insert" on notification_prefs;
create policy "own notification prefs: insert" on notification_prefs
  for insert with check (user_id = auth.uid());

drop policy if exists "own notification prefs: update" on notification_prefs;
create policy "own notification prefs: update" on notification_prefs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Shared push helper ─────────────────────────────────────────────────────────
-- Posts an arbitrary JSON body to the send-push Edge Function. Used by the
-- new-content trigger and by the targeted notifications inside the RPCs below.

create or replace function post_push(p_body jsonb)
returns void
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
    return; -- secret not set yet; do nothing
  end if;

  perform net.http_post(
    url     := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := p_body
  );
end;
$$;

-- Re-point the existing new-content trigger function at the shared helper.
create or replace function notify_new_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform post_push(jsonb_build_object(
    'table',  tg_table_name,
    'record', row_to_json(new)
  ));
  return new;
end;
$$;

-- ─── submit_answer: notify creator when all players have answered ───────────────
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
  v_answer_count int;
  v_eligible     int;
begin
  -- fetch question
  select * into v_question from questions where id = p_question_id;
  if not found then
    raise exception 'question not found';
  end if;
  if v_question.status = 'closed' then
    raise exception 'question is closed';
  end if;
  if v_user_id = v_question.creator_id then
    raise exception 'creator cannot answer own question';
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

  -- notify the creator once every eligible player has answered
  select count(*) into v_answer_count from answers where question_id = p_question_id;
  select count(*) - 1 into v_eligible from profiles where role = 'adult';
  if v_eligible > 0 and v_answer_count >= v_eligible then
    perform post_push(jsonb_build_object(
      'event',          'question_completed',
      'target_user_id', v_question.creator_id,
      'question_id',    p_question_id,
      'content',        v_question.content
    ));
  end if;

  return json_build_object(
    'is_correct', v_is_correct,
    'points_earned', v_points
  );
end;
$$;

-- ─── vote_on_submission: notify submitter when their photo is rejected ──────────
create or replace function vote_on_submission(
  p_submission_id uuid,
  p_approved      boolean
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id                uuid := auth.uid();
  v_submission             photo_submissions%rowtype;
  v_approve_count          int;
  v_reject_count           int;
  v_new_status             text := 'pending';
  v_vote_count             int;
  v_photo_count            int;
  v_achievements           json[] := '{}';
  v_challenge_achievements json[];
  v_a                      json;
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

    -- challenge completion
    if v_submission.challenge_id is not null then
      v_challenge_achievements := complete_challenge_submission(
        v_submission.challenge_id, v_submission.submitter_id, p_submission_id
      );
      v_achievements := array_cat(v_achievements, v_challenge_achievements);
    end if;

  elsif v_reject_count >= 4 then
    v_new_status := 'rejected';
    update photo_submissions set status = 'rejected' where id = p_submission_id;

    -- notify the submitter that their photo did not pass
    perform post_push(jsonb_build_object(
      'event',          'photo_rejected',
      'target_user_id', v_submission.submitter_id,
      'submission_id',  p_submission_id,
      'caption',        v_submission.caption
    ));
  end if;

  return json_build_object(
    'approve_count', v_approve_count,
    'reject_count',  v_reject_count,
    'status',        v_new_status,
    'achievements',  to_json(v_achievements)
  );
end;
$$;
