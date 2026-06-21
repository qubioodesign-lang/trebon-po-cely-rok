import type { MetrikySouhrn, PayloadMetriky } from "@/types";
import type { MetrikyAgregovane, UlozisteDat, ZaznamMetriky } from "./uloziste-dat";
import type { TypZarizeni } from "./zarizeni-navstevnika";
import { aplikovatAnalyticsBatch } from "./analytics";
import { nacistData, upravitData } from "./uloziste-dat";

/** Prázdný souhrn metrik – výchozí stav administrace */
export function prazdnySouhrnMetrik(): MetrikySouhrn {
  return souhrnZAgregovanych(prazdneMetrikyAgregovane());
}

/** Výchozí agregované countery */
export function prazdneMetrikyAgregovane(): MetrikyAgregovane {
  return {
    pocetNavstev: 0,
    pocetZobrazeniFotografii: 0,
    pocetPosunuVpred: 0,
    pocetNavratuZpet: 0,
    pocetKliknutiChciSeVracet: 0,
    pocetPovolenychUpozorneni: 0,
    navstevyPodleNavstevnika: {},
  };
}

function pocitatVracejiciSe(navstevyPodleNavstevnika: Record<string, number>): number {
  return Object.values(navstevyPodleNavstevnika).filter((pocet) => pocet > 1).length;
}

function vypocitatProcentoNavratu(pocetPosunuVpred: number, pocetNavratuZpet: number): number {
  const celkemPosunu = pocetPosunuVpred + pocetNavratuZpet;
  return celkemPosunu > 0
    ? Math.round((pocetNavratuZpet / celkemPosunu) * 1000) / 10
    : 0;
}

/** Převede agregované countery na souhrn pro administraci */
export function souhrnZAgregovanych(agregovane: MetrikyAgregovane): MetrikySouhrn {
  return {
    pocetNavstev: agregovane.pocetNavstev,
    pocetVracejicichSeNavstevniku: pocitatVracejiciSe(agregovane.navstevyPodleNavstevnika),
    pocetZobrazeniFotografii: agregovane.pocetZobrazeniFotografii,
    pocetPosunuVpred: agregovane.pocetPosunuVpred,
    pocetNavratuZpet: agregovane.pocetNavratuZpet,
    procentoNavratu: vypocitatProcentoNavratu(
      agregovane.pocetPosunuVpred,
      agregovane.pocetNavratuZpet
    ),
    pocetKliknutiChciSeVracet: agregovane.pocetKliknutiChciSeVracet,
    pocetPovolenychUpozorneni: agregovane.pocetPovolenychUpozorneni,
  };
}

/** Inkrementuje jeden counter podle typu události */
export function aplikovatMetriku(
  agregovane: MetrikyAgregovane,
  payload: PayloadMetriky
): void {
  switch (payload.typ) {
    case "navsteva":
      agregovane.pocetNavstev += 1;
      if (payload.navstevnikId) {
        const { navstevnikId } = payload;
        agregovane.navstevyPodleNavstevnika[navstevnikId] =
          (agregovane.navstevyPodleNavstevnika[navstevnikId] ?? 0) + 1;
      }
      break;
    case "zobrazeni_fotografie":
      agregovane.pocetZobrazeniFotografii += 1;
      break;
    case "posun_vpred":
      agregovane.pocetPosunuVpred += 1;
      break;
    case "navrat_zpet":
      agregovane.pocetNavratuZpet += 1;
      break;
    case "klik_chci_se_vracet":
      agregovane.pocetKliknutiChciSeVracet += 1;
      break;
    case "povoleno_upozorneni":
      agregovane.pocetPovolenychUpozorneni += 1;
      break;
  }
}

/** Zajistí agregované metriky – migruje staré pole metriky[] pokud existuje */
export function zajistitMetrikyAgregovane(uloziste: UlozisteDat): MetrikyAgregovane {
  if (uloziste.metrikyAgregovane) {
    if (uloziste.metriky.length > 0) {
      for (const zaznam of uloziste.metriky) {
        aplikovatMetriku(uloziste.metrikyAgregovane, {
          typ: zaznam.typ,
          polozkaId: zaznam.polozkaId,
          navstevnikId: zaznam.navstevnikId,
        });
      }
      uloziste.metriky = [];
    }
    return uloziste.metrikyAgregovane;
  }

  if (uloziste.metriky.length > 0) {
    uloziste.metrikyAgregovane = migrovatLegacyMetriky(uloziste.metriky);
  } else {
    uloziste.metrikyAgregovane = prazdneMetrikyAgregovane();
  }

  uloziste.metriky = [];
  return uloziste.metrikyAgregovane;
}

