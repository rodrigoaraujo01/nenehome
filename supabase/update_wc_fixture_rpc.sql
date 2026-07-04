-- ─────────────────────────────────────────────
-- RPC: update_wc_fixture
-- Admin-only: fill in a knockout fixture's teams and/or kick-off time.
-- Used by the "Atualizar confrontos (TBD)" button, which feeds resolved
-- bracket slots from ESPN. Never touches a finished match. Re-runnable.
-- ─────────────────────────────────────────────
create or replace function update_wc_fixture(
  p_match_id   uuid,
  p_home_team  text,
  p_home_code  text,
  p_home_flag  text,
  p_away_team  text,
  p_away_code  text,
  p_away_flag  text,
  p_date       timestamptz
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id    uuid := auth.uid();
  v_user_email text;
  v_match      wc_matches%rowtype;
begin
  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email != 'alf.rodrigo@gmail.com' then
    return json_build_object('error', 'Apenas o admin pode atualizar confrontos');
  end if;

  select * into v_match from wc_matches where id = p_match_id;
  if not found then
    return json_build_object('error', 'Jogo não encontrado');
  end if;

  if v_match.status = 'finished' then
    return json_build_object('error', 'Jogo já encerrado');
  end if;

  update wc_matches
  set home_team = p_home_team,
      home_code = p_home_code,
      home_flag = p_home_flag,
      away_team = p_away_team,
      away_code = p_away_code,
      away_flag = p_away_flag,
      date      = p_date
  where id = p_match_id;

  return json_build_object('ok', true);
end;
$$;
