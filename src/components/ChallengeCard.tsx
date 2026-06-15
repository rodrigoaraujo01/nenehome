
import { Link } from "react-router-dom";
import { Avatar } from "./Avatar";
import { ADULTS } from "@/lib/constants";
import type { DbPhotoChallenge } from "@/lib/types";

interface ChallengeCardProps {
  challenge: DbPhotoChallenge;
  variant?: "mission" | "archive" | "mine";
}

function formatDeadline(deadline: string): string {
  const d = new Date(deadline);
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}

function getTimeLeft(deadline: string): string {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return "Expirado";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 1) return `${days} dias restantes`;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h restantes`;
  const mins = Math.floor(diff / (1000 * 60));
  return `${mins}min restantes`;
}

function isUrgent(deadline: string): boolean {
  const diff = new Date(deadline).getTime() - Date.now();
  return diff > 0 && diff <= 1000 * 60 * 60 * 24;
}

function CameraIcon() {
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
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

export function ChallengeCard({ challenge, variant = "mission" }: ChallengeCardProps) {
  const isExpired = new Date(challenge.deadline) < new Date();
  const isCompleted = !!challenge.my_completion;
  const completionCount = challenge.completion_count ?? 0;
  const completionProgress =
    ADULTS.length > 0 ? Math.min((completionCount / ADULTS.length) * 100, 100) : 0;
  const urgent = isUrgent(challenge.deadline);
  const creatorReward = 8 + 3 * Math.min(completionCount, 8);

  const status = (() => {
    if (isExpired) {
      return {
        label: "Expirado",
        cls: "bg-red-500/15 text-red-400",
      };
    }
    if (isCompleted) {
      return {
        label: "Você completou",
        cls: "bg-green/15 text-green",
      };
    }
    if (urgent) {
      return {
        label: "Prazo acabando",
        cls: "bg-yellow-500/15 text-yellow-400",
      };
    }
    return {
      label: "Enviar foto",
      cls: "bg-accent text-background",
    };
  })();

  const cardClass = [
    "bg-surface border rounded-2xl p-5 transition-colors",
    !isExpired && !isCompleted && variant === "mission"
      ? "border-accent/35 hover:border-accent"
      : "border-border hover:border-accent/40",
    variant === "archive" ? "opacity-80" : "",
  ].join(" ");

  return (
    <Link to={`/fotos/desafios/${challenge.id}`} className="block">
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-bold text-sm leading-snug line-clamp-2 flex-1">
            {challenge.title}
          </h3>
          <span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full shrink-0 ${status.cls}`}
          >
            {!isExpired && !isCompleted && <CameraIcon />}
            {status.label}
          </span>
        </div>

        {challenge.description && (
          <p className="text-sm text-muted line-clamp-2 mb-3">
            {challenge.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-2">
            {challenge.creator && (
              <>
                <Avatar
                  spriteUrl={challenge.creator.avatar_url}
                  nickname={challenge.creator.nickname}
                  size={20}
                />
                <span>{challenge.creator.nickname}</span>
              </>
            )}
          </div>
          <span className="text-accent font-semibold">
            +{challenge.points_reward} pts
          </span>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Completaram</span>
            <span>
              {completionCount}/{ADULTS.length}
            </span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${completionProgress}%` }}
            />
          </div>
        </div>

        {!isExpired && (
          <p className="text-[11px] text-muted mt-3">
            Criador recebe +{creatorReward} no prazo, até +32.
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>📅</span>
            <span>
              {isExpired ? `Encerrou ${formatDeadline(challenge.deadline)}` : getTimeLeft(challenge.deadline)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {completionCount > 0 && challenge.completions && (
              <div className="flex -space-x-1.5">
                {challenge.completions.slice(0, 4).map((c) => (
                  <div key={c.id} className="ring-2 ring-surface rounded-full">
                    <Avatar
                      spriteUrl={c.user?.avatar_url ?? null}
                      nickname={c.user?.nickname ?? "?"}
                      size={18}
                    />
                  </div>
                ))}
              </div>
            )}
            <span className="text-xs text-muted">
              {completionCount}/{ADULTS.length}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
