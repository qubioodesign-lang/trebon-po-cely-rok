import {
  BRANA_ANALYTIKA_POHLEDY,
  type BranaAnalytikaNavstevnik,
  type BranaAnalytikaPohled,
  type BranaAnalytikaSpusteni,
  type BranaAnalytikaUdalostNavstevy,
  type BranaAnalytikaUdalostPohledu,
} from "./model";

/** Návrat do popředí po této době založí novou návštěvu. */
export const BRANA_NAVSTEVA_MIN_ODCHOD_MS = 30 * 60 * 1000;

const KLIC_NAVSTEVA = "brana_analytika_navsteva";
const KLIC_SKRYTO = "brana_analytika_skryto";
const KLIC_POHLED = "brana_analytika_pohled";

export type BranaNavstevaUloziste = {
  getItem(klic: string): string | null;
  setItem(klic: string, hodnota: string): void;
  removeItem(klic: string): void;
};

export type BranaNavstevaVstup = {
  uloziste: BranaNavstevaUloziste | null;
  ted: number;
  spusteni: BranaAnalytikaSpusteni;
  navstevnik?: BranaAnalytikaNavstevnik;
  /** Dotaz z adresy v okamžiku nové návštěvy. Bez něj se zdroj neurčuje. */
  hledani?: string;
};

export type BranaZdrojPrichodu =
  | { zdroj: "qr"; qrDesktop?: true }
  | { zdroj: "sdileni" };

/**
 * Jeden zdroj z adresy.
 * Pořadí: desktopový QR, ostatní QR, sdílený odkaz.
 * WhatsApp a neznámá značka zdrojem nejsou.
 */
export function rozpoznatZdrojZAdresy(
  hledani: string | null | undefined,
): BranaZdrojPrichodu | null {
  if (!hledani) {
    return null;
  }

  try {
    const dotaz = hledani.startsWith("?") ? hledani.slice(1) : hledani;
    const params = new URLSearchParams(dotaz);
    const znacky = params.getAll("z").map((znacka) => znacka.toLowerCase());
    if (params.get("zdroj")?.toLowerCase() === "desktop-qr") {
      return { zdroj: "qr", qrDesktop: true };
    }
    if (znacky.includes("qr")) {
      return { zdroj: "qr" };
    }
    if (znacky.includes("sdileni")) {
      return { zdroj: "sdileni" };
    }
    return null;
  } catch {
    return null;
  }
}

export type BranaNavstevaVysledek =
  | { zaznamenat: false; duvod: "stejna-navsteva" | "uloziste-nedostupne" }
  | { zaznamenat: true; udalost: BranaAnalytikaUdalostNavstevy };

type OknoSpusteni = {
  matchMedia?: (dotaz: string) => { matches: boolean };
  navigator?: { standalone?: boolean };
};

/** Značka, že už byla přijata aspoň jedna návštěva. Není to identifikátor. */
export const KLIC_BRANA_UZ_NAVSTIVIL = "brana_analytika_uz_navstivil";

/**
 * Nový nebo vracející se podle místní značky.
 * Bez úložiště nebo při chybě čtení údaj chybí a jistota se nepředstírá.
 */
export function nacistDruhNavstevnika(
  uloziste: BranaNavstevaUloziste | null,
): BranaAnalytikaNavstevnik | undefined {
  if (!uloziste) {
    return undefined;
  }

  try {
    return uloziste.getItem(KLIC_BRANA_UZ_NAVSTIVIL) === "1" ? "vracejici" : "novy";
  } catch {
    return undefined;
  }
}

/** Zapíše značku až po přijaté návštěvě. Hodnota je jen „1“, bez času a identity. */
export function oznacitPrvniPrijatouNavstevu(
  uloziste: BranaNavstevaUloziste | null,
): boolean {
  if (!uloziste) {
    return false;
  }

  try {
    uloziste.setItem(KLIC_BRANA_UZ_NAVSTIVIL, "1");
    return uloziste.getItem(KLIC_BRANA_UZ_NAVSTIVIL) === "1";
  } catch {
    return false;
  }
}

/** Bez předaného úložiště údaj chybí. Trvalé náhodné ID se nezakládá. */
export function nacistVolitelnehoNavstevnika(
  uloziste?: BranaNavstevaUloziste | null,
): BranaAnalytikaNavstevnik | undefined {
  if (!uloziste) {
    return undefined;
  }
  return nacistDruhNavstevnika(uloziste);
}

