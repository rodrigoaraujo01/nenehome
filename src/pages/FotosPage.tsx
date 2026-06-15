import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { PhotoCard } from "@/components/PhotoCard";
import { ChallengeCard } from "@/components/ChallengeCard";
import { useAuth } from "@/hooks/useAuth";
import { getPhotoSubmissions, getChallenges } from "@/lib/supabase/queries";
import type { DbPhotoSubmission, DbPhotoChallenge } from "@/lib/types";

type Tab = "missions" | "vote" | "gallery" | "mine";

const tabs: { id: Tab; label: string }[] = [
  { id: "missions", label: "Missões" },
  { id: "vote", label: "Votar" },
  { id: "gallery", label: "Galeria" },
  { id: "mine", label: "Minhas" },
];

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

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
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

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 bg-surface border border-border rounded-2xl px-6">
      <p className="text-4xl mb-4">🎯</p>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted mt-1">{text}</p>
      {action}
    </div>
  );
}

function sortMissions(challenges: DbPhotoChallenge[]) {
  return [...challenges].sort((a, b) => {
    const aDone = a.my_completion ? 1 : 0;
    const bDone = b.my_completion ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;

    const aDeadline = new Date(a.deadline).getTime();
    const bDeadline = new Date(b.deadline).getTime();
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    return b.points_reward - a.points_reward;
  });
}

