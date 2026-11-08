/** Vlastní vyloučení analytiky BRÁNY. Není to klíč galerie. */
export const KLIC_BRANA_VYLOUCIT_ANALYTIKU = "brana_vyloucit_analytiku";

const DOMENA_COOKIE = "trebonpocelyrok.cz";
/** Horní hranice, kterou prohlížeč u cookie ještě přijme. */
const PLATNOST_COOKIE_SEKUND = 60 * 60 * 24 * 400;

export type BranaVylouceniUloziste = {
  getItem(klic: string): string | null;
  setItem(klic: string, hodnota: string): void;
  removeItem(klic: string): void;
};

export type BranaCookieProstredi = {
  cist(): string;
  zapsat(hodnota: string): void;
  hostname(): string;
  jeHttps(): boolean;
};

export type VysledekNastaveniBranaVylouceni =
  | { ok: true; vylouceno: boolean }
  | { ok: false };

export function jeHostProDomenovouCookie(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "").split(":")[0] ?? "";
  return host === DOMENA_COOKIE || host.endsWith(`.${DOMENA_COOKIE}`);
}

/** Řádek cookie jen pro obě adresy BRÁNY. Mimo ně se cookie nezapisuje. */
export function sestavitBranaCookieVylouceni(
  vyloucit: boolean,
  hostname: string,
  jeHttps: boolean,
): string | null {
  if (!jeHostProDomenovouCookie(hostname)) {
    return null;
  }

  const secure = jeHttps ? "; Secure" : "";
  if (vyloucit) {
    return `${KLIC_BRANA_VYLOUCIT_ANALYTIKU}=1; Domain=.${DOMENA_COOKIE}; Path=/; Max-Age=${PLATNOST_COOKIE_SEKUND}; SameSite=Lax${secure}`;
  }

  return `${KLIC_BRANA_VYLOUCIT_ANALYTIKU}=; Domain=.${DOMENA_COOKIE}; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function jeBranaAnalytikaVyloucena(
  uloziste: BranaVylouceniUloziste | null = mistniUloziste(),
  cookie: BranaCookieProstredi | null = cookieProstredi(),
): boolean {
  if (maCookieVylouceni(cookie)) {
    return true;
  }

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
 * Zapíše nebo smaže vyloučení. Při chybě místní značky vrátí neúspěch,
 * aby rozhraní nesmělo tvrdit, že se nastavení povedlo.
 * Cookie je navíc. Když nejde zapsat, zůstane místní značka.
 */
export function nastavitBranaVylouceniAnalytiky(
  vyloucit: boolean,
  uloziste: BranaVylouceniUloziste | null = mistniUloziste(),
  cookie: BranaCookieProstredi | null = cookieProstredi(),
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
    const mistne = uloziste.getItem(KLIC_BRANA_VYLOUCIT_ANALYTIKU) === "1";
    if (mistne !== vyloucit) {
      return { ok: false };
    }

    zapsatCookie(vyloucit, cookie);
    const vylouceno = jeBranaAnalytikaVyloucena(uloziste, cookie);
    if (!vyloucit && vylouceno) {
      return { ok: false };
    }
    return { ok: true, vylouceno };
  } catch {
    return { ok: false };
  }
}

/**
 * Když je místní vyloučení už zapnuté, doplní doménovou cookie.
 * Vypnuté vyloučení nemění.
 */
export function doplnitDomenovouCookieVylouceni(
  uloziste: BranaVylouceniUloziste | null = mistniUloziste(),
  cookie: BranaCookieProstredi | null = cookieProstredi(),
): void {
  if (!uloziste || maCookieVylouceni(cookie)) {
    return;
  }

  try {
    if (uloziste.getItem(KLIC_BRANA_VYLOUCIT_ANALYTIKU) !== "1") {
      return;
    }
  } catch {
    return;
  }

  zapsatCookie(true, cookie);
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

function maCookieVylouceni(cookie: BranaCookieProstredi | null): boolean {
  if (!cookie) {
    return false;
  }

  try {
    return cookie
      .cist()
      .split(";")
      .some((cast) => {
        const [jmeno, ...zbytek] = cast.trim().split("=");
        return jmeno === KLIC_BRANA_VYLOUCIT_ANALYTIKU && zbytek.join("=") === "1";
      });
  } catch {
    return false;
  }
}

function zapsatCookie(vyloucit: boolean, cookie: BranaCookieProstredi | null): void {
  if (!cookie) {
    return;
  }

  const retezec = sestavitBranaCookieVylouceni(
    vyloucit,
    cookie.hostname(),
    cookie.jeHttps(),
  );
  if (!retezec) {
    return;
  }

  try {
    cookie.zapsat(retezec);
  } catch {
    // Místní značka zůstává platná i bez cookie.
  }
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

function cookieProstredi(): BranaCookieProstredi | null {
  try {
    if (typeof document === "undefined" || typeof location === "undefined") {
      return null;
    }

    return {
      cist: () => document.cookie,
      zapsat: (hodnota) => {
        document.cookie = hodnota;
      },
      hostname: () => location.hostname,
      jeHttps: () => location.protocol === "https:",
    };
  } catch {
    return null;
  }
}
