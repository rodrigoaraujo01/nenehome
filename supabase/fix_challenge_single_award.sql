-- Fix: a user may submit multiple photos to the same challenge, but should
-- earn the per-photo `photo_approved` points only for the FIRST one approved.
--   • challenge_completed points were already deduped via the
--     unique (challenge_id, user_id) constraint on photo_challenge_completions.
--   • photo_approved (points_reward) points were awarded on every approval,
--     letting a user farm points by flooding a single challenge. Now gated to
--     the first approved submission per (challenge, submitter).
-- Builds on fix_vote_on_submission_full.sql (rejection threshold = 4,
-- challenge completion restored).
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
  v_award_photo_points     boolean;
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

    -- per-photo approval points: for challenge photos, only the first approved
    -- submission per (challenge, submitter) earns points. Non-challenge photos
    -- always earn.
    if v_submission.challenge_id is null then
      v_award_photo_points := true;
    else
      select not exists (
        select 1 from photo_submissions
        where challenge_id  = v_submission.challenge_id
          and submitter_id  = v_submission.submitter_id
          and status        = 'approved'
          and id           <> p_submission_id
      ) into v_award_photo_points;
    end if;

    if v_award_photo_points then
      insert into points_log (user_id, amount, reason, ref_id)
      values (v_submission.submitter_id, v_submission.points_reward, 'photo_approved', p_submission_id);
    end if;

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

    -- challenge completion (challenge_completed points deduped by unique constraint)
    if v_submission.challenge_id is not null then
      v_challenge_achievements := complete_challenge_submission(
        v_submission.challenge_id, v_submission.submitter_id, p_submission_id
      );
      v_achievements := array_cat(v_achievements, v_challenge_achievements);
    end if;

  elsif v_reject_count >= 4 then
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
-- Optional one-time cleanup: remove duplicate photo_approved points already
-- granted for 2nd+ approved photos in the same challenge by the same user.
-- Keeps the earliest approved submission per (challenge, submitter).
-- Review the SELECT before running the DELETE.
-- ─────────────────────────────────────────────
-- with ranked as (
--   select ps.id as submission_id,
--          row_number() over (
--            partition by ps.challenge_id, ps.submitter_id
--            order by ps.created_at
--          ) as rn
--   from photo_submissions ps
--   where ps.challenge_id is not null
--     and ps.status = 'approved'
-- )
-- select * from points_log
-- where reason = 'photo_approved'
--   and ref_id in (select submission_id from ranked where rn > 1);
--
-- The CTE only applies to the statement it prefixes, so the DELETE needs its own:
-- with ranked as (
--   select ps.id as submission_id,
--          row_number() over (
--            partition by ps.challenge_id, ps.submitter_id
--            order by ps.created_at
--          ) as rn
--   from photo_submissions ps
--   where ps.challenge_id is not null
--     and ps.status = 'approved'
-- )
-- delete from points_log
-- where reason = 'photo_approved'
--   and ref_id in (select submission_id from ranked where rn > 1);
