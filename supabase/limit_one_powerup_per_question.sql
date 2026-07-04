-- ─────────────────────────────────────────────
-- Limita a 1 poder por pergunta (por usuário):
-- usar Eliminar Alternativa bloqueia Segunda Chance e vice-versa.
-- Redefine use_eliminate_option e submit_answer com o guard ampliado
-- (qualquer question_assists do usuário na pergunta, não só o mesmo kind).
-- Rodar DEPOIS de powerups.sql.
-- ─────────────────────────────────────────────

create or replace function use_eliminate_option(p_question_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id  uuid := auth.uid();
  v_question questions%rowtype;
  v_option   uuid;
begin
  select * into v_question from questions where id = p_question_id;
  if not found then return json_build_object('error', 'Pergunta não encontrada'); end if;
  if v_question.type != 'multiple_choice' then
    return json_build_object('error', 'Só funciona em múltipla escolha');
  end if;
  if v_question.status = 'closed' then return json_build_object('error', 'Pergunta encerrada'); end if;
  if v_user_id = v_question.creator_id then
    return json_build_object('error', 'O criador não responde a própria pergunta');
  end if;
  if exists (select 1 from answers where question_id = p_question_id and user_id = v_user_id) then
    return json_build_object('error', 'Você já respondeu');
  end if;
  if exists (select 1 from question_assists
             where question_id = p_question_id and user_id = v_user_id) then
    return json_build_object('error', 'Você só pode usar um poder por pergunta');
  end if;
  if powerup_qty(v_user_id, 'eliminate') < 1 then
    return json_build_object('error', 'Sem Eliminar Alternativa no inventário');
  end if;

  select id into v_option
  from question_options
  where question_id = p_question_id and is_correct = false
  order by random()
  limit 1;

  if v_option is null then
    return json_build_object('error', 'Nada para eliminar');
  end if;

  insert into question_assists (question_id, user_id, kind)
  values (p_question_id, v_user_id, 'eliminate');

  insert into powerup_ledger (user_id, powerup_key, delta, reason, ref_id)
  values (v_user_id, 'eliminate', -1, 'use', p_question_id);

  return json_build_object('option_id', v_option, 'qty', powerup_qty(v_user_id, 'eliminate'));
end;
$$;

-- submit_answer: o guard da Segunda Chance agora rejeita se o usuário já usou
-- qualquer poder (eliminate) nesta pergunta.
create or replace function submit_answer(
  p_question_id          uuid,
  p_selected_option_id   uuid    default null,
  p_subject_guess_id     text    default null,
  p_use_second_chance    boolean default false,
  p_coins_wagered        integer default 0,
  p_sabotage_option_id   uuid    default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id      uuid := auth.uid();
  v_question     questions%rowtype;
  v_is_correct   boolean := false;
  v_is_decoy     boolean := false;
  v_assisted     boolean := false;
  v_balance      integer;
  v_answer_id    uuid;
  v_count        int;
  v_answer_count int;
  v_eligible     int;
  v_achievements json[] := '{}';
  v_a            json;
begin
  select * into v_question from questions where id = p_question_id;
  if not found then raise exception 'question not found'; end if;
  if v_question.status = 'closed' then raise exception 'question is closed'; end if;
  if v_user_id = v_question.creator_id then raise exception 'creator cannot answer own question'; end if;

  -- O alvo escolheu a alternativa-decoy da sabotagem? (sempre errada)
  if p_sabotage_option_id is not null then
    if exists (
      select 1 from question_sabotages
      where id = p_sabotage_option_id
        and question_id = p_question_id
        and target_user_id = v_user_id
    ) then
      v_is_decoy   := true;
      v_is_correct := false;
    end if;
  end if;

  -- Correção normal (se não foi a decoy)
  if not v_is_decoy then
    if v_question.type = 'multiple_choice' then
      select coalesce(is_correct, false) into v_is_correct
        from question_options
        where id = p_selected_option_id and question_id = p_question_id;
      if not found then v_is_correct := false; end if;
    elsif v_question.type = 'story' then
      v_is_correct := coalesce(p_subject_guess_id = v_question.subject_id, false);
    end if;
  end if;

  -- Segunda Chance: errou + tem token + ainda não usou nenhum poder → descarta a
  -- tentativa (não persiste, não liquida) e libera nova resposta.
  if not v_is_correct and p_use_second_chance
     and powerup_qty(v_user_id, 'second_chance') >= 1
     and not exists (
       select 1 from question_assists
       where question_id = p_question_id and user_id = v_user_id
     )
  then
    insert into question_assists (question_id, user_id, kind)
    values (p_question_id, v_user_id, 'second_chance');
    insert into powerup_ledger (user_id, powerup_key, delta, reason, ref_id)
    values (v_user_id, 'second_chance', -1, 'use', p_question_id);
    return json_build_object('is_correct', false, 'retry_granted', true, 'pending', true, 'achievements', '[]'::json);
  end if;

  -- Aposta de coins na pergunta (estilo bolão): valida saldo antes de persistir
  if p_coins_wagered < 0 then
    return json_build_object('error', 'Aposta inválida');
  end if;
  if p_coins_wagered > 0 then
    select coalesce(sum(amount), 0) into v_balance
    from nenecoins_ledger where user_id = v_user_id and coin_type = 'nenecoin';
    if v_balance < p_coins_wagered then
      return json_build_object('error', 'Nenecoins insuficientes pra essa aposta');
    end if;
  end if;

  -- assistida (p/ excluir do cálculo de dificuldade): usou eliminate/second_chance
  v_assisted := exists (
    select 1 from question_assists
    where question_id = p_question_id and user_id = v_user_id
      and kind in ('eliminate', 'second_chance')
  );

  insert into answers (question_id, user_id, selected_option_id, subject_guess_id, is_correct, assisted, coins_wagered)
  values (p_question_id, v_user_id,
          case when v_is_decoy then null else p_selected_option_id end,
          p_subject_guess_id, v_is_correct, v_assisted, p_coins_wagered)
  returning id into v_answer_id;

  if v_is_decoy then
    update question_sabotages set hit = true
    where id = p_sabotage_option_id and target_user_id = v_user_id;
  end if;

  -- Contra-golpe: se havia sabotagem mirando este usuário nesta pergunta,
  -- concede o crédito de revanche AGORA (já respondeu, sem spoiler do decoy).
  insert into sabotage_revenge (user_id, source_sabotage_id)
  select v_user_id, qs.id
  from question_sabotages qs
  where qs.question_id = p_question_id and qs.target_user_id = v_user_id
  on conflict (source_sabotage_id) do nothing;

  -- debita a aposta de coins (paga no settle conforme a dificuldade)
  if p_coins_wagered > 0 then
    insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
    values (v_user_id, -p_coins_wagered, 'nenecoin', 'question_bet_placed', v_answer_id,
      'Aposta na pergunta');
    insert into nenecoins_state (user_id, last_activity_at)
    values (v_user_id, now())
    on conflict (user_id) do update set last_activity_at = now();
  end if;

  -- conquistas de contagem (pontos de acerto ficam para o settle)
  if v_is_correct then
    select count(*) into v_count from answers where user_id = v_user_id and is_correct = true;
    if v_count = 1  then v_a := grant_achievement(v_user_id, 'first_correct'); if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
    if v_count = 5  then v_a := grant_achievement(v_user_id, 'correct_5');     if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
    if v_count = 25 then v_a := grant_achievement(v_user_id, 'correct_25');    if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
    select array_cat(v_achievements, check_points_achievements(v_user_id)) into v_achievements;
  end if;

  -- liquida quando todos os elegíveis responderam
  select count(*) into v_answer_count from answers where question_id = p_question_id;
  select count(*) into v_eligible
    from profiles
    where role = 'adult' and id <> v_question.creator_id;
  if v_eligible > 0 and v_answer_count >= v_eligible then
    perform settle_question(p_question_id);
  end if;

  return json_build_object(
    'is_correct',    v_is_correct,
    'points_earned', 0,
    'pending',       true,
    'achievements',  to_json(v_achievements)
  );
end;
$$;
