-- Answer-gated comments on questions.
-- Run after notifications_v2.sql so post_push(jsonb) and notification_prefs exist.

create table if not exists question_comments (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  content     text not null check (char_length(btrim(content)) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists question_comments_question_created_idx
  on question_comments (question_id, created_at);

alter table question_comments enable row level security;

-- Even if a client queries this table directly, comments stay invisible until
-- the current user has answered the question. Question creators do not get a
-- special exception because they cannot answer their own question.
drop policy if exists "question comments: answerers can read" on question_comments;
create policy "question comments: answerers can read"
  on question_comments for select
  using (
    exists (
      select 1
      from answers a
      where a.question_id = question_comments.question_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "question comments: answerers can insert" on question_comments;
create policy "question comments: answerers can insert"
  on question_comments for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from answers a
      where a.question_id = question_comments.question_id
        and a.user_id = auth.uid()
    )
  );

alter table notification_prefs
  add column if not exists question_comment boolean not null default true;

-- Notify every other user who has answered this question. The payload already
-- contains the display names and result so the Edge Function only formats and
-- delivers it.
create or replace function notify_question_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commenter       text;
  v_creator         text;
  v_is_correct      boolean;
  v_target_user_ids jsonb;
begin
  select commenter.nickname, creator.nickname, a.is_correct
    into v_commenter, v_creator, v_is_correct
  from answers a
  join profiles commenter on commenter.id = new.user_id
  join questions q on q.id = new.question_id
  join profiles creator on creator.id = q.creator_id
  where a.question_id = new.question_id
    and a.user_id = new.user_id;

  select coalesce(jsonb_agg(a.user_id), '[]'::jsonb)
    into v_target_user_ids
  from answers a
  where a.question_id = new.question_id
    and a.user_id <> new.user_id;

  if jsonb_array_length(v_target_user_ids) > 0 then
    perform post_push(jsonb_build_object(
      'event',           'question_comment',
      'target_user_ids', v_target_user_ids,
      'question_id',     new.question_id,
      'comment_id',      new.id,
      'commenter',       v_commenter,
      'question_creator', v_creator,
      'is_correct',      v_is_correct
    ));
  end if;

  return new;
end;
$$;

drop trigger if exists question_comment_push on question_comments;
create trigger question_comment_push
  after insert on question_comments
  for each row execute function notify_question_comment();
