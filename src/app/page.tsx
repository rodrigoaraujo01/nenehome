"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { getLeaderboard, getNenecoinBalance } from "@/lib/supabase/queries";
import { ADULTS } from "@/lib/constants";
import type { LeaderboardEntry, NenecoinBalance } from "@/lib/types";

const mockQuests = [
  { id: 1, title: "Responda 3 perguntas", progress: 0, total: 3 },
  { id: 2, title: "Crie sua primeira pergunta", progress: 0, total: 1 },
];

export default function Home() {
  const { profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [balance, setBalance] = useState<NenecoinBalance | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push("/login");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile) return;
    getLeaderboard().then(setLeaderboard);
    getNenecoinBalance().then(setBalance);
  }, [profile]);

  if (loading || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  const currentMember = ADULTS.find((m) => m.nickname === profile.nickname);
  const userRank =
    leaderboard.findIndex((r) => r.user_id === profile.id) + 1 || null;
  const userPoints =
    leaderboard.find((r) => r.user_id === profile.id)?.total_points ?? 0;

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">

          {/* greeting */}
          <div className="flex items-center gap-4">
            <Avatar
              spriteUrl={currentMember?.spriteUrl ?? profile.avatar_url}
              nickname={profile.nickname}
              size={64}
            />
            <div>
              <p className="text-muted text-sm">Olá,</p>
              <p className="text-2xl font-bold">{profile.nickname}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-bold text-accent">{userPoints}</p>
              <p className="text-muted text-xs">
                pontos{userRank ? ` · #${userRank}` : ""}
              </p>
            </div>
          </div>

          {/* nenecoins */}
          {balance && (
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

          {/* quick access */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/perguntas"
              className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-2xl px-4 py-4 hover:bg-accent/20 transition-colors"
            >
              <div>
                <p className="font-bold">Perguntas</p>
                <p className="text-xs text-muted mt-0.5">Responda e pontuе</p>
              </div>
              <span className="text-accent">→</span>
            </Link>
            <Link
              href="/fotos"
              className="flex items-center justify-between bg-purple/10 border border-purple/30 rounded-2xl px-4 py-4 hover:bg-purple/20 transition-colors"
            >
              <div>
                <p className="font-bold">Fotos</p>
                <p className="text-xs text-muted mt-0.5">Vote e envie</p>
              </div>
              <span className="text-purple">→</span>
            </Link>
          </div>

          {/* active quests */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-3">
              Missões ativas
            </h2>
            <div className="space-y-3">
              {mockQuests.map((q) => (
                <Card key={q.id}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{q.title}</p>
                    <span className="text-sm text-muted">
                      {q.progress}/{q.total}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 bg-surface-light rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${(q.progress / q.total) * 100}%` }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* leaderboard */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-3">
              Ranking
            </h2>
            <Card>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">
                  Nenhum ponto ainda — seja o primeiro!
                </p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((r, i) => {
                    const member = ADULTS.find(
                      (a) => a.nickname === r.nickname
                    );
                    const isUser = r.user_id === profile.id;
                    return (
                      <Link
                        key={r.user_id}
                        href={`/perfil/${r.nickname.toLowerCase()}`}
                        className={`flex items-center gap-3 py-1.5 rounded-lg transition-colors hover:bg-surface-light px-2 -mx-2 ${
                          isUser ? "bg-surface-light" : ""
                        }`}
                      >
                        <span
                          className={`text-sm font-bold w-6 ${
                            i < 3 ? "text-accent" : "text-muted"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <Avatar
                          spriteUrl={member?.spriteUrl ?? r.avatar_url}
                          nickname={r.nickname}
                          size={32}
                        />
                        <span
                          className={`font-semibold flex-1 ${
                            isUser ? "text-accent" : ""
                          }`}
                        >
                          {r.nickname}
                        </span>
                        <span className="text-sm text-muted">
                          {r.total_points}pts
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </section>

          {/* group */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-3">
              O grupo
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {ADULTS.map((m) => (
                <Link
                  key={m.id}
                  href={`/perfil/${m.nickname.toLowerCase()}`}
                  className="flex flex-col items-center gap-1.5 shrink-0 hover:opacity-80 transition-opacity"
                >
                  <Avatar
                    spriteUrl={m.spriteUrl}
                    nickname={m.nickname}
                    size={48}
                  />
                  <span className="text-xs text-muted">{m.nickname}</span>
                </Link>
              ))}
            </div>
          </section>

          <button
            onClick={signOut}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Sair
          </button>
        </div>
      </main>
    </>
  );
}
