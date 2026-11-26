/** Doplnění AbortSignal jen když volající o přerušení stojí. Bez signálu se objekt nemění. */

export function volbyGetSSignalem<T extends object>(
  volby: T,
  signal?: AbortSignal,
): T & { abortSignal?: AbortSignal } {
  if (!signal) return volby;
  return { ...volby, abortSignal: signal };
}

export function volbyFetchSSignalem(
  zaklad: RequestInit,
  signal?: AbortSignal,
): RequestInit {
  if (!signal) return zaklad;
  return { ...zaklad, signal };
}

export function jePreruseni(error: unknown, signal?: AbortSignal): boolean {
  if (!signal) return false;
  if (signal.aborted) return true;
  return error instanceof Error && error.name === "AbortError";
}

export function vyzadovatPokracovani(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Čtení přerušeno", "AbortError");
  }
}

/**
 * Strop čekání. Signál se přeruší v limitu a návrat přijde i tehdy,
 * když volaná operace signál ignoruje.
 */
export async function sPevnymStropem<T>(
  limitMs: number,
  prace: (signal: AbortSignal) => Promise<T>,
): Promise<T | null> {
  const controller = new AbortController();
  let casovac: ReturnType<typeof setTimeout> | undefined;
  const strop = new Promise<null>((resolve) => {
    casovac = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, limitMs);
  });

  try {
    return await Promise.race([
      prace(controller.signal).catch(() => null),
      strop,
    ]);
  } finally {
    if (casovac !== undefined) clearTimeout(casovac);
  }
}
