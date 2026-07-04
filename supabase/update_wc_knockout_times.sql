-- Update: correct kick-off times for quarters → final.
-- Source: official schedule in BRT (UTC-3); stored as UTC (BRT + 3h).
-- Round of 16 (89-96) already matches; quarters onward drifted from the seed.
-- Re-runnable.

-- Quartas de final
update wc_matches set date = '2026-07-09 20:00:00+00' where match_number=97;
update wc_matches set date = '2026-07-10 19:00:00+00' where match_number=98;
update wc_matches set date = '2026-07-11 21:00:00+00' where match_number=99;
update wc_matches set date = '2026-07-12 01:00:00+00' where match_number=100;

-- Semifinais
update wc_matches set date = '2026-07-14 19:00:00+00' where match_number=101;
update wc_matches set date = '2026-07-15 19:00:00+00' where match_number=102;

-- Disputa de 3º lugar
update wc_matches set date = '2026-07-18 21:00:00+00' where match_number=103;

-- Final
update wc_matches set date = '2026-07-19 19:00:00+00' where match_number=104;
