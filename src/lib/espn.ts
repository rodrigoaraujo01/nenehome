// ─────────────────────────────────────────────────────────────────────────────
// ESPN live-score sync for the Bolão da Copa.
//
// Ported from the old `copa_confra` Flask app, which polled ESPN's public
// scoreboard JSON server-side on every page load. nenehome has no app server,
// so here the *admin's browser* fetches ESPN on demand (the "Sincronizar
// placares" button) and feeds each result through the existing admin-only
// `score_wc_match` RPC.
//
// ESPN's site.api endpoint sends permissive CORS headers, so a browser fetch
// works without a proxy.
// ─────────────────────────────────────────────────────────────────────────────

import type { WcMatch } from "./types";
import { scoreWcMatch, updateWcFixture } from "./supabase/queries";

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

// Statuses ESPN reports for a match that is no longer in progress.
const ESPN_FINISHED = new Set([
  "STATUS_FINAL",
  "STATUS_FULL_TIME",
  "STATUS_FT",
  "STATUS_ENDED",
]);

// ESPN's team abbreviations mostly match FIFA 3-letter codes, but not always.
// Map known ESPN → FIFA differences here. Because matching requires BOTH codes
// of a fixture to line up, a missing/wrong entry just fails to match (the game
// is reported as "unmatched" and can be entered manually) — it can never update
// the wrong game.
const ESPN_TO_FIFA: Record<string, string> = {
  // Add overrides as you spot them in the "não reconhecidos" list, e.g.:
  // NTH: "NED",
  // ROK: "KOR",
};

function normalizeCode(espnAbbr: string): string {
  const up = (espnAbbr || "").toUpperCase();
  return ESPN_TO_FIFA[up] ?? up;
}

interface EspnEvent {
  homeCode: string;
  awayCode: string;
  homeScore: number;
  awayScore: number;
  status: "live" | "finished";
  date: string;
}

