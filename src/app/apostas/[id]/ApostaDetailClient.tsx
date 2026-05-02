"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { AchievementToast } from "@/components/AchievementToast";
import { useAuth } from "@/hooks/useAuth";
import { getBet, placeBet, resolveBet, getNenecoinBalance } from "@/lib/supabase/queries";
import type { DbBet, BetOption, BetEntry, NenecoinBalance, UnlockedAchievement } from "@/lib/types";

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function OptionBar({
  option,
  entries,
  totalPot,
  resolved,
  winningOptionId,
  myOptionId,
}: {
  option: BetOption;
  entries: BetEntry[];
  totalPot: number;
  resolved: boolean;
  winningOptionId: string | null;
  myOptionId: string | null;
}) {
  const optEntries = entries.filter((e) => e.option_id === option.id);
  const optPot = optEntries.reduce((s, e) => s + e.coins_wagered, 0);
  const pct = totalPot > 0 ? Math.round((optPot / totalPot) * 100) : 0;
  const isWinner = resolved && winningOptionId === option.id;
  const isMine = myOptionId === option.id;

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        isWinner
          ? "border-green bg-green/10"
          : isMine && !resolved
          ? "border-accent bg-accent/10"
          : "border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isWinner && <span className="text-green font-bold text-sm">✓</span>}
          <span className="font-semibold text-sm">{option.label}</span>
          {isMine && !resolved && (
            <span className="text-[10px] text-accent font-bold uppercase">seu voto</span>
          )}
        </div>
        <span className="text-xs text-muted">🪙 {optPot} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-surface-light rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isWinner ? "bg-green" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {resolved && optEntries.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {optEntries.map((e) => (
            <div key={e.id} className="flex items-center gap-1">
              <Avatar spriteUrl={e.profiles?.avatar_url ?? null} nickname={e.profiles?.nickname ?? "?"} size={20} />
              {e.is_winner && e.coins_won > 0 && (
                <span className="text-[10px] text-green font-bold">+{e.coins_won}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ApostaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [bet, setBet] = useState<DbBet | null>(null);
  const [balance, setBalance] = useState<NenecoinBalance | null>(null);
  const [fetching, setFetching] = useState(true);
  const [coins, setCoins] = useState(10);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [guessValue, setGuessValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolveValue, setResolveValue] = useState("");
  const [resolving, setResolving] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [newAchievements, setNewAchievements] = useState<UnlockedAchievement[]>([]);

  useEffect(() => {
    if (!loading && !profile) router.push("/login");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile || !id) return;
    Promise.all([getBet(id, profile.id), getNenecoinBalance()]).then(([b, bal]) => {
      setBet(b);
      setBalance(bal);
      setFetching(false);
    });
  }, [profile, id]);

  if (loading || fetching || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }
  if (!bet) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted">Aposta não encontrada.</p>
        </main>
      </>
    );
  }

  const isCreator = bet.creator_id === profile.id;
  const isResolved = bet.status === "resolved";
  const isPastDeadline = new Date(bet.deadline) < new Date();
  const canEnter = !isResolved && !isPastDeadline && !bet.my_entry;
  const entries = bet.entries ?? [];
  const totalPot = bet.total_pot ?? 0;

  const winningOptionId =
    isResolved && bet.type === "pool" ? bet.result_value : null;

  async function handlePlaceBet(e: React.FormEvent) {
    e.preventDefault();
    if (!bet) return;
    setEntryError(null);
    setSubmitting(true);

    const result = await placeBet({
      bet_id: bet.id,
      coins,
      option_id: bet.type === "pool" ? (selectedOption ?? undefined) : undefined,
      guess_value: bet.type === "closest_guess" ? (guessValue || undefined) : undefined,
    });

    setSubmitting(false);
    if (result.error) { setEntryError(result.error); return; }
    if (result.achievements?.length) setNewAchievements(result.achievements);
    const updated = await getBet(bet.id, profile!.id);
    if (updated) setBet(updated);
    const bal = await getNenecoinBalance();
    if (bal) setBalance(bal);
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!bet || !resolveValue) return;
    setResolveError(null);
    setResolving(true);

    // For pool bets resolveValue is the winning option id, already set from selector
    const result = await resolveBet(bet.id, resolveValue);
    setResolving(false);
    if (result.error) { setResolveError(result.error); return; }
    const updated = await getBet(bet.id, profile!.id);
    if (updated) setBet(updated);
    const bal = await getNenecoinBalance();
    if (bal) setBalance(bal);
  }

  // For closest_guess resolved: sort entries by distance to result
  const sortedEntries = isResolved && bet.type === "closest_guess" && bet.result_value
    ? [...entries].sort((a, b) => {
        const dist = (e: BetEntry) => {
          if (!bet.result_value || !e.guess_value) return Infinity;
          if (bet.guess_kind === "date") {
            return Math.abs(
              new Date(bet.result_value).getTime() - new Date(e.guess_value).getTime()
            );
          }
          return Math.abs(parseFloat(bet.result_value) - parseFloat(e.guess_value));
        };
        return dist(a) - dist(b);
      })
    : entries;

  return (
    <>
      <AchievementToast achievements={newAchievements} />
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-5">
          {/* back + status */}
          <div className="flex items-center gap-3">
            <Link href="/apostas" className="flex items-center gap-2 text-muted hover:text-foreground transition-colors">
              <span>‹</span>
              <span className={`text-sm font-bold ${isResolved ? "text-green" : isPastDeadline ? "text-red-400" : "text-yellow-400"}`}>
                {isResolved ? "✓ Resolvida" : isPastDeadline ? "Prazo encerrado" : "Aberta"}
              </span>
            </Link>
          </div>

          {/* title + meta */}
          <div>
            <h2 className="text-xl font-bold leading-snug">{bet.title}</h2>
            {bet.description && (
              <p className="text-sm text-muted mt-1">{bet.description}</p>
            )}
          </div>

          {/* creator + pot + deadline */}
          <div className="bg-surface border border-border rounded-2xl p-4 flex flex-wrap gap-4">
            {bet.creator && (
              <div className="flex items-center gap-2 text-sm">
                <Avatar spriteUrl={bet.creator.avatar_url} nickname={bet.creator.nickname} size={24} />
                <span className="text-muted">{bet.creator.nickname}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted">Pote:</span>
              <span className="font-bold text-yellow-400">🪙 {totalPot}</span>
            </div>
            <div className="text-sm text-muted">
              {isResolved ? `Resolvida em ${formatDeadline(bet.resolved_at!)}` : `Até ${formatDeadline(bet.deadline)}`}
            </div>
          </div>

          {/* resolved result banner */}
          {isResolved && bet.result_value && (
            <div className="bg-green/10 border border-green/30 rounded-2xl p-4">
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Resultado</p>
              <p className="text-lg font-bold text-green">
                {bet.type === "pool"
                  ? bet.options?.find((o) => o.id === bet.result_value)?.label ?? bet.result_value
                  : bet.guess_kind === "date"
                  ? new Date(bet.result_value).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
                  : `${parseFloat(bet.result_value).toLocaleString("pt-BR")}${bet.unit ? " " + bet.unit : ""}`}
              </p>
              {totalPot > 0 && (
                <p className="text-sm text-muted mt-1">{entries.filter((e) => e.is_winner).length} vencedor(es) dividiram 🪙 {totalPot}</p>
              )}
            </div>
          )}

          {/* pool: option bars */}
          {bet.type === "pool" && bet.options && bet.options.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted uppercase tracking-wider">Opções</p>
              {bet.options.map((opt) => (
                <OptionBar
                  key={opt.id}
                  option={opt}
                  entries={entries}
                  totalPot={totalPot}
                  resolved={isResolved}
                  winningOptionId={winningOptionId}
                  myOptionId={bet.my_entry?.option_id ?? null}
                />
              ))}
            </div>
          )}

          {/* closest_guess: entry list (guesses hidden pre-resolution) */}
          {bet.type === "closest_guess" && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted uppercase tracking-wider">
                Palpites {isResolved ? "" : `(${entries.length} apostas — revelados na resolução)`}
              </p>
              {isResolved ? (
                sortedEntries.map((e, i) => {
                  const distDays = bet.guess_kind === "date" && bet.result_value && e.guess_value
                    ? Math.abs(
                        (new Date(bet.result_value).getTime() - new Date(e.guess_value).getTime()) /
                        (1000 * 60 * 60 * 24)
                      ).toFixed(0)
                    : null;
                  const distNum = bet.guess_kind === "number" && bet.result_value && e.guess_value
                    ? Math.abs(parseFloat(bet.result_value) - parseFloat(e.guess_value))
                    : null;

                  return (
                    <div
                      key={e.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 ${
                        e.is_winner ? "border-green bg-green/10" : "border-border"
                      }`}
                    >
                      <span className="text-muted text-sm w-5 text-center font-bold">{i + 1}</span>
                      <Avatar spriteUrl={e.profiles?.avatar_url ?? null} nickname={e.profiles?.nickname ?? "?"} size={28} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{e.profiles?.nickname}</p>
                        <p className="text-xs text-muted">
                          {bet.guess_kind === "date"
                            ? new Date(e.guess_value!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                            : `${parseFloat(e.guess_value!).toLocaleString("pt-BR")}${bet.unit ? " " + bet.unit : ""}`}
                          {distDays !== null && <span className="ml-1">(±{distDays} dias)</span>}
                          {distNum !== null && <span className="ml-1">(±{distNum.toLocaleString("pt-BR")})</span>}
                        </p>
                      </div>
                      {e.is_winner && (
                        <span className="text-green font-bold text-sm">+{e.coins_won} 🪙</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted py-2">
                  {bet.my_entry
                    ? `Seu palpite: ${bet.guess_kind === "date"
                        ? new Date(bet.my_entry.guess_value!).toLocaleDateString("pt-BR")
                        : `${parseFloat(bet.my_entry.guess_value!).toLocaleString("pt-BR")}${bet.unit ? " " + bet.unit : ""}`}
                       · 🪙 ${bet.my_entry.coins_wagered}`
                    : entries.length > 0
                    ? `${entries.length} aposta(s) feita(s). Os palpites serão revelados na resolução.`
                    : "Ninguém apostou ainda."}
                </div>
              )}
            </div>
          )}

          {/* entry form */}
          {canEnter && (
            <form onSubmit={handlePlaceBet} className="bg-surface border border-border rounded-2xl p-4 space-y-4 overflow-hidden">
              <p className="font-semibold text-sm">Sua aposta</p>

              {balance !== null && (
                <p className="text-xs text-muted">Saldo: 🪙 {balance.nenecoin_balance} nenecoins</p>
              )}

              {/* pool: pick option */}
              {bet.type === "pool" && bet.options && (
                <div className="space-y-2">
                  {bet.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOption(opt.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                        selectedOption === opt.id
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border hover:border-accent/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* closest_guess: input */}
              {bet.type === "closest_guess" && (
                <div>
                  <label className="text-xs text-muted block mb-1">
                    {bet.guess_kind === "date" ? "Seu palpite de data" : `Seu palpite${bet.unit ? ` (${bet.unit})` : ""}`}
                  </label>
                  {bet.guess_kind === "date" ? (
                    <input
                      type="date"
                      value={guessValue}
                      onChange={(e) => setGuessValue(e.target.value)}
                      className="w-full max-w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
                    />
                  ) : (
                    <input
                      type="number"
                      step="any"
                      value={guessValue}
                      onChange={(e) => setGuessValue(e.target.value)}
                      placeholder={bet.unit ?? "0"}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
                    />
                  )}
                </div>
              )}

              {/* coin amount */}
              <div>
                <label className="text-xs text-muted block mb-1">Nenecoins a apostar</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCoins((c) => Math.max(1, c - 5))}
                    className="w-9 h-9 rounded-full border border-border text-muted hover:border-accent/40 text-lg font-bold"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={balance?.nenecoin_balance ?? 9999}
                    value={coins}
                    onChange={(e) => setCoins(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 text-center bg-surface border border-border rounded-xl px-4 py-2 text-lg font-bold focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setCoins((c) => Math.min(balance?.nenecoin_balance ?? 9999, c + 5))}
                    className="w-9 h-9 rounded-full border border-border text-muted hover:border-accent/40 text-lg font-bold"
                  >+</button>
                </div>
                {balance && (
                  <button
                    type="button"
                    onClick={() => setCoins(balance.nenecoin_balance)}
                    className="mt-1 text-xs text-accent hover:opacity-80 transition-opacity"
                  >
                    All in ({balance.nenecoin_balance})
                  </button>
                )}
              </div>

              {entryError && <p className="text-sm text-red-400">{entryError}</p>}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  submitting ||
                  (bet.type === "pool" && !selectedOption) ||
                  (bet.type === "closest_guess" && !guessValue) ||
                  (balance !== null && coins > balance.nenecoin_balance)
                }
              >
                {submitting ? "Apostando..." : `Apostar 🪙 ${coins}`}
              </Button>
            </form>
          )}

          {/* my entry (already placed, not resolved) */}
          {bet.my_entry && !isResolved && (
            <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4 text-sm">
              <p className="font-semibold text-accent">✓ Você apostou 🪙 {bet.my_entry.coins_wagered}</p>
              {bet.type === "pool" && bet.my_entry.option_id && (
                <p className="text-muted mt-0.5">
                  Em: {bet.options?.find((o) => o.id === bet.my_entry!.option_id)?.label}
                </p>
              )}
            </div>
          )}

          {/* resolve section (creator only, open bet) */}
          {isCreator && !isResolved && (
            <form onSubmit={handleResolve} className="border-t border-border pt-5 space-y-4">
              <p className="text-sm font-semibold text-muted">Resolver aposta</p>

              {bet.type === "pool" && bet.options && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">Qual opção ganhou?</p>
                  {bet.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setResolveValue(opt.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                        resolveValue === opt.id
                          ? "border-green bg-green/10 text-green"
                          : "border-border hover:border-green/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {bet.type === "closest_guess" && (
                <div>
                  <label className="text-xs text-muted block mb-1">
                    {bet.guess_kind === "date"
                      ? "Data real"
                      : `Valor real${bet.unit ? ` (${bet.unit})` : ""}`}
                  </label>
                  {bet.guess_kind === "date" ? (
                    <input
                      type="date"
                      value={resolveValue}
                      onChange={(e) => setResolveValue(e.target.value)}
                      className="w-full max-w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green transition-colors"
                    />
                  ) : (
                    <input
                      type="number"
                      step="any"
                      value={resolveValue}
                      onChange={(e) => setResolveValue(e.target.value)}
                      placeholder="0"
                      className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm placeholder:text-muted/50 focus:outline-none focus:border-green transition-colors"
                    />
                  )}
                </div>
              )}

              {resolveError && <p className="text-sm text-red-400">{resolveError}</p>}

              <Button
                type="submit"
                variant="ghost"
                className="w-full"
                disabled={resolving || !resolveValue}
              >
                {resolving ? "Resolvendo..." : "Confirmar resultado"}
              </Button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