function migrovatLegacyMetriky(metriky: ZaznamMetriky[]): MetrikyAgregovane {
  const agregovane = prazdneMetrikyAgregovane();
  for (const zaznam of metriky) {
    aplikovatMetriku(agregovane, {
      typ: zaznam.typ,
      polozkaId: zaznam.polozkaId,
      navstevnikId: zaznam.navstevnikId,
    });
  }
  return agregovane;
}

/** Agreguje surové záznamy metrik do souhrnu – pro migraci starých dat */
export function agregovatSouhrnMetrik(metriky: ZaznamMetriky[]): MetrikySouhrn {
  return souhrnZAgregovanych(migrovatLegacyMetriky(metriky));
}

/** Aplikuje dávku událostí na úložiště v paměti */
export function aplikovatMetriky(uloziste: UlozisteDat, udalosti: PayloadMetriky[]): void {
  const agregovane = zajistitMetrikyAgregovane(uloziste);
  for (const udalost of udalosti) {
    aplikovatMetriku(agregovane, udalost);
  }
  aplikovatAnalyticsBatch(uloziste, udalosti);
}

/** Souhrn metrik z načteného úložiště */
export function ziskatSouhrnZUloziste(uloziste: UlozisteDat): MetrikySouhrn {
  return souhrnZAgregovanych(zajistitMetrikyAgregovane(uloziste));
}

/** Zaznamená dávku událostí – jeden get + put na Blob */
export async function zaznamenatMetrikyBatch(
  udalosti: PayloadMetriky[],
  oidcZHeaderu?: string | null
): Promise<void> {
  if (udalosti.length === 0) {
    return;
  }

  await upravitData((uloziste) => {
    aplikovatMetriky(uloziste, udalosti);
  }, oidcZHeaderu);
}

/** Vrátí agregovaný souhrn všech metrik */
export async function ziskatSouhrnMetrik(
  oidcZHeaderu?: string | null
): Promise<MetrikySouhrn> {
  const uloziste = await nacistData(oidcZHeaderu);
  return ziskatSouhrnZUloziste(uloziste);
}

function pushOdberJeUlozen(
  uloziste: UlozisteDat,
  data: { endpoint: string; klicP256dh: string; klicAuth: string }
): boolean {
  return uloziste.pushOdbery.some(
    (odber) =>
      odber.endpoint === data.endpoint &&
      odber.klicP256dh === data.klicP256dh &&
      odber.klicAuth === data.klicAuth
  );
}

/** Uloží push subscription – metrika povolení je volitelná a best-effort */
export async function ulozitPushOdber(
  data: {
    endpoint: string;
    klicP256dh: string;
    klicAuth: string;
  },
  oidcZHeaderu?: string | null,
  volby?: { zaznamenatPovoleni?: boolean; navstevnikId?: string; zarizeni?: TypZarizeni }
): Promise<void> {
  await upravitData(
    (uloziste) => {
      const existujici = uloziste.pushOdbery.findIndex((o) => o.endpoint === data.endpoint);

      const zaznam = {
        endpoint: data.endpoint,
        klicP256dh: data.klicP256dh,
        klicAuth: data.klicAuth,
        vytvoreno: new Date().toISOString(),
      };

      if (existujici >= 0) {
        uloziste.pushOdbery[existujici] = zaznam;
      } else {
        uloziste.pushOdbery.push(zaznam);
      }
    },
    oidcZHeaderu,
    {
      maxPokusu: 16,
      overitPoUlozeni: (uloziste) => pushOdberJeUlozen(uloziste, data),
      chybovaZprava:
        "Push odběr se nepodařilo uložit – souběžné zápisy metrik přepsaly změnu. Zkuste registraci znovu.",
    }
  );

  if (volby?.zaznamenatPovoleni) {
    try {
      await zaznamenatMetrikyBatch(
        [
          {
            typ: "povoleno_upozorneni",
            navstevnikId: volby.navstevnikId,
            zarizeni: volby.zarizeni,
          },
        ],
        oidcZHeaderu
      );
    } catch {
      // Metrika nesmí zablokovat úspěšně uložený push odběr
    }
  }
}
