-- Update: fill in Round of 16 matchups + kick-off times as they get fixed.
-- Source of truth: ESPN scoreboard (fifa.world), synced 2026-07-03.
-- Matches 95 (both sides) and 96 (away side) still have TBD slots.
-- Re-runnable.

-- Matchups (both teams known)
update wc_matches set home_team='Paraguai',       home_code='PAR', home_flag='🇵🇾', away_team='França',    away_code='FRA', away_flag='🇫🇷' where match_number=89;
update wc_matches set home_team='Canadá',         home_code='CAN', home_flag='🇨🇦', away_team='Marrocos',  away_code='MAR', away_flag='🇲🇦' where match_number=90;
update wc_matches set home_team='Brasil',         home_code='BRA', home_flag='🇧🇷', away_team='Noruega',   away_code='NOR', away_flag='🇳🇴' where match_number=91;
update wc_matches set home_team='México',         home_code='MEX', home_flag='🇲🇽', away_team='Inglaterra', away_code='ENG', away_flag='🏴󠁧󠁢󠁥󠁮󠁧󠁿' where match_number=92;
update wc_matches set home_team='Portugal',       home_code='POR', home_flag='🇵🇹', away_team='Espanha',   away_code='ESP', away_flag='🇪🇸' where match_number=93;
update wc_matches set home_team='Estados Unidos', home_code='USA', home_flag='🇺🇸', away_team='Bélgica',   away_code='BEL', away_flag='🇧🇪' where match_number=94;
update wc_matches set home_team='Suíça',          home_code='SUI', home_flag='🇨🇭'                                                       where match_number=96;

-- Kick-off times (all 8, incl. the two still-TBD fixtures)
update wc_matches set date = '2026-07-04 21:00:00+00' where match_number=89;
update wc_matches set date = '2026-07-04 17:00:00+00' where match_number=90;
update wc_matches set date = '2026-07-05 20:00:00+00' where match_number=91;
update wc_matches set date = '2026-07-06 00:00:00+00' where match_number=92;
update wc_matches set date = '2026-07-06 19:00:00+00' where match_number=93;
update wc_matches set date = '2026-07-07 00:00:00+00' where match_number=94;
update wc_matches set date = '2026-07-07 16:00:00+00' where match_number=95;
update wc_matches set date = '2026-07-07 20:00:00+00' where match_number=96;
