"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/Card";
import { ADULTS } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

const mockQuests = [
  { id: 1, title: "Responda 3 quizzes", progress: 1, total: 3 },
  { id: 2, title: "Tire uma foto com 2 membros", progress: 0, total: 1 },
];

const mockRanking = [
  { nickname: "Grizante", points: 450 },
  { nickname: "Dani", points: 380 },
  { nickname: "Rodrigo", points: 320 },
  { nickname: "Malu", points: 290 },
  { nickname: "Leo", points: 250 },
  { nickname: "Maiana", points: 200 },
  { nickname: "Thiago", points: 150 },
  { nickname: "Milena", points: 120 },
];

export default function Home() {
  const { member, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !member) {
      router.push("/login");
    }
  }, [loading, member, router]);

  if (loading || !member) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  const userRank = mockRanking.findIndex((r) => r.nickname === member.nickname) + 1;
  const userPoints = mockRanking.find((r) => r.nickname === member.nickname)?.points ?? 0;

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">

          <div className="flex items-center gap-4">
            <Avatar spriteUrl={member.spriteUrl} nickname={member.nickname} size={64} />
            <div>
              <p className="text-muted text-sm">Olá,</p>
              <p className="text-2xl font-bold">{member.nickname}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-bold text-accent">{userPoints}</p>
              <p className="text-muted text-xs">pontos · #{userRank}</p>
            </div>
          </div>

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

          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-3">
              Ranking
            </h2>
            <Card>
              <div className="space-y-3">
                {mockRanking.map((r, i) => {
                  const m = ADULTS.find((a) => a.nickname === r.nickname);
                  const isUser = r.nickname === member.nickname;
                  return (
                    <Link
                      key={r.nickname}
                      href={`/perfil/${r.nickname.toLowerCase()}`}
                      className={`flex items-center gap-3 py-1.5 rounded-lg transition-colors hover:bg-surface-light px-2 -mx-2 ${
                        isUser ? "bg-surface-light" : ""
                      }`}
                    >
                      <span className={`text-sm font-bold w-6 ${i < 3 ? "text-accent" : "text-muted"}`}>
                        {i + 1}
                      </span>
                      <Avatar
                        spriteUrl={m?.spriteUrl ?? null}
                        nickname={r.nickname}
                        size={32}
                      />
                      <span className={`font-semibold flex-1 ${isUser ? "text-accent" : ""}`}>
                        {r.nickname}
                      </span>
                      <span className="text-sm text-muted">{r.points}pts</span>
                    </Link>
                  );
                })}
              </div>
            </Card>
          </section>

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
                  <Avatar spriteUrl={m.spriteUrl} nickname={m.nickname} size={48} />
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
