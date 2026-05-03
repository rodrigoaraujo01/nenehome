"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { PhotoCard } from "@/components/PhotoCard";
import { ChallengeCard } from "@/components/ChallengeCard";
import { useAuth } from "@/hooks/useAuth";
import { getPhotoSubmissions, getChallenges } from "@/lib/supabase/queries";
import type { DbPhotoSubmission, DbPhotoChallenge } from "@/lib/types";

export default function FotosPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<DbPhotoSubmission[]>([]);
  const [challenges, setChallenges] = useState<DbPhotoChallenge[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) router.push("/login");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      getPhotoSubmissions(profile.id),
      getChallenges(profile.id),
    ]).then(([s, c]) => {
      setSubmissions(s);
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

  const pending = submissions.filter((s) => s.status === "pending");
  const approved = submissions.filter((s) => s.status === "approved");
  const now = new Date();
  const activeChallenges = challenges.filter((c) => new Date(c.deadline) >= now);
  const expiredChallenges = challenges.filter((c) => new Date(c.deadline) < now);

  const hasContent = activeChallenges.length > 0 || pending.length > 0 || approved.length > 0 || expiredChallenges.length > 0;

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Fotos</h2>
              <p className="text-sm text-muted mt-0.5">
                Desafios fotográficos e votação
              </p>
            </div>
            <Link
              href="/fotos/desafios/novo"
              className="bg-accent hover:bg-accent-hover text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              + Desafio
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
          ) : !hasContent ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">🎯</p>
              <p className="font-semibold">Nenhum desafio ainda</p>
              <p className="text-sm text-muted mt-1">
                Crie o primeiro desafio fotográfico!
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {activeChallenges.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                    Desafios ativos ({activeChallenges.length})
                  </h3>
                  <div className="space-y-3">
                    {activeChallenges.map((c) => (
                      <ChallengeCard
                        key={c.id}
                        challenge={c}
                      />
                    ))}
                  </div>
                </section>
              )}

              {pending.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                    Votação aberta ({pending.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {pending.map((s) => (
                      <PhotoCard
                        key={s.id}
                        submission={s}
                        currentUserId={profile.id}
                      />
                    ))}
                  </div>
                </section>
              )}

              {approved.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                    Aprovadas ({approved.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {approved.map((s) => (
                      <PhotoCard
                        key={s.id}
                        submission={s}
                        currentUserId={profile.id}
                      />
                    ))}
                  </div>
                </section>
              )}

              {expiredChallenges.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                    Desafios expirados ({expiredChallenges.length})
                  </h3>
                  <div className="space-y-3">
                    {expiredChallenges.map((c) => (
                      <ChallengeCard
                        key={c.id}
                        challenge={c}
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
