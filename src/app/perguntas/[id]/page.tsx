"use client";

// No paths are pre-rendered; the 404.html SPA trick handles direct navigation.
export function generateStaticParams() { return []; }

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { getQuestion, submitAnswer } from "@/lib/supabase/queries";
import { ADULTS } from "@/lib/constants";
import type { DbQuestion, AnswerResult } from "@/lib/types";

const OPTION_LABELS = ["A", "B", "C", "D"];

export default function PerguntaPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [question, setQuestion] = useState<DbQuestion | null>(null);
  const [fetching, setFetching] = useState(true);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push("/login");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile || !id) return;
    getQuestion(id, profile.id).then((q) => {
      setQuestion(q);
      setFetching(false);
    });
  }, [profile, id]);

  // pre-populate if already answered
  useEffect(() => {
    if (question?.my_answer) {
      setSelectedOptionId(question.my_answer.selected_option_id);
      setSelectedSubjectId(question.my_answer.subject_guess_id);
    }
  }, [question]);

  if (loading || fetching || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  if (!question) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted">Pergunta não encontrada.</p>
        </main>
      </>
    );
  }

  const alreadyAnswered = !!question.my_answer;
  const isCorrect = question.my_answer?.is_correct ?? result?.is_correct;

  async function handleSubmit() {
    if (!question) return;
    setSubmitting(true);
    const res = await submitAnswer({
      question_id: question.id,
      selected_option_id: selectedOptionId ?? undefined,
      subject_guess_id: selectedSubjectId ?? undefined,
    });
    setSubmitting(false);
    if (res) {
      setResult(res);
      // refresh question to get my_answer
      if (profile) {
        const updated = await getQuestion(question.id, profile.id);
        if (updated) setQuestion(updated);
      }
    }
  }

  const canSubmit =
    !alreadyAnswered &&
    !result &&
    (question.type === "multiple_choice"
      ? !!selectedOptionId
      : !!selectedSubjectId);

  // for story: which member matches the subject_id
  const correctSubject =
    question.type === "story" && question.subject_id
      ? ADULTS.find((m) => m.id === question.subject_id)
      : null;

  const showReveal = alreadyAnswered || !!result;

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href="/perguntas"
              className="text-muted hover:text-foreground transition-colors"
            >
              ←
            </Link>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {question.type === "story" ? "História" : "Múltipla escolha"}
            </span>
          </div>

          {/* creator */}
          {question.creator && (
            <div className="flex items-center gap-2">
              <Avatar
                spriteUrl={question.creator.avatar_url}
                nickname={question.creator.nickname}
                size={28}
              />
              <span className="text-sm text-muted">
                {question.creator.nickname} ·{" "}
                {question.answer_count}{" "}
                {question.answer_count === 1 ? "resposta" : "respostas"}
              </span>
            </div>
          )}

          {/* question content */}
          <p className="text-lg leading-relaxed">{question.content}</p>

          {/* result banner */}
          {showReveal && (
            <div
              className={`rounded-2xl px-5 py-4 border ${
                isCorrect
                  ? "bg-green/10 border-green/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}
            >
              <p
                className={`font-bold text-lg ${
                  isCorrect ? "text-green" : "text-red-400"
                }`}
              >
                {isCorrect ? "✓ Acertou!" : "✗ Errou"}
              </p>
              {result && result.points_earned > 0 && (
                <p className="text-sm text-muted mt-1">
                  +{result.points_earned} pontos
                </p>
              )}
              {question.type === "story" && correctSubject && (
                <div className="flex items-center gap-2 mt-3">
                  <Avatar
                    spriteUrl={correctSubject.spriteUrl}
                    nickname={correctSubject.nickname}
                    size={32}
                  />
                  <span className="text-sm font-semibold">
                    Era {correctSubject.nickname}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* multiple choice options */}
          {question.type === "multiple_choice" && question.options && (
            <div className="space-y-2">
              {question.options.map((opt, i) => {
                const isSelected = selectedOptionId === opt.id;
                const isCorrectOpt = showReveal && opt.is_correct;
                const isWrongSelected =
                  showReveal && isSelected && !opt.is_correct;

                return (
                  <button
                    key={opt.id}
                    onClick={() =>
                      !alreadyAnswered && !result && setSelectedOptionId(opt.id)
                    }
                    disabled={alreadyAnswered || !!result}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-colors ${
                      isCorrectOpt
                        ? "border-green bg-green/10 text-green"
                        : isWrongSelected
                        ? "border-red-500 bg-red-500/10 text-red-400"
                        : isSelected
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/40"
                    } disabled:cursor-default`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 ${
                        isCorrectOpt
                          ? "border-green text-green"
                          : isWrongSelected
                          ? "border-red-500 text-red-400"
                          : isSelected
                          ? "border-accent text-accent"
                          : "border-muted/40 text-muted"
                      }`}
                    >
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="text-sm">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* story: member picker */}
          {question.type === "story" && (
            <div>
              {!showReveal && (
                <p className="text-sm text-muted mb-3">
                  Quem você acha que é?
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {ADULTS.filter((m) => m.nickname !== profile.nickname).map(
                  (m) => {
                    const isSelected = selectedSubjectId === m.id;
                    const isCorrectMember =
                      showReveal && m.id === question.subject_id;
                    const isWrongMember =
                      showReveal && isSelected && m.id !== question.subject_id;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          !alreadyAnswered &&
                          !result &&
                          setSelectedSubjectId(m.id)
                        }
                        disabled={alreadyAnswered || !!result}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors disabled:cursor-default ${
                          isCorrectMember
                            ? "border-green bg-green/10"
                            : isWrongMember
                            ? "border-red-500 bg-red-500/10"
                            : isSelected
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-accent/40"
                        }`}
                      >
                        <Avatar
                          spriteUrl={m.spriteUrl}
                          nickname={m.nickname}
                          size={44}
                        />
                        <span className="text-xs">{m.nickname}</span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* action buttons */}
          {!alreadyAnswered && !result && (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full"
            >
              {submitting ? "Enviando..." : "Confirmar resposta"}
            </Button>
          )}

          {showReveal && (
            <Link
              href="/perguntas"
              className="block text-center text-sm text-accent hover:text-accent-hover transition-colors"
            >
              ← Voltar para perguntas
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
