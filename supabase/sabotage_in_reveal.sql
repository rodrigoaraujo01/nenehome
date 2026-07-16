-- nenehome — Mostrar a alternativa-decoy escolhida (e quem sabotou) no reveal
-- Rodar DEPOIS de scoring_v2.sql (e dos demais que redefinem get_question_answers).
--
-- Quando alguém cai na Sabotagem, submit_answer grava answers.selected_option_id
-- = NULL (a decoy não é uma question_options real), então "O que o grupo achou"
-- mostrava "—". Aqui expomos, só no reveal (já pós-resposta, sem spoiler), o
-- texto da alternativa falsa e o apelido de quem a plantou.
-- ─────────────────────────────────────────────
drop function if exists get_question_answers(uuid);

create or replace function get_question_answers(p_question_id uuid)
returns table (
  id                 uuid,
  user_id            uuid,
  selected_option_id uuid,
  subject_guess_id   text,
  is_correct         boolean,
  created_at         timestamptz,
  nickname           text,
  avatar_url         text,
  points_earned      int,
  sabotage_decoy_text text,
  saboteur_nickname   text
)
language plpgsql
security definer
as $$
begin
  if auth.role() <> 'authenticated' then
    return;
  end if;

  if not exists (
    select 1 from answers a
    where a.question_id = p_question_id and a.user_id = auth.uid()
  ) and not exists (
    select 1 from questions q
    where q.id = p_question_id and q.creator_id = auth.uid()
  ) then
    return;
  end if;

  return query
    select
      a.id,
      a.user_id,
      a.selected_option_id,
      a.subject_guess_id,
      a.is_correct,
      a.created_at,
      pr.nickname,
      pr.avatar_url,
      coalesce((
        select sum(pl.amount)::int from points_log pl
        where pl.reason = 'correct_answer' and pl.ref_id = a.id
      ), 0) as points_earned,
      qs.decoy_text as sabotage_decoy_text,
      spr.nickname  as saboteur_nickname
    from answers a
    join profiles pr on pr.id = a.user_id
    left join question_sabotages qs
      on qs.question_id = a.question_id
     and qs.target_user_id = a.user_id
     and qs.hit = true
    left join profiles spr on spr.id = qs.saboteur_id
    where a.question_id = p_question_id
    order by a.created_at asc;
end;
$$;
