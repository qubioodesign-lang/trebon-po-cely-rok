/**
 * Stisk existujícího tlačítka Sdílet.
 * Záznam se spustí a na jeho výsledek se nečeká.
 * Vypnutý příjem záznam vůbec nezavolá.
 */
export async function obslouzitStiskSdileni(volby: {
  prijima: boolean;
  sdilet: () => Promise<unknown>;
  zaznamenat?: () => unknown;
}): Promise<void> {
  if (volby.prijima && volby.zaznamenat) {
    try {
      void Promise.resolve(volby.zaznamenat()).catch(() => undefined);
    } catch {
      // Chyba analytiky nesmí změnit sdílení.
    }
  }

  try {
    await volby.sdilet();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
  }
}
