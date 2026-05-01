"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/useAuth";
import { getBets, getNenecoinBalance } from "@/lib/supabase/queries";
import type { DbBet, NenecoinBalance } from "@/lib/types";

function BetTypeBadge({ bet }: { bet: DbBet }) {
  const label =
    bet.type === "pool"
      ? "Pool"
      : bet.guess_kind === "date"
      ? "Bolão data"
      : `Bolão número`;
  const colors =
    bet.type === "pool"
      ? "bg-purple-500/15 text-purple-400"
      : "bg-blue-500/15 text-blue-400";
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors}`}>
      {label}
    </span>
  );
}

function BetCard({ bet }: { bet: DbBet }) {
  const isPastDeadline = new Date(bet.deadline) < new Date();
  const deadline = new Date(bet.deadline).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short",
  });

  return (
    <Link href={`/apostas/${bet.id}`} className="block">
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-3 hover:border-accent/40 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-snug line-clamp-2">{bet.title}</p>
          </div>
          <BetTypeBadge bet={bet} />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          {bet.creator && (
            <>
              <Avatar spriteUrl={bet.creator.avatar_url} nickname={bet.creator.nickname} size={18} />
              <span>{bet.creator.nickname}</span>
              <span>·</span>
            </>
          )}
          <span>{bet.entries_count ?? 0} apostas</span>
          <span>·</span>
          <span className="text-yellow-400 font-semibold">🪙 {bet.total_pot ?? 0}</span>
        </div>

        <div className="flex items-center justify-between">
          {bet.status === "open" ? (
            <span className={`text-xs ${isPastDeadline ? "text-red-400" : "text-muted"}`}>
              {isPastDeadline ? "Prazo encerrado" : `Até ${deadline}`}
            </span>
          ) : (
            <span className="text-xs text-green font-semibold">✓ Resolvida</span>
          )}
          {bet.my_entry ? (
            <span className="text-xs text-accent font-semibold">✓ Você apostou</span>
          ) : bet.status === "open" ? (
            <span className="text-xs text-muted">Apostar →</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function ApostasPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [bets, setBets] = useState<DbBet[]>([]);
  const [balance, setBalance] = useState<NenecoinBalance | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) router.push("/login");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile) return;
    Promise.all([getBets(profile.id), getNenecoinBalance()]).then(([b, bal]) => {
      setBets(b);
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

  const open = bets.filter((b) => b.status === "open");
  const resolved = bets.filter((b) => b.status === "resolved");

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          {/* header row */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Apostas</h2>
            <Link
              href="/apostas/nova"
              className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              + Nova
            </Link>
          </div>

          {/* balance bar */}
          {balance !== null && (
            <div className="flex gap-3">
              <div className="flex-1 bg-surface border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
                <span className="text-xl">🪙</span>
                <div>
                  <p className="text-lg font-bold">{balance.nenecoin_balance}</p>
                  <p className="text-[10px] text-muted">nenecoins</p>
                </div>
              </div>
              {balance.firecoin_balance > 0 && (
                <div className="flex-1 bg-surface border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <div>
                    <p className="text-lg font-bold">{balance.firecoin_balance}</p>
                    <p className="text-[10px] text-muted">firecoins</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* open bets */}
          {open.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Abertas</h3>
              {open.map((b) => <BetCard key={b.id} bet={b} />)}
            </section>
          )}

          {/* resolved bets */}
          {resolved.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Resolvidas</h3>
              {resolved.map((b) => <BetCard key={b.id} bet={b} />)}
            </section>
          )}

          {bets.length === 0 && (
            <div className="text-center py-16 text-muted">
              <p className="text-4xl mb-3">🎲</p>
              <p className="font-semibold">Nenhuma aposta ainda</p>
              <p className="text-sm mt-1">Crie a primeira!</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