async function fetchEventsForDate(d: Date): Promise<any[]> {
  const yyyymmdd =
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0");
  try {
    const res = await fetch(`${ESPN_URL}?dates=${yyyymmdd}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.events ?? [];
  } catch {
    return [];
  }
}

function parseEvent(event: any): EspnEvent | null {
  const comp = event?.competitions?.[0];
  const comps = comp?.competitors ?? [];
  if (comps.length !== 2) return null;

  const home = comps.find((c: any) => c.homeAway === "home") ?? comps[0];
  const away = comps.find((c: any) => c.homeAway === "away") ?? comps[1];

  const homeCode = normalizeCode(home?.team?.abbreviation ?? "");
  const awayCode = normalizeCode(away?.team?.abbreviation ?? "");
  if (!homeCode || !awayCode) return null;

  const type = event?.status?.type ?? {};
  const statusName: string = type.name ?? "";
  const completed: boolean = type.completed ?? false;

  // Skip matches that haven't kicked off yet.
  if (statusName === "STATUS_SCHEDULED" || type.state === "pre") return null;

  const status: "live" | "finished" =
    completed || ESPN_FINISHED.has(statusName) ? "finished" : "live";

  return {
    homeCode,
    awayCode,
    homeScore: parseInt(home?.score ?? "0") || 0,
    awayScore: parseInt(away?.score ?? "0") || 0,
    status,
    date: event?.date ?? "",
  };
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

export interface SyncResult {
  updated: { label: string; home: number; away: number; status: string }[];
  errors: { label: string; error: string }[];
  unmatched: string[];
  fetchError?: string;
}

// Fetch ESPN scores (yesterday + today) and push them into score_wc_match.
// Matches already marked "finished" are skipped so predictions/coins are never
// scored twice. Returns a summary for the UI.
export async function syncWcFromEspn(matches: WcMatch[]): Promise<SyncResult> {
  const result: SyncResult = { updated: [], errors: [], unmatched: [] };

  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  // Yesterday catches late matches that finished near midnight.
  const rawEvents = [
    ...(await fetchEventsForDate(yesterday)),
    ...(await fetchEventsForDate(today)),
  ];

  if (rawEvents.length === 0) {
    result.fetchError =
      "Não foi possível obter jogos da ESPN (sem jogos hoje/ontem ou falha de rede).";
    return result;
  }

  for (const raw of rawEvents) {
    const ev = parseEvent(raw);
    if (!ev) continue;

    const codeSet = new Set([ev.homeCode, ev.awayCode]);
    // Candidate fixtures with the same pair of teams (order-insensitive),
    // preferring one on the same calendar day.
    const candidates = matches.filter(
      (m) =>
        m.status !== "finished" &&
        codeSet.has(m.home_code.toUpperCase()) &&
        codeSet.has(m.away_code.toUpperCase()),
    );
    const match =
      candidates.find((m) => sameDay(m.date, ev.date)) ?? candidates[0];

    if (!match) {
      result.unmatched.push(`${ev.homeCode} x ${ev.awayCode}`);
      continue;
    }

    // ESPN home/away may be swapped vs. our seed — map scores by team code.
    const ourHomeIsEspnHome = match.home_code.toUpperCase() === ev.homeCode;
    const homeScore = ourHomeIsEspnHome ? ev.homeScore : ev.awayScore;
    const awayScore = ourHomeIsEspnHome ? ev.awayScore : ev.homeScore;
    const label = `${match.home_team} x ${match.away_team}`;

    const res = await scoreWcMatch({
      match_id: match.id,
      home_score: homeScore,
      away_score: awayScore,
      status: ev.status,
    });

    if (res.error) {
      result.errors.push({ label, error: res.error });
    } else {
      result.updated.push({
        label,
        home: homeScore,
        away: awayScore,
        status: ev.status,
      });
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture sync: fill in knockout matchups (TBD slots) and their kick-off times
// from ESPN, once the bracket resolves them.
// ─────────────────────────────────────────────────────────────────────────────

const CODE_RE = /^[A-Z]{3}$/;

interface EspnFixture {
  homeCode: string;
  awayCode: string;
  date: string;
}

// A fixture is only usable once ESPN has resolved BOTH teams to real 3-letter
// codes (unresolved slots come back as "RD16", "W1", etc.).
function parseFixture(event: any): EspnFixture | null {
  const comps = event?.competitions?.[0]?.competitors ?? [];
  if (comps.length !== 2) return null;
  const home = comps.find((c: any) => c.homeAway === "home") ?? comps[0];
  const away = comps.find((c: any) => c.homeAway === "away") ?? comps[1];
  const homeCode = normalizeCode(home?.team?.abbreviation ?? "");
  const awayCode = normalizeCode(away?.team?.abbreviation ?? "");
  if (!CODE_RE.test(homeCode) || !CODE_RE.test(awayCode)) return null;
  const date = event?.date ?? "";
  if (!date) return null;
  return { homeCode, awayCode, date };
}

export interface FixtureSyncResult {
  updated: { label: string; date: string }[];
  errors: { label: string; error: string }[];
  unknownTeams: string[]; // resolved on ESPN but no name/flag known locally
  unmatched: string[]; // resolved on ESPN but no TBD slot to place them in
  fetchError?: string;
}

// Fetch ESPN fixtures around our still-TBD matches and fill in the ones ESPN
// has resolved. A TBD match is any non-finished fixture with a 'TBD' code.
// Each resolved ESPN fixture is matched to the nearest-in-time TBD slot (greedy,
// one-to-one). Team names/flags are looked up from teams already present in our
// own schedule (every nation appears in the group stage), so no static table is
// needed. Never touches finished matches. Returns a summary for the UI.
export async function syncWcFixturesFromEspn(
  matches: WcMatch[],
): Promise<FixtureSyncResult> {
  const result: FixtureSyncResult = {
    updated: [],
    errors: [],
    unknownTeams: [],
    unmatched: [],
  };

  const tbd = matches.filter(
    (m) =>
      m.status !== "finished" &&
      (m.home_code.toUpperCase() === "TBD" || m.away_code.toUpperCase() === "TBD"),
  );
  if (tbd.length === 0) {
    result.fetchError = "Nenhum confronto TBD para atualizar.";
    return result;
  }

  // code → { team name, flag } from any already-known team in our schedule.
  const known = new Map<string, { name: string; flag: string }>();
  for (const m of matches) {
    if (m.home_code.toUpperCase() !== "TBD")
      known.set(m.home_code.toUpperCase(), { name: m.home_team, flag: m.home_flag });
    if (m.away_code.toUpperCase() !== "TBD")
      known.set(m.away_code.toUpperCase(), { name: m.away_team, flag: m.away_flag });
  }

  // Fetch each UTC day a TBD match currently sits on, ±1 day for time drift.
  const dayMs = 24 * 60 * 60 * 1000;
  const dates = new Set<number>();
  for (const m of tbd) {
    const t = new Date(m.date).getTime();
    for (const off of [-1, 0, 1]) dates.add(t + off * dayMs);
  }
  const rawEvents: any[] = [];
  for (const t of dates) {
    rawEvents.push(...(await fetchEventsForDate(new Date(t))));
  }
  if (rawEvents.length === 0) {
    result.fetchError = "Não foi possível obter jogos da ESPN.";
    return result;
  }

  // Dedup ESPN fixtures by team pair + date, keep only resolved ones.
  const seen = new Set<string>();
  const fixtures: EspnFixture[] = [];
  for (const raw of rawEvents) {
    const f = parseFixture(raw);
    if (!f) continue;
    const key = `${f.date}|${[f.homeCode, f.awayCode].sort().join("-")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fixtures.push(f);
  }

  // Only consider fixtures whose teams don't already sit in a non-TBD slot with
  // the same pairing (those are group games / already-filled knockouts).
  const filledPairs = new Set(
    matches
      .filter((m) => m.home_code.toUpperCase() !== "TBD" && m.away_code.toUpperCase() !== "TBD")
      .map((m) => [m.home_code.toUpperCase(), m.away_code.toUpperCase()].sort().join("-")),
  );

  const claimed = new Set<string>();
  // Process earliest fixtures first for stable greedy assignment.
  fixtures.sort((a, b) => +new Date(a.date) - +new Date(b.date));

  for (const f of fixtures) {
    const pairKey = [f.homeCode, f.awayCode].sort().join("-");
    if (filledPairs.has(pairKey)) continue;

    const homeInfo = known.get(f.homeCode);
    const awayInfo = known.get(f.awayCode);
    if (!homeInfo || !awayInfo) {
      result.unknownTeams.push(`${f.homeCode} x ${f.awayCode}`);
      continue;
    }

    // Nearest unclaimed TBD slot by kickoff time.
    const fTime = +new Date(f.date);
    let best: WcMatch | null = null;
    let bestDiff = Infinity;
    for (const m of tbd) {
      if (claimed.has(m.id)) continue;
      const diff = Math.abs(+new Date(m.date) - fTime);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = m;
      }
    }
    if (!best) {
      result.unmatched.push(`${f.homeCode} x ${f.awayCode}`);
      continue;
    }

    claimed.add(best.id);
    const label = `${homeInfo.name} x ${awayInfo.name}`;
    const res = await updateWcFixture({
      match_id: best.id,
      home_team: homeInfo.name,
      home_code: f.homeCode,
      home_flag: homeInfo.flag,
      away_team: awayInfo.name,
      away_code: f.awayCode,
      away_flag: awayInfo.flag,
      date: f.date,
    });
    if (res.error) result.errors.push({ label, error: res.error });
    else result.updated.push({ label, date: f.date });
  }

  return result;
}
