-- Fix: complete_challenge_submission was returning early when now() > deadline,
-- dropping challenge points for photos approved after the deadline even if
-- they were submitted before it. Deadline only blocks new submissions (UI-side).
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
-- Manual fix: award the missing challenge points to Rodrigo.
-- Replace the UUIDs below before running.
-- ─────────────────────────────────────────────
-- Step 1: find your user id and the challenge id
--   select id, nickname from profiles;
--   select id, title, points_reward from photo_challenges;

-- Step 2: insert the missing completion record (if not already there)
--   insert into photo_challenge_completions (challenge_id, user_id, submission_id)
--   values ('<challenge_id>', '<your_user_id>', '<your_submission_id>')
--   on conflict do nothing;

-- Step 3: award the missing points
--   insert into points_log (user_id, amount, reason, ref_id)
--   values ('<your_user_id>', 100, 'challenge_completed', '<challenge_id>');
