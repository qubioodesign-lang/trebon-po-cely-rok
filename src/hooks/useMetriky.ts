"use client";

import { useCallback } from "react";
import type { TypUdalostiMetriky } from "@/types";
import { ziskatNavstevnikId } from "@/lib/uloziste";

/**
 * Hook pro odesílání metrik na server.
 * Sleduje návštěvy, posuny, návraty a další klíčové ukazatele.
 */
export function useMetriky() {
  const odeslat = useCallback(
    async (typ: TypUdalostiMetriky, polozkaId?: string) => {
      try {
        await fetch("/api/metriky", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            typ,
            polozkaId,
            navstevnikId: ziskatNavstevnikId(),
          }),
        });
      } catch {
        // Metriky nesmí narušit uživatelský zážitek
      }
    },
    []
  );

  return { odeslat };
}
