/** Prodleva před zobrazením výzvy „Přidat BRÁNU na plochu“ (testovací hodnota). */
export const BRANA_VYZVA_PLOCHA_PRODLEVA_MS = 10_000;

type StavVyzvyPlochy = {
  casNacteni: number | null;
  zavreno: boolean;
  zobrazena: boolean;
};

const stav: StavVyzvyPlochy = {
  casNacteni: null,
  zavreno: false,
  zobrazena: false,
};

export function jeVyzvaPlochyZavrena(): boolean {
  return stav.zavreno;
}

export function bylaVyzvaPlochyZobrazena(): boolean {
  return stav.zobrazena;
}

export function oznacVyzvuPlochyZobrazenou(): void {
  stav.zobrazena = true;
}

export function zavritVyzvuPlochy(): void {
  stav.zavreno = true;
}

/** Hlavní akce výzvy – připraveno pro budoucí napojení instalace na plochu. */
export function hlavniAkceVyzvyPlochy(): void {
  // Zatím bez akce.
}

/** Zbyvající prodleva od prvního otevření BRÁNY v tomto načtení stránky. */
export function zbyvajiciProdlevaVyzvyPlochy(): number {
  if (stav.casNacteni === null) {
    stav.casNacteni = Date.now();
  }

  return Math.max(
    BRANA_VYZVA_PLOCHA_PRODLEVA_MS - (Date.now() - stav.casNacteni),
    0,
  );
}
