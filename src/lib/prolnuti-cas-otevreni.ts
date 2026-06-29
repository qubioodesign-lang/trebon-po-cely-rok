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
export function ziskatZbyvajiciCekaniProlnuti(cekaniMs: number): number {
  if (typeof window === "undefined") return cekaniMs;
  const t0 = ziskatCasOtevreniProlnuti();
  return Math.max(0, cekaniMs - (performance.now() - t0));
}

export function cekaniProlnutiUplynulo(cekaniMs: number): boolean {
  return ziskatZbyvajiciCekaniProlnuti(cekaniMs) === 0;
}
