
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { QuestionCard } from "@/components/QuestionCard";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/useAuth";
import { getQuestions } from "@/lib/supabase/queries";
import type { DbQuestion, DbProfile } from "@/lib/types";

interface CreatorStat {
  creator: DbProfile;
  correct: number;
  total: number;
}

export default function PerguntasRespondidasPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<DbQuestion[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (!profile) return;
    getQuestions(profile.id).then((qs) => {
      setQuestions(qs);
      setFetching(false);
    });
  }, [profile]);

  const answered = useMemo(
    () =>
      questions.filter(
        (q) => q.creator_id !== profile?.id && q.my_answer,
      ),
    [questions, profile],
  );

  const correctCount = answered.filter((q) => q.my_answer?.is_correct).length;
  const overallRatio = answered.length
    ? Math.round((correctCount / answered.length) * 100)
    : 0;

  const byCreator = useMemo<CreatorStat[]>(() => {
    const map = new Map<string, CreatorStat>();
    for (const q of answered) {
      if (!q.creator) continue;
      const stat = map.get(q.creator_id) ?? {
        creator: q.creator,
        correct: 0,
        total: 0,
      };
      stat.total += 1;
      if (q.my_answer?.is_correct) stat.correct += 1;
      map.set(q.creator_id, stat);
    }
    return [...map.values()].sort((a, b) => {
      const ra = a.correct / a.total;
      const rb = b.correct / b.total;
      if (rb !== ra) return rb - ra;
      return b.total - a.total;
    });
  }, [answered]);

  if (loading || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Link
              to="/perguntas"
              className="flex items-center gap-3 text-muted hover:text-foreground transition-colors"
            >
              <span>‹</span>
              <h2 className="text-xl font-bold text-foreground">
                Já respondidas
              </h2>
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
          ) : answered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">📭</p>
              <p className="font-semibold">Você ainda não respondeu nada</p>
              <p className="text-sm text-muted mt-1">
                Volte e responda as perguntas do grupo!
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <section>
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                  Aproveitamento
                </h3>
                <div className="bg-surface border border-border rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{overallRatio}%</p>
                    <p className="text-sm text-muted mt-0.5">
                      {correctCount} de {answered.length} corretas
                    </p>
                  </div>
                  <span className="text-4xl">
                    {overallRatio >= 70 ? "🎯" : overallRatio >= 40 ? "👍" : "🤔"}
                  </span>
                </div>
              </section>

              {byCreator.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                    Por quem perguntou
                  </h3>
                  <div className="space-y-2">
                    {byCreator.map((stat) => {
                      const ratio = Math.round(
                        (stat.correct / stat.total) * 100,
                      );
                      return (
                        <Link
                          key={stat.creator.id}
                          to={`/perfil/${stat.creator.nickname}`}
                          className="bg-surface border border-border rounded-2xl p-3 flex items-center gap-3 hover:border-accent/40 transition-colors"
                        >
                          <Avatar
                            spriteUrl={stat.creator.avatar_url}
                            nickname={stat.creator.nickname}
                            size={32}
                          />
                          <span className="text-sm font-semibold flex-1">
                            {stat.creator.nickname}
                          </span>
                          <div className="text-right">
                            <p className="text-sm font-bold">{ratio}%</p>
                            <p className="text-xs text-muted">
                              {stat.correct}/{stat.total}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                  Perguntas ({answered.length})
                </h3>
                <div className="space-y-3">
                  {answered.map((q) => (
                    <QuestionCard key={q.id} question={q} />
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
