"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { createPhotoChallenge } from "@/lib/supabase/queries";

export default function NovoDesafioPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsReward, setPointsReward] = useState("30");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  function validate(): string | null {
    if (!title.trim()) return "Dê um nome para o desafio.";
    if (!deadline) return "Defina um prazo.";
    if (new Date(deadline) <= new Date()) return "O prazo precisa ser no futuro.";
    const pts = parseInt(pointsReward);
    if (isNaN(pts) || pts < 5 || pts > 200) return "Pontos devem ser entre 5 e 200.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    if (!profile) return;
    setError(null);
    setSubmitting(true);

    const result = await createPhotoChallenge({
      title: title.trim(),
      description: description.trim() || undefined,
      pointsReward: parseInt(pointsReward),
      deadline: new Date(deadline).toISOString(),
      creatorId: profile.id,
    });

    setSubmitting(false);
    if (!result) {
      setError("Erro ao criar desafio. Tente novamente.");
      return;
    }
    router.push(`/fotos/desafios/${result.id}`);
  }

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/fotos/desafios" className="flex items-center gap-3 text-muted hover:text-foreground transition-colors">
              <span>‹</span>
              <h2 className="text-xl font-bold text-foreground">Novo desafio</h2>
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-muted block mb-1.5">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Foto com todas as meninas do grupo"
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
                placeholder="Detalhe o que precisa aparecer na foto..."
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-muted block mb-1.5">
                Pontos por completar
              </label>
              <input
                type="number"
                value={pointsReward}
                onChange={(e) => setPointsReward(e.target.value)}
                min={5}
                max={200}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-accent transition-colors"
              />
              <p className="text-xs text-muted mt-1">
                Além dos +20 pts da foto aprovada
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-muted block mb-1.5">Prazo</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Criando..." : "Criar desafio"}
            </Button>
          </form>
        </div>
      </main>
    </>
  );
}
