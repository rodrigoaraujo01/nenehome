import { useCallback, useEffect, useState } from "react";
import {
  pushSupported,
  permissionBlocked,
  currentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

export function usePushSubscription(userId: string | undefined) {
  const [supported] = useState(pushSupported);
  const [blocked, setBlocked] = useState(permissionBlocked);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) {
      setLoading(false);
      return;
    }
    currentSubscription()
      .then((s) => setEnabled(!!s))
      .finally(() => setLoading(false));
  }, [supported]);

  const enable = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      await subscribeToPush(userId);
      setEnabled(true);
      setBlocked(permissionBlocked());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao ativar notificações");
      setBlocked(permissionBlocked());
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await unsubscribeFromPush();
      setEnabled(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao desativar notificações");
    } finally {
      setBusy(false);
    }
  }, []);

  return { supported, blocked, enabled, loading, busy, error, enable, disable };
}