/** Ikona jen podle display-mode: standalone nebo iOS navigator.standalone. */
export function zjistitSpusteni(
  okno: OknoSpusteni | null | undefined,
): BranaAnalytikaSpusteni {
  try {
    if (!okno) {
      return "prohlizec";
    }
    const ikona =
      okno.matchMedia?.("(display-mode: standalone)")?.matches === true ||
      okno.navigator?.standalone === true;
    return ikona ? "ikona" : "prohlizec";
  } catch {
    return "prohlizec";
  }
}

/** Zapamatuje odchod z popředí. Opakovaný signál během jednoho odchodu čas neposouvá. */
export function oznacitOdchodDoPozadi(
  uloziste: BranaNavstevaUloziste | null,
  ted: number,
): void {
  if (!uloziste || !Number.isFinite(ted)) {
    return;
  }
  try {
    if (uloziste.getItem(KLIC_SKRYTO) === null) {
      uloziste.setItem(KLIC_SKRYTO, String(ted));
    }
  } catch {
    /* Úložiště nesmí shodit BRÁNU. */
  }
}

/**
 * Rozhodne začátek návštěvy podle panelu a doby mimo popředí.
 * Samotné opětovné zavolání, přepnutí pohledu ani obnovení stránky nestačí.
 * Nic neodesílá.
 */
export function rozhodnoutZacatekNavstevy(
  vstup: BranaNavstevaVstup,
): BranaNavstevaVysledek {
  const { uloziste, ted, spusteni } = vstup;
  if (!uloziste || !Number.isFinite(ted)) {
    return { zaznamenat: false, duvod: "uloziste-nedostupne" };
  }

  try {
    const maNavstevu = uloziste.getItem(KLIC_NAVSTEVA) !== null;
    const skryto = casSkryti(uloziste.getItem(KLIC_SKRYTO));
    const dlouhyOdchod =
      skryto !== null && ted - skryto >= BRANA_NAVSTEVA_MIN_ODCHOD_MS;
    const nova = !maNavstevu || dlouhyOdchod;

    if (skryto !== null) {
      uloziste.removeItem(KLIC_SKRYTO);
    }
    if (!nova) {
      return { zaznamenat: false, duvod: "stejna-navsteva" };
    }

    uloziste.setItem(KLIC_NAVSTEVA, "1");
    const udalost: BranaAnalytikaUdalostNavstevy = { typ: "navsteva", spusteni };
    if (vstup.navstevnik) {
      udalost.navstevnik = vstup.navstevnik;
    }
    const zdroj = rozpoznatZdrojZAdresy(vstup.hledani);
    if (zdroj?.zdroj === "qr") {
      udalost.zdroj = "qr";
      if (zdroj.qrDesktop) {
        udalost.qrDesktop = true;
      }
    } else if (zdroj?.zdroj === "sdileni") {
      udalost.zdroj = "sdileni";
    }
    return { zaznamenat: true, udalost };
  } catch {
    return { zaznamenat: false, duvod: "uloziste-nedostupne" };
  }
}

/**
 * První pohled započítané návštěvy, nebo další skutečné otevření.
 * Stejný pohled při obnovení či překreslení se nepočítá znovu.
 * V panelu zůstane jen poslední pohled, ne historie navigace.
 */
export function rozhodnoutOtevreniPohledu(
  uloziste: BranaNavstevaUloziste | null,
  pohled: BranaAnalytikaPohled,
  novaNavsteva: boolean,
): BranaAnalytikaUdalostPohledu | null {
  if (!uloziste || !jePohled(pohled)) {
    return null;
  }

  try {
    const ulozeny = uloziste.getItem(KLIC_POHLED);
    if (!novaNavsteva && ulozeny === pohled) {
      return null;
    }

    const raz = (novaNavsteva || ulozeny === null) ? "prvni" : "dalsi";
    uloziste.setItem(KLIC_POHLED, pohled);
    if (uloziste.getItem(KLIC_POHLED) !== pohled) {
      return null;
    }
    return { typ: "pohled", pohled, raz };
  } catch {
    return null;
  }
}

function jePohled(hodnota: string): hodnota is BranaAnalytikaPohled {
  return (BRANA_ANALYTIKA_POHLEDY as readonly string[]).includes(hodnota);
}

function casSkryti(hodnota: string | null): number | null {
  if (!hodnota || !/^\d+$/.test(hodnota)) {
    return null;
  }
  const cas = Number(hodnota);
  return Number.isSafeInteger(cas) ? cas : null;
}
