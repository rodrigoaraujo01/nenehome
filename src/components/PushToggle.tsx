import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/supabase/queries";

const PREF_ITEMS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: "new_question", label: "Novas perguntas" },
  { key: "new_challenge", label: "Novos desafios de foto" },
  { key: "new_photo", label: "Novas fotos para votar" },
  { key: "question_completed", label: "Resultado das perguntas (pontos liberados)" },
  { key: "photo_rejected", label: "Minha foto foi rejeitada" },
  { key: "question_comment", label: "Comentários nas perguntas que respondi" },
];

function NotificationPrefsList({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getNotificationPrefs(userId)
      .then((p) => {
        if (active) setPrefs(p);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  async function toggle(key: keyof NotificationPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    try {
      await saveNotificationPrefs(userId, next);
    } catch {
      setPrefs(prefs); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
        Avisar quando
      </p>
      <ul className="flex flex-col gap-2">
        {PREF_ITEMS.map(({ key, label }) => (
          <li
            key={key}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="min-w-0 text-foreground">{label}</span>
            <button
              role="switch"
              aria-checked={prefs[key]}
              aria-label={label}
              disabled={saving}
              onClick={() => toggle(key)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                prefs[key] ? "bg-accent" : "bg-surface-light"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
                  prefs[key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PushToggle({ userId }: { userId: string }) {
  const { supported, blocked, enabled, loading, busy, error, enable, disable } =
    usePushSubscription(userId);

  if (!supported) {
    return (
      <Card className="w-full">
        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
          Notificações
        </p>
        <p className="text-sm text-muted">
          Este dispositivo não suporta notificações push. No iPhone, adicione o
          app à tela de início para ativar.
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">
            Notificações
          </p>
          <p className="text-sm text-muted">
            Avisos de novas perguntas, desafios e fotos para votar.
          </p>
        </div>
        <button
          onClick={enabled ? disable : enable}
          disabled={busy || loading || blocked}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            enabled
              ? "bg-surface-light text-foreground hover:bg-border"
              : "bg-accent text-background hover:bg-accent-hover"
          }`}
        >
          {busy ? "..." : enabled ? "Ativado" : "Ativar"}
        </button>
      </div>
      {blocked && (
        <p className="text-xs text-red-400 mt-3">
          As notificações estão bloqueadas. Libere nas configurações do
          navegador para ativar.
        </p>
      )}
      {error && !blocked && (
        <p className="text-xs text-red-400 mt-3">{error}</p>
      )}
      {enabled && <NotificationPrefsList userId={userId} />}
    </Card>
  );
}