export default function FotosPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<DbPhotoSubmission[]>([]);
  const [challenges, setChallenges] = useState<DbPhotoChallenge[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("missions");

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

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
  const rejected = submissions.filter((s) => s.status === "rejected");
  const myPhotos = submissions.filter((s) => s.submitter_id === profile.id);
  const myPending = myPhotos.filter((s) => s.status === "pending");
  const myApproved = myPhotos.filter((s) => s.status === "approved");
  const myRejected = myPhotos.filter((s) => s.status === "rejected");
  const toVote = pending.filter(
    (s) =>
      s.submitter_id !== profile.id &&
      (s.my_vote === null || s.my_vote === undefined),
  );
  const now = new Date();
  const activeChallenges = sortMissions(
    challenges.filter((c) => new Date(c.deadline) >= now),
  );
  const expiredChallenges = challenges.filter((c) => new Date(c.deadline) < now);
  const completedChallenges = challenges.filter((c) => c.my_completion);
  const openForMe = activeChallenges.filter((c) => !c.my_completion);

  const hasContent =
    challenges.length > 0 || pending.length > 0 || approved.length > 0 || rejected.length > 0;

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Fotos</h2>
              <p className="text-sm text-muted mt-0.5">
                Missões, votos e galeria
              </p>
            </div>
            <Link
              to="/fotos/desafios/novo"
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-background text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              <PlusIcon />
              Desafio
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
                  className="bg-surface border border-border rounded-2xl h-36 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Para votar" value={toVote.length} tone="accent" />
                <Stat label="Missões ativas" value={activeChallenges.length} />
                <Stat
                  label="Completadas"
                  value={`${completedChallenges.length}/${challenges.length}`}
                  tone="green"
                />
                <Stat label="Aprovadas" value={approved.length} />
              </div>

              {toVote.length > 0 && (
                <Link
                  to="/fotos/votar"
                  className="flex items-center justify-between bg-accent hover:bg-accent-hover text-background font-bold px-5 py-4 rounded-2xl transition-colors"
                >
                  <span>
                    {toVote.length}{" "}
                    {toVote.length === 1
                      ? "foto precisa do seu voto"
                      : "fotos precisam do seu voto"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm bg-background/15 rounded-full px-3 py-1">
                    Votar agora <ArrowIcon />
                  </span>
                </Link>
              )}

              <div className="grid grid-cols-4 gap-1 bg-surface border border-border rounded-2xl p-1">
                {tabs.map((tab) => {
                  const count =
                    tab.id === "missions"
                      ? activeChallenges.length
                      : tab.id === "vote"
                      ? toVote.length
                      : tab.id === "gallery"
                      ? approved.length
                      : myPhotos.length;
                  const active = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`min-h-10 rounded-xl px-1.5 text-xs font-bold transition-colors ${
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

              {!hasContent ? (
                <EmptyState
                  title="Nenhum desafio ainda"
                  text="Crie o primeiro desafio fotográfico!"
                  action={
                    <Link
                      to="/fotos/desafios/novo"
                      className="inline-flex items-center gap-1.5 mt-5 bg-accent hover:bg-accent-hover text-background text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                    >
                      <PlusIcon />
                      Criar desafio
                    </Link>
                  }
                />
              ) : (
                <>
                  {activeTab === "missions" && (
                    <section className="space-y-6">
                      {activeChallenges.length > 0 ? (
                        <div className="space-y-3">
                          {activeChallenges.map((c) => (
                            <ChallengeCard
                              key={c.id}
                              challenge={c}
                              variant="mission"
                            />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="Nenhuma missão ativa"
                          text="Quando alguém criar um desafio, ele aparece aqui."
                        />
                      )}

                      {expiredChallenges.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                            Expiradas ({expiredChallenges.length})
                          </h3>
                          <div className="space-y-3">
                            {expiredChallenges.map((c) => (
                              <ChallengeCard
                                key={c.id}
                                challenge={c}
                                variant="archive"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {activeTab === "vote" && (
                    <section className="space-y-4">
                      <Link
                        to="/fotos/votar"
                        className="block bg-surface border border-border rounded-2xl p-4 hover:border-accent/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold">
                              Modo votação rápida
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {toVote.length > 0
                                ? `${toVote.length} esperando sua decisão`
                                : "Tudo votado por enquanto"}
                            </p>
                          </div>
                          <span className="text-muted text-xl">›</span>
                        </div>
                      </Link>

                      {toVote.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {toVote.map((s) => (
                            <PhotoCard
                              key={s.id}
                              submission={s}
                              currentUserId={profile.id}
                              variant="vote"
                            />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="Tudo votado"
                          text="As próximas fotos pendentes aparecem aqui."
                        />
                      )}
                    </section>
                  )}

                  {activeTab === "gallery" && (
                    <section className="space-y-6">
                      {approved.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {approved.map((s) => (
                            <PhotoCard
                              key={s.id}
                              submission={s}
                              currentUserId={profile.id}
                              variant="gallery"
                            />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="Galeria vazia"
                          text="Fotos aprovadas pelo grupo aparecem aqui."
                        />
                      )}

                      {pending.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                            Aguardando votos ({pending.length})
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
                        </div>
                      )}

                      {rejected.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                            Rejeitadas ({rejected.length})
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            {rejected.map((s) => (
                              <PhotoCard
                                key={s.id}
                                submission={s}
                                currentUserId={profile.id}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {activeTab === "mine" && (
                    <section className="space-y-6">
                      {openForMe.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                            Para completar ({openForMe.length})
                          </h3>
                          <div className="space-y-3">
                            {openForMe.map((c) => (
                              <ChallengeCard
                                key={c.id}
                                challenge={c}
                                variant="mine"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {myPhotos.length === 0 &&
                      completedChallenges.length === 0 &&
                      openForMe.length === 0 ? (
                        <EmptyState
                          title="Nada seu ainda"
                          text="Complete uma missão ou envie uma foto para começar."
                        />
                      ) : (
                        <>
                          {myPending.length > 0 && (
                            <div>
                              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                                Aguardando votos ({myPending.length})
                              </h3>
                              <div className="grid grid-cols-2 gap-3">
                                {myPending.map((s) => (
                                  <PhotoCard
                                    key={s.id}
                                    submission={s}
                                    currentUserId={profile.id}
                                    variant="mine"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {myApproved.length > 0 && (
                            <div>
                              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                                Aprovadas ({myApproved.length})
                              </h3>
                              <div className="grid grid-cols-2 gap-3">
                                {myApproved.map((s) => (
                                  <PhotoCard
                                    key={s.id}
                                    submission={s}
                                    currentUserId={profile.id}
                                    variant="mine"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {myRejected.length > 0 && (
                            <div>
                              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                                Rejeitadas ({myRejected.length})
                              </h3>
                              <div className="grid grid-cols-2 gap-3">
                                {myRejected.map((s) => (
                                  <PhotoCard
                                    key={s.id}
                                    submission={s}
                                    currentUserId={profile.id}
                                    variant="mine"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {completedChallenges.length > 0 && (
                            <div>
                              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                                Missões completadas ({completedChallenges.length})
                              </h3>
                              <div className="space-y-3">
                                {completedChallenges.map((c) => (
                                  <ChallengeCard
                                    key={c.id}
                                    challenge={c}
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
            </>
          )}
        </div>
      </main>
    </>
  );
}
