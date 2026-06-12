import { Card } from "@/components/ui/Card";
import { usePushSubscription } from "@/hooks/usePushSubscription";

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
    </Card>
  );
}
