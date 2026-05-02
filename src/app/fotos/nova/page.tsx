"use client";

import { Suspense, useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { createPhotoSubmission, getChallenge } from "@/lib/supabase/queries";
import type { DbPhotoChallenge } from "@/lib/types";

function NovaFotoContent() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("challenge_id");
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<DbPhotoChallenge | null>(null);

  useEffect(() => {
    if (!loading && !challengeId) router.push("/fotos");
  }, [loading, challengeId, router]);

  useEffect(() => {
    if (!challengeId || !profile) return;
    getChallenge(challengeId, profile.id).then(setChallenge);
  }, [challengeId, profile]);

  if (loading || !challengeId) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setError("Selecione uma imagem.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("A imagem deve ter menos de 10MB.");
      return;
    }
    setError(null);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !profile) return;
    setUploading(true);
    setError(null);

    const id = await createPhotoSubmission({
      file,
      caption,
      userId: profile.id,
      challengeId: challengeId!,
    });

    if (!id) {
      setError("Erro ao enviar foto. Tente novamente.");
      setUploading(false);
      return;
    }

    router.push(challengeId ? `/fotos/desafios/${challengeId}` : `/fotos/${id}`);
  }

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Link href={challengeId ? `/fotos/desafios/${challengeId}` : "/fotos"} className="flex items-center gap-3 text-muted hover:text-foreground transition-colors">
              <span>‹</span>
              <h2 className="text-xl font-bold text-foreground">Enviar foto</h2>
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {challenge && (
              <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4">
                <p className="text-xs font-bold text-accent uppercase tracking-wider mb-1">
                  Desafio
                </p>
                <p className="font-semibold text-sm">{challenge.title}</p>
                {challenge.description && (
                  <p className="text-xs text-muted mt-1">{challenge.description}</p>
                )}
                <p className="text-xs text-muted mt-2">
                  +{challenge.points_reward} pts extras se aprovada
                </p>
              </div>
            )}

            {/* photo picker */}
            <div>
              {preview ? (
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-surface-light">
                  <Image
                    src={preview}
                    alt="Preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-3 right-3 bg-background/80 text-foreground text-xs font-bold px-3 py-1.5 rounded-full hover:bg-background transition-colors"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 hover:border-accent/60 transition-colors"
                >
                  <span className="text-4xl">📷</span>
                  <span className="text-sm text-muted">
                    Toque para escolher uma foto
                  </span>
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* caption */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1.5">
                Legenda <span className="font-normal">(opcional)</span>
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                placeholder="Conta o que rolou nesse momento..."
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors resize-none text-sm"
              />
            </div>

            <p className="text-xs text-muted">
              O grupo vai votar para aprovar. Você ganha{" "}
              <span className="text-accent font-semibold">+20 pts</span>
              {challenge && (
                <>
                  {" "}+ <span className="text-accent font-semibold">+{challenge.points_reward} pts</span> do desafio
                </>
              )}{" "}
              se aprovada.
            </p>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={!file || uploading}
            >
              {uploading ? "Enviando..." : "Enviar para votação"}
            </Button>
          </form>
        </div>
      </main>
    </>
  );
}

export default function NovaFotoPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted">Carregando...</p>
        </main>
      }
    >
      <NovaFotoContent />
    </Suspense>
  );
}
