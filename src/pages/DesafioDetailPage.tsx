
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { PhotoCard } from "@/components/PhotoCard";
import { useAuth } from "@/hooks/useAuth";
import { getChallenge, deletePhotoChallenge, settleChallenge } from "@/lib/supabase/queries";
import { ADULTS } from "@/lib/constants";
import type { DbPhotoChallenge } from "@/lib/types";

export default function DesafioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState<DbPhotoChallenge | null>(null);
  const [fetching, setFetching] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (!profile || !id) return;
    // settle preguiçoso: idempotente e guardado por deadline/settled_at no RPC
    settleChallenge(id)
      .catch(() => {})
      .finally(() => {
        getChallenge(id, profile.id).then((c) => {
          setChallenge(c);
          setFetching(false);
        });
      });
  }, [profile, id]);

  if (loading || fetching || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  if (!challenge) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted">Desafio não encontrado.</p>
        </main>
      </>
    );
  }

  const isExpired = new Date(challenge.deadline) < new Date();
  const isCompleted = !!challenge.my_completion;
  const completionCount = challenge.completion_count ?? 0;
  const submissions = challenge.submissions ?? [];
  const pendingSubs = submissions.filter((s) => s.status === "pending");
  const approvedSubs = submissions.filter((s) => s.status === "approved");
  const rejectedSubs = submissions.filter((s) => s.status === "rejected");

  const canSubmit = !isExpired && !isCompleted;
  const isCreator = challenge.creator_id === profile.id;

  async function handleDelete() {
    if (!challenge) return;
    const hasData = completionCount > 0 || submissions.length > 0;
    const msg = hasData
      ? `Excluir "${challenge.title}"? As fotos enviadas serão apagadas e todos os pontos e conquistas relacionados serão desfeitos, como se o desafio nunca tivesse existido.`
      : `Excluir "${challenge.title}"?`;
    if (!confirm(msg)) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deletePhotoChallenge(challenge.id);
    if (result.error) {
      setDeleteError(result.error);
      setDeleting(false);
    } else {
      navigate("/fotos/desafios");
    }
  }

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-5">
          <Link to="/fotos" className="flex items-center gap-3 text-muted hover:text-foreground transition-colors">
            <span>‹</span>
            <span className="text-sm font-bold text-foreground">Fotos</span>
          </Link>

          {/* challenge info */}
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
            <h2 className="text-lg font-bold">{challenge.title}</h2>
            {challenge.description && (
              <p className="text-sm text-muted">{challenge.description}</p>
            )}

            <div className="flex items-center gap-3 text-sm text-muted">
              {challenge.creator && (
                <div className="flex items-center gap-2">
                  <Avatar
                    spriteUrl={challenge.creator.avatar_url}
                    nickname={challenge.creator.nickname}
                    size={24}
                  />
                  <span>Criado por {challenge.creator.nickname}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-muted">
                <span>📅</span>
                <span>
                  Prazo:{" "}
                  {new Date(challenge.deadline).toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <span className="text-accent font-bold">
                +{challenge.points_reward} pts
              </span>
            </div>

            {challenge.settled_at && (
              <div className="flex items-center gap-1.5 text-sm border-t border-border pt-3 text-muted">
                <span>🏁</span>
                <span>
                  Desafio encerrado · {challenge.creator?.nickname ?? "Criador"}{" "}
                  ganhou{" "}
                  <span className="text-accent font-bold">
                    +{8 + 3 * Math.min(completionCount, 8)} pts
                  </span>{" "}
                  por {completionCount}{" "}
                  {completionCount === 1 ? "participante" : "participantes"}.
                </span>
              </div>
            )}
          </div>

          {/* submit button */}
          {canSubmit && (
            <Link
              to={`/fotos/nova?challenge_id=${challenge.id}`}
              className="block bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-xl text-center transition-colors"
            >
              Enviar foto para este desafio
            </Link>
          )}

          {isCompleted && (
            <div className="bg-green/10 border border-green/30 rounded-2xl p-4">
              <p className="text-green font-bold">
                Você já completou este desafio!
              </p>
              <p className="text-sm text-muted mt-1">
                +{challenge.points_reward} pts recebidos
              </p>
            </div>
          )}

          {/* completions */}
          {completionCount > 0 && challenge.completions && (
            <div>
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                Completaram ({completionCount}/{ADULTS.length})
              </h3>
              <div className="bg-surface border border-border rounded-2xl divide-y divide-border">
                {challenge.completions.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-3">
                    <Avatar
                      spriteUrl={c.user?.avatar_url ?? null}
                      nickname={c.user?.nickname ?? "?"}
                      size={32}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">
                        {c.user?.nickname}
                      </p>
                      <p className="text-xs text-muted">
                        {new Date(c.completed_at).toLocaleDateString("pt-BR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <Link
                      to={`/fotos/${c.submission_id}`}
                      state={{ backTo: { to: `/fotos/desafios/${challenge.id}`, label: challenge.title } }}
                      className="text-xs text-accent hover:opacity-80 transition-opacity"
                    >
                      Ver foto
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* submissions linked to this challenge */}
          {pendingSubs.length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                Votação aberta ({pendingSubs.length})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {pendingSubs.map((s) => (
                  <PhotoCard
                    key={s.id}
                    submission={s}
                    currentUserId={profile.id}
                    backTo={{ to: `/fotos/desafios/${challenge.id}`, label: challenge.title }}
                  />
                ))}
              </div>
            </section>
          )}

          {approvedSubs.length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                Fotos aprovadas ({approvedSubs.length})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {approvedSubs.map((s) => (
                  <PhotoCard
                    key={s.id}
                    submission={s}
                    currentUserId={profile.id}
                    backTo={{ to: `/fotos/desafios/${challenge.id}`, label: challenge.title }}
                  />
                ))}
              </div>
            </section>
          )}

          {rejectedSubs.length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                Rejeitadas ({rejectedSubs.length})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {rejectedSubs.map((s) => (
                  <PhotoCard
                    key={s.id}
                    submission={s}
                    currentUserId={profile.id}
                    backTo={{ to: `/fotos/desafios/${challenge.id}`, label: challenge.title }}
                  />
                ))}
              </div>
            </section>
          )}

          {submissions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted text-sm">
                Nenhuma foto enviada ainda para este desafio.
              </p>
            </div>
          )}

          {isCreator && (
            <div className="border-t border-border pt-5 space-y-3">
              {(completionCount > 0 || submissions.length > 0) && (
                <p className="text-sm text-muted">
                  Excluir apaga as fotos enviadas e desfaz todos os pontos e
                  conquistas relacionados, como se o desafio nunca tivesse
                  existido.
                </p>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-red-400 hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {deleting ? "Excluindo..." : "Excluir desafio"}
              </button>
              {deleteError && (
                <p className="text-xs text-red-400">{deleteError}</p>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
