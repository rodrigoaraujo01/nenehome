
import { Link } from "react-router-dom";
import { Avatar } from "./Avatar";
import { ADULTS } from "@/lib/constants";
import type { DbQuestion } from "@/lib/types";

interface QuestionCardProps {
  question: DbQuestion;
  variant?: "answer" | "answered" | "mine";
}

const TYPE_LABEL: Record<DbQuestion["type"], string> = {
  story: "História",
  multiple_choice: "Múltipla escolha",
};

const DIFFICULTY_BADGE: Record<string, string> = {
  easy: "🟢 Fácil",
  medium: "🟡 Médio",
  hard: "🔴 Difícil",
  impossible: "💀 Impossível",
};

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

export function QuestionCard({ question, variant }: QuestionCardProps) {
  const answered = question.my_answer !== null && question.my_answer !== undefined;
  const correct = question.my_answer?.is_correct;
  const closed = question.status === "closed";
  const isMine = variant === "mine";
  const isAnswerMode = variant === "answer";
  const eligibleTotal = Math.max(ADULTS.length - 1, 0);
  const answerCount = question.answer_count ?? 0;
  const progressText = `${Math.min(answerCount, eligibleTotal)} de ${eligibleTotal} responderam`;
  const showProgress = !closed && (isMine || isAnswerMode);
  const difficulty = closed && question.difficulty
    ? DIFFICULTY_BADGE[question.difficulty]
    : null;

  const cardClass = [
    "bg-surface border rounded-2xl p-4 transition-colors",
    isAnswerMode && !closed
      ? "border-accent/40 hover:border-accent"
      : "border-border hover:border-accent/40",
  ].join(" ");

  const statusPill = (() => {
    if (isAnswerMode && !answered && !closed) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-accent text-background">
          Responder <ArrowIcon />
        </span>
      );
    }

    if (closed && !answered && !isMine) {
      return (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-border/60 text-muted">
          Encerrada
        </span>
      );
    }

    if (answered) {
      return (
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            correct
              ? "bg-green/15 text-green"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {correct ? "✓ Acertou" : "✗ Errou"}
        </span>
      );
    }

    if (isMine && !closed) {
      return (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
          Em jogo
        </span>
      );
    }

    if (isMine && closed) {
      return (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-border/60 text-muted">
          Finalizada
        </span>
      );
    }

    return null;
  })();

  return (
    <Link to={`/perguntas/${question.id}`} className="block">
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            {TYPE_LABEL[question.type]}
          </span>
          {statusPill}
        </div>

        {difficulty && (
          <div className="mb-3">
            <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full bg-surface-light text-foreground">
              {difficulty}
            </span>
          </div>
        )}

        <p className="text-sm leading-relaxed line-clamp-3 mb-4">
          {question.content}
        </p>

        {showProgress && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted mb-1.5">
              <span>{progressText}</span>
              <span>{eligibleTotal > 0 ? Math.round((Math.min(answerCount, eligibleTotal) / eligibleTotal) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full"
                style={{
                  width: `${eligibleTotal > 0 ? (Math.min(answerCount, eligibleTotal) / eligibleTotal) * 100 : 0}%`,
                }}
              />
            </div>
            {isAnswerMode && (
              <p className="text-[11px] text-muted mt-2">
                Pontos liberam quando todo mundo responder.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          {question.creator && (
            <div className="flex items-center gap-2">
              <Avatar
                spriteUrl={question.creator.avatar_url}
                nickname={question.creator.nickname}
                size={24}
              />
              <span className="text-xs text-muted">
                {question.creator.nickname}
              </span>
            </div>
          )}
          <span className="text-xs text-muted ml-auto">
            {answerCount} {answerCount === 1 ? "resposta" : "respostas"}
          </span>
        </div>
      </div>
    </Link>
  );
}
