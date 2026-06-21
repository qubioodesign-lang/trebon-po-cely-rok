import "server-only";

import type { Polozka } from "@/types";
import type { PayloadMetriky, AnalyticsSouhrn, AnalyticsFotografieRadek } from "@/types";
import type { UlozisteDat } from "./uloziste-dat";
import {
  jePlatnyZdrojNavstevy,
  type ZdrojNavstevnika,
  ZDROJE_NAVSTEV,
} from "./zdroj-navstev";

/** Countery u jedné fotografie */
export interface AnalyticsFotografie {
  zobrazeni: number;
  sdileni: number;
}

/** Agregovaná analytics v uloziste.json */
export interface AnalyticsAgregovane {
  navstevyPodleZdroje: Record<ZdrojNavstevnika, number>;
  fotografie: Record<string, AnalyticsFotografie>;
}

export function prazdneAnalytics(): AnalyticsAgregovane {
  return {
    navstevyPodleZdroje: {
      qr: 0,
      whatsapp: 0,
      sdileni: 0,
      primy: 0,
      ostatni: 0,
    },
    fotografie: {},
  };
}

/** Prázdný souhrn pro administraci při chybě načtení */
export function prazdnySouhrnAnalytics(): AnalyticsSouhrn {
  return {
    zdroje: { ...prazdneAnalytics().navstevyPodleZdroje },
    fotografie: [],
  };
}

function zajistitFotografii(
  analytics: AnalyticsAgregovane,
  polozkaId: string
): AnalyticsFotografie {
  if (!analytics.fotografie[polozkaId]) {
    analytics.fotografie[polozkaId] = { zobrazeni: 0, sdileni: 0 };
  }
  return analytics.fotografie[polozkaId];
}

/** Zajistí analytics blok v úložišti */
export function zajistitAnalytics(uloziste: UlozisteDat): AnalyticsAgregovane {
  if (!uloziste.analyticsAgregovane) {
    uloziste.analyticsAgregovane = prazdneAnalytics();
  }
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

  return { zdroje, fotografie };
}
