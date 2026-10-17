import { BRANA_ANALYTIKA_PRIJEM_ZAPNUT, type BranaAnalytikaPohled } from "./model";
import {
  oznacitOdchodDoPozadi,
  zjistitSpusteni,
  type BranaNavstevaUloziste,
  type BranaNavstevaVstup,
} from "./navsteva-klient";
import {
  odeslatKlikSdileni,
  odeslatRozpoznanouNavstevu,
  odeslatUdalostiProchazeni,
  jeOdeslaniBranaAnalytikyPovoleno,
  type BranaAnalytikaOdesilac,
  type BranaOdeslaniVysledek,
} from "./odeslani-navstevy";
import { pripojitMereniProchazeni } from "./prochazeni-obsahu";

/**
 * Jediné napojení už připraveného rozpoznání návštěvy.
 * Vypnutý příjem se vrací dřív, než se návštěva vyhodnotí nebo odešle.
 */
export async function napojitRozpoznaniNavstevy(
  povoleno: boolean,
  vstup: BranaNavstevaVstup,
  odeslat: BranaAnalytikaOdesilac,
  trvaleUloziste?: BranaNavstevaUloziste | null,
  pohled?: BranaAnalytikaPohled,
): Promise<BranaOdeslaniVysledek> {
  if (!povoleno) {
    return { pokusu: 0, odeslano: false };
  }

  return odeslatRozpoznanouNavstevu(vstup, odeslat, trvaleUloziste, pohled);
}

function ulozistePanelu(): BranaNavstevaUloziste | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function hledaniZOkna(): string {
  try {
    return window.location.search;
  } catch {
    return "";
  }
}

function ulozisteTrvale(): BranaNavstevaUloziste | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Spuštění v okně veřejné BRÁNY. Při vypnutém příjmu nic neposlouchá
 * a na úložiště panelu nesáhne.
 */
export function spustitRozpoznaniNavstevyVOkne(
  pohled: BranaAnalytikaPohled,
): () => void {
  if (!BRANA_ANALYTIKA_PRIJEM_ZAPNUT) {
    return () => {};
  }
  if (!jeOdeslaniBranaAnalytikyPovoleno()) {
    return () => {};
  }

  const uloziste = ulozistePanelu();
  const odeslat: BranaAnalytikaOdesilac = (url, pozadavek) => fetch(url, pozadavek);
  const hledani = hledaniZOkna();
  void napojitRozpoznaniNavstevy(
    true,
    {
      uloziste,
      ted: Date.now(),
      spusteni: zjistitSpusteni({
        matchMedia: (dotaz) => window.matchMedia(dotaz),
        navigator: {
          standalone: (window.navigator as { standalone?: boolean }).standalone,
        },
      }),
      hledani,
    },
    odeslat,
    ulozisteTrvale(),
    pohled,
  );
  const uklidProchazeni = pripojitProchazeniVOkne(uloziste, pohled, odeslat);

  const priOdchodu = () => {
    if (document.visibilityState === "hidden") {
      oznacitOdchodDoPozadi(uloziste, Date.now());
    }
  };
  document.addEventListener("visibilitychange", priOdchodu);
  return () => {
    uklidProchazeni();
    document.removeEventListener("visibilitychange", priOdchodu);
  };
}

function pripojitProchazeniVOkne(
  uloziste: BranaNavstevaUloziste | null,
  pohled: BranaAnalytikaPohled,
  odeslat: BranaAnalytikaOdesilac,
): () => void {
  try {
    const nalezeny = document.querySelector("section.brana-prostor-obsah");
    const koren = nalezeny instanceof HTMLElement ? nalezeny : null;
    return pripojitMereniProchazeni(
      koren,
      uloziste,
      pohled,
      (udalosti) => odeslatUdalostiProchazeni(udalosti, odeslat),
      (cil, callback) => {
        if (typeof ResizeObserver === "undefined") {
          return () => {};
        }
        const pozorovatel = new ResizeObserver(() => callback());
        pozorovatel.observe(cil);
        return () => pozorovatel.disconnect();
      },
    );
  } catch {
    return () => {};
  }
}

/**
 * Jeden stisk sdílení. Při vypnutém příjmu se úložiště nečte a požadavek se neodešle.
 */
export function zaznamenatKlikSdileniVOkne(): Promise<BranaOdeslaniVysledek> {
  if (!BRANA_ANALYTIKA_PRIJEM_ZAPNUT) {
    return Promise.resolve({ pokusu: 0, odeslano: false });
  }
  if (!jeOdeslaniBranaAnalytikyPovoleno()) {
    return Promise.resolve({ pokusu: 0, odeslano: false });
  }

  const odeslat: BranaAnalytikaOdesilac = (url, pozadavek) => fetch(url, pozadavek);
  return odeslatKlikSdileni(odeslat);
}
