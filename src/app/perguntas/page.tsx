"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { QuestionCard } from "@/components/QuestionCard";
import { useAuth } from "@/hooks/useAuth";
import { getQuestions } from "@/lib/supabase/queries";
import type { DbQuestion } from "@/lib/types";

export default function PerguntasPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<DbQuestion[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) router.push("/login");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile) return;
    getQuestions(profile.id).then((qs) => {
      setQuestions(qs);
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

  const unanswered = questions.filter((q) => !q.my_answer);
  const answered = questions.filter((q) => q.my_answer);

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Perguntas</h2>
              <p className="text-sm text-muted mt-0.5">
                Responda e ganhe pontos
              </p>
            </div>
            <Link
              href="/perguntas/nova"
              className="bg-accent hover:bg-accent-hover text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              + Nova
            </Link>
          </div>

          {fetching ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-surface border border-border rounded-2xl h-28 animate-pulse"
                />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">🤔</p>
              <p className="font-semibold">Nenhuma pergunta ainda</p>
              <p className="text-sm text-muted mt-1">
                Seja o primeiro a criar uma!
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {unanswered.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                    Para responder ({unanswered.length})
                  </h3>
                  <div className="space-y-3">
                    {unanswered.map((q) => (
                      <QuestionCard key={q.id} question={q} />
                    ))}
                  </div>
                </section>
              )}

              {answered.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                    Já respondidas ({answered.length})
                  </h3>
                  <div className="space-y-3">
                    {answered.map((q) => (
                      <QuestionCard key={q.id} question={q} />
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
