"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { PhotoCard } from "@/components/PhotoCard";
import { useAuth } from "@/hooks/useAuth";
import { getPhotoSubmissions } from "@/lib/supabase/queries";
import type { DbPhotoSubmission } from "@/lib/types";

export default function FotosPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<DbPhotoSubmission[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) router.push("/login");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile) return;
    getPhotoSubmissions(profile.id).then((s) => {
      setSubmissions(s);
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

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Fotos</h2>
              <p className="text-sm text-muted mt-0.5">
                Submeta e vote nos momentos do grupo
              </p>
            </div>
            <Link
              href="/fotos/nova"
              className="bg-accent hover:bg-accent-hover text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              + Enviar
            </Link>
          </div>

          {fetching ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-surface border border-border rounded-2xl aspect-square animate-pulse"
                />
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">📸</p>
              <p className="font-semibold">Nenhuma foto ainda</p>
              <p className="text-sm text-muted mt-1">
                Registre um momento do grupo!
              </p>
            </div>
          ) : (
            <div className="space-y-8">
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
            </div>
          )}
        </div>
      </main>
    </>
  );
}
