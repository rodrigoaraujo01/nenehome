-- nenehome — Conquista "Melhor foto" + reversões
-- Run AFTER best_photo_vote.sql, scoring_v2.sql e delete_user_content.sql.
--
-- Dá tratamento especial a quem vence a votação de melhor foto de um desafio:
--   • conquista 'best_photo_win' (além dos pontos dobrados que já existiam);
-- e mantém a "reversão completa" ao deletar conteúdo:
--   • apagar a foto vencedora (ou o desafio) desfaz os pontos dobrados
--     ('challenge_best_photo') e revoga a conquista se o autor não tiver mais
--     nenhuma foto vencedora.

-- ─────────────────────────────────────────────
-- Catálogo
-- ─────────────────────────────────────────────
insert into achievements (key, title, description, icon, points_reward, sort_order) values
  ('best_photo_win', 'Melhor foto',
   'Venceu a votação de melhor foto de um desafio', '🏆', 25, 12)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────
-- Redefine settle_challenge_best: além de dobrar os pontos, concede a
-- conquista à(s) autora(s) da(s) foto(s) vencedora(s). Supera a versão de
-- best_photo_vote.sql — deve rodar depois dela.
-- ─────────────────────────────────────────────
create or replace function settle_challenge_best(p_challenge_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_challenge  photo_challenges%rowtype;
  v_max        int;
  v_win        record;
  v_paid_users uuid[] := '{}';
  v_photo_pts  int;
  v_compl_pts  int;
  v_amount     int;
  v_winners    int := 0;
begin
  select * into v_challenge from photo_challenges where id = p_challenge_id;
  if not found then return json_build_object('settled', false); end if;
  if v_challenge.best_settled_at is not null then
    return json_build_object('settled', false, 'already', true);
  end if;
  if now() < v_challenge.deadline + interval '48 hours' then
    return json_build_object('settled', false, 'not_ready', true);
  end if;

  update photo_challenges set best_settled_at = now() where id = p_challenge_id;

  -- sem disputa (0 ou 1 foto aprovada) → ninguém dobra
  if challenge_best_candidates(p_challenge_id) < 2 then
    return json_build_object('settled', true, 'no_contest', true, 'winners', 0);
  end if;

  select max(c) into v_max from (
    select count(*) as c
    from challenge_best_votes
    where challenge_id = p_challenge_id
    group by submission_id
  ) t;

  -- ninguém votou → ninguém dobra
  if v_max is null or v_max = 0 then
    return json_build_object('settled', true, 'no_votes', true, 'winners', 0);
  end if;

  for v_win in
    select v.submission_id, count(*)::int as votes, s.submitter_id
    from challenge_best_votes v
    join photo_submissions s on s.id = v.submission_id
    where v.challenge_id = p_challenge_id
    group by v.submission_id, s.submitter_id
    having count(*) = v_max
  loop
    update photo_submissions set best_photo = true where id = v_win.submission_id;

    -- conquista pra quem venceu (idempotente por usuário)
    perform grant_achievement(v_win.submitter_id, 'best_photo_win');

    -- dobra = repete os pontos que a pessoa recebeu NESTE desafio: os da
    -- aprovação da foto vencedora + os de completar o desafio.
    select coalesce(sum(amount), 0) into v_photo_pts
      from points_log
      where reason = 'photo_approved' and ref_id = v_win.submission_id
        and user_id = v_win.submitter_id;

    -- a parte do challenge_completed é por pessoa: se alguém vencer com duas
    -- fotos suas empatadas, ela não recebe os 30 do desafio duas vezes.
    if v_win.submitter_id = any(v_paid_users) then
      v_compl_pts := 0;
    else
      select coalesce(sum(amount), 0) into v_compl_pts
        from points_log
        where reason = 'challenge_completed' and ref_id = p_challenge_id
          and user_id = v_win.submitter_id;
      v_paid_users := v_paid_users || v_win.submitter_id;
    end if;

    v_amount := v_photo_pts + v_compl_pts;
    if v_amount > 0 then
      insert into points_log (user_id, amount, reason, ref_id)
      values (v_win.submitter_id, v_amount, 'challenge_best_photo', v_win.submission_id);
      perform check_points_achievements(v_win.submitter_id);
    end if;
    v_winners := v_winners + 1;
  end loop;

  return json_build_object(
    'settled', true,
    'winners', v_winners,
    'top_votes', v_max
  );
end;
$$;

-- ─────────────────────────────────────────────
-- Redefine delete_photo_submission: agora também desfaz os pontos dobrados
-- ('challenge_best_photo') e revoga 'best_photo_win' se o autor ficar sem
-- nenhuma foto vencedora. Supera a versão de delete_user_content.sql.
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

  -- undo the approval points + os pontos dobrados de melhor foto
  delete from points_log
    where reason = 'photo_approved' and ref_id = p_submission_id;
  delete from points_log
    where reason = 'challenge_best_photo' and ref_id = p_submission_id;

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

      select count(*) into v_remaining
        from photo_submissions where submitter_id = v_uid and best_photo = true;
      if v_remaining < 1 then perform revoke_achievement(v_uid, 'best_photo_win'); end if;

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

-- ─────────────────────────────────────────────
-- Redefine delete_photo_challenge: mesma reversão da conquista e dos pontos
-- dobrados para todas as fotos do desafio. Supera a versão de scoring_v2.sql.
-- ─────────────────────────────────────────────
create or replace function delete_photo_challenge(p_challenge_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id        uuid := auth.uid();
  v_challenge      photo_challenges%rowtype;
  v_sub_ids        uuid[];
  v_paths          text[];
  v_affected       uuid[];
  v_uid            uuid;
  v_remaining      int;
  v_total          int;
  v_storage_error  text := null;
begin
  select * into v_challenge from photo_challenges where id = p_challenge_id;
  if not found then
    return json_build_object('error', 'Desafio não encontrado');
  end if;

  if v_challenge.creator_id != v_user_id then
    return json_build_object('error', 'Apenas o criador pode excluir o desafio');
  end if;

  select array_agg(id), array_agg(storage_path)
    into v_sub_ids, v_paths
    from photo_submissions where challenge_id = p_challenge_id;

  -- afetados: criador (prêmio), submitters, votantes e completers
  select array_agg(distinct uid) into v_affected from (
    select v_challenge.creator_id as uid
    union
    select submitter_id from photo_submissions where challenge_id = p_challenge_id
    union
    select voter_id from photo_votes
      where submission_id = any(coalesce(v_sub_ids, '{}'::uuid[]))
    union
    select user_id from photo_challenge_completions where challenge_id = p_challenge_id
  ) u;

  -- undo dos pontos que fluíram deste desafio
  delete from points_log
    where reason = 'challenge_completed' and ref_id = p_challenge_id;
  delete from points_log
    where reason = 'challenge_created' and ref_id = p_challenge_id;
  if v_sub_ids is not null then
    delete from points_log
      where reason = 'photo_approved' and ref_id = any(v_sub_ids);
    delete from points_log
      where reason = 'challenge_best_photo' and ref_id = any(v_sub_ids);
  end if;

  if v_paths is not null then
    begin
      delete from storage.objects
        where bucket_id = 'photo-submissions' and name = any(v_paths);
    exception when others then
      v_storage_error := SQLERRM;
    end;
  end if;

  delete from photo_submissions where challenge_id = p_challenge_id;
  delete from photo_challenge_completions where challenge_id = p_challenge_id;
  delete from photo_challenges where id = p_challenge_id;

  if v_affected is not null then
    foreach v_uid in array v_affected loop
      select count(*) into v_remaining
        from photo_submissions where submitter_id = v_uid and status = 'approved';
      if v_remaining < 1 then perform revoke_achievement(v_uid, 'photographer_1'); end if;
      if v_remaining < 3 then perform revoke_achievement(v_uid, 'photographer_3'); end if;

      select count(*) into v_remaining
        from photo_submissions where submitter_id = v_uid and best_photo = true;
      if v_remaining < 1 then perform revoke_achievement(v_uid, 'best_photo_win'); end if;

      select count(*) into v_remaining from photo_votes where voter_id = v_uid;
      if v_remaining < 5 then perform revoke_achievement(v_uid, 'voter_5'); end if;

      select count(*) into v_remaining
        from photo_challenge_completions where user_id = v_uid;
      if v_remaining < 1 then perform revoke_achievement(v_uid, 'challenger_1'); end if;
      if v_remaining < 3 then perform revoke_achievement(v_uid, 'challenger_3'); end if;
    end loop;

    foreach v_uid in array v_affected loop
      select coalesce(sum(amount), 0) into v_total
        from points_log where user_id = v_uid;
      if v_total < 100 then perform revoke_achievement(v_uid, 'points_100'); end if;
      if v_total < 500 then perform revoke_achievement(v_uid, 'points_500'); end if;
    end loop;
  end if;

  return json_build_object(
    'deleted', true,
    'photos_removed', coalesce(array_length(v_sub_ids, 1), 0),
    'storage_error', v_storage_error
  );
end;
$$;
