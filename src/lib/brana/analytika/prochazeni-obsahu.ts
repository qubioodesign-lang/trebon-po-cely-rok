import type { BranaAnalytikaPohled, BranaAnalytikaUdalostProchazeni } from "./model";
import type { BranaNavstevaUloziste } from "./navsteva-klient";

export type OdesilacProchazeni = (
  udalosti: readonly BranaAnalytikaUdalostProchazeni[],
) => Promise<unknown>;

/** Toleruje jen zaokrouhlení pixelu, ne skrytý konec seznamu. */
const TOLERANCE_PX = 1;

const KLIC_PROCHAZENI = "brana_analytika_prochazeni";

export type DuvodMereniProchazeni = "layout" | "obsah" | "resize" | "scroll" | "render";

export type MereniSeznamu = {
  pripraveno: boolean;
  seznamSpodek: number;
  portSpodek: number;
  scrollTop: number;
};

export type StavProchazeni = {
  rozhodnuto: boolean;
  delsi: boolean;
  posunuto: boolean;
  konec: boolean;
  vychoziScroll: number | null;
};

export function pocatecniStavProchazeni(): StavProchazeni {
  return {
    rozhodnuto: false,
    delsi: false,
    posunuto: false,
    konec: false,
    vychoziScroll: null,
  };
}

/**
 * Delší obsah: konec seznamu událostí není vidět v počátečním zobrazení.
 * Konec: seznam byl delší, návštěvník jím pohnul a konec se dostal do plochy.
 * Render a změna rozměrů samy konec nezaloží.
 */
export function posouditKrokProchazeni(
  stav: StavProchazeni,
  mereni: MereniSeznamu,
  duvod: DuvodMereniProchazeni,
): { stav: StavProchazeni; delsi: boolean; konec: boolean } {
  if (!mereni.pripraveno) {
    return { stav, delsi: false, konec: false };
  }

  const dalsi: StavProchazeni = { ...stav };
  if (
    dalsi.vychoziScroll === null &&
    (duvod === "layout" || duvod === "obsah")
  ) {
    dalsi.vychoziScroll = mereni.scrollTop;
  }

  if (
    duvod === "scroll" &&
    dalsi.vychoziScroll !== null &&
    mereni.scrollTop !== dalsi.vychoziScroll
  ) {
    dalsi.posunuto = true;
  }

  const delsiTed =
    mereni.seznamSpodek + mereni.scrollTop > mereni.portSpodek + TOLERANCE_PX;
  const konecViditelny = mereni.seznamSpodek <= mereni.portSpodek + TOLERANCE_PX;
  let emitDelsi = false;

  if (duvod === "layout" || duvod === "obsah") {
    dalsi.rozhodnuto = true;
    if (delsiTed && !dalsi.delsi) {
      dalsi.delsi = true;
      emitDelsi = true;
    }
  }

  const emitKonec =
    duvod === "scroll" &&
    dalsi.delsi &&
    dalsi.posunuto &&
    konecViditelny &&
    !dalsi.konec;
  if (emitKonec) {
    dalsi.konec = true;
  }

  return { stav: dalsi, delsi: emitDelsi, konec: emitKonec };
}

/** Smaže značky procházení při nové návštěvě. Není to identifikátor. */
export function smazatZnackyProchazeni(
  uloziste: BranaNavstevaUloziste | null,
): void {
  if (!uloziste) {
    return;
  }
  try {
    uloziste.removeItem(KLIC_PROCHAZENI);
  } catch {
    /* Úložiště nesmí shodit BRÁNU. */
  }
}

/**
 * Jednou za pohled a návštěvu. Vrací jen nově uznané metriky.
 * V panelu je jen značka pohledů, ne dráha scrollování.
 */
export function prijmoutMetrikyProchazeni(
  uloziste: BranaNavstevaUloziste | null,
  pohled: BranaAnalytikaPohled,
  chce: { delsi: boolean; konec: boolean },
): BranaAnalytikaUdalostProchazeni[] {
  if (!uloziste || (!chce.delsi && !chce.konec)) {
    return [];
  }

  try {
    const mapa = nactiMapu(uloziste.getItem(KLIC_PROCHAZENI));
    const puvodni = mapa[pohled] ?? "";
    let dalsi = puvodni;
    const udalosti: BranaAnalytikaUdalostProchazeni[] = [];

    if (chce.delsi && !dalsi.includes("d")) {
      dalsi += "d";
      udalosti.push({ typ: "prochazeni", pohled, metrika: "delsi" });
    }
    if (chce.konec && !dalsi.includes("k")) {
      dalsi += "k";
      udalosti.push({ typ: "prochazeni", pohled, metrika: "konec" });
    }
    if (dalsi === puvodni) {
      return [];
    }

    mapa[pohled] = dalsi;
    uloziste.setItem(KLIC_PROCHAZENI, slozitMapu(mapa));
    if (uloziste.getItem(KLIC_PROCHAZENI) !== slozitMapu(mapa)) {
      return [];
    }
    return udalosti;
  } catch {
    return [];
  }
}

