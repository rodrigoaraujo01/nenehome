-- nenehome — Deletion RPCs for user-created content
-- Run AFTER schema.sql, achievements.sql, photos.sql and photo_challenges.sql
--
-- Gives creators a way to wipe the things they create — questions and photo
-- submissions — mirroring the existing delete_bet / delete_photo_challenge
-- behaviour: every point and achievement the content produced is reverted, as
-- if it had never existed. Runs as security definer so it can touch other
-- members' points/achievements (and storage objects) that RLS would block.

-- ─────────────────────────────────────────────
-- RPC: delete_question
-- Creator-only. Removes the question, its options and every answer, then
-- undoes the points it generated:
--   • 'question_created' for the creator
--   • 'correct_answer' for everyone who answered correctly
-- Re-evaluates the count-based badges that may have dropped
-- (question_1/5 for the creator, first_correct/correct_5/correct_25 for
-- answerers) and the points_100/500 milestones, revoking each (and refunding
-- its points) when the user no longer qualifies.
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

  -- answers tied to this question + everyone touched (creator + answerers)
  select array_agg(id) into v_answer_ids
    from answers where question_id = p_question_id;

  select array_agg(distinct uid) into v_affected from (
    select v_question.creator_id as uid
    union
    select user_id from answers where question_id = p_question_id
  ) u;

  -- undo points: creator bonus + every correct answer
  delete from points_log
    where reason = 'question_created' and ref_id = p_question_id;
  if v_answer_ids is not null then
    delete from points_log
      where reason = 'correct_answer' and ref_id = any(v_answer_ids);
  end if;

  -- remove the rows (question_options cascade off the question delete)
  delete from answers where question_id = p_question_id;
  delete from questions where id = p_question_id;

  -- re-evaluate count-based achievements for everyone affected
  if v_affected is not null then
    foreach v_uid in array v_affected loop
      select count(*) into v_remaining
        from questions where creator_id = v_uid;
      if v_remaining < 1 then perform revoke_achievement(v_uid, 'question_1'); end if;
      if v_remaining < 5 then perform revoke_achievement(v_uid, 'question_5'); end if;

      select count(*) into v_remaining
        from answers where user_id = v_uid and is_correct = true;
      if v_remaining < 1  then perform revoke_achievement(v_uid, 'first_correct'); end if;
      if v_remaining < 5  then perform revoke_achievement(v_uid, 'correct_5'); end if;
      if v_remaining < 25 then perform revoke_achievement(v_uid, 'correct_25'); end if;
    end loop;

    -- milestones last: totals have settled after every refund above
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
-- RPC: delete_photo_submission
-- Submitter-only. Removes a single photo (and its votes / challenge
-- completion / storage file), undoing the points it earned:
--   • 'photo_approved' for the submitter
--   • 'challenge_completed' when the photo completed a challenge
-- Re-evaluates the badges whose counts may have dropped (photographer_1/3 and
-- challenger_1/3 for the submitter, voter_5 for anyone who voted) plus the
-- points_100/500 milestones.
-- ─────────────────────────────────────────────
create or replace function delete_photo_submission(p_submission_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id       uuid := auth.uid();
  v_submission    photo_submissions%rowtype;
  v_completion    photo_challenge_completions%rowtype;
  v_has_completion boolean := false;
  v_affected      uuid[];
  v_uid           uuid;
  v_remaining     int;
  v_total         int;
  v_storage_error text := null;
begin
  select * into v_submission from photo_submissions where id = p_submission_id;
  if not found then
    return json_build_object('error', 'Foto não encontrada');
  end if;

  if v_submission.submitter_id != v_user_id then
    return json_build_object('error', 'Apenas quem enviou pode excluir a foto');
  end if;

  -- everyone touched: the submitter plus anyone who voted on this photo
  select array_agg(distinct uid) into v_affected from (
    select v_submission.submitter_id as uid
    union
    select voter_id from photo_votes where submission_id = p_submission_id
  ) u;

  -- if the photo completed a challenge, undo those points too
  select * into v_completion
    from photo_challenge_completions where submission_id = p_submission_id;
  if found then
    v_has_completion := true;
    delete from points_log
      where reason = 'challenge_completed'
        and ref_id = v_completion.challenge_id
        and user_id = v_completion.user_id;
  end if;

  -- undo the approval points
  delete from points_log
    where reason = 'photo_approved' and ref_id = p_submission_id;

  -- wipe the file from storage (best effort — must not abort the reversal)
  begin
    delete from storage.objects
      where bucket_id = 'photo-submissions' and name = v_submission.storage_path;
  exception when others then
    v_storage_error := SQLERRM;
  end;

  -- delete the submission (cascades photo_votes and the completion row)
  delete from photo_submissions where id = p_submission_id;

  -- re-evaluate count-based achievements for everyone affected
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

    -- milestones last: totals have settled after every refund above
    foreach v_uid in array v_affected loop
      select coalesce(sum(amount), 0) into v_total
        from points_log where user_id = v_uid;
      if v_total < 100 then perform revoke_achievement(v_uid, 'points_100'); end if;
      if v_total < 500 then perform revoke_achievement(v_uid, 'points_500'); end if;
    end loop;
  end if;

  return json_build_object(
    'deleted', true,
    'completed_challenge', v_has_completion,
    'storage_error', v_storage_error
  );
end;
$$;
