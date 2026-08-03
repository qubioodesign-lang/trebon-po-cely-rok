/** Minimální zdvořilostní odstup před zobrazením výzvy. */
export const BRANA_VYZVA_ZDVORILOST_MS = 8_000;

/** Strop – výzva i při pasivním čtení bez hlubší interakce. */
export const BRANA_VYZVA_STROP_MS = 20_000;

/** @deprecated Použij BRANA_VYZVA_ZDVORILOST_MS. */
export const BRANA_VYZVA_PLOCHA_PRODLEVA_MS = BRANA_VYZVA_ZDVORILOST_MS;

type StavVyzvyPlochy = {
  casNacteni: number | null;
  zavreno: boolean;
  zobrazena: boolean;
  zajemPohled: boolean;
  zajemScroll: boolean;
  posledniPohled: string | null;
  vychoziScrollY: number | null;
};

const stav: StavVyzvyPlochy = {
  casNacteni: null,
  zavreno: false,
  zobrazena: false,
  zajemPohled: false,
  zajemScroll: false,
  posledniPohled: null,
  vychoziScrollY: null,
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
  return stav.zajemPohled || stav.zajemScroll;
}

export function uplynulaZdvorilostVyzvyPlochy(): boolean {
  return Date.now() - zajistitCasNacteni() >= BRANA_VYZVA_ZDVORILOST_MS;
}

export function uplynulStropVyzvyPlochy(): boolean {
  return Date.now() - zajistitCasNacteni() >= BRANA_VYZVA_STROP_MS;
}

/** Zda produktová politika dovoluje zobrazení (po zdvořilosti + zájem nebo strop). */
export function smiSeZobrazitVyzvaPlochy(): boolean {
  if (!uplynulaZdvorilostVyzvyPlochy()) {
    return false;
  }

  return maZajemVyzvyPlochy() || uplynulStropVyzvyPlochy();
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

/** Nový scroll kontejner po navigaci – baseline se změří znovu, zájem scrollu zůstane. */
export function resetVychoziScrollVyzvyPlochy(): void {
  stav.vychoziScrollY = null;
}

/**
 * Smysluplný scroll ≈ jedna výška okna oproti výchozí pozici kontejneru.
 */
export function zpracovatScrollVyzvyPlochy(
  scrollY: number,
  vyskaOkna: number,
): boolean {
  if (vyskaOkna <= 0) {
    return stav.zajemScroll;
  }

  if (stav.vychoziScrollY === null) {
    stav.vychoziScrollY = scrollY;
    return stav.zajemScroll;
  }

  if (Math.abs(scrollY - stav.vychoziScrollY) >= vyskaOkna) {
    stav.zajemScroll = true;
  }

  return stav.zajemScroll;
}

/** Zbývající čas do zdvořilostního odstupu (8 s). */
export function zbyvajiciZdvorilostVyzvyPlochy(): number {
  return Math.max(
    BRANA_VYZVA_ZDVORILOST_MS - (Date.now() - zajistitCasNacteni()),
    0,
  );
}

/** Zbývající čas do stropu (20 s). */
export function zbyvajiciStropVyzvyPlochy(): number {
  return Math.max(
    BRANA_VYZVA_STROP_MS - (Date.now() - zajistitCasNacteni()),
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
