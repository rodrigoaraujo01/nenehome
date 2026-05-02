"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { ChallengeCard } from "@/components/ChallengeCard";
import { useAuth } from "@/hooks/useAuth";
import { getChallenges } from "@/lib/supabase/queries";
import type { DbPhotoChallenge } from "@/lib/types";

export default function DesafiosPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [challenges, setChallenges] = useState<DbPhotoChallenge[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) router.push("/login");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile) return;
    getChallenges(profile.id).then((c) => {
      setChallenges(c);
      setFetching(false);
    });
  }, [profile]);

  if (loading || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  const now = new Date();
  const active = challenges.filter((c) => new Date(c.deadline) >= now);
  const expired = challenges.filter((c) => new Date(c.deadline) < now);

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link href="/fotos" className="flex items-center gap-3 text-muted hover:text-foreground transition-colors">
              <span>‹</span>
              <div>
                <h2 className="text-xl font-bold text-foreground">Desafios</h2>
                <p className="text-sm text-muted mt-0.5">
                  Missões fotográficas com prazo
                </p>
              </div>
            </Link>
            <Link
              href="/fotos/desafios/novo"
              className="bg-accent hover:bg-accent-hover text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              + Novo
            </Link>
          </div>

          {fetching ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-surface border border-border rounded-2xl h-36 animate-pulse"
                />
              ))}
            </div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">🎯</p>
              <p className="font-semibold">Nenhum desafio ainda</p>
              <p className="text-sm text-muted mt-1">
                Crie o primeiro desafio fotográfico!
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {active.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                    Ativos ({active.length})
                  </h3>
                  <div className="space-y-3">
                    {active.map((c) => (
                      <ChallengeCard
                        key={c.id}
                        challenge={c}
                        currentUserId={profile.id}
                      />
                    ))}
                  </div>
                </section>
              )}

              {expired.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                    Expirados ({expired.length})
                  </h3>
                  <div className="space-y-3">
                    {expired.map((c) => (
                      <ChallengeCard
                        key={c.id}
                        challenge={c}
                        currentUserId={profile.id}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
