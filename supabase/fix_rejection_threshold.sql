-- Fix: require exactly 4 rejections (hard minimum) for a photo to be rejected.
-- Previously used a dynamic formula based on group size.
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
