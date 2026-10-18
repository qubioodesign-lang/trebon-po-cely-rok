import { dnesVPraze, pridatDny, type BranaDatum } from "@/lib/brana/cas";
import { jeDenDostupnyProGraf } from "@/lib/brana/analytika/grafy";
import {
  BRANA_ANALYTIKA_MAX_DNU,
  isoDenZData,
  type BranaAnalytikaOblast,
} from "@/lib/brana/analytika/model";
import type {
  BodGeografieGrafu,
  GeografieGrafyAdmin,
  GeografieObdobi,
  GeografieObdobiPodklady,
  KategorieOdchoduNavstevy,
  MetrikySouhrn,
  PayloadMetriky,
  SouctyGeografieGrafu,
} from "@/types";
import { GEOGRAFIE_OBDOBI } from "@/types";
import type {
  GeografieNavstev,
  GeografieNavstevDen,
  MetrikyAgregovane,
  UlozisteDat,
  ZaznamMetriky,
} from "./uloziste-dat";
import { jePlatneZarizeni, type TypZarizeni } from "./zarizeni-navstevnika";
import type { PushOdber } from "./uloziste-dat";
import { aplikovatAnalyticsBatch } from "./analytics";
import { aplikovatKomunitaNavstevu } from "./komunita";
import { aplikovatOdchodNavstevy } from "./chovani-navstevniku";
import { nacistData, upravitData } from "./uloziste-dat";

/** Prázdný souhrn metrik – výchozí stav administrace */
export function prazdnySouhrnMetrik(referencniCas: Date = new Date()): MetrikySouhrn {
  return pripojitGeografii(souhrnZAgregovanych(prazdneMetrikyAgregovane()), undefined, referencniCas);
}

