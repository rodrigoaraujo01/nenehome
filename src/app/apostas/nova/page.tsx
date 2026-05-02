"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { createBet } from "@/lib/supabase/queries";

type BetType = "pool" | "closest_guess";
type GuessKind = "date" | "number";

interface PoolOption { label: string }

export default function NovApostaPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [type, setType] = useState<BetType>("pool");
  const [guessKind, setGuessKind] = useState<GuessKind>("date");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [deadline, setDeadline] = useState("");
  const [options, setOptions] = useState<PoolOption[]>([{ label: "" }, { label: "" }]);
  const [creatorCanBet, setCreatorCanBet] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  function addOption() {
    if (options.length < 8) setOptions((prev) => [...prev, { label: "" }]);
  }
  function removeOption(i: number) {
    if (options.length > 2) setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateOption(i: number, label: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { label } : o)));
  }

  function validate(): string | null {
    if (!title.trim()) return "Dê um nome para o bolão.";
    if (!deadline) return "Defina um prazo.";
    if (new Date(deadline) <= new Date()) return "O prazo precisa ser no futuro.";
    if (type === "pool") {
      if (options.some((o) => !o.label.trim())) return "Preencha todas as opções.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSubmitting(true);

    const result = await createBet({
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      guess_kind: type === "closest_guess" ? guessKind : undefined,
      unit: type === "closest_guess" && unit.trim() ? unit.trim() : undefined,
      deadline: new Date(deadline).toISOString(),
      options: type === "pool" ? options.filter((o) => o.label.trim()) : undefined,
      creator_can_bet: creatorCanBet,
    });

    setSubmitting(false);
    if (!result) {
      setError("Erro ao criar bolão. Tente novamente.");
      return;
    }
    router.push(`/apostas/${result.id}`);
  }

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/apostas" className="flex items-center gap-3 text-muted hover:text-foreground transition-colors">
              <span>‹</span>
              <h2 className="text-xl font-bold text-foreground">Novo bolão</h2>
            </Link>
          </div>

          {/* type toggle */}
          <div className="flex bg-surface border border-border rounded-xl p-1 mb-4">
            {(["pool", "closest_guess"] as BetType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  type === t ? "bg-accent text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {t === "pool" ? "Múltipla escolha" : "Palpite"}
              </button>
            ))}
          </div>

          {/* closest_guess sub-toggle */}
          {type === "closest_guess" && (
            <div className="flex bg-surface border border-border rounded-xl p-1 mb-4">
              {(["date", "number"] as GuessKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setGuessKind(k)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    guessKind === k ? "bg-accent text-white" : "text-muted hover:text-foreground"
                  }`}
                >
                  {k === "date" ? "📅 Data" : "🔢 Número"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-muted block mb-1.5">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "pool"
                    ? "Quem vai comer mais no churrasco?"
                    : guessKind === "date"
                    ? "Quando o Antônio vai nascer?"
                    : "Quanto custou o aniversário?"
                }
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-muted block mb-1.5">
                Descrição <span className="font-normal">(opcional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Contexto extra..."
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors resize-none"
              />
            </div>

            {type === "closest_guess" && guessKind === "number" && (
              <div>
                <label className="text-sm font-semibold text-muted block mb-1.5">
                  Unidade <span className="font-normal">(opcional, ex: R$, km, princesas)</span>
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="princesas"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-muted block mb-1.5">Prazo para palpites</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                role="switch"
                aria-checked={creatorCanBet}
                onClick={() => setCreatorCanBet((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${creatorCanBet ? "bg-accent" : "bg-border"}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${creatorCanBet ? "translate-x-5" : ""}`} />
              </div>
              <span className="text-sm font-semibold text-muted">Criador pode participar</span>
            </label>

            {type === "pool" && (
              <div>
                <label className="text-sm font-semibold text-muted block mb-3">Opções</label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-surface-light border border-border flex items-center justify-center text-xs font-bold text-muted shrink-0">
                        {i + 1}
                      </div>
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={`Opção ${i + 1}`}
                        className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(i)}
                          className="text-muted hover:text-red-400 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 8 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="mt-3 text-sm text-accent hover:opacity-80 transition-opacity"
                  >
                    + Adicionar opção
                  </button>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Criando..." : "Criar bolão"}
            </Button>
          </form>
        </div>
      </main>
    </>
  );
}
