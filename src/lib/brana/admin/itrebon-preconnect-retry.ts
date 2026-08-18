/**
 * Jeden retry GET na www.itrebon.cz, jen při 15s abortu před TCP/TLS connect.
 * JKT i GBU sdílejí tutéž fetch cestu. Ostatní hosty se nerretryují.
 */

export const BRANA_SCAN_TIMEOUT_HLASKA = "Načtení zdroje vypršelo.";

export const ITREBON_PRECONNECT_RETRY_HOST = "www.itrebon.cz";

export type ItrebonSitFaze = {
  probehlConnect: boolean;
  probehlSecureConnect: boolean;
};

export function novaItrebonSitFaze(): ItrebonSitFaze {
  return { probehlConnect: false, probehlSecureConnect: false };
}

export function jeItrebonPreConnectRetryHost(hostname: string): boolean {
  return (
    hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase() ===
    ITREBON_PRECONNECT_RETRY_HOST
  );
}

export function jeBranaScanTimeoutHlaska(error: unknown): boolean {
  return error instanceof Error && error.message === BRANA_SCAN_TIMEOUT_HLASKA;
}

/** cisloPokusu: 1 = první GET této URL. */
export function smiItrebonPreConnectRetry(args: {
  hostname: string;
  cisloPokusu: number;
  vyprselTimeout: boolean;
  probehlConnect: boolean;
  probehlSecureConnect: boolean;
}): boolean {
  if (args.cisloPokusu !== 1) {
    return false;
  }
  if (!jeItrebonPreConnectRetryHost(args.hostname)) {
    return false;
  }
  if (!args.vyprselTimeout) {
    return false;
  }
  if (args.probehlConnect || args.probehlSecureConnect) {
    return false;
  }
  return true;
}

export async function provestSItrebonPreConnectRetry<T>(
  hostname: string,
  pokus: (sitFaze: ItrebonSitFaze, cisloPokusu: 1 | 2) => Promise<T>,
): Promise<T> {
  const faze1 = novaItrebonSitFaze();
  try {
    return await pokus(faze1, 1);
  } catch (error) {
    if (
      !smiItrebonPreConnectRetry({
        hostname,
        cisloPokusu: 1,
        vyprselTimeout: jeBranaScanTimeoutHlaska(error),
        probehlConnect: faze1.probehlConnect,
        probehlSecureConnect: faze1.probehlSecureConnect,
      })
    ) {
      throw error;
    }
    console.error("[BRANA_SCAN_NET_PHASE]", {
      phase: "itrebon-preconnect-retry",
      protocol: "https:",
      elapsedMs: 0,
      pokus: 2,
    });
    const faze2 = novaItrebonSitFaze();
    return await pokus(faze2, 2);
  }
}
