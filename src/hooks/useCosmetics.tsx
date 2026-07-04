import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getEquippedCosmetics } from "@/lib/supabase/queries";
import type { CosmeticPayload, CosmeticSlot } from "@/lib/types";

type SlotMap = Record<string, Partial<Record<CosmeticSlot, CosmeticPayload>>>;

interface CosmeticsContextValue {
  /** Lookup por nickname (case-insensitive), a chave ubíqua no app. */
  frameFor: (nickname: string | null | undefined) => CosmeticPayload | null;
  nameStyleFor: (nickname: string | null | undefined) => CosmeticPayload | null;
  refresh: () => Promise<void>;
}

const CosmeticsContext = createContext<CosmeticsContextValue | null>(null);

export function CosmeticsProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<SlotMap>({});

  const refresh = useCallback(async () => {
    const rows = await getEquippedCosmetics();
    const next: SlotMap = {};
    for (const r of rows) {
      const key = r.nickname.toLowerCase();
      (next[key] ??= {})[r.slot] = r.payload;
    }
    setMap(next);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<CosmeticsContextValue>(
    () => ({
      frameFor: (n) => (n ? map[n.toLowerCase()]?.avatar_frame ?? null : null),
      nameStyleFor: (n) => (n ? map[n.toLowerCase()]?.name_style ?? null : null),
      refresh,
    }),
    [map, refresh],
  );

  return (
    <CosmeticsContext.Provider value={value}>
      {children}
    </CosmeticsContext.Provider>
  );
}

export function useCosmetics(): CosmeticsContextValue {
  const ctx = useContext(CosmeticsContext);
  if (!ctx) {
    // Safe fallback if a component renders outside the provider.
    return {
      frameFor: () => null,
      nameStyleFor: () => null,
      refresh: async () => {},
    };
  }
  return ctx;
}

/** Estilo inline pra aplicar a cor/gradiente de nome num <span>/texto. */
export function nameStyleCss(p: CosmeticPayload | null): React.CSSProperties {
  if (!p) return {};
  if (p.gradient && p.gradient.length > 0) {
    return {
      backgroundImage: `linear-gradient(90deg, ${p.gradient.join(", ")})`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    };
  }
  if (p.color) return { color: p.color };
  return {};
}
