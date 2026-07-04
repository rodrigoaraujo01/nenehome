-- Update: fill in the last two Round of 16 matchups once determined.
-- Source of truth: ESPN scoreboard (fifa.world), synced 2026-07-04.
-- Match 95 = V86/V88 (Argentina/Egito); match 96 = V85/V87 (Suíça/Colômbia).
-- Times already set in update_wc_round_of_16.sql. Re-runnable.

update wc_matches set home_team='Argentina', home_code='ARG', home_flag='🇦🇷', away_team='Egito',    away_code='EGY', away_flag='🇪🇬' where match_number=95;
update wc_matches set                                                          away_team='Colômbia', away_code='COL', away_flag='🇨🇴' where match_number=96;
