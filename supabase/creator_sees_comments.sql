-- nenehome — O criador enxerga (e participa d)a conversa da própria pergunta.
-- Rodar DEPOIS de question_comments.sql.
--
-- Reverte a decisão original ("Question creators do not get a special exception
-- because they cannot answer their own question"): o criador não responde, mas
-- é dono do conteúdo e quer ver o que o grupo achou. Não vaza nada — a conversa
-- segue invisível pra quem ainda não respondeu, e o criador já via as respostas
-- (get_question_answers sempre teve exceção pra ele).

-- ─────────────────────────────────────────────
-- RLS: leitura — quem respondeu OU o criador
-- ─────────────────────────────────────────────
drop policy if exists "question comments: answerers can read" on question_comments;
drop policy if exists "question comments: answerers or creator can read" on question_comments;
create policy "question comments: answerers or creator can read"
  on question_comments for select
  using (
    exists (
      select 1 from answers a
      where a.question_id = question_comments.question_id
        and a.user_id = auth.uid()
    )
    or exists (
      select 1 from questions q
      where q.id = question_comments.question_id
        and q.creator_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- RLS: escrita — quem respondeu OU o criador
-- ─────────────────────────────────────────────
drop policy if exists "question comments: answerers can insert" on question_comments;
drop policy if exists "question comments: answerers or creator can insert" on question_comments;
create policy "question comments: answerers or creator can insert"
  on question_comments for insert
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1 from answers a
        where a.question_id = question_comments.question_id
          and a.user_id = auth.uid()
      )
      or exists (
        select 1 from questions q
        where q.id = question_comments.question_id
          and q.creator_id = auth.uid()
      )
    )
  );

-- ─────────────────────────────────────────────
-- notify_question_comment — duas correções:
--
-- 1. O lookup do comentarista fazia JOIN em answers, então um comentário do
--    criador (que nunca tem answer) sairia com commenter/is_correct nulos.
--    Agora o nome vem de profiles e is_correct fica null pro criador.
-- 2. O criador nunca era notificado da conversa na própria pergunta. Agora ele
--    entra na lista de alvos (sem se auto-notificar quando é ele quem comenta).
-- ─────────────────────────────────────────────
create or replace function notify_question_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commenter       text;
  v_creator         text;
  v_creator_id      uuid;
  v_is_correct      boolean;
  v_target_user_ids jsonb;
begin
  select q.creator_id, creator.nickname
    into v_creator_id, v_creator
  from questions q
  join profiles creator on creator.id = q.creator_id
  where q.id = new.question_id;

  select p.nickname into v_commenter
  from profiles p where p.id = new.user_id;

  -- null quando quem comentou é o criador (não respondeu, não tem acerto/erro)
  select a.is_correct into v_is_correct
  from answers a
  where a.question_id = new.question_id and a.user_id = new.user_id;

  -- alvos: todo mundo que respondeu + o criador, menos quem acabou de comentar
  select coalesce(jsonb_agg(distinct t.user_id), '[]'::jsonb)
    into v_target_user_ids
  from (
    select a.user_id from answers a where a.question_id = new.question_id
    union
    select v_creator_id
  ) t
  where t.user_id <> new.user_id;

  if jsonb_array_length(v_target_user_ids) > 0 then
    perform post_push(jsonb_build_object(
      'event',           'question_comment',
      'target_user_ids', v_target_user_ids,
      'question_id',     new.question_id,
      'comment_id',      new.id,
      'commenter',       v_commenter,
      'question_creator', v_creator,
      'is_correct',      v_is_correct,
      -- sem isso a Edge Function formataria "fulano comentou na pergunta de
      -- fulano depois de errar" (is_correct null cai no ramo do erro)
      'is_creator',      new.user_id = v_creator_id
    ));
  end if;

  return new;
end;
$$;
