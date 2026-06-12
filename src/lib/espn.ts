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
import { scoreWcMatch } from "./supabase/queries";

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
