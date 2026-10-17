/** Vlastní místní vyloučení analytiky BRÁNY. Není to klíč galerie. */
export const KLIC_BRANA_VYLOUCIT_ANALYTIKU = "brana_vyloucit_analytiku";

export type BranaVylouceniUloziste = {
  getItem(klic: string): string | null;
  setItem(klic: string, hodnota: string): void;
  removeItem(klic: string): void;
};

export type VysledekNastaveniBranaVylouceni =
  | { ok: true; vylouceno: boolean }
  | { ok: false };

export function jeBranaAnalytikaVyloucena(
  uloziste: BranaVylouceniUloziste | null = mistniUloziste(),
): boolean {
  if (!uloziste) {
    return false;
  }

  try {
    return uloziste.getItem(KLIC_BRANA_VYLOUCIT_ANALYTIKU) === "1";
  } catch {
    return false;
  }
}

/**
 * Zapíše nebo smaže vyloučení. Při chybě vrátí neúspěch,
 * aby rozhraní nesmělo tvrdit, že se nastavení povedlo.
 */
export function nastavitBranaVylouceniAnalytiky(
  vyloucit: boolean,
  uloziste: BranaVylouceniUloziste | null = mistniUloziste(),
): VysledekNastaveniBranaVylouceni {
  if (!uloziste) {
    return { ok: false };
  }

  try {
    if (vyloucit) {
      uloziste.setItem(KLIC_BRANA_VYLOUCIT_ANALYTIKU, "1");
    } else {
      uloziste.removeItem(KLIC_BRANA_VYLOUCIT_ANALYTIKU);
    }
    const vylouceno = uloziste.getItem(KLIC_BRANA_VYLOUCIT_ANALYTIKU) === "1";
    if (vylouceno !== vyloucit) {
      return { ok: false };
    }
    return { ok: true, vylouceno };
  } catch {
    return { ok: false };
  }
}

/** Po neúspěšném uložení zůstane zobrazený původní stav. */
export function zobrazitVylouceniPoUlozeni(
  stavPred: boolean,
  vysledek: VysledekNastaveniBranaVylouceni,
): boolean {
  if (!vysledek.ok) {
    return stavPred;
  }
  return vysledek.vylouceno;
}

function mistniUloziste(): BranaVylouceniUloziste | null {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}
