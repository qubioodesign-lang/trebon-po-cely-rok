import { pripravitOtevreniVChromu } from "@/lib/brana/otevrit-v-chromu";
import { jeSafari } from "@/lib/brana/pwa-instalacni-navod";
import { jeInstalacniPromptKDispozici } from "@/lib/brana/pwa-instalace";
import {
  jeAndroid,
  potrebujeOtevritVChromu,
} from "@/lib/brana/vlozeny-android-prohlizec";
import { jeIOS } from "@/lib/uloziste";

export type BranaInstalacniStavSkrytoDuvod =
  | "NAINSTALOVANO"
  | "ZAVRENO_UZIVATELEM"
  | "CEKANI_NA_PRODLENI"
  | "DESKTOP_NEBO_NEPODPOROVANO"
  | "BEZ_FUNKCNI_AKCE";

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
  prodlevaUplynula: boolean;
  aktualniUrl: string;
};

function jeMobilniProstredi(): boolean {
  return jeIOS() || jeAndroid();
}

/** Textový popis stavu pro diagnostiku. */
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
 * Jediný resolver instalačního stavu BRÁNY.
 * Pouze čisté rozhodování – bez side effectů a bez volání prompt().
 */
export function urcitBranaInstalacniStav(
  vstup: BranaInstalacniStavVstup,
): BranaInstalacniStav {
  if (vstup.vyzvaZavrena) {
    return { typ: "SKRYTO", duvod: "ZAVRENO_UZIVATELEM" };
  }

  if (vstup.nainstalovano) {
    return { typ: "SKRYTO", duvod: "NAINSTALOVANO" };
  }

  if (!jeMobilniProstredi()) {
    return { typ: "SKRYTO", duvod: "DESKTOP_NEBO_NEPODPOROVANO" };
  }

  if (!vstup.prodlevaUplynula) {
    return { typ: "SKRYTO", duvod: "CEKANI_NA_PRODLENI" };
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

  return { typ: "SKRYTO", duvod: "BEZ_FUNKCNI_AKCE" };
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
