/** Minimální zdvořilostní odstup před zobrazením výzvy. */
export const BRANA_VYZVA_ZDVORILOST_MS = 8_000;

/** @deprecated Použij BRANA_VYZVA_ZDVORILOST_MS. */
export const BRANA_VYZVA_PLOCHA_PRODLEVA_MS = BRANA_VYZVA_ZDVORILOST_MS;

type StavVyzvyPlochy = {
  casNacteni: number | null;
  zavreno: boolean;
  zobrazena: boolean;
  zajemPohled: boolean;
  posledniPohled: string | null;
};

const stav: StavVyzvyPlochy = {
  casNacteni: null,
  zavreno: false,
  zobrazena: false,
  zajemPohled: false,
  posledniPohled: null,
};

function zajistitCasNacteni(): number {
  if (stav.casNacteni === null) {
    stav.casNacteni = Date.now();
  }

  return stav.casNacteni;
}

export function jeVyzvaPlochyZavrena(): boolean {
  return stav.zavreno;
}

export function bylaVyzvaPlochyZobrazena(): boolean {
  return stav.zobrazena;
}

export function oznacVyzvuPlochyZobrazenou(): void {
  stav.zobrazena = true;
}

/** Zavření = „teď ne“ – jen aktuální návštěva (module state), bez trvalého úložiště. */
export function zavritVyzvuPlochy(): void {
  stav.zavreno = true;
}

export function maZajemVyzvyPlochy(): boolean {
  return stav.zajemPohled;
}

export function uplynulaZdvorilostVyzvyPlochy(): boolean {
  return Date.now() - zajistitCasNacteni() >= BRANA_VYZVA_ZDVORILOST_MS;
}

/** Zda produktová politika dovoluje zobrazení (po zdvořilosti + přepnutí pohledu). */
export function smiSeZobrazitVyzvaPlochy(): boolean {
  return uplynulaZdvorilostVyzvyPlochy() && maZajemVyzvyPlochy();
}

/**
 * Sleduje veřejný pohled BRÁNY. První pozorování není změna;
 * skutečná změna mezi pohledy nastaví zájem.
 */
export function sledovatPohledVyzvyPlochy(pohledId: string | null): boolean {
  if (!pohledId) {
    return stav.zajemPohled;
  }

  if (stav.posledniPohled === null) {
    stav.posledniPohled = pohledId;
    return stav.zajemPohled;
  }

  if (stav.posledniPohled !== pohledId) {
    stav.posledniPohled = pohledId;
    stav.zajemPohled = true;
  }

  return stav.zajemPohled;
}

/** Zbývající čas do zdvořilostního odstupu (8 s). */
export function zbyvajiciZdvorilostVyzvyPlochy(): number {
  return Math.max(
    BRANA_VYZVA_ZDVORILOST_MS - (Date.now() - zajistitCasNacteni()),
    0,
  );
}

/** @deprecated Použij zbyvajiciZdvorilostVyzvyPlochy. */
export function zbyvajiciProdlevaVyzvyPlochy(): number {
  return zbyvajiciZdvorilostVyzvyPlochy();
}

/** Veřejný pohled z pathname (subdoména i /brana). */
export function pohledVyzvyZPathname(pathname: string): string | null {
  const segmenty = pathname.split("/").filter(Boolean);
  const posledni = segmenty[segmenty.length - 1];

  if (!posledni || posledni === "brana") {
    return "dnes";
  }

  if (
    posledni === "zitra" ||
    posledni === "vikend" ||
    posledni === "7-dni" ||
    posledni === "vyhled"
  ) {
    return posledni;
  }

  return null;
}
