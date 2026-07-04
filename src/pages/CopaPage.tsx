
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/Card";
import { CurrencyBadge } from "@/components/CurrencyBadge";
import { useAuth } from "@/hooks/useAuth";
import {
  getWcMatches,
  getWcLeaderboard,
  getNenecoinBalance,
} from "@/lib/supabase/queries";
import {
  syncWcFromEspn,
  syncWcFixturesFromEspn,
  type SyncResult,
  type FixtureSyncResult,
} from "@/lib/espn";
import { ADULTS } from "@/lib/constants";
import type { WcMatch, WcLeaderboardEntry, NenecoinBalance } from "@/lib/types";

function MiniMatchCard({ match }: { match: WcMatch }) {
  const kickoff = new Date(match.date);
  const isLive = match.status === "live";
  const hasPred = !!match.my_prediction;

  return (
    <Link to={`/copa/jogo/${match.id}`} className="block">
      <div
        className={`bg-surface border rounded-xl p-3 transition-colors hover:border-accent/40 ${
          isLive ? "border-green" : "border-border"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{match.home_flag}</span>
          <span className="text-xs font-semibold flex-1 truncate">{match.home_team}</span>
          {match.home_score !== null ? (
            <span className="font-bold text-sm">{match.home_score}</span>
          ) : (
            <span className="text-xs text-muted">
              {kickoff.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm">{match.away_flag}</span>
          <span className="text-xs font-semibold flex-1 truncate">{match.away_team}</span>
          {match.away_score !== null && (
            <span className="font-bold text-sm">{match.away_score}</span>
          )}
        </div>
        {!hasPred && match.status === "scheduled" && (
          <p className="text-[10px] text-red-400 mt-1 font-semibold">Sem palpite!</p>
        )}
        {hasPred && (
          <p className="text-[10px] text-accent mt-1">
            Palpite: {match.my_prediction!.home_score} x {match.my_prediction!.away_score}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function CopaDashboard() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  const [matches, setMatches] = useState<WcMatch[]>([]);
  const [leaderboard, setLeaderboard] = useState<WcLeaderboardEntry[]>([]);
  const [balance, setBalance] = useState<NenecoinBalance | null>(null);
  const [fetching, setFetching] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [fixtureSyncing, setFixtureSyncing] = useState(false);
  const [fixtureResult, setFixtureResult] = useState<FixtureSyncResult | null>(null);

  const isAdmin = profile?.nickname === "Rodrigo";

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  async function handleSyncScores() {
    if (!profile) return;
    setSyncing(true);
    setSyncResult(null);
    const result = await syncWcFromEspn(matches);
    setMatches(await getWcMatches(profile.id));
    setSyncResult(result);
    setSyncing(false);
  }

  async function handleSyncFixtures() {
    if (!profile) return;
    setFixtureSyncing(true);
    setFixtureResult(null);
    const result = await syncWcFixturesFromEspn(matches);
    setMatches(await getWcMatches(profile.id));
    setFixtureResult(result);
    setFixtureSyncing(false);
  }

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      getWcMatches(profile.id),
      getWcLeaderboard(),
      getNenecoinBalance(),
    ]).then(([m, lb, bal]) => {
      setMatches(m);
      setLeaderboard(lb);
      setBalance(bal);
      setFetching(false);
    });
  }, [profile]);

  if (loading || fetching || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toDateString();

  const todayMatches = matches.filter((m) => new Date(m.date).toDateString() === todayStr);
  const tomorrowMatches = matches.filter((m) => new Date(m.date).toDateString() === tomorrowStr);
  const liveMatches = matches.filter((m) => m.status === "live");

  const myRank = leaderboard.findIndex((e) => e.user_id === profile.id) + 1 || null;
  const myEntry = leaderboard.find((e) => e.user_id === profile.id);
  const totalPredictions = matches.filter((m) => m.my_prediction).length;
  const totalMatches = matches.length;

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="text-muted hover:text-foreground transition-colors"
              >
                &#8249;
              </Link>
              <h1 className="text-xl font-bold">Copa 2026</h1>
            </div>
            <div className="flex gap-2">
              <Link
                to="/copa/regras"
                className="text-xs text-muted hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
              >
                Regras
              </Link>
              <Link
                to="/copa/jogos"
                className="text-xs text-accent font-semibold border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/10 transition-colors"
              >
                Todos os jogos
              </Link>
            </div>
          </div>

          {/* User stats */}
          <div className="flex gap-3">
            <CurrencyBadge
              value={myEntry?.total_points ?? 0}
              label="pts bolao"
              icon="points"
            />
            <CurrencyBadge
              value={totalPredictions}
              label={`de ${totalMatches} jogos`}
              icon="points"
            />
            {balance && (
              <CurrencyBadge
                value={balance.nenecoin_balance}
                label="nenecoins"
                icon="nenecoins"
              />
            )}
          </div>

          {/* Admin: ESPN sync */}
          {isAdmin && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handleSyncScores}
                  disabled={syncing || fixtureSyncing}
                  className="flex-1 bg-surface border border-border rounded-2xl px-4 py-2.5 text-sm font-semibold text-foreground hover:border-accent/40 disabled:opacity-50 transition-colors"
                >
                  {syncing ? "Sincronizando..." : "Atualizar placares"}
                </button>
                <button
                  onClick={handleSyncFixtures}
                  disabled={syncing || fixtureSyncing}
                  className="flex-1 bg-surface border border-border rounded-2xl px-4 py-2.5 text-sm font-semibold text-foreground hover:border-accent/40 disabled:opacity-50 transition-colors"
                >
                  {fixtureSyncing ? "Atualizando..." : "Atualizar confrontos (TBD)"}
                </button>
              </div>

              {syncResult && (
                <div className="bg-surface border border-border rounded-2xl p-4 text-xs space-y-2">
                  {syncResult.fetchError && (
                    <p className="text-red-400">{syncResult.fetchError}</p>
                  )}
                  {syncResult.updated.length > 0 && (
                    <div>
                      <p className="font-bold text-green mb-1">
                        Placares atualizados ({syncResult.updated.length})
                      </p>
                      {syncResult.updated.map((u, i) => (
                        <p key={i} className="text-muted">
                          {u.label}: {u.home} x {u.away}{" "}
                          <span className="uppercase">
                            {u.status === "finished" ? "(encerrado)" : "(ao vivo)"}
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                  {syncResult.errors.length > 0 && (
                    <div>
                      <p className="font-bold text-red-400 mb-1">
                        Erros ({syncResult.errors.length})
                      </p>
                      {syncResult.errors.map((e, i) => (
                        <p key={i} className="text-muted">
                          {e.label}: {e.error}
                        </p>
                      ))}
                    </div>
                  )}
                  {syncResult.unmatched.length > 0 && (
                    <div>
                      <p className="font-bold text-muted mb-1">
                        Não reconhecidos ({syncResult.unmatched.length})
                      </p>
                      <p className="text-muted">{syncResult.unmatched.join(", ")}</p>
                    </div>
                  )}
                  {!syncResult.fetchError &&
                    syncResult.updated.length === 0 &&
                    syncResult.errors.length === 0 &&
                    syncResult.unmatched.length === 0 && (
                      <p className="text-muted">Nenhum jogo ao vivo ou encerrado para atualizar.</p>
                    )}
                </div>
              )}

              {fixtureResult && (
                <div className="bg-surface border border-border rounded-2xl p-4 text-xs space-y-2">
                  {fixtureResult.fetchError && (
                    <p className="text-muted">{fixtureResult.fetchError}</p>
                  )}
                  {fixtureResult.updated.length > 0 && (
                    <div>
                      <p className="font-bold text-green mb-1">
                        Confrontos atualizados ({fixtureResult.updated.length})
                      </p>
                      {fixtureResult.updated.map((u, i) => (
                        <p key={i} className="text-muted">
                          {u.label} —{" "}
                          {new Date(u.date).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      ))}
                    </div>
                  )}
                  {fixtureResult.errors.length > 0 && (
                    <div>
                      <p className="font-bold text-red-400 mb-1">
                        Erros ({fixtureResult.errors.length})
                      </p>
                      {fixtureResult.errors.map((e, i) => (
                        <p key={i} className="text-muted">
                          {e.label}: {e.error}
                        </p>
                      ))}
                    </div>
                  )}
                  {fixtureResult.unknownTeams.length > 0 && (
                    <div>
                      <p className="font-bold text-muted mb-1">
                        Times desconhecidos ({fixtureResult.unknownTeams.length})
                      </p>
                      <p className="text-muted">{fixtureResult.unknownTeams.join(", ")}</p>
                    </div>
                  )}
                  {fixtureResult.unmatched.length > 0 && (
                    <div>
                      <p className="font-bold text-muted mb-1">
                        Sem vaga TBD ({fixtureResult.unmatched.length})
                      </p>
                      <p className="text-muted">{fixtureResult.unmatched.join(", ")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Live matches */}
          {liveMatches.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-green uppercase tracking-wider">
                Ao Vivo
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {liveMatches.map((m) => (
                  <MiniMatchCard key={m.id} match={m} />
                ))}
              </div>
            </section>
          )}

          {/* Today's matches */}
          {todayMatches.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-muted uppercase tracking-wider">
                Hoje
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {todayMatches.map((m) => (
                  <MiniMatchCard key={m.id} match={m} />
                ))}
              </div>
            </section>
          )}

          {/* Tomorrow's matches */}
          {tomorrowMatches.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-muted uppercase tracking-wider">
                Amanha
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {tomorrowMatches.map((m) => (
                  <MiniMatchCard key={m.id} match={m} />
                ))}
              </div>
            </section>
          )}

          {/* Ranking */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-muted uppercase tracking-wider">
                Ranking do Bolao
              </h2>
              <Link
                to="/copa/ranking"
                className="text-xs text-accent hover:underline"
              >
                Ver completo &#8250;
              </Link>
            </div>
            <Card>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">
                  Nenhum palpite computado ainda
                </p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.slice(0, 8).map((entry, i) => {
                    const member = ADULTS.find((a) => a.nickname === entry.nickname);
                    const isUser = entry.user_id === profile.id;
                    return (
                      <div
                        key={entry.user_id}
                        className={`flex items-center gap-3 py-1.5 rounded-lg px-2 -mx-2 ${
                          isUser ? "bg-surface-light" : ""
                        }`}
                      >
                        <span className={`text-sm font-bold w-6 ${i < 3 ? "text-accent" : "text-muted"}`}>
                          {i + 1}
                        </span>
                        <Avatar
                          spriteUrl={member?.spriteUrl ?? entry.avatar_url}
                          nickname={entry.nickname}
                          size={28}
                        />
                        <span className={`font-semibold flex-1 text-sm ${isUser ? "text-accent" : ""}`}>
                          {entry.nickname}
                        </span>
                        <span className="text-xs text-muted">
                          {entry.exact_scores} exatos
                        </span>
                        <span className="text-sm font-bold">
                          {entry.total_points}pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </section>

          {todayMatches.length === 0 && tomorrowMatches.length === 0 && liveMatches.length === 0 && (
            <div className="text-center py-8 text-muted">
              <p className="text-3xl mb-2">&#9917;</p>
              <p className="font-semibold">Sem jogos hoje ou amanha</p>
              <Link to="/copa/jogos" className="text-accent text-sm hover:underline">
                Ver calendario completo
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
