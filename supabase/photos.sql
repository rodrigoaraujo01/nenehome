-- nenehome — Photo submissions schema
-- Run this in the Supabase SQL editor AFTER schema.sql

-- ─────────────────────────────────────────────
-- Storage bucket
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('photo-submissions', 'photo-submissions', true)
on conflict (id) do nothing;

create policy "photo-submissions: authenticated can upload"
  on storage.objects for insert
  with check (bucket_id = 'photo-submissions' and auth.role() = 'authenticated');

create policy "photo-submissions: anyone can read"
  on storage.objects for select
  using (bucket_id = 'photo-submissions');

create policy "photo-submissions: owner can delete"
  on storage.objects for delete
  using (bucket_id = 'photo-submissions' and auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────────
-- photo_submissions
-- ─────────────────────────────────────────────
create table if not exists photo_submissions (
  id            uuid primary key default gen_random_uuid(),
  submitter_id  uuid not null references profiles(id),
  caption       text,
  photo_url     text not null,
  storage_path  text not null,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  points_reward int  not null default 20,
  votes_to_approve int not null default 4,
  created_at    timestamptz default now()
);

alter table photo_submissions enable row level security;

create policy "photo_submissions: authenticated can read"
  on photo_submissions for select using (auth.role() = 'authenticated');

create policy "photo_submissions: submitter can insert"
  on photo_submissions for insert with check (auth.uid() = submitter_id);

-- ─────────────────────────────────────────────
-- photo_votes
-- ─────────────────────────────────────────────
create table if not exists photo_votes (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references photo_submissions(id) on delete cascade,
  voter_id      uuid not null references profiles(id),
  approved      boolean not null,
  created_at    timestamptz default now(),
  unique (submission_id, voter_id)
);

alter table photo_votes enable row level security;

create policy "photo_votes: authenticated can read"
  on photo_votes for select using (auth.role() = 'authenticated');

create policy "photo_votes: voter can insert own"
  on photo_votes for insert with check (auth.uid() = voter_id);

-- ─────────────────────────────────────────────
-- RPC: vote_on_submission
-- Records vote, checks threshold, awards points.
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
  v_user_id         uuid := auth.uid();
  v_submission      photo_submissions%rowtype;
  v_approve_count   int;
  v_reject_count    int;
  v_eligible        int;
  v_new_status      text := 'pending';
begin
  select * into v_submission
    from photo_submissions where id = p_submission_id;

  if not found then
    raise exception 'submission not found';
  end if;
  if v_submission.status <> 'pending' then
    raise exception 'submission is not pending';
  end if;
  if v_submission.submitter_id = v_user_id then
    raise exception 'cannot vote on own submission';
  end if;

  insert into photo_votes (submission_id, voter_id, approved)
  values (p_submission_id, v_user_id, p_approved);

  select count(*) into v_approve_count
    from photo_votes where submission_id = p_submission_id and approved = true;
  select count(*) into v_reject_count
    from photo_votes where submission_id = p_submission_id and approved = false;

  -- eligible voters = all adults minus the submitter
  select count(*) - 1 into v_eligible
    from profiles where role = 'adult';

  if v_approve_count >= v_submission.votes_to_approve then
    v_new_status := 'approved';
    update photo_submissions set status = 'approved' where id = p_submission_id;
    insert into points_log (user_id, amount, reason, ref_id)
    values (v_submission.submitter_id, v_submission.points_reward, 'photo_approved', p_submission_id);
  elsif v_reject_count > (v_eligible - v_submission.votes_to_approve) then
    v_new_status := 'rejected';
    update photo_submissions set status = 'rejected' where id = p_submission_id;
  end if;

  return json_build_object(
    'approve_count', v_approve_count,
    'reject_count',  v_reject_count,
    'status',        v_new_status
  );
end;
$$;
