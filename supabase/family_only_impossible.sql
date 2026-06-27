-- Questions answered correctly only by members of the creator's family are
-- considered impossible. They award no answer points, creator points, or bet
-- payouts, just like questions nobody answered correctly.
--
-- Run after powerups.sql because this replaces its latest settle_question RPC.

create or replace function settle_question(p_question_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_question              questions%rowtype;
  v_total                 int;
  v_correct               int;
  v_un_total              int;
  v_un_correct            int;
  v_diff_total            int;
  v_diff_correct          int;
  v_eligible              int;
  v_creator_group         int;
  v_outside_family_correct int;
  v_family_only           boolean := false;
  v_ratio                 numeric;
  v_difficulty            text;
  v_per_pts               int := 0;
  v_bet_mult              numeric := 0;
  v_payout                int;
  v_ans                   record;
  v_affected              uuid[];
  v_uid                   uuid;
begin
  select * into v_question from questions where id = p_question_id;
  if not found then return json_build_object('settled', false); end if;
  if v_question.status = 'closed' then
    return json_build_object('settled', false, 'already', true);
  end if;

  select count(*) into v_total from answers where question_id = p_question_id;
  select count(*) into v_eligible
    from profiles where role = 'adult' and id <> v_question.creator_id;
  if v_eligible <= 0 or v_total < v_eligible then
    return json_build_object('settled', false, 'not_ready', true);
  end if;

  update questions set status = 'closed', closed_at = now() where id = p_question_id;

  select count(*) into v_correct
  from answers
  where question_id = p_question_id and is_correct = true;

  select couple_group into v_creator_group
  from profiles
  where id = v_question.creator_id;

  select count(*) into v_outside_family_correct
  from answers a
  join profiles answerer on answerer.id = a.user_id
  where a.question_id = p_question_id
    and a.is_correct = true
    and answerer.couple_group <> v_creator_group;

  v_family_only := v_correct > 0 and v_outside_family_correct = 0;

  -- Assisted answers remain excluded from the ordinary difficulty ratio. The
  -- family-only rule deliberately considers every correct answer: assistance
  -- must not let an otherwise family-only question award points.
  select count(*) into v_un_total
  from answers
  where question_id = p_question_id and assisted = false;

  select count(*) into v_un_correct
  from answers
  where question_id = p_question_id and assisted = false and is_correct = true;

  if v_un_total = 0 then
    v_diff_total := v_total;
    v_diff_correct := v_correct;
  else
    v_diff_total := v_un_total;
    v_diff_correct := v_un_correct;
  end if;

  if v_diff_total = 0 or v_diff_correct = 0 or v_family_only then
    v_difficulty := 'impossible';
    v_per_pts := 0;
    v_bet_mult := 0;
  else
    v_ratio := v_diff_correct::numeric / v_diff_total::numeric;
    if v_ratio <= 1.0/3.0 then
      v_difficulty := 'hard';
      v_per_pts := 20;
      v_bet_mult := 3;
    elsif v_ratio <= 2.0/3.0 then
      v_difficulty := 'medium';
      v_per_pts := 12;
      v_bet_mult := 2;
    else
      v_difficulty := 'easy';
      v_per_pts := 5;
      v_bet_mult := 1.5;
    end if;
  end if;

  update questions set difficulty = v_difficulty where id = p_question_id;

  if v_per_pts > 0 then
    for v_ans in
      select id, user_id from answers
      where question_id = p_question_id and is_correct = true
    loop
      insert into points_log (user_id, amount, reason, ref_id)
      values (v_ans.user_id, v_per_pts, 'correct_answer', v_ans.id);
    end loop;
  end if;

  if v_difficulty = 'impossible' then
    delete from points_log
    where reason = 'question_created' and ref_id = p_question_id;
  elsif v_difficulty = 'hard' then
    insert into points_log (user_id, amount, reason, ref_id)
    values (v_question.creator_id, 10, 'question_hard_bonus', p_question_id);
  end if;

  if v_bet_mult > 0 then
    for v_ans in
      select id, user_id, coins_wagered from answers
      where question_id = p_question_id and is_correct = true and coins_wagered > 0
    loop
      v_payout := floor(v_ans.coins_wagered * v_bet_mult)::int;
      update answers set coins_won = v_payout where id = v_ans.id;
      insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
      values (
        v_ans.user_id,
        v_payout,
        'nenecoin',
        'question_bet_won',
        v_ans.id,
        'Ganhou aposta na pergunta (' || v_difficulty || ')'
      );
    end loop;
  end if;

  select array_agg(distinct uid) into v_affected from (
    select v_question.creator_id as uid
    union
    select user_id from answers where question_id = p_question_id
  ) u;

  if v_affected is not null then
    foreach v_uid in array v_affected loop
      perform check_points_achievements(v_uid);
    end loop;
  end if;

  perform post_push(jsonb_build_object(
    'event',          'question_settled',
    'target_user_id', v_question.creator_id,
    'question_id',    p_question_id,
    'content',        v_question.content,
    'role',           'creator',
    'difficulty',     v_difficulty,
    'family_only',    v_family_only
  ));

  for v_ans in
    select id, user_id, is_correct from answers where question_id = p_question_id
  loop
    perform post_push(jsonb_build_object(
      'event',          'question_settled',
      'target_user_id', v_ans.user_id,
      'question_id',    p_question_id,
      'content',        v_question.content,
      'role',           'answerer',
      'is_correct',     v_ans.is_correct,
      'points',         case when v_ans.is_correct then v_per_pts else 0 end,
      'difficulty',     v_difficulty,
      'family_only',    v_family_only
    ));
  end loop;

  return json_build_object(
    'settled',     true,
    'difficulty',  v_difficulty,
    'correct',     v_correct,
    'total',       v_total,
    'points_each', v_per_pts,
    'family_only', v_family_only
  );
end;
$$;

-- Backfill closed questions previously scored as hard/medium/easy even though
-- every correct answer came from the creator's family. Reverse the rewards so
-- historical totals follow the same rule as future settlements.
do $$
declare
  v_question_id uuid;
begin
  for v_question_id in
    select q.id
    from questions q
    join profiles creator on creator.id = q.creator_id
    where q.status = 'closed'
      and q.difficulty <> 'impossible'
      and exists (
        select 1 from answers a
        where a.question_id = q.id and a.is_correct = true
      )
      and not exists (
        select 1
        from answers a
        join profiles answerer on answerer.id = a.user_id
        where a.question_id = q.id
          and a.is_correct = true
          and answerer.couple_group <> creator.couple_group
      )
  loop
    delete from points_log
    where reason in ('question_created', 'question_hard_bonus')
      and ref_id = v_question_id;

    delete from points_log
    where reason = 'correct_answer'
      and ref_id in (
        select id from answers where question_id = v_question_id
      );

    delete from nenecoins_ledger
    where tx_type = 'question_bet_won'
      and ref_id in (
        select id from answers where question_id = v_question_id
      );

    update answers
    set coins_won = 0
    where question_id = v_question_id;

    update questions
    set difficulty = 'impossible'
    where id = v_question_id;
  end loop;
end;
$$;