export function nactiRozmerySeznamu(koren: HTMLElement): MereniSeznamu | null {
  if (koren.querySelector(".brana-listovani-panel--bezi")) {
    return null;
  }

  const port = koren.getBoundingClientRect();
  if (port.height <= 0) {
    return null;
  }

  const zivy = jakoUzel(
    koren.querySelector(".brana-listovani-panel--prijezd, .brana-prostor-obsah-vnitr"),
  );
  if (!zivy) {
    return null;
  }

  const seznamy = Array.from(zivy.querySelectorAll(".brana-seznam-akci"))
    .map((seznam) => jakoUzel(seznam))
    .filter((seznam): seznam is HTMLElement => seznam !== null);
  if (seznamy.length === 0) {
    return null;
  }

  const posledni = seznamy[seznamy.length - 1];
  const maPolozky = seznamy.some((seznam) => (seznam.childElementCount ?? 0) > 0);
  const rect = posledni.getBoundingClientRect();
  if (maPolozky && rect.height <= 0) {
    return null;
  }

  return {
    pripraveno: true,
    seznamSpodek: rect.bottom,
    portSpodek: port.bottom,
    scrollTop: koren.scrollTop,
  };
}

/**
 * Poslouchá už existující scrollovací plochu Kalendáře.
 * Nic nepřidává do toku scrollu a při chybě BRÁNU neshodí.
 */
export function pripojitMereniProchazeni(
  koren: HTMLElement | null,
  uloziste: BranaNavstevaUloziste | null,
  pohled: BranaAnalytikaPohled,
  odeslat: OdesilacProchazeni,
  poslouchatRozmer?: (cil: HTMLElement, callback: () => void) => () => void,
  povoleno = true,
): () => void {
  if (!povoleno || !koren || !uloziste) {
    return () => {};
  }

  let stav = pocatecniStavProchazeni();

  const krok = (duvod: DuvodMereniProchazeni) => {
    let mereni: MereniSeznamu | null = null;
    try {
      mereni = nactiRozmerySeznamu(koren);
    } catch {
      return;
    }
    if (!mereni) {
      return;
    }

    const vysledek = posouditKrokProchazeni(stav, mereni, duvod);
    stav = vysledek.stav;
    const udalosti = prijmoutMetrikyProchazeni(uloziste, pohled, {
      delsi: vysledek.delsi,
      konec: vysledek.konec,
    });
    if (udalosti.length === 0) {
      return;
    }

    void odeslat(udalosti).catch(() => {
      /* Jeden pokus. Neúspěch se neopakuje. */
    });
  };

  const naScroll = () => krok("scroll");
  try {
    koren.addEventListener("scroll", naScroll, { passive: true });
  } catch {
    return () => {};
  }

  const uklidRozmeru: Array<() => void> = [];
  if (poslouchatRozmer) {
    try {
      uklidRozmeru.push(poslouchatRozmer(koren, () => krok("resize")));
      const zivy = jakoUzel(
        koren.querySelector(".brana-listovani-panel--prijezd, .brana-prostor-obsah-vnitr"),
      );
      if (zivy) {
        uklidRozmeru.push(poslouchatRozmer(zivy, () => krok("obsah")));
      }
    } catch {
      /* Pozorovatel rozměrů je volitelný. Scroll dál stačí. */
    }
  }

  krok("layout");

  return () => {
    try {
      koren.removeEventListener("scroll", naScroll);
    } catch {
      /* Úklid nesmí shodit odchod ze stránky. */
    }
    for (const uklid of uklidRozmeru) {
      uklid();
    }
  };
}

function jakoUzel(hodnota: unknown): HTMLElement | null {
  if (!hodnota || typeof (hodnota as HTMLElement).getBoundingClientRect !== "function") {
    return null;
  }
  return hodnota as HTMLElement;
}

function nactiMapu(hodnota: string | null): Record<string, string> {
  const mapa: Record<string, string> = {};
  if (!hodnota) {
    return mapa;
  }
  for (const cast of hodnota.split(",")) {
    const [pohled, znacky] = cast.split("=");
    if (!pohled || !znacky) {
      continue;
    }
    mapa[pohled] = znacky.replace(/[^dk]/g, "");
  }
  return mapa;
}

function slozitMapu(mapa: Record<string, string>): string {
  return Object.entries(mapa)
    .filter(([, znacky]) => znacky.length > 0)
    .map(([pohled, znacky]) => `${pohled}=${znacky}`)
    .join(",");
}
