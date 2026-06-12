-- ─────────────────────────────────────────────────────────────
-- WIPE GAME — reset tudo como se o jogo nunca tivesse sido jogado,
-- PRESERVANDO o Bolão da Copa (palpites, jogos e pontos/coins da Copa).
--
-- Preserva:
--   * profiles            (membros)
--   * achievements        (catálogo de conquistas)
--   * wc_matches          (jogos da Copa)
--   * wc_predictions      (palpites + pontos/coins ganhos na Copa)
--   * points_log          → SOMENTE linhas da Copa
--   * nenecoins_ledger    → reconstruído do zero (jogo recomeça hoje): cada
--                            conta fica com 100 coins iniciais menos as apostas
--                            ativas da Copa (re-escrowadas de wc_predictions)
--   * user_achievements   → SOMENTE conquistas wc_*
--
-- Apaga: perguntas, respostas, fotos, desafios, bolões internos e
--        todo histórico de pontos/nenecoins não relacionado à Copa.
--
-- Rode dentro de uma transação. Revise antes de aplicar em produção.
-- ─────────────────────────────────────────────────────────────

begin;

-- 1. Conteúdo de perguntas (answers → options → questions)
delete from answers;
delete from question_options;
delete from questions;

-- 2. Fotos e desafios de foto
delete from photo_votes;
delete from photo_challenge_completions;
delete from photo_submissions;
delete from photo_challenges;

-- 3. Bolões internos (não-Copa)
delete from bet_entries;
delete from bet_options;
delete from bets;

-- 4. Conquistas — manter apenas as da Copa (key começando com 'wc_')
delete from user_achievements
where achievement_id not in (
  select id from achievements where key like 'wc\_%' escape '\'
);

-- 5. points_log — manter apenas pontos da Copa:
--    bônus de torneio + pontos de conquistas wc_*
delete from points_log
where not (
  reason = 'wc_tournament_bonus'
  or (
    reason = 'achievement'
    and ref_id in (select id from achievements where key like 'wc\_%' escape '\')
  )
);

-- 6. nenecoins_ledger — jogo recomeça hoje.
--    Apaga TODO o ledger, inclusive os movimentos antigos da Copa: o histórico
--    de wc_bet_* fica inconsistente com churn de testes (clawbacks sem o
--    wc_bet_won correspondente). Reconstruímos o ledger da Copa a partir da
--    fonte de verdade: wc_predictions.coins_wagered.
delete from nenecoins_ledger;

--    Zera o scoring de teste dos palpites (Copa 2026 ainda não começou),
--    mantendo os palpites em si (placares + coins_wagered).
update wc_predictions
set points_earned = null,
    coins_won     = 0;

--    Concede um único saldo inicial de 100 coins por membro.
insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, note)
select id, 100, 'nenecoin', 'initial', 'Saldo inicial de boas-vindas 🪙'
from profiles;

--    Re-escrowa apenas as apostas ativas: uma entrada limpa por palpite.
--    Resultado: cada conta = 100 - soma das apostas ativas da Copa.
insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, ref_id, note)
select user_id, -coins_wagered, 'nenecoin', 'wc_bet_placed', match_id, 'Aposta Copa (recomeço)'
from wc_predictions
where coins_wagered > 0;

-- 7. nenecoins_state — relógio do bônus semanal recomeça HOJE.
--    (last_weekly_bonus_at = now() evita pagar semanas acumuladas desde o
--     cadastro; com null, claim_weekly_bonuses usaria created_at antigo.)
update nenecoins_state
set last_weekly_bonus_at = now(),
    firecoin_popup_shown = false,
    last_activity_at     = now();

-- Garante uma linha de state para quem ainda não tem (relógio começa hoje)
insert into nenecoins_state (user_id, last_weekly_bonus_at, last_activity_at)
select id, now(), now() from profiles
on conflict (user_id) do nothing;

commit;
