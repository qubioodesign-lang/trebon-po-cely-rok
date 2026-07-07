"use client";

import { useCallback, useEffect } from "react";
import type { PayloadMetriky, TypUdalostiMetriky, ZdrojNavstevnika, TypZarizeni } from "@/types";
import { ziskatNavstevnikId } from "@/lib/uloziste";
import { pripravitOdchodNavstevy } from "@/lib/chovani-navstevnika";
import { jeVyloucenoZeStatistik } from "@/lib/metriky-vylouceni";

const MAX_FRONTA = 10;
const DEBOUNCE_MS = 30_000;

const fronta: PayloadMetriky[] = [];
let casovacFlush: ReturnType<typeof setTimeout> | null = null;
let poslouchaceRegistrovany = false;

function zaraditOdchodNavstevy(): void {
  const data = pripravitOdchodNavstevy();
  if (!data) {
    return;
  }

  fronta.push({
    typ: "odchod_navstevy",
    navstevnikId: ziskatNavstevnikId(),
    delkaMs: data.delkaMs,
    odchod: data.odchod,
  });
}

function naplanovatFlush(): void {
  if (casovacFlush !== null) {
    clearTimeout(casovacFlush);
  }

  casovacFlush = setTimeout(() => {
    casovacFlush = null;
    void odeslatFrontu();
  }, DEBOUNCE_MS);
}

async function odeslatFrontu(priOdchodu = false): Promise<void> {
  if (casovacFlush !== null) {
    clearTimeout(casovacFlush);
    casovacFlush = null;
  }

  if (fronta.length === 0) {
    return;
  }

  const udalosti = fronta.splice(0, fronta.length);
  const telo = JSON.stringify({ udalosti });

  if (priOdchodu && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/metriky",
      new Blob([telo], { type: "application/json" })
    );
    return;
  }

  try {
    await fetch("/api/metriky", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: telo,
      keepalive: priOdchodu,
    });
  } catch {
    // Metriky nesmí narušit uživatelský zážitek
  }
}

function registrovatPoslouchace(): void {
  if (poslouchaceRegistrovany || typeof document === "undefined") {
    return;
  }

  poslouchaceRegistrovany = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      zaraditOdchodNavstevy();
      void odeslatFrontu(true);
    }
  });

  window.addEventListener("pagehide", () => {
    zaraditOdchodNavstevy();
    void odeslatFrontu(true);
  });
}

/**
 * Hook pro odesílání metrik na server.
 * Události se dávkovají – jeden Blob zápis na dávku místo na každý klik.
 */
export function useMetriky() {
  useEffect(() => {
    registrovatPoslouchace();
  }, []);

  const odeslat = useCallback(
    (
      typ: TypUdalostiMetriky,
      polozkaId?: string,
      zdroj?: ZdrojNavstevnika,
      zarizeni?: TypZarizeni
    ) => {
      if (jeVyloucenoZeStatistik()) {
        return;
      }

      fronta.push({
        typ,
        polozkaId,
        navstevnikId: ziskatNavstevnikId(),
        zdroj,
        zarizeni,
      });

      if (fronta.length >= MAX_FRONTA) {
        void odeslatFrontu();
        return;
      }

      naplanovatFlush();
    },
    []
  );

  return { odeslat };
}