/** Výchozí agregované countery */
export function prazdneMetrikyAgregovane(): MetrikyAgregovane {
  return {
    pocetNavstev: 0,
    pocetZobrazeniFotografii: 0,
    pocetPosunuVpred: 0,
    pocetNavratuZpet: 0,
    pocetKliknutiChciSeVracet: 0,
    pocetKliknutiNaBranu: 0,
    pocetPovolenychUpozorneni: 0,
    pocetKliknutiPridatNaPlochu: 0,
    pocetNavstevZePlochy: 0,
    pocetReplayProlnuti: 0,
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
export function souhrnZAgregovanych(
  agregovane: MetrikyAgregovane,
): Omit<MetrikySouhrn, "geografie"> {
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
    pocetKliknutiNaBranu: agregovane.pocetKliknutiNaBranu ?? 0,
    pocetPovolenychUpozorneni: agregovane.pocetPovolenychUpozorneni,
    pocetKliknutiPridatNaPlochu: agregovane.pocetKliknutiPridatNaPlochu ?? 0,
    pocetNavstevZePlochy: agregovane.pocetNavstevZePlochy ?? 0,
    pocetReplayProlnuti: agregovane.pocetReplayProlnuti ?? 0,
  };
}

const KLIC_DNE_GEOGRAFIE = /^\d{4}-\d{2}-\d{2}$/;

function datumZIso(iso: string): BranaDatum {
  const [rok, mesic, den] = iso.split("-").map(Number);
  return { rok, mesic, den };
}

function posunDenGeografie(iso: string, dny: number): string {
  return isoDenZData(pridatDny(datumZIso(iso), dny));
}

function oknoDnuGeografie(konecIso: string, pocet: number): string[] {
  const zacatek = posunDenGeografie(konecIso, -(pocet - 1));
  return Array.from({ length: pocet }, (_, poradi) => posunDenGeografie(zacatek, poradi));
}

function orezatDnyGeografie(
  dny: Record<string, GeografieNavstevDen>,
  referencniCas: Date,
): Record<string, GeografieNavstevDen> {
  const dnes = isoDenZData(dnesVPraze(referencniCas));
  const hranice = isoDenZData(
    pridatDny(dnesVPraze(referencniCas), -(BRANA_ANALYTIKA_MAX_DNU - 1)),
  );
  const vysledek: Record<string, GeografieNavstevDen> = {};
  for (const [klic, den] of Object.entries(dny)) {
    if (klic < hranice || klic > dnes) {
      continue;
    }
    vysledek[klic] = {
      trebonsko: nezaporneCislo(den?.trebonsko),
      mimo_trebonsko: nezaporneCislo(den?.mimo_trebonsko),
      neurceno: nezaporneCislo(den?.neurceno),
    };
  }
  return vysledek;
}

/** Přičte právě jednu návštěvu do pražského dne. Jiné události se sem nedostanou. */
export function pricistGeografiiNavstevy(
  uloziste: UlozisteDat,
  oblast: BranaAnalytikaOblast,
  referencniCas: Date,
): void {
  const dnes = isoDenZData(dnesVPraze(referencniCas));
  if (!uloziste.geografieNavstev) {
    uloziste.geografieNavstev = { merenoOd: dnes, dny: {} };
  }

  const blok = uloziste.geografieNavstev;
  blok.dny = orezatDnyGeografie(blok.dny ?? {}, referencniCas);
  const ulozeny = blok.dny[dnes];
  const den: GeografieNavstevDen = {
    trebonsko: nezaporneCislo(ulozeny?.trebonsko),
    mimo_trebonsko: nezaporneCislo(ulozeny?.mimo_trebonsko),
    neurceno: nezaporneCislo(ulozeny?.neurceno),
  };
  den[oblast] += 1;
  blok.dny[dnes] = den;
}

function denGeografie(
  blok: GeografieNavstev | undefined,
  den: string,
  dnesIso: string,
): GeografieNavstevDen | null {
  if (!blok || !KLIC_DNE_GEOGRAFIE.test(blok.merenoOd)) {
    return null;
  }
  if (!jeDenDostupnyProGraf(den, dnesIso)) {
    return null;
  }
  if (den < blok.merenoOd) {
    return null;
  }
  const ulozeny = blok.dny?.[den];
  return {
    trebonsko: nezaporneCislo(ulozeny?.trebonsko),
    mimo_trebonsko: nezaporneCislo(ulozeny?.mimo_trebonsko),
    neurceno: nezaporneCislo(ulozeny?.neurceno),
  };
}

function nezaporneCislo(hodnota: unknown): number {
  return typeof hodnota === "number" && Number.isFinite(hodnota) && hodnota >= 0 ? hodnota : 0;
}

function skupinyDnuGeografie(
  dny: readonly string[],
  poMesicich: boolean,
): Array<{ rok: number; mesic: number; dny: string[] }> {
  if (!poMesicich) {
    return dny.map((den) => ({
      rok: Number(den.slice(0, 4)),
      mesic: Number(den.slice(5, 7)),
      dny: [den],
    }));
  }

  const skupiny: Array<{ rok: number; mesic: number; dny: string[] }> = [];
  for (const den of dny) {
    const rok = Number(den.slice(0, 4));
    const mesic = Number(den.slice(5, 7));
    const posledni = skupiny[skupiny.length - 1];
    if (!posledni || posledni.rok !== rok || posledni.mesic !== mesic) {
      skupiny.push({ rok, mesic, dny: [den] });
    } else {
      posledni.dny.push(den);
    }
  }
  return skupiny;
}

function soucetGeografie(
  body: readonly BodGeografieGrafu[],
  klic: keyof SouctyGeografieGrafu,
): number | null {
  let soucet = 0;
  let dostupnych = 0;
  for (const bod of body) {
    const hodnota = bod[klic];
    if (hodnota === null) {
      continue;
    }
    dostupnych += 1;
    soucet += hodnota;
  }
  return dostupnych === 0 ? null : soucet;
}

function procentaGeografie(soucty: SouctyGeografieGrafu): SouctyGeografieGrafu {
  const { trebonsko, mimo_trebonsko, neurceno } = soucty;
  if (trebonsko === null || mimo_trebonsko === null || neurceno === null) {
    return { trebonsko: null, mimo_trebonsko: null, neurceno: null };
  }
  const soucet = trebonsko + mimo_trebonsko + neurceno;
  if (soucet === 0) {
    return { trebonsko: null, mimo_trebonsko: null, neurceno: null };
  }
  return {
    trebonsko: (100 * trebonsko) / soucet,
    mimo_trebonsko: (100 * mimo_trebonsko) / soucet,
    neurceno: (100 * neurceno) / soucet,
  };
}

export function sestavitGeografiiGrafy(
  blok: GeografieNavstev | undefined,
  referencniCas: Date,
): GeografieGrafyAdmin {
  const dnes = isoDenZData(dnesVPraze(referencniCas));
  const podklady = {} as GeografieGrafyAdmin;

  for (const obdobi of GEOGRAFIE_OBDOBI) {
    podklady[obdobi] = sestavitObdobiGeografie(blok, dnes, obdobi);
  }

  return podklady;
}

function sestavitObdobiGeografie(
  blok: GeografieNavstev | undefined,
  dnes: string,
  obdobi: GeografieObdobi,
): GeografieObdobiPodklady {
  const poMesicich = obdobi === 365;
  const dny = oknoDnuGeografie(dnes, obdobi);
  const body = skupinyDnuGeografie(dny, poMesicich).map((skupina) => {
    let trebonsko = 0;
    let mimo = 0;
    let neurceno = 0;
    let dostupnych = 0;
    for (const den of skupina.dny) {
      const hodnoty = denGeografie(blok, den, dnes);
      if (!hodnoty) {
        continue;
      }
      dostupnych += 1;
      trebonsko += hodnoty.trebonsko;
      mimo += hodnoty.mimo_trebonsko;
      neurceno += hodnoty.neurceno;
    }
    const bod: BodGeografieGrafu = {
      od: skupina.dny[0] ?? "",
      do: skupina.dny[skupina.dny.length - 1] ?? "",
      rok: skupina.rok,
      mesic: skupina.mesic,
      den: skupina.dny.length === 1 ? Number(skupina.dny[0]?.slice(8, 10)) : null,
      pocetDnu: skupina.dny.length,
      nedostupnychDnu: skupina.dny.length - dostupnych,
      trebonsko: dostupnych === 0 ? null : trebonsko,
      mimo_trebonsko: dostupnych === 0 ? null : mimo,
      neurceno: dostupnych === 0 ? null : neurceno,
    };
    return bod;
  });
  const soucty: SouctyGeografieGrafu = {
    trebonsko: soucetGeografie(body, "trebonsko"),
    mimo_trebonsko: soucetGeografie(body, "mimo_trebonsko"),
    neurceno: soucetGeografie(body, "neurceno"),
  };

  return {
    obdobi,
    rozliseni: poMesicich ? "mesic" : "den",
    okno: { od: dny[0] ?? "", do: dny[dny.length - 1] ?? "" },
    body,
    soucty,
    procenta: procentaGeografie(soucty),
  };
}

function pripojitGeografii(
  cisla: Omit<MetrikySouhrn, "geografie">,
  blok: GeografieNavstev | undefined,
  referencniCas: Date,
): MetrikySouhrn {
  return {
    ...cisla,
    geografie: sestavitGeografiiGrafy(blok, referencniCas),
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
    case "klik_na_branu":
      agregovane.pocetKliknutiNaBranu = (agregovane.pocetKliknutiNaBranu ?? 0) + 1;
      break;
    case "povoleno_upozorneni":
      agregovane.pocetPovolenychUpozorneni += 1;
      break;
    case "klik_pridat_na_plochu":
      agregovane.pocetKliknutiPridatNaPlochu =
        (agregovane.pocetKliknutiPridatNaPlochu ?? 0) + 1;
      break;
    case "navsteva_standalone":
      agregovane.pocetNavstevZePlochy =
        (agregovane.pocetNavstevZePlochy ?? 0) + 1;
      break;
    case "replay_prolnuti":
      agregovane.pocetReplayProlnuti = (agregovane.pocetReplayProlnuti ?? 0) + 1;
      break;
    case "odchod_navstevy":
      break;
  }
}

function jePlatnyOdchod(odchod: unknown): odchod is KategorieOdchoduNavstevy {
  return odchod === "pribeh" || odchod === "chci_se_vracet" || odchod === "ostatni";
}

/** Aplikuje odchod návštěvy – samostatně od globálních counterů */
export function aplikovatChovaniNavstevy(
  uloziste: UlozisteDat,
  payload: PayloadMetriky
): void {
  if (payload.typ !== "odchod_navstevy") {
    return;
  }

  if (
    typeof payload.delkaMs !== "number" ||
    !Number.isFinite(payload.delkaMs) ||
    payload.delkaMs < 0 ||
    payload.delkaMs > 3_600_000 ||
    !jePlatnyOdchod(payload.odchod)
  ) {
    return;
  }

  aplikovatOdchodNavstevy(uloziste, Math.round(payload.delkaMs), payload.odchod);
}

/** Zajistí agregované metriky – migruje staré pole metriky[] pokud existuje */
export function zajistitMetrikyAgregovane(uloziste: UlozisteDat): MetrikyAgregovane {
  if (uloziste.metrikyAgregovane) {
    uloziste.metrikyAgregovane.pocetReplayProlnuti ??= 0;
    uloziste.metrikyAgregovane.pocetKliknutiNaBranu ??= 0;
    uloziste.metrikyAgregovane.pocetKliknutiPridatNaPlochu ??= 0;
    uloziste.metrikyAgregovane.pocetNavstevZePlochy ??= 0;
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
export function agregovatSouhrnMetrik(
  metriky: ZaznamMetriky[],
  referencniCas: Date = new Date(),
): MetrikySouhrn {
  return pripojitGeografii(
    souhrnZAgregovanych(migrovatLegacyMetriky(metriky)),
    undefined,
    referencniCas,
  );
}

/** Aplikuje dávku událostí na úložiště v paměti */
export function aplikovatMetriky(
  uloziste: UlozisteDat,
  udalosti: PayloadMetriky[],
  oblast?: BranaAnalytikaOblast,
  referencniCas: Date = new Date(),
): void {
  const agregovane = zajistitMetrikyAgregovane(uloziste);
  for (const udalost of udalosti) {
    if (udalost.typ === "navsteva" && udalost.navstevnikId) {
      aplikovatKomunitaNavstevu(uloziste, udalost.navstevnikId);
    }
    if (udalost.typ === "odchod_navstevy") {
      aplikovatChovaniNavstevy(uloziste, udalost);
      continue;
    }
    aplikovatMetriku(agregovane, udalost);
    if (udalost.typ === "navsteva" && oblast) {
      pricistGeografiiNavstevy(uloziste, oblast, referencniCas);
    }
  }
  aplikovatAnalyticsBatch(uloziste, udalosti);
}

/** Souhrn metrik z načteného úložiště */
export function ziskatSouhrnZUloziste(
  uloziste: UlozisteDat,
  referencniCas: Date = new Date(),
): MetrikySouhrn {
  return pripojitGeografii(
    souhrnZAgregovanych(zajistitMetrikyAgregovane(uloziste)),
    uloziste.geografieNavstev,
    referencniCas,
  );
}

/** Zaznamená dávku událostí – jeden get + put na Blob */
export async function zaznamenatMetrikyBatch(
  udalosti: PayloadMetriky[],
  oidcZHeaderu?: string | null,
  oblast?: BranaAnalytikaOblast,
): Promise<void> {
  if (udalosti.length === 0) {
    return;
  }

  await upravitData((uloziste) => {
    aplikovatMetriky(uloziste, udalosti, oblast);
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
      const predchozi = existujici >= 0 ? uloziste.pushOdbery[existujici] : null;

      const zaznam: PushOdber = {
        endpoint: data.endpoint,
        klicP256dh: data.klicP256dh,
        klicAuth: data.klicAuth,
        vytvoreno: predchozi?.vytvoreno ?? new Date().toISOString(),
      };

      if (volby?.zarizeni && jePlatneZarizeni(volby.zarizeni)) {
        zaznam.zarizeni = volby.zarizeni;
      } else if (predchozi?.zarizeni) {
        zaznam.zarizeni = predchozi.zarizeni;
      }

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
