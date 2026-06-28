import { PROLNUTI_CEKANI_MS } from "@/lib/prolnuti-konstanty";

declare global {
  interface Window {
    /** Nastaví inline script při parsování HTML – start 2s čekání od otevření stránky */
    __TREBON_PROLNUTI_T0?: number;
  }
}

export function ziskatCasOtevreniProlnuti(): number {
  if (typeof window === "undefined") return 0;
  return window.__TREBON_PROLNUTI_T0 ?? performance.now();
}

/** Kolik ms zbývá do konce klidové fáze (0 = čekání už uplynulo) */
export function ziskatZbyvajiciCekaniProlnuti(): number {
  if (typeof window === "undefined") return PROLNUTI_CEKANI_MS;
  const t0 = ziskatCasOtevreniProlnuti();
  return Math.max(0, PROLNUTI_CEKANI_MS - (performance.now() - t0));
}

export function cekaniProlnutiUplynulo(): boolean {
  return ziskatZbyvajiciCekaniProlnuti() === 0;
}
