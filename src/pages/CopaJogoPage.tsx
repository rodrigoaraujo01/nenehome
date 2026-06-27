
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { AchievementToast } from "@/components/AchievementToast";
import { useAuth } from "@/hooks/useAuth";
import {
  getWcMatch,
  getWcMatches,
  placeWcPrediction,
  scoreWcMatch,
  revertWcMatch,
  getNenecoinBalance,
  getWcDistribution,
  revealWcDistribution,
  getPowerupInventory,
  getPowerups,
  buyPowerup,
} from "@/lib/supabase/queries";
import { ADULTS } from "@/lib/constants";
import type { WcMatch, WcPrediction, NenecoinBalance, UnlockedAchievement, WcDistribution } from "@/lib/types";

const POINTS_LABELS: Record<number, string> = {
  25: "Placar exato",
  18: "Vencedor + gols do vencedor",
  15: "Vencedor + saldo de gols",
  12: "Vencedor + gols do perdedor",
  10: "Resultado certo",
  0: "Errou",
};

export default function CopaJogoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, loading } = useAuth();

  const [match, setMatch] = useState<WcMatch | null>(null);
  const [predictions, setPredictions] = useState<WcPrediction[]>([]);
  const [balance, setBalance] = useState<NenecoinBalance | null>(null);
  const [fetching, setFetching] = useState(true);

  // Revelar Distribuição (poder)
  const [dist, setDist] = useState<WcDistribution | null>(null);
  const [wcRevealQty, setWcRevealQty] = useState(0);
  const [wcRevealPrice, setWcRevealPrice] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState("");

  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [coins, setCoins] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submittingNext, setSubmittingNext] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<UnlockedAchievement[]>([]);

  // Next still-open game to jump to after confirming ("confirmar e próximo")
  const [nextMatchId, setNextMatchId] = useState<string | null>(null);

  // Admin state
  const [adminHome, setAdminHome] = useState("");
  const [adminAway, setAdminAway] = useState("");
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [reverting, setReverting] = useState(false);

  const isAdmin = profile?.nickname === "Rodrigo";

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      getWcMatch(id!, profile.id),
      getNenecoinBalance(),
      getWcDistribution(id!),
      getPowerupInventory(),
      getPowerups(),
    ]).then(([data, bal, distData, inv, cat]) => {
      if (data) {
        setMatch(data.match);
        setPredictions(data.predictions);
        // Reset the form for the freshly-loaded game (important when jumping
        // between games via "confirmar e próximo")
        setHomeScore(data.match.my_prediction ? String(data.match.my_prediction.home_score) : "");
        setAwayScore(data.match.my_prediction ? String(data.match.my_prediction.away_score) : "");
        setCoins(data.match.my_prediction?.coins_wagered ?? 0);
        setError("");
        // Clear any leftover submit state from a "confirmar e próximo" jump
        setSubmitting(false);
        setSubmittingNext(false);
        if (data.match.home_score !== null) {
          setAdminHome(String(data.match.home_score));
          setAdminAway(String(data.match.away_score));
        }
      }
      setBalance(bal);
      setDist(distData);
      setWcRevealQty(inv.find((i) => i.powerup_key === "wc_reveal")?.qty ?? 0);
      setWcRevealPrice(cat.find((p) => p.key === "wc_reveal")?.price ?? null);
      setFetching(false);
    });
  }, [profile, id]);

  // Work out the next still-bettable game to offer as "confirmar e próximo"
  useEffect(() => {
    if (!profile) return;
    getWcMatches(profile.id).then((all) => {
      const now = Date.now();
      const open = all
        .filter(
          (m) =>
            m.id !== id &&
            m.status === "scheduled" &&
            now < new Date(m.date).getTime() - 10 * 60_000,
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      // Prefer the next game without a prediction yet; fall back to the next open game
      const next = open.find((m) => !m.my_prediction) ?? open[0];
      setNextMatchId(next?.id ?? null);
    });
  }, [profile, id]);

  if (loading || fetching || !profile || !match) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  const kickoff = new Date(match.date);
  const betsOpen = match.status === "scheduled" && new Date() < new Date(kickoff.getTime() - 10 * 60_000);
  const showPredictions = !betsOpen || match.status !== "scheduled";
  // Allow finishing only after expected end time (kickoff + 105 min)
  const canFinish = new Date() >= new Date(kickoff.getTime() + 105 * 60_000);

  async function handleSubmit(e: React.FormEvent, goNext = false) {
    e.preventDefault();
    setError("");
    if (goNext) setSubmittingNext(true);
    else setSubmitting(true);

    const h = parseInt(homeScore);
    const a = parseInt(awayScore);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError("Placar invalido");
      setSubmitting(false);
      setSubmittingNext(false);
      return;
    }

    const result = await placeWcPrediction({
      match_id: match!.id,
      home_score: h,
      away_score: a,
      coins,
    });

    if (result.error) {
      setError(result.error);
    } else {
      if (goNext && nextMatchId) {
        // Jump straight to the next open game; its effect refetches/resets the form
        navigate(`/copa/jogo/${nextMatchId}`);
        return;
      }
      if (result.achievements?.length) {
        setToasts(result.achievements);
      }
      const data = await getWcMatch(match!.id, profile!.id);
      if (data) {
        setMatch(data.match);
        setPredictions(data.predictions);
      }
      const bal = await getNenecoinBalance();
      setBalance(bal);
    }
    setSubmitting(false);
    setSubmittingNext(false);
  }

  async function handleReveal() {
    setRevealError("");
    setRevealing(true);
    // compra-e-usa: se não tem o poder, compra 1 na hora antes de revelar
    if (wcRevealQty <= 0) {
      const buy = await buyPowerup("wc_reveal", 1);
      if (buy.error) {
        setRevealing(false);
        setRevealError(buy.error);
        return;
      }
      setWcRevealQty(buy.qty ?? 1);
      if (buy.nenecoin_balance != null) {
        const nb = buy.nenecoin_balance;
        setBalance((b) => (b ? { ...b, nenecoin_balance: nb } : b));
      }
    }
    const res = await revealWcDistribution(match!.id);
    setRevealing(false);
    if (res.error) {
      setRevealError(res.error);
      return;
    }
    if (res.distribution) setDist(res.distribution);
    setWcRevealQty((q) => Math.max(0, q - 1));
  }

  async function handleAdminScore(e: React.FormEvent) {
    e.preventDefault();
    setAdminError("");
    const h = parseInt(adminHome);
    const a = parseInt(adminAway);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;
    setAdminSubmitting(true);
    const result = await scoreWcMatch({
      match_id: match!.id,
      home_score: h,
      away_score: a,
      status: "finished",
    });
    if (result.error) {
      setAdminError(result.error);
    } else {
      const data = await getWcMatch(match!.id, profile!.id);
      if (data) {
        setMatch(data.match);
        setPredictions(data.predictions);
      }
    }
    setAdminSubmitting(false);
  }

  async function handleRevert() {
    if (!confirm("Reverter este jogo para 'scheduled'? Pontos e coins serão desfeitos.")) return;
    setReverting(true);
    setAdminError("");
    const result = await revertWcMatch(match!.id);
    if (result.error) {
      setAdminError(result.error);
    } else {
      const data = await getWcMatch(match!.id, profile!.id);
      if (data) {
        setMatch(data.match);
        setPredictions(data.predictions);
      }
    }
    setReverting(false);
  }

  // Bet statistics
  const totalPreds = predictions.length;
  const homeWins = predictions.filter((p) => p.home_score > p.away_score).length;
  const draws = predictions.filter((p) => p.home_score === p.away_score).length;
  const awayWins = predictions.filter((p) => p.home_score < p.away_score).length;

  return (
    <>
      <Header />
      {toasts.length > 0 && <AchievementToast achievements={toasts} />}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <Link
            to="/copa/jogos"
            className="flex items-center gap-3 text-muted hover:text-foreground transition-colors"
          >
            <span>&#8249;</span>
            <span>Voltar</span>
          </Link>

          {/* Match header */}
          <div className="bg-surface border border-border rounded-2xl p-6 text-center">
            <p className="text-xs text-muted mb-4">
              {kickoff.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}{" "}
              {kickoff.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              {match.group_name && (
                <span className="ml-2 text-accent">Grupo {match.group_name}</span>
              )}
            </p>

            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-3xl mb-1">{match.home_flag}</p>
                <p className="font-bold text-sm">{match.home_team}</p>
              </div>

              <div className="text-center min-w-[80px]">
                {match.home_score !== null && match.away_score !== null ? (
                  <p className="text-4xl font-bold">
                    {match.home_score} <span className="text-muted text-2xl">x</span> {match.away_score}
                  </p>
                ) : (
                  <p className="text-2xl text-muted font-bold">vs</p>
                )}
                {match.status === "live" && (
                  <span className="text-xs font-bold text-green uppercase">Ao Vivo</span>
                )}
              </div>

              <div className="text-center">
                <p className="text-3xl mb-1">{match.away_flag}</p>
                <p className="font-bold text-sm">{match.away_team}</p>
              </div>
            </div>
          </div>

          {/* Prediction form */}
          {betsOpen && (
            <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-bold">Seu palpite</h3>

              <div className="flex items-center gap-4 justify-center">
                <div className="text-center">
                  <p className="text-xs text-muted mb-1">{match.home_code}</p>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={homeScore}
                    onChange={(e) => setHomeScore(e.target.value)}
                    className="w-16 h-14 text-center text-2xl font-bold bg-background border border-border rounded-xl focus:border-accent outline-none"
                    required
                  />
                </div>
                <span className="text-muted text-xl font-bold mt-5">x</span>
                <div className="text-center">
                  <p className="text-xs text-muted mb-1">{match.away_code}</p>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={awayScore}
                    onChange={(e) => setAwayScore(e.target.value)}
                    className="w-16 h-14 text-center text-2xl font-bold bg-background border border-border rounded-xl focus:border-accent outline-none"
                    required
                  />
                </div>
              </div>

              {/* Coin wager — mirrors the question page's bet block */}
              {balance && (
                <div className="space-y-2.5 rounded-2xl border border-yellow/20 bg-yellow/5 px-4 py-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                      Apostar nenecoins (opcional)
                    </p>
                    <span className="text-xs text-muted">Saldo: {balance.nenecoin_balance}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCoins((c) => Math.max(0, c - 5))}
                      className="w-9 h-9 rounded-full border border-border text-muted hover:border-yellow/40 text-lg font-bold"
                    >−</button>
                    <input
                      type="number"
                      min={0}
                      max={balance.nenecoin_balance}
                      value={coins}
                      onChange={(e) => setCoins(Math.max(0, Math.min(balance.nenecoin_balance, parseInt(e.target.value) || 0)))}
                      className="flex-1 text-center bg-surface border border-border rounded-xl px-4 py-2 text-lg font-bold focus:outline-none focus:border-yellow/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCoins((c) => Math.min(balance.nenecoin_balance, c + 5))}
                      className="w-9 h-9 rounded-full border border-border text-muted hover:border-yellow/40 text-lg font-bold"
                    >+</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoins(balance.nenecoin_balance)}
                    className="text-xs text-yellow-400 hover:opacity-80 transition-opacity"
                  >
                    All in ({balance.nenecoin_balance})
                  </button>
                </div>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button type="submit" disabled={submitting || submittingNext} className="w-full">
                {submitting
                  ? "..."
                  : match.my_prediction
                  ? "Atualizar palpite"
                  : "Confirmar palpite"}
              </Button>

              {nextMatchId && (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={submitting || submittingNext}
                  className="w-full text-sm font-semibold text-accent border border-accent/40 rounded-xl py-2.5 hover:bg-accent/10 transition-colors disabled:opacity-50"
                >
                  {submittingNext ? "..." : "Confirmar e próximo jogo ›"}
                </button>
              )}
            </form>
          )}

          {/* Revelar Distribuição (power-up) — enquanto os palpites estão abertos */}
          {betsOpen && (
            <div className="bg-surface border border-purple/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold">🔭 Distribuição dos palpites</h3>
                {!dist && (() => {
                  const owned = wcRevealQty > 0;
                  const tooPoor =
                    !owned &&
                    wcRevealPrice != null &&
                    wcRevealPrice > (balance?.nenecoin_balance ?? 0);
                  return (
                    <button
                      onClick={handleReveal}
                      disabled={revealing || tooPoor}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-purple/40 text-purple hover:bg-purple/10 transition-colors disabled:opacity-50"
                    >
                      {revealing
                        ? "..."
                        : owned
                        ? `Revelar (${wcRevealQty})`
                        : `Revelar · ${wcRevealPrice ?? ""} 🪙`}
                    </button>
                  );
                })()}
              </div>
              {revealError && <p className="text-xs text-red-400">{revealError}</p>}

              {dist ? (
                dist.total === 0 ? (
                  <p className="text-xs text-muted">Ninguém palpitou ainda.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2 text-xs">
                      <span className="bg-background border border-border rounded-full px-3 py-1">
                        {match.home_code} {Math.round((dist.home_win / dist.total) * 100)}%
                      </span>
                      <span className="bg-background border border-border rounded-full px-3 py-1">
                        Empate {Math.round((dist.draw / dist.total) * 100)}%
                      </span>
                      <span className="bg-background border border-border rounded-full px-3 py-1">
                        {match.away_code} {Math.round((dist.away_win / dist.total) * 100)}%
                      </span>
                    </div>
                    {dist.scorelines.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {dist.scorelines.map((s) => (
                          <span
                            key={s.score}
                            className="text-xs bg-background border border-border rounded-lg px-2 py-1"
                          >
                            {s.score} <span className="text-muted">×{s.count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-muted">
                      Anônimo e ao vivo — ainda pode mudar até o fechamento.
                    </p>
                  </div>
                )
              ) : (
                <p className="text-xs text-muted">
                  Espie como o grupo está palpitando (anônimo) antes do
                  fechamento — compre e use na hora pelo botão acima.
                </p>
              )}
            </div>
          )}

          {/* User's prediction (when bets are closed) */}
          {!betsOpen && match.my_prediction && (
            <div className="bg-surface border border-accent/30 rounded-2xl p-4">
              <p className="text-xs text-muted mb-2">Seu palpite</p>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold">
                  {match.my_prediction.home_score} x {match.my_prediction.away_score}
                </p>
                <div className="text-right">
                  {match.my_prediction.points_earned != null && (
                    <p className={`font-bold ${match.my_prediction.points_earned > 0 ? "text-green" : "text-red-400"}`}>
                      +{match.my_prediction.points_earned} pts
                      <span className="text-xs text-muted ml-1">
                        ({POINTS_LABELS[match.my_prediction.points_earned] ?? ""})
                      </span>
                    </p>
                  )}
                  {match.my_prediction.coins_wagered > 0 && (
                    <p className="text-xs text-yellow-400">
                      Apostou {match.my_prediction.coins_wagered} coins
                      {match.my_prediction.coins_won > 0 && (
                        <span className="text-green ml-1">
                          &rarr; ganhou {match.my_prediction.coins_won}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Predictions from others */}
          {showPredictions && predictions.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                Palpites ({predictions.length})
              </h3>

              {/* Statistics */}
              {totalPreds > 0 && (
                <div className="flex gap-2 text-xs">
                  <span className="bg-surface border border-border rounded-full px-3 py-1">
                    {match.home_code} {Math.round((homeWins / totalPreds) * 100)}%
                  </span>
                  <span className="bg-surface border border-border rounded-full px-3 py-1">
                    Empate {Math.round((draws / totalPreds) * 100)}%
                  </span>
                  <span className="bg-surface border border-border rounded-full px-3 py-1">
                    {match.away_code} {Math.round((awayWins / totalPreds) * 100)}%
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {predictions
                  .sort((a, b) => (b.points_earned ?? -1) - (a.points_earned ?? -1))
                  .map((pred) => {
                    const member = ADULTS.find((a) => a.nickname === pred.profiles?.nickname);
                    return (
                      <div
                        key={pred.id}
                        className={`bg-surface border rounded-xl p-3 flex items-center gap-3 ${
                          pred.user_id === profile!.id ? "border-accent/40" : "border-border"
                        }`}
                      >
                        <Avatar
                          spriteUrl={member?.spriteUrl ?? pred.profiles?.avatar_url ?? null}
                          nickname={pred.profiles?.nickname ?? "?"}
                          size={28}
                        />
                        <span className="text-sm font-semibold flex-1">
                          {pred.profiles?.nickname}
                        </span>
                        <span className="text-sm font-bold">
                          {pred.home_score} x {pred.away_score}
                        </span>
                        {pred.coins_wagered > 0 && (
                          <span className="text-xs text-yellow-400">{pred.coins_wagered}c</span>
                        )}
                        {pred.points_earned != null && (
                          <span className={`text-sm font-bold min-w-[40px] text-right ${pred.points_earned > 0 ? "text-green" : "text-red-400"}`}>
                            +{pred.points_earned}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Admin: score update */}
          {isAdmin && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-red-400 text-sm">Admin</h3>

              {match.status !== "finished" && (
                <form onSubmit={handleAdminScore} className="space-y-3">
                  <div className="flex items-center gap-3 justify-center">
                    <input
                      type="number"
                      min="0"
                      value={adminHome}
                      onChange={(e) => setAdminHome(e.target.value)}
                      className="w-14 h-10 text-center font-bold bg-background border border-border rounded-xl outline-none"
                      required
                    />
                    <span className="text-muted">x</span>
                    <input
                      type="number"
                      min="0"
                      value={adminAway}
                      onChange={(e) => setAdminAway(e.target.value)}
                      className="w-14 h-10 text-center font-bold bg-background border border-border rounded-xl outline-none"
                      required
                    />
                  </div>
                  {!canFinish && (
                    <p className="text-xs text-yellow-400 text-center">
                      Disponível após {new Date(kickoff.getTime() + 105 * 60_000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={adminSubmitting || !canFinish}
                    className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50"
                  >
                    Finalizar jogo
                  </Button>
                </form>
              )}

              {match.status === "finished" && (
                <Button
                  onClick={handleRevert}
                  disabled={reverting}
                  className="w-full bg-yellow-600 hover:bg-yellow-700"
                >
                  {reverting ? "Revertendo..." : "Reverter jogo"}
                </Button>
              )}

              {adminError && <p className="text-xs text-red-400">{adminError}</p>}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
