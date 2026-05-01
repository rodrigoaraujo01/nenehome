"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/Card";
import { MEMBERS, COUPLES } from "@/lib/constants";
import { getProfileStats } from "@/lib/supabase/queries";
import { useAuth } from "@/hooks/useAuth";
import { getUserAchievements } from "@/lib/supabase/queries";
import { getSupabase } from "@/lib/supabase/client";
import type { ProfileStats, DbAchievement } from "@/lib/types";

async function getProfileIdByNickname(nickname: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("profiles")
    .select("id")
    .eq("nickname", nickname)
    .maybeSingle();
  return data?.id ?? null;
}

export function ProfileClient({ nickname }: { nickname: string }) {
  const { profile: currentUser } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [achievements, setAchievements] = useState<DbAchievement[]>([]);

  const member = MEMBERS.find(
    (m) => m.nickname.toLowerCase() === nickname.toLowerCase()
  );

  useEffect(() => {
    if (!member) return;
    getProfileStats(member.nickname).then((s) => {
      setStats(s);
      setLoadingStats(false);
    });
  }, [member?.nickname]);

  useEffect(() => {
    if (!member) return;
    // find this member's profile id by matching nickname in the leaderboard
    // we use a simple approach: fetch after stats load
    getProfileIdByNickname(member.nickname).then((id) => {
      if (id) getUserAchievements(id).then(setAchievements);
    });
  }, [member?.nickname]);

  if (!member) {
    return (
      <>
        <Header />
        <main className="flex-1 px-6 py-8">
          <p className="text-center text-muted mt-12">Membro não encontrado.</p>
        </main>
      </>
    );
  }

  const couple = COUPLES.find((c) => c.id === member.coupleGroup);
  const family = couple?.members.filter((m) => m.id !== member.id) ?? [];
  const isOwnProfile = currentUser?.nickname === member.nickname;
  const accuracy =
    stats && stats.answers_total > 0
      ? Math.round((stats.answers_correct / stats.answers_total) * 100)
      : null;

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <section className="max-w-md mx-auto flex flex-col items-center gap-6">
          <Avatar spriteUrl={member.spriteUrl} nickname={member.nickname} size={120} />
          <div className="text-center">
            <h2 className="text-3xl font-bold">{member.nickname}</h2>
            <p className="text-muted mt-1">{member.name}</p>
            {isOwnProfile && (
              <span className="text-xs text-accent font-semibold">você</span>
            )}
          </div>

          {loadingStats ? (
            <div className="w-32 h-16 bg-surface border border-border rounded-2xl animate-pulse" />
          ) : (
            <div className="flex flex-col items-center bg-surface border border-border rounded-2xl px-8 py-4">
              <span className="text-4xl font-bold text-accent">
                {stats?.total_points ?? 0}
              </span>
              <span className="text-xs text-muted mt-1">pontos</span>
            </div>
          )}

          {!loadingStats && stats && (
            <div className="grid grid-cols-3 gap-3 w-full">
              <Card className="flex flex-col items-center py-4 px-2">
                <span className="text-2xl font-bold">{stats.answers_total}</span>
                <span className="text-xs text-muted text-center mt-1">respondidas</span>
              </Card>
              <Card className="flex flex-col items-center py-4 px-2">
                <span className="text-2xl font-bold text-green">
                  {accuracy !== null ? `${accuracy}%` : "—"}
                </span>
                <span className="text-xs text-muted text-center mt-1">acertos</span>
              </Card>
              <Card className="flex flex-col items-center py-4 px-2">
                <span className="text-2xl font-bold">{stats.questions_created}</span>
                <span className="text-xs text-muted text-center mt-1">criadas</span>
              </Card>
            </div>
          )}

          {!loadingStats && stats && stats.recent_answers.length > 0 && (
            <div className="w-full">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                Últimas respostas
              </h3>
              <Card>
                <div className="space-y-3">
                  {stats.recent_answers.slice(0, 8).map((a, i) => (
                    <Link
                      key={i}
                      href={`/perguntas/${a.question_id}`}
                      className="flex items-start gap-3 hover:opacity-80 transition-opacity"
                    >
                      <span className={`mt-0.5 shrink-0 text-sm font-bold ${a.is_correct ? "text-green" : "text-red-400"}`}>
                        {a.is_correct ? "✓" : "✗"}
                      </span>
                      <p className="text-sm text-muted line-clamp-2">
                        {a.questions?.content ?? "Pergunta removida"}
                      </p>
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {achievements.length > 0 && (
            <div className="w-full">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                Conquistas
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {achievements.map((a) => (
                  <div
                    key={a.key}
                    title={a.unlocked_at ? a.title : a.description}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                      a.unlocked_at
                        ? "border-accent/30 bg-accent/5"
                        : "border-border opacity-30"
                    }`}
                  >
                    <span className="text-2xl">{a.icon}</span>
                    <span className="text-[10px] text-center text-muted leading-tight">
                      {a.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {couple && (
            <Card className="w-full">
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Família</p>
              <p className="text-lg font-bold">{couple.label}</p>
              <div className="flex gap-4 mt-4 flex-wrap">
                {family.map((f) => (
                  <Link
                    key={f.id}
                    href={`/perfil/${f.nickname.toLowerCase()}`}
                    className="flex flex-col items-center gap-1.5 hover:opacity-80 transition-opacity"
                  >
                    <Avatar spriteUrl={f.spriteUrl} nickname={f.nickname} size={48} />
                    <span className="text-xs text-muted">{f.nickname}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </section>
      </main>
    </>
  );
}
