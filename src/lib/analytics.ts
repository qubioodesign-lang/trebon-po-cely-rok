import "server-only";

import type { Polozka } from "@/types";
import type { PayloadMetriky, AnalyticsSouhrn, AnalyticsFotografieRadek } from "@/types";
import type { UlozisteDat } from "./uloziste-dat";
import {
  jePlatnyZdrojNavstevy,
  type ZdrojNavstevnika,
  ZDROJE_NAVSTEV,
} from "./zdroj-navstev";
import {
  jePlatneZarizeni,
  prazdnaPocitadlaZarizeni,
  type TypZarizeni,
  ZARIZENI_NAVSTEV,
} from "./zarizeni-navstevnika";

/** Countery u jedné fotografie */
export interface AnalyticsFotografie {
  zobrazeni: number;
  sdileni: number;
  replay: number;
}

/** Agregovaná analytics v uloziste.json */
export interface AnalyticsAgregovane {
  navstevyPodleZdroje: Record<ZdrojNavstevnika, number>;
  navstevyPodleZarizeni: Record<TypZarizeni, number>;
  pushOdberyPodleZarizeni: Record<TypZarizeni, number>;
  fotografie: Record<string, AnalyticsFotografie>;
}

export function prazdneAnalytics(): AnalyticsAgregovane {
  return {
    navstevyPodleZdroje: {
      qr: 0,
      "desktop-qr": 0,
      whatsapp: 0,
      sdileni: 0,
      primy: 0,
      ostatni: 0,
    },
    navstevyPodleZarizeni: prazdnaPocitadlaZarizeni(),
    pushOdberyPodleZarizeni: prazdnaPocitadlaZarizeni(),
    fotografie: {},
  };
}

/** Prázdný souhrn pro administraci při chybě načtení */
export function prazdnySouhrnAnalytics(): AnalyticsSouhrn {
  const prazdne = prazdneAnalytics();
  return {
    zdroje: { ...prazdne.navstevyPodleZdroje },
    navstevyPodleZarizeni: { ...prazdne.navstevyPodleZarizeni },
    pushOdberyPodleZarizeni: { ...prazdne.pushOdberyPodleZarizeni },
    fotografie: [],
  };
}

function normalizovatFotografii(countery: AnalyticsFotografie): AnalyticsFotografie {
  countery.replay ??= 0;
  return countery;
}

function zajistitFotografii(
  analytics: AnalyticsAgregovane,
  polozkaId: string
): AnalyticsFotografie {
  if (!analytics.fotografie[polozkaId]) {
    analytics.fotografie[polozkaId] = { zobrazeni: 0, sdileni: 0, replay: 0 };
  }
  return normalizovatFotografii(analytics.fotografie[polozkaId]);
}

function zajistitZdrojeNavstev(analytics: AnalyticsAgregovane): void {
  for (const zdroj of ZDROJE_NAVSTEV) {
    analytics.navstevyPodleZdroje[zdroj] ??= 0;
  }
}

function zajistitPocitadlaZarizeni(analytics: AnalyticsAgregovane): void {
  if (!analytics.navstevyPodleZarizeni) {
    analytics.navstevyPodleZarizeni = prazdnaPocitadlaZarizeni();
  }
  if (!analytics.pushOdberyPodleZarizeni) {
    analytics.pushOdberyPodleZarizeni = prazdnaPocitadlaZarizeni();
  }

  for (const zarizeni of ZARIZENI_NAVSTEV) {
    analytics.navstevyPodleZarizeni[zarizeni] ??= 0;
    analytics.pushOdberyPodleZarizeni[zarizeni] ??= 0;
  }
}

/** Zajistí analytics blok v úložišti */
export function zajistitAnalytics(uloziste: UlozisteDat): AnalyticsAgregovane {
  if (!uloziste.analyticsAgregovane) {
    uloziste.analyticsAgregovane = prazdneAnalytics();
  }
  for (const countery of Object.values(uloziste.analyticsAgregovane.fotografie)) {
    countery.replay ??= 0;
  }
  zajistitZdrojeNavstev(uloziste.analyticsAgregovane);
  zajistitPocitadlaZarizeni(uloziste.analyticsAgregovane);
  return uloziste.analyticsAgregovane;
}

/** Inkrementuje analytics countery podle události */
export function aplikovatAnalytics(
  uloziste: UlozisteDat,
  payload: PayloadMetriky
): void {
  const analytics = zajistitAnalytics(uloziste);

  switch (payload.typ) {
    case "navsteva":
      if (payload.zdroj && jePlatnyZdrojNavstevy(payload.zdroj)) {
        analytics.navstevyPodleZdroje[payload.zdroj] += 1;
      }
      if (payload.zarizeni && jePlatneZarizeni(payload.zarizeni)) {
        analytics.navstevyPodleZarizeni[payload.zarizeni] += 1;
      }
      break;
    case "povoleno_upozorneni":
      if (payload.zarizeni && jePlatneZarizeni(payload.zarizeni)) {
        analytics.pushOdberyPodleZarizeni[payload.zarizeni] += 1;
      }
      break;
    case "zobrazeni_fotografie":
      if (payload.polozkaId) {
        zajistitFotografii(analytics, payload.polozkaId).zobrazeni += 1;
      }
      break;
    case "sdileni_fotografie":
      if (payload.polozkaId) {
        zajistitFotografii(analytics, payload.polozkaId).sdileni += 1;
      }
      break;
    case "replay_prolnuti":
      if (payload.polozkaId) {
        zajistitFotografii(analytics, payload.polozkaId).replay += 1;
      }
      break;
  }
}

export function aplikovatAnalyticsBatch(
  uloziste: UlozisteDat,
  udalosti: PayloadMetriky[]
): void {
  for (const udalost of udalosti) {
    aplikovatAnalytics(uloziste, udalost);
  }
}

/** Souhrn analytics pro admin – spojí s položkami galerie */
export function ziskatSouhrnAnalytics(
  uloziste: UlozisteDat,
  polozky: Polozka[]
): AnalyticsSouhrn {
  const analytics = zajistitAnalytics(uloziste);

  const fotografie: AnalyticsFotografieRadek[] = polozky.map((polozka) => {
    const countery = analytics.fotografie[polozka.id];
    return {
      polozkaId: polozka.id,
      popis: polozka.popis,
      zobrazeni: countery?.zobrazeni ?? 0,
      sdileni: countery?.sdileni ?? 0,
      replay: countery?.replay ?? 0,
    };
  });

  fotografie.sort(
    (a, b) =>
      b.zobrazeni - a.zobrazeni ||
      b.sdileni - a.sdileni ||
      a.popis.localeCompare(b.popis, "cs")
  );

  const zdroje = { ...analytics.navstevyPodleZdroje };
  for (const zdroj of ZDROJE_NAVSTEV) {
    zdroje[zdroj] ??= 0;
  }

  const navstevyPodleZarizeni = { ...analytics.navstevyPodleZarizeni };
  const pushOdberyPodleZarizeni = { ...analytics.pushOdberyPodleZarizeni };
  for (const zarizeni of ZARIZENI_NAVSTEV) {
    navstevyPodleZarizeni[zarizeni] ??= 0;
    pushOdberyPodleZarizeni[zarizeni] ??= 0;
  }

  return { zdroje, navstevyPodleZarizeni, pushOdberyPodleZarizeni, fotografie };
}
