import type { KategorieOdchoduNavstevy } from "@/types";
import { jeVyloucenoZeStatistik } from "./metriky-vylouceni";

const KLIC_ZACATEK = "trebon_navsteva_zacatek";
const KLIC_ZONA = "trebon_navsteva_zona";
const KLIC_ODCHOD_ODESLAN = "trebon_odchod_odeslan";

/** Horní hranice délky návštěvy – otevřená záložka nesmí zkreslit průměr */
const MAX_DELKA_MS = 60 * 60 * 1000;

const PRIORITA_ZONY: Record<KategorieOdchoduNavstevy, number> = {
  ostatni: 0,
  pribeh: 1,
  chci_se_vracet: 2,
};

/** Nastaví začátek návštěvy a nejvyšší dosaženou zónu v relaci prohlížeče */
export function inicializovatSledovaniChovani(zona: KategorieOdchoduNavstevy): void {
  if (typeof window === "undefined" || jeVyloucenoZeStatistik()) {
    return;
  }

  if (!sessionStorage.getItem(KLIC_ZACATEK)) {
    sessionStorage.setItem(KLIC_ZACATEK, String(Date.now()));
  }

  const aktualni = sessionStorage.getItem(KLIC_ZONA) as KategorieOdchoduNavstevy | null;
  if (!aktualni || PRIORITA_ZONY[zona] >= PRIORITA_ZONY[aktualni]) {
    sessionStorage.setItem(KLIC_ZONA, zona);
  }
}

/** Po kliknutí na odkaz „chci se vracet“ – zóna se už nevrátí na příběh */
export function oznacitZonuChciSeVracet(): void {
  if (typeof window === "undefined" || jeVyloucenoZeStatistik()) {
    return;
  }

  sessionStorage.setItem(KLIC_ZONA, "chci_se_vracet");
}

export interface DataOdchoduNavstevy {
  delkaMs: number;
  odchod: KategorieOdchoduNavstevy;
}

/**
 * Připraví data odchodu jednou za relaci – volá se při skrytí stránky / pagehide.
 */
export function pripravitOdchodNavstevy(): DataOdchoduNavstevy | null {
  if (typeof window === "undefined" || jeVyloucenoZeStatistik()) {
    return null;
  }

  if (sessionStorage.getItem(KLIC_ODCHOD_ODESLAN)) {
    return null;
  }

  const zacatekRaw = sessionStorage.getItem(KLIC_ZACATEK);
  if (!zacatekRaw) {
    return null;
  }

  const zacatek = Number.parseInt(zacatekRaw, 10);
  if (!Number.isFinite(zacatek)) {
    return null;
  }

  sessionStorage.setItem(KLIC_ODCHOD_ODESLAN, "1");

  const delkaMs = Math.min(Math.max(0, Date.now() - zacatek), MAX_DELKA_MS);
  const odchod =
    (sessionStorage.getItem(KLIC_ZONA) as KategorieOdchoduNavstevy | null) ??
    "ostatni";

  return { delkaMs, odchod };
}
