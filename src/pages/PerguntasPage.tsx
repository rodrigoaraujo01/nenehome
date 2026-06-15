
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { QuestionCard } from "@/components/QuestionCard";
import { useAuth } from "@/hooks/useAuth";
import { getQuestions, hasPremiumQuestionToday } from "@/lib/supabase/queries";
import type { DbQuestion } from "@/lib/types";

type Tab = "answer" | "answered" | "mine";

const tabs: { id: Tab; label: string }[] = [
  { id: "answer", label: "Para responder" },
  { id: "answered", label: "Respondidas" },
  { id: "mine", label: "Minhas" },
];

const difficultyLabel: Record<string, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
  impossible: "Impossível",
};

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "accent" | "green";
}) {
  const toneClass =
    tone === "accent"
      ? "text-accent"
      : tone === "green"
      ? "text-green"
      : "text-foreground";

  return (
    <div className="bg-surface border border-border rounded-2xl px-3 py-3 min-w-0">
      <p className={`text-lg font-bold leading-none ${toneClass}`}>{value}</p>
      <p className="text-[11px] text-muted mt-1 truncate">{label}</p>
    </div>
  );
}

export default function PerguntasPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<DbQuestion[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("answer");
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      getQuestions(profile.id),
      hasPremiumQuestionToday(profile.id),
    ]).then(([qs, premium]) => {
      setQuestions(qs);
      setIsPremium(premium);
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

  const mine = questions.filter((q) => q.creator_id === profile.id);
  const myActive = mine.filter((q) => q.status !== "closed");
  const myClosed = mine.filter((q) => q.status === "closed");
  const others = questions.filter((q) => q.creator_id !== profile.id);
  const unanswered = others.filter(
    (q) => !q.my_answer && q.status !== "closed",
  );
  const answered = others.filter((q) => q.my_answer);
  const correctCount = answered.filter((q) => q.my_answer?.is_correct).length;
  const hitRatio = answered.length
    ? Math.round((correctCount / answered.length) * 100)
    : 0;
  const bestDifficulty = (() => {
    const stats = new Map<string, { correct: number; total: number }>();

    for (const q of answered) {
      if (!q.difficulty || !q.my_answer) continue;
      const stat = stats.get(q.difficulty) ?? { correct: 0, total: 0 };
      stat.total += 1;
      if (q.my_answer.is_correct) stat.correct += 1;
      stats.set(q.difficulty, stat);
    }

    return [...stats.entries()].sort((a, b) => {
      const ratioA = a[1].correct / a[1].total;
      const ratioB = b[1].correct / b[1].total;
      if (ratioB !== ratioA) return ratioB - ratioA;
      return b[1].total - a[1].total;
    })[0]?.[0];
  })();

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Perguntas</h2>
              <p className="text-sm text-muted mt-0.5">
                Responda e ganhe pontos
              </p>
            </div>
            <Link
              to="/perguntas/nova"
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-background text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              <PlusIcon />
              Pergunta
            </Link>
          </div>

          {fetching ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-surface border border-border rounded-2xl h-16 animate-pulse"
                  />
                ))}
              </div>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-surface border border-border rounded-2xl h-28 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Para responder" value={unanswered.length} tone="accent" />
                <Stat label="Respondidas" value={answered.length} />
                <Stat label="Aproveitamento" value={`${hitRatio}%`} tone="green" />
                {isPremium !== null && (
                  <Stat
                    label="Premium"
                    value={isPremium ? "Disponível" : "Usada"}
                    tone={isPremium ? "accent" : "default"}
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-1 bg-surface border border-border rounded-2xl p-1">
                {tabs.map((tab) => {
                  const count =
                    tab.id === "answer"
                      ? unanswered.length
                      : tab.id === "answered"
                      ? answered.length
                      : mine.length;
                  const active = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`min-h-10 rounded-xl px-2 text-xs font-bold transition-colors ${
                        active
                          ? "bg-accent text-background"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      <span className="block truncate">{tab.label}</span>
                      <span className="text-[10px] opacity-80">{count}</span>
                    </button>
                  );
                })}
              </div>

              {activeTab === "answer" && (
                <section className="space-y-3">
                  {unanswered.length === 0 ? (
                    <div className="text-center py-14 bg-surface border border-border rounded-2xl px-6">
                      <p className="text-4xl mb-4">🤔</p>
                      <p className="font-semibold">
                        Nenhuma pergunta para responder
                      </p>
                      <p className="text-sm text-muted mt-1">
                        Crie uma pergunta e puxe a rodada.
                      </p>
                      <Link
                        to="/perguntas/nova"
                        className="inline-flex items-center gap-1.5 mt-5 bg-accent hover:bg-accent-hover text-background text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                      >
                        <PlusIcon />
                        Criar pergunta
                      </Link>
                    </div>
                  ) : (
                    unanswered.map((q) => (
                      <QuestionCard key={q.id} question={q} variant="answer" />
                    ))
                  )}
                </section>
              )}

              {activeTab === "answered" && (
                <section className="space-y-3">
                  <Link
                    to="/perguntas/respondidas"
                    className="block bg-surface border border-border rounded-2xl p-4 hover:border-accent/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          Já respondidas
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {answered.length}{" "}
                          {answered.length === 1 ? "pergunta" : "perguntas"} ·{" "}
                          {hitRatio}% de acerto
                          {bestDifficulty
                            ? ` · melhor em ${difficultyLabel[bestDifficulty]}`
                            : ""}
                        </p>
                      </div>
                      <span className="text-muted text-xl">›</span>
                    </div>
                  </Link>

                  {answered.length === 0 ? (
                    <div className="text-center py-12 bg-surface border border-border rounded-2xl px-6">
                      <p className="font-semibold">
                        Você ainda não respondeu nenhuma pergunta
                      </p>
                      <p className="text-sm text-muted mt-1">
                        As respostas aparecem aqui depois da primeira rodada.
                      </p>
                    </div>
                  ) : (
                    answered.map((q) => (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        variant="answered"
                      />
                    ))
                  )}
                </section>
              )}

              {activeTab === "mine" && (
                <section className="space-y-6">
                  {mine.length === 0 ? (
                    <div className="text-center py-12 bg-surface border border-border rounded-2xl px-6">
                      <p className="font-semibold">
                        Você ainda não criou perguntas
                      </p>
                      <p className="text-sm text-muted mt-1">
                        A primeira do dia vale mais.
                      </p>
                      <Link
                        to="/perguntas/nova"
                        className="inline-flex items-center gap-1.5 mt-5 bg-accent hover:bg-accent-hover text-background text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                      >
                        <PlusIcon />
                        Criar pergunta
                      </Link>
                    </div>
                  ) : (
                    <>
                      {myActive.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                            Em jogo ({myActive.length})
                          </h3>
                          <div className="space-y-3">
                            {myActive.map((q) => (
                              <QuestionCard
                                key={q.id}
                                question={q}
                                variant="mine"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {myClosed.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                            Finalizadas ({myClosed.length})
                          </h3>
                          <div className="space-y-3">
                            {myClosed.map((q) => (
                              <QuestionCard
                                key={q.id}
                                question={q}
                                variant="mine"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
