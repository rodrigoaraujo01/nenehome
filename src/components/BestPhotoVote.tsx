import { useState } from "react";
import { Avatar } from "./Avatar";
import { voteBestPhoto } from "@/lib/supabase/queries";
import type { ChallengeBestState, DbPhotoSubmission } from "@/lib/types";

interface BestPhotoVoteProps {
  submissions: DbPhotoSubmission[];
  currentUserId: string;
  best: ChallengeBestState;
  onVoted: () => void;
}

function timeLeft(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return "encerrada";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h restantes`;
  if (hours > 0) return `${hours}h restantes`;
  return `${Math.floor(diff / (1000 * 60))}min restantes`;
}

export function BestPhotoVote({
  submissions,
  currentUserId,
  best,
  onVoted,
}: BestPhotoVoteProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // votação só existe entre fotos aprovadas, e só com disputa (2+)
  if (best.state === "not_open" || best.state === "no_contest") return null;
  // desafio antigo que nunca teve janela: não polui a página com seção vazia
  if (best.state === "closed" && best.votes.length === 0) return null;

  const isOpen = best.state === "open";
  const voteCount = (id: string) =>
    best.votes.find((v) => v.submission_id === id)?.votes ?? 0;
  const topVotes = Math.max(0, ...best.votes.map((v) => v.votes));

  async function handleVote(submissionId: string) {
    setBusy(submissionId);
    setError(null);
    const res = await voteBestPhoto(submissionId);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    onVoted();
  }

  // na apuração o empate é mantido: todas as fotos no topo dobram
  const ordered = [...submissions].sort((a, b) => voteCount(b.id) - voteCount(a.id));

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
          🏅 Melhor foto
        </h3>
        <span className="text-xs text-muted">
          {isOpen ? `⏳ ${timeLeft(best.closes_at)}` : "Encerrada"}
        </span>
      </div>

      <p className="text-xs text-muted mb-3">
        {isOpen
          ? "Vote na melhor foto do desafio. Quem vencer dobra os pontos que ganhou aqui. Dá pra trocar o voto até o fim do prazo."
          : "Votação encerrada — quem venceu dobrou os pontos do desafio."}
      </p>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        {ordered.map((s) => {
          const votes = voteCount(s.id);
          const isOwn = s.submitter_id === currentUserId;
          const isMyVote = best.my_vote === s.id;
          // antes da apuração o topo é só parcial, não vencedor
          const isWinner = best.settled && s.best_photo;
          const isLeading = !best.settled && votes > 0 && votes === topVotes;

          return (
            <div
              key={s.id}
              className={`bg-surface border rounded-2xl overflow-hidden transition-colors ${
                isWinner
                  ? "border-yellow-400"
                  : isMyVote
                  ? "border-accent"
                  : "border-border"
              }`}
            >
              <div className="relative aspect-square w-full bg-surface-light">
                <img
                  src={s.photo_url}
                  alt={s.caption ?? "Foto"}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {isWinner && (
                  <span className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-full bg-yellow-400 text-background">
                    🏆 Melhor foto
                  </span>
                )}
                {isLeading && (
                  <span className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-full bg-surface/90 text-foreground">
                    Liderando
                  </span>
                )}
                <span className="absolute bottom-2 right-2 text-xs font-bold px-2 py-1 rounded-full bg-surface/90 text-foreground">
                  {votes} {votes === 1 ? "voto" : "votos"}
                </span>
              </div>

              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {s.submitter && (
                    <Avatar
                      spriteUrl={s.submitter.avatar_url}
                      nickname={s.submitter.nickname}
                      size={22}
                    />
                  )}
                  <span className="text-xs font-semibold text-muted truncate">
                    {isOwn ? "Sua foto" : s.submitter?.nickname}
                  </span>
                </div>

                {isOpen && !isOwn && (
                  <button
                    type="button"
                    onClick={() => handleVote(s.id)}
                    disabled={busy !== null || isMyVote}
                    className={`w-full text-xs font-bold py-2 rounded-xl border transition-colors disabled:opacity-60 ${
                      isMyVote
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-surface hover:border-accent/50"
                    }`}
                  >
                    {busy === s.id
                      ? "..."
                      : isMyVote
                      ? "Seu voto ✓"
                      : "Votar"}
                  </button>
                )}
                {isOpen && isOwn && (
                  <p className="text-[11px] text-muted text-center py-1">
                    Não dá pra votar na sua
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
