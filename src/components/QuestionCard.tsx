"use client";

import Link from "next/link";
import { Avatar } from "./Avatar";
import type { DbQuestion } from "@/lib/types";

interface QuestionCardProps {
  question: DbQuestion;
}

const TYPE_LABEL: Record<DbQuestion["type"], string> = {
  story: "História",
  multiple_choice: "Múltipla escolha",
};

export function QuestionCard({ question }: QuestionCardProps) {
  const answered = question.my_answer !== null && question.my_answer !== undefined;
  const correct = question.my_answer?.is_correct;

  return (
    <Link href={`/perguntas/${question.id}`} className="block">
      <div className="bg-surface border border-border rounded-2xl p-4 hover:border-accent/40 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            {TYPE_LABEL[question.type]}
          </span>
          {answered && (
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                correct
                  ? "bg-green/15 text-green"
                  : "bg-red-500/15 text-red-400"
              }`}
            >
              {correct ? "✓ Acertou" : "✗ Errou"}
            </span>
          )}
        </div>

        <p className="text-sm leading-relaxed line-clamp-3 mb-4">
          {question.content}
        </p>

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
            {question.answer_count}{" "}
            {question.answer_count === 1 ? "resposta" : "respostas"}
          </span>
        </div>
      </div>
    </Link>
  );
}
