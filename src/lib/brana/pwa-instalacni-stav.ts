import { pripravitOtevreniVChromu } from "@/lib/brana/otevrit-v-chromu";
import { jeSafari } from "@/lib/brana/pwa-instalacni-navod";
import { jeInstalacniPromptKDispozici } from "@/lib/brana/pwa-instalace";
import {
  jeAndroid,
  potrebujeOtevritVChromu,
} from "@/lib/brana/vlozeny-android-prohlizec";
import { jeIOS } from "@/lib/uloziste";

/** Důvod skrytí výzvy – odděleně od volby cesty po kliknutí. */
export type BranaVyzvaViditelnostDuvod =
  | "NAINSTALOVANO"
  | "ZAVRENO_UZIVATELEM"
  | "CEKANI_NA_PRODLENI"
  | "DESKTOP_NEBO_NEPODPOROVANO";

export type BranaVyzvaViditelnost =
  | { viditelna: true }
  | { viditelna: false; duvod: BranaVyzvaViditelnostDuvod };

/** Technická cesta po klepnutí na výzvu – uživateli se nezobrazuje. */
export type BranaCestaPoKliknuti =
  | { typ: "PROMPT" }
  | { typ: "CHROME_INTENT"; url: string }
  | {
      typ: "IOS_INSTALACE";
      varianta: "SAFARI" | "JINY_PROHLIZEC";
    }
  | { typ: "ZATIM_NEDOSTUPNA" };

/** @deprecated Kompatibilní tvar pro diagnostiku – preferuj viditelnost + cestu. */
export type BranaInstalacniStavSkrytoDuvod =
  | "NAINSTALOVANO"
  | "ZAVRENO_UZIVATELEM"
  | "CEKANI_NA_PRODLENI"
  | "DESKTOP_NEBO_NEPODPOROVANO"
  | "BEZ_FUNKCNI_AKCE";

/** @deprecated Kompatibilní tvar pro diagnostiku – preferuj viditelnost + cestu. */
export type BranaInstalacniStav =
  | {
      typ: "SKRYTO";
      duvod: BranaInstalacniStavSkrytoDuvod;
    }
  | {
      typ: "PROMPT";
    }
  | {
      typ: "CHROME_INTENT";
      url: string;
    }
  | {
      typ: "IOS_INSTALACE";
      varianta: "SAFARI" | "JINY_PROHLIZEC";
    };

export type BranaInstalacniStavVstup = {
  vyzvaZavrena: boolean;
  nainstalovano: boolean;
  /** Zdvořilost 8 s uplynula a (zájem nebo strop 20 s). */
  politikaZobrazeniSplnena?: boolean;
  /** @deprecated Použij politikaZobrazeniSplnena. */
  prodlevaUplynula?: boolean;
  aktualniUrl: string;
};

function jeMobilniProstredi(): boolean {
  return jeIOS() || jeAndroid();
}

/**
 * Volba technické cesty po kliknutí.
 * Neřeší, zda se výzva smí zobrazit.
 */
export function urcitBranaCestuPoKliknuti(
  vstup: Pick<BranaInstalacniStavVstup, "aktualniUrl">,
): BranaCestaPoKliknuti {
  // SSR: bez window/navigator nelze určit cestu.
  if (typeof window === "undefined") {
    return { typ: "ZATIM_NEDOSTUPNA" };
  }

  if (jeIOS()) {
    return {
      typ: "IOS_INSTALACE",
      varianta: jeSafari() ? "SAFARI" : "JINY_PROHLIZEC",
    };
  }

  if (jeInstalacniPromptKDispozici()) {
    return { typ: "PROMPT" };
  }

  if (potrebujeOtevritVChromu()) {
    const url = pripravitOtevreniVChromu(vstup.aktualniUrl);

    if (url) {
      return { typ: "CHROME_INTENT", url };
    }
  }

  return { typ: "ZATIM_NEDOSTUPNA" };
}

/**
 * Zda se výzva smí zobrazit – pouze produktová politika (ne technická cesta).
 */
export function urcitBranaVyzvaViditelnost(
  vstup: BranaInstalacniStavVstup,
): BranaVyzvaViditelnost {
  if (vstup.vyzvaZavrena) {
    return { viditelna: false, duvod: "ZAVRENO_UZIVATELEM" };
  }

  if (vstup.nainstalovano) {
    return { viditelna: false, duvod: "NAINSTALOVANO" };
  }

  if (!jeMobilniProstredi()) {
    return { viditelna: false, duvod: "DESKTOP_NEBO_NEPODPOROVANO" };
  }

  if (!(vstup.politikaZobrazeniSplnena ?? vstup.prodlevaUplynula)) {
    return { viditelna: false, duvod: "CEKANI_NA_PRODLENI" };
  }

  return { viditelna: true };
}

/** Textový popis kompatibilního stavu pro diagnostiku. */
export function popisBranaInstalacniStav(stav: BranaInstalacniStav): string {
  if (stav.typ === "SKRYTO") {
    return `SKRYTO / ${stav.duvod}`;
  }

  if (stav.typ === "IOS_INSTALACE") {
    return `IOS_INSTALACE / ${stav.varianta}`;
  }

  if (stav.typ === "CHROME_INTENT") {
    return "CHROME_INTENT";
  }

  return "PROMPT";
}

/**
 * Kompatibilní složení viditelnosti + cesty (pro diagnostiku).
 * Preferuj {@link urcitBranaVyzvaViditelnost} a {@link urcitBranaCestuPoKliknuti}.
 */
export function urcitBranaInstalacniStav(
  vstup: BranaInstalacniStavVstup,
): BranaInstalacniStav {
  const viditelnost = urcitBranaVyzvaViditelnost(vstup);

  if (!viditelnost.viditelna) {
    return {
      typ: "SKRYTO",
      duvod: viditelnost.duvod,
    };
  }

  const cesta = urcitBranaCestuPoKliknuti(vstup);

  if (cesta.typ === "ZATIM_NEDOSTUPNA") {
    // Výzva může být vidět i bez promptu – kompatibilní API nemá samostatný typ.
    return { typ: "SKRYTO", duvod: "BEZ_FUNKCNI_AKCE" };
  }

  return cesta;
}

/**
 * Fáze 2: otevře samostatnou iOS instalační obrazovku.
 * Zatím bez route a bez UI – handler je připraven pro navázání.
 */
export function otevritBranaIosInstalacniObrazovku(
  _varianta: "SAFARI" | "JINY_PROHLIZEC",
): void {
  void _varianta;
}
