-- One-time backfill: challenge photos approved while complete_challenge_submission
-- was disabled (dropped by fix_rejection_threshold.sql, restored later) never
-- recorded a completion row nor awarded challenge_completed points.
--
-- This backfills both, idempotently:
--   Step 1 — insert the missing completion (one per challenge+user, earliest
--            approved submission). The completion counter (0/8) reads from here.
--   Step 2 — award challenge_completed points for any completion missing them.
--
-- photo_approved points are NOT touched here (they were already awarded; the
-- duplicates were handled by fix_challenge_single_award.sql).
-- Run the preview SELECTs first, then the writes.

-- ── Step 1: preview the completions to be inserted ──────────────────────────
select distinct on (ps.challenge_id, ps.submitter_id)
  ps.challenge_id, ps.submitter_id, ps.id as submission_id, ps.created_at
from photo_submissions ps
where ps.challenge_id is not null
  and ps.status = 'approved'
order by ps.challenge_id, ps.submitter_id, ps.created_at;

-- ── Step 1: insert ──────────────────────────────────────────────────────────
insert into photo_challenge_completions (challenge_id, user_id, submission_id)
select distinct on (ps.challenge_id, ps.submitter_id)
  ps.challenge_id, ps.submitter_id, ps.id
from photo_submissions ps
where ps.challenge_id is not null
  and ps.status = 'approved'
order by ps.challenge_id, ps.submitter_id, ps.created_at
on conflict (challenge_id, user_id) do nothing;

-- ── Step 2: preview the challenge_completed points to be awarded ────────────
select comp.user_id, c.points_reward as amount, comp.challenge_id
from photo_challenge_completions comp
join photo_challenges c on c.id = comp.challenge_id
where not exists (
  select 1 from points_log pl
  where pl.reason  = 'challenge_completed'
    and pl.ref_id  = comp.challenge_id
    and pl.user_id = comp.user_id
);

-- ── Step 2: award ───────────────────────────────────────────────────────────
insert into points_log (user_id, amount, reason, ref_id)
select comp.user_id, c.points_reward, 'challenge_completed', comp.challenge_id
from photo_challenge_completions comp
join photo_challenges c on c.id = comp.challenge_id
where not exists (
  select 1 from points_log pl
  where pl.reason  = 'challenge_completed'
    and pl.ref_id  = comp.challenge_id
    and pl.user_id = comp.user_id
);
