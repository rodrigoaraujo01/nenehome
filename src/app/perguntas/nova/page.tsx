"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { AchievementToast } from "@/components/AchievementToast";
import { useAuth } from "@/hooks/useAuth";
import { createQuestion } from "@/lib/supabase/queries";
import { ADULTS } from "@/lib/constants";
import type { UnlockedAchievement } from "@/lib/types";

type QuestionType = "story" | "multiple_choice";

interface Option {
  text: string;
  is_correct: boolean;
}

export default function NovaPerguntaPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [type, setType] = useState<QuestionType>("multiple_choice");
  const [content, setContent] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [options, setOptions] = useState<Option[]>([
    { text: "", is_correct: false },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newAchievements, setNewAchievements] = useState<UnlockedAchievement[]>([]);

  useEffect(() => {
    if (!loading && !profile) router.push("/login");
  }, [loading, profile, router]);

  if (loading || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  function setCorrectOption(index: number) {
    setOptions((prev) =>
      prev.map((o, i) => ({ ...o, is_correct: i === index }))
    );
  }

  function updateOptionText(index: number, text: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text } : o)));
  }

  function validate(): string | null {
    if (!content.trim()) return "Escreva a pergunta ou história.";
    if (type === "story" && !subjectId)
      return "Selecione sobre quem é a história.";
    if (type === "multiple_choice") {
      if (options.some((o) => !o.text.trim()))
        return "Preencha todas as alternativas.";
      if (!options.some((o) => o.is_correct))
        return "Marque qual alternativa é correta.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSubmitting(true);

    const result = await createQuestion({
      type,
      content: content.trim(),
      subject_id: type === "story" ? (subjectId ?? undefined) : undefined,
      options: type === "multiple_choice" ? options : undefined,
    });

    if (!result) {
      setError("Erro ao criar pergunta. Tente novamente.");
      setSubmitting(false);
      return;
    }

    if (result.achievements.length) {
      setNewAchievements(result.achievements);
      setTimeout(() => router.push("/perguntas"), 3500);
    } else {
      router.push("/perguntas");
    }
  }

  const subjectCandidates = ADULTS;

  return (
    <>
      <AchievementToast achievements={newAchievements} />
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/perguntas" className="flex items-center gap-3 text-muted hover:text-foreground transition-colors">
              <span>‹</span>
              <h2 className="text-xl font-bold text-foreground">Nova pergunta</h2>
            </Link>
          </div>

          {/* type toggle */}
          <div className="flex bg-surface border border-border rounded-xl p-1 mb-6">
            {(["multiple_choice", "story"] as QuestionType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  type === t
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t === "multiple_choice" ? "Múltipla escolha" : "História"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-muted block mb-1.5">
                {type === "story"
                  ? "Conte a história (sem revelar de quem é)"
                  : "Escreva a pergunta"}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder={
                  type === "story"
                    ? "Certa vez, essa pessoa fez uma coisa inacreditável..."
                    : "Qual é a capital da França?"
                }
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors resize-none"
              />
            </div>

            {type === "story" && (
              <div>
                <label className="text-sm font-semibold text-muted block mb-3">
                  Sobre quem é? (só você vai saber)
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {subjectCandidates.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSubjectId(m.nickname)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                        subjectId === m.nickname
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/40"
                      }`}
                    >
                      <Avatar
                        spriteUrl={m.spriteUrl}
                        nickname={m.nickname}
                        size={40}
                      />
                      <span className="text-xs">{m.nickname}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {type === "multiple_choice" && (
              <div>
                <label className="text-sm font-semibold text-muted block mb-3">
                  Alternativas{" "}
                  <span className="font-normal">(toque na correta)</span>
                </label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectOption(i)}
                        className={`w-8 h-8 rounded-full border-2 shrink-0 font-bold text-sm transition-colors ${
                          opt.is_correct
                            ? "border-green bg-green/15 text-green"
                            : "border-border text-muted hover:border-accent/40"
                        }`}
                      >
                        {String.fromCharCode(65 + i)}
                      </button>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => updateOptionText(i, e.target.value)}
                        placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                        className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Enviando..." : "Criar pergunta (+5 pts)"}
            </Button>
          </form>
        </div>
      </main>
    </>
  );
}
