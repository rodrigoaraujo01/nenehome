-- Allow a voter to undo / change their vote while a submission is still pending.
-- Once a submission has reached 'approved' or 'rejected' the vote is locked
-- (the RPC raises and the UI hides the undo button).
--
-- Note: we intentionally do NOT revoke the 'voter_5' achievement if a user's
-- vote count drops below 5 after undoing. The app does not revoke achievements
-- for reversible micro-actions; keeping it is consistent and simpler.
create or replace function unvote_on_submission(
  p_submission_id uuid
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
begin
  select * into v_submission from photo_submissions where id = p_submission_id;
  if not found then raise exception 'submission not found'; end if;
  if v_submission.status <> 'pending' then raise exception 'submission is not pending'; end if;

  delete from photo_votes
    where submission_id = p_submission_id and voter_id = v_user_id;

  select count(*) into v_approve_count from photo_votes where submission_id = p_submission_id and approved = true;
  select count(*) into v_reject_count  from photo_votes where submission_id = p_submission_id and approved = false;

  return json_build_object(
    'approve_count', v_approve_count,
    'reject_count',  v_reject_count,
    'status',        'pending',
    'achievements',  to_json('{}'::json[])
  );
end;
$$;
