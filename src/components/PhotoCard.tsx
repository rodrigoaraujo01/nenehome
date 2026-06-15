
import { Link } from "react-router-dom";
import { Avatar } from "./Avatar";
import type { DbPhotoSubmission } from "@/lib/types";

interface PhotoCardProps {
  submission: DbPhotoSubmission;
  currentUserId: string;
  backTo?: { to: string; label: string };
  variant?: "vote" | "gallery" | "mine";
}

const STATUS_LABEL = {
  pending: "Votação aberta",
  approved: "Aprovada",
  rejected: "Rejeitada",
} as const;

const STATUS_STYLE = {
  pending: "bg-yellow-500/15 text-yellow-400",
  approved: "bg-green/15 text-green",
  rejected: "bg-red-500/15 text-red-400",
} as const;

function VoteIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 12 2 2 4-4" />
      <path d="M21 12c.552 0 1-.448 1-1V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6c0 .552.448 1 1 1a2 2 0 0 1 0 4c-.552 0-1 .448-1 1v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2c0-.552-.448-1-1-1a2 2 0 0 1 0-4Z" />
    </svg>
  );
}

export function PhotoCard({
  submission,
  currentUserId,
  backTo,
  variant,
}: PhotoCardProps) {
  const isOwn = submission.submitter_id === currentUserId;
  const voted = submission.my_vote !== null && submission.my_vote !== undefined;
  const canVote = submission.status === "pending" && !isOwn && !voted;
  const isVoteVariant = variant === "vote";
  const isGallery = variant === "gallery";
  const isMine = variant === "mine";

  const approveCount = submission.approve_count ?? 0;
  const threshold = submission.votes_to_approve;
  const progress = Math.min((approveCount / threshold) * 100, 100);
  const cardClass = [
    "bg-surface border rounded-2xl overflow-hidden transition-colors",
    canVote && isVoteVariant
      ? "border-accent/40 hover:border-accent"
      : "border-border hover:border-accent/40",
  ].join(" ");
  const statusText = (() => {
    if (canVote) return "Seu voto faz diferença";
    if (submission.status === "pending" && isOwn) return "Aguardando votos";
    if (submission.status === "pending" && voted) {
      return `Você ${submission.my_vote ? "aprovou" : "rejeitou"}`;
    }
    if (submission.status === "approved") return "Aprovada pelo grupo";
    return "Rejeitada pelo grupo";
  })();

  return (
    <Link to={`/fotos/${submission.id}`} state={backTo ? { backTo } : undefined} className="block">
      <div className={cardClass}>
        {/* photo */}
        <div className="relative aspect-square w-full bg-surface-light">
          <img
            src={submission.photo_url}
            alt={submission.caption ?? "Foto"}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span
            className={`absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-full ${
              STATUS_STYLE[submission.status]
            }`}
          >
            {STATUS_LABEL[submission.status]}
          </span>
          {submission.challenge_id && (
            <span className="absolute top-3 left-3 text-xs font-bold px-2 py-1 rounded-full bg-accent/20 text-accent">
              🎯
            </span>
          )}
          {canVote && isVoteVariant && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-accent text-background">
              <VoteIcon />
              Votar
            </span>
          )}
        </div>

        <div className={`${isGallery ? "p-3" : "p-4"} space-y-3`}>
          {/* submitter + caption */}
          <div className="flex items-start gap-2">
            {submission.submitter && !isGallery && (
              <Avatar
                spriteUrl={submission.submitter.avatar_url}
                nickname={submission.submitter.nickname}
                size={28}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted">
                {isMine ? "Sua foto" : submission.submitter?.nickname}
              </p>
              {submission.caption && !isGallery && (
                <p className="text-sm mt-0.5 line-clamp-2">{submission.caption}</p>
              )}
              {isGallery && (
                <p className="text-sm mt-0.5 line-clamp-1">
                  {submission.caption || submission.submitter?.nickname}
                </p>
              )}
            </div>
          </div>

          {/* vote progress */}
          {submission.status === "pending" && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">
                {statusText}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-surface-light rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted shrink-0">
                  {approveCount}/{threshold}
                </span>
              </div>
            </div>
          )}

          {isMine && submission.status !== "pending" && (
            <p
              className={`text-xs font-semibold ${
                submission.status === "approved" ? "text-green" : "text-red-400"
              }`}
            >
              {statusText}
            </p>
          )}

          {submission.status === "approved" &&
            !isGallery &&
            (submission.awarded_points === false ? (
              <p className="text-xs text-muted font-semibold">
                Aprovada · sem pontos (já pontuou neste desafio)
              </p>
            ) : (
              <p className="text-xs text-green font-semibold">
                +{submission.points_reward} pts para{" "}
                {submission.submitter?.nickname}
              </p>
            ))}
        </div>
      </div>
    </Link>
  );
}
