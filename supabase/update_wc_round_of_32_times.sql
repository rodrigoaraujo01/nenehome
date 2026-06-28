-- Update: correct Round of 32 kick-off times.
-- Source: official schedule in ET (EDT = UTC-4); stored as UTC.
-- Match 73 confirmed via Brazil time (16:00 BRT = 19:00 UTC).
-- The previous seed used a placeholder template (19:00/22:00/01:00 UTC daily),
-- leaving bets open past kick-off. Re-runnable.

update wc_matches set date = '2026-06-28 19:00:00+00' where match_number=73;
update wc_matches set date = '2026-06-29 20:30:00+00' where match_number=74;
update wc_matches set date = '2026-06-30 01:00:00+00' where match_number=75;
update wc_matches set date = '2026-06-29 17:00:00+00' where match_number=76;
update wc_matches set date = '2026-06-30 21:00:00+00' where match_number=77;
update wc_matches set date = '2026-06-30 17:00:00+00' where match_number=78;
update wc_matches set date = '2026-07-01 01:00:00+00' where match_number=79;
update wc_matches set date = '2026-07-01 16:00:00+00' where match_number=80;
update wc_matches set date = '2026-07-02 00:00:00+00' where match_number=81;
update wc_matches set date = '2026-07-01 20:00:00+00' where match_number=82;
update wc_matches set date = '2026-07-02 23:00:00+00' where match_number=83;
update wc_matches set date = '2026-07-02 19:00:00+00' where match_number=84;
update wc_matches set date = '2026-07-03 03:00:00+00' where match_number=85;
update wc_matches set date = '2026-07-03 18:00:00+00' where match_number=86;
update wc_matches set date = '2026-07-03 22:00:00+00' where match_number=87;
update wc_matches set date = '2026-07-04 01:30:00+00' where match_number=88;
