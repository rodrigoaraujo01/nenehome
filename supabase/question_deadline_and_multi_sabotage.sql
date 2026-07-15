-- nenehome — Prazo de 48h nas perguntas + Sabotagem multi-alvo
-- Rodar DEPOIS de powerups.sql e limit_one_powerup_per_question.sql.
-- Redefine create_question, settle_question e adiciona settle_expired_questions
-- e deploy_sabotage_multi.

-- ─────────────────────────────────────────────
-- questions.deadline — 48h fixas a partir da criação.
-- Perguntas antigas recebem deadline retroativo (created_at + 48h), então uma
-- pergunta já vencida liquida no primeiro sweep.
-- ─────────────────────────────────────────────
alter table questions
  add column if not exists deadline timestamptz;

update questions
  set deadline = created_at + interval '48 hours'
  where deadline is null;

alter table questions
  alter column deadline set default (now() + interval '48 hours');

-- ─────────────────────────────────────────────
-- create_question — igual ao scoring_v2, só preenchendo o deadline.
-- ─────────────────────────────────────────────
create or replace function create_question(
  p_type       text,
  p_content    text,
  p_subject_id text default null,
  p_options    json default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id      uuid := auth.uid();
  v_question_id  uuid;
  v_deadline     timestamptz := now() + interval '48 hours';
  v_option       json;
  v_pos          int := 0;
  v_count        int;
  v_today_count  int;
  v_creator_pts  int;
  v_achievements json[] := '{}';
  v_a            json;
begin
  -- quantas perguntas o criador já fez hoje (fuso fixo p/ definir "hoje")
  select count(*) into v_today_count
    from questions
    where creator_id = v_user_id
      and (created_at at time zone 'America/Sao_Paulo')::date
          = (now() at time zone 'America/Sao_Paulo')::date;

  v_creator_pts := case when v_today_count = 0 then 20 else 5 end;

  insert into questions (creator_id, type, content, subject_id, points_creator, deadline)
  values (v_user_id, p_type, p_content, p_subject_id, v_creator_pts, v_deadline)
  returning id into v_question_id;

  if p_type = 'multiple_choice' and p_options is not null then
    for v_option in select * from json_array_elements(p_options) loop
      insert into question_options (question_id, text, is_correct, position)
      values (v_question_id, v_option->>'text', (v_option->>'is_correct')::boolean, v_pos);
      v_pos := v_pos + 1;
    end loop;
  end if;

  insert into points_log (user_id, amount, reason, ref_id)
  values (v_user_id, v_creator_pts, 'question_created', v_question_id);

  select count(*) into v_count from questions where creator_id = v_user_id;
  if v_count = 1 then v_a := grant_achievement(v_user_id, 'question_1'); if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;
  if v_count = 5 then v_a := grant_achievement(v_user_id, 'question_5'); if v_a is not null then v_achievements := v_achievements || v_a; end if; end if;

  select array_cat(v_achievements, check_points_achievements(v_user_id)) into v_achievements;

  return json_build_object(
    'id', v_question_id,
    'points_creator', v_creator_pts,
    'is_premium', v_today_count = 0,
    'deadline', v_deadline,
    'achievements', to_json(v_achievements)
  );
end;
$$;

-- ═════════════════════════════════════════════
-- settle_question — agora liquida também quando o prazo vence, mesmo com
-- respostas faltando. Quem não respondeu conta como erro no denominador da
-- dificuldade (não perde pontos e não gera linha em answers).
-- ═════════════════════════════════════════════
create or replace function settle_question(p_question_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_question     questions%rowtype;
  v_total        int;
  v_correct      int;
  v_un_total     int;
  v_un_correct   int;
  v_no_shows     int;
  v_diff_total   int;
  v_diff_correct int;
  v_eligible     int;
  v_expired      boolean;
  v_ratio        numeric;
  v_difficulty   text;
  v_per_pts      int := 0;
  -- multiplicador da aposta de coins por dificuldade (acerto): impossível perde
  v_bet_mult     numeric := 0;
  v_payout       int;
  v_ans          record;
  v_affected     uuid[];
  v_uid          uuid;
begin
  select * into v_question from questions where id = p_question_id;
  if not found then return json_build_object('settled', false); end if;
  if v_question.status = 'closed' then
    return json_build_object('settled', false, 'already', true);
  end if;

  select count(*) into v_total from answers where question_id = p_question_id;
  select count(*) into v_eligible
    from profiles where role = 'adult' and id <> v_question.creator_id;

  v_expired := v_question.deadline is not null and now() >= v_question.deadline;

  -- liquida se todos responderam OU se o prazo venceu
  if v_eligible <= 0 or (v_total < v_eligible and not v_expired) then
    return json_build_object('settled', false, 'not_ready', true);
  end if;

  update questions set status = 'closed', closed_at = now() where id = p_question_id;

  select count(*) into v_correct from answers where question_id = p_question_id and is_correct = true;

  -- Quem não respondeu até o prazo conta como erro: entra só no denominador.
  v_no_shows := greatest(v_eligible - v_total, 0);

  -- dificuldade: só conta respostas NÃO assistidas (fallback p/ todas se ninguém
  -- respondeu sem ajuda), somadas aos ausentes.
  select count(*) into v_un_total   from answers where question_id = p_question_id and assisted = false;
  select count(*) into v_un_correct from answers where question_id = p_question_id and assisted = false and is_correct = true;
  if v_un_total = 0 then
    v_diff_total := v_total;   v_diff_correct := v_correct;
  else
    v_diff_total := v_un_total; v_diff_correct := v_un_correct;
  end if;
  v_diff_total := v_diff_total + v_no_shows;

  if v_diff_total = 0 or v_diff_correct = 0 then
    v_difficulty := 'impossible';
    v_per_pts := 0;   v_bet_mult := 0;
  else
    v_ratio := v_diff_correct::numeric / v_diff_total::numeric;
    if v_ratio <= 1.0/3.0 then
      v_difficulty := 'hard';   v_per_pts := 20; v_bet_mult := 3;
    elsif v_ratio <= 2.0/3.0 then
      v_difficulty := 'medium'; v_per_pts := 12; v_bet_mult := 2;
    else
      v_difficulty := 'easy';   v_per_pts := 5;  v_bet_mult := 1.5;
    end if;
  end if;

  update questions set difficulty = v_difficulty where id = p_question_id;

  -- pontos por acerto (por tier) — pra todos os corretos, assistidos inclusive
  if v_per_pts > 0 then
    for v_ans in
      select id, user_id from answers
      where question_id = p_question_id and is_correct = true
    loop
      insert into points_log (user_id, amount, reason, ref_id)
      values (v_ans.user_id, v_per_pts, 'correct_answer', v_ans.id);
    end loop;
  end if;

  -- ajuste do criador. Ninguém tentou (v_total = 0) não é culpa do criador:
  -- a pergunta foi ignorada, não é "impossível" — mantém o bônus de criação.
  if v_difficulty = 'impossible' and v_total > 0 then
    delete from points_log where reason = 'question_created' and ref_id = p_question_id;
  elsif v_difficulty = 'hard' then
    insert into points_log (user_id, amount, reason, ref_id)
    values (v_question.creator_id, 10, 'question_hard_bonus', p_question_id);
  end if;

  -- Aposta de coins: paga quem apostou e acertou (multiplicador por dificuldade).
  -- Quem errou já perdeu o stake no submit. Impossível (mult 0) não paga.
  if v_bet_mult > 0 then
    for v_ans in
      select id, user_id, coins_wagered from answers
      where question_id = p_question_id and is_correct = true and coins_wagered > 0
    loop
      v_payout := floor(v_ans.coins_wagered * v_bet_mult)::int;
      update answers set coins_won = v_payout where id = v_ans.id;
      insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
      values (v_ans.user_id, v_payout, 'nenecoin', 'question_bet_won', v_ans.id,
        'Ganhou aposta na pergunta (' || v_difficulty || ')');
    end loop;
  end if;

  -- re-checa milestones
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

  -- notifica todos
  perform post_push(jsonb_build_object(
    'event',          'question_settled',
    'target_user_id', v_question.creator_id,
    'question_id',    p_question_id,
    'content',        v_question.content,
    'role',           'creator',
    'difficulty',     v_difficulty
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
      'difficulty',     v_difficulty
    ));
  end loop;

  return json_build_object(
    'settled',     true,
    'difficulty',  v_difficulty,
    'correct',     v_correct,
    'total',       v_total,
    'no_shows',    v_no_shows,
    'expired',     v_expired,
    'points_each', v_per_pts
  );
end;
$$;

-- ─────────────────────────────────────────────
-- settle_expired_questions — sweep preguiçoso das perguntas vencidas.
-- Chamado por qualquer membro ao abrir a Home; idempotente (settle_question
-- ignora perguntas já fechadas).
-- ─────────────────────────────────────────────
create or replace function settle_expired_questions()
returns json
language plpgsql
security definer
as $$
declare
  v_id      uuid;
  v_settled int := 0;
  v_res     json;
begin
  for v_id in
    select id from questions
    where status = 'active' and deadline is not null and now() >= deadline
    order by deadline
  loop
    v_res := settle_question(v_id);
    if coalesce((v_res->>'settled')::boolean, false) then
      v_settled := v_settled + 1;
    end if;
  end loop;
  return json_build_object('settled', v_settled);
end;
$$;

-- ═════════════════════════════════════════════
-- deploy_sabotage_multi — sabota vários alvos de uma vez na mesma pergunta,
-- com o mesmo texto-decoy. Custa 1 token por alvo e é tudo-ou-nada: se algum
-- alvo for inválido ou faltar token, nada é plantado.
-- ═════════════════════════════════════════════
create or replace function deploy_sabotage_multi(
  p_question_id     uuid,
  p_target_user_ids uuid[],
  p_decoy_text      text
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id  uuid := auth.uid();
  v_question questions%rowtype;
  v_targets  uuid[];
  v_n        int;
  v_target   uuid;
  v_nick     text;
begin
  if p_decoy_text is null or btrim(p_decoy_text) = '' then
    return json_build_object('error', 'Escreva a alternativa falsa');
  end if;

  select array(select distinct unnest(p_target_user_ids)) into v_targets;
  v_n := coalesce(array_length(v_targets, 1), 0);
  if v_n = 0 then
    return json_build_object('error', 'Escolha pelo menos um alvo');
  end if;

  select * into v_question from questions where id = p_question_id;
  if not found then return json_build_object('error', 'Pergunta não encontrada'); end if;
  if v_question.type != 'multiple_choice' then
    return json_build_object('error', 'Só funciona em múltipla escolha');
  end if;
  if v_question.status = 'closed' then return json_build_object('error', 'Pergunta encerrada'); end if;
  if v_question.deadline is not null and now() >= v_question.deadline then
    return json_build_object('error', 'Pergunta encerrada');
  end if;

  -- valida cada alvo antes de plantar qualquer coisa
  foreach v_target in array v_targets loop
    if v_target = v_user_id then
      return json_build_object('error', 'Não pode sabotar a si mesmo');
    end if;
    if v_target = v_question.creator_id then
      return json_build_object('error', 'O criador não responde a própria pergunta');
    end if;
    select nickname into v_nick from profiles where id = v_target and role = 'adult';
    if v_nick is null then
      return json_build_object('error', 'Alvo inválido');
    end if;
    if exists (select 1 from answers where question_id = p_question_id and user_id = v_target) then
      return json_build_object('error', v_nick || ' já respondeu');
    end if;
    if exists (select 1 from question_sabotages where question_id = p_question_id and target_user_id = v_target) then
      return json_build_object('error', v_nick || ' já foi sabotado nesta pergunta');
    end if;
  end loop;

  if powerup_qty(v_user_id, 'sabotage') < v_n then
    return json_build_object('error',
      'Sabotagem insuficiente no inventário (precisa de ' || v_n || ')');
  end if;

  insert into question_sabotages (question_id, target_user_id, saboteur_id, decoy_text)
  select p_question_id, t, v_user_id, btrim(p_decoy_text)
  from unnest(v_targets) t;

  insert into powerup_ledger (user_id, powerup_key, delta, reason, ref_id)
  values (v_user_id, 'sabotage', -v_n, 'use', p_question_id);

  return json_build_object('success', true, 'planted', v_n, 'qty', powerup_qty(v_user_id, 'sabotage'));
end;
$$;

-- Catálogo: a descrição da Sabotagem agora reflete o multi-alvo.
update powerups
  set description = 'Injeta uma 5ª alternativa falsa (escrita por você) numa pergunta, só para os alvos que ainda não responderam. 1 token por alvo.'
  where key = 'sabotage';
