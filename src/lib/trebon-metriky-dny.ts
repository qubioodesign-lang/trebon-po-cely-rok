import { dnesVPraze, pridatDny, type BranaDatum } from "@/lib/brana/cas";
import { jeDenDostupnyProGraf } from "@/lib/brana/analytika/grafy";
import { BRANA_ANALYTIKA_MAX_DNU, isoDenZData } from "@/lib/brana/analytika/model";
import type {
  BodMetrikDne,
  MetrikyDnuObdobi,
  MetrikyDnuObdobiPodklady,
  MetrikyPoDnechGrafy,
  SouctyMetrikDne,
} from "@/types";
import { METRIKY_DNU_OBDOBI, METRIKY_DNU_RADY } from "@/types";
import type { PayloadMetriky } from "@/types";
import type {
  MetrikyDenPoDnech,
  MetrikyPoDnech,
  UlozisteDat,
} from "./uloziste-dat";

const KLIC_DNE = /^\d{4}-\d{2}-\d{2}$/;

const SLEDOVANE_TYPY = new Set<PayloadMetriky["typ"]>([
  "navsteva",
  "navsteva_standalone",
  "klik_chci_se_vracet",
  "klik_pridat_na_plochu",
]);

function datumZIso(iso: string): BranaDatum {
  const [rok, mesic, den] = iso.split("-").map(Number);
  return { rok, mesic, den };
}

function posunDen(iso: string, dny: number): string {
  return isoDenZData(pridatDny(datumZIso(iso), dny));
}

function oknoDnu(konecIso: string, pocet: number): string[] {
  const zacatek = posunDen(konecIso, -(pocet - 1));
  return Array.from({ length: pocet }, (_, poradi) => posunDen(zacatek, poradi));
}

function nezaporne(hodnota: unknown): number {
  return typeof hodnota === "number" && Number.isFinite(hodnota) && hodnota >= 0
    ? hodnota
    : 0;
}

function prazdnyDen(): MetrikyDenPoDnech {
  return {
    navstevy: 0,
    navstevniciNovi: 0,
    navstevniciVracejici: 0,
    navstevyZIkony: 0,
    klikChciSeVracet: 0,
    klikPridatNaPlochu: 0,
  };
}

function denZeUlozeneho(ulozeny: MetrikyDenPoDnech | undefined): MetrikyDenPoDnech {
  return {
    navstevy: nezaporne(ulozeny?.navstevy),
    navstevniciNovi: nezaporne(ulozeny?.navstevniciNovi),
    navstevniciVracejici: nezaporne(ulozeny?.navstevniciVracejici),
    navstevyZIkony: nezaporne(ulozeny?.navstevyZIkony),
    klikChciSeVracet: nezaporne(ulozeny?.klikChciSeVracet),
    klikPridatNaPlochu: nezaporne(ulozeny?.klikPridatNaPlochu),
  };
}

function orezatDny(
  dny: Record<string, MetrikyDenPoDnech>,
  referencniCas: Date,
): Record<string, MetrikyDenPoDnech> {
  const dnes = isoDenZData(dnesVPraze(referencniCas));
  const hranice = isoDenZData(
    pridatDny(dnesVPraze(referencniCas), -(BRANA_ANALYTIKA_MAX_DNU - 1)),
  );
  const vysledek: Record<string, MetrikyDenPoDnech> = {};
  for (const [klic, den] of Object.entries(dny)) {
    if (!KLIC_DNE.test(klic) || klic < hranice || klic > dnes) {
      continue;
    }
    vysledek[klic] = denZeUlozeneho(den);
  }
  return vysledek;
}

function prahovyDen(iso: string): string | null {
  const cas = new Date(iso);
  if (Number.isNaN(cas.getTime())) {
    return null;
  }
  const den = isoDenZData(dnesVPraze(cas));
  return KLIC_DNE.test(den) ? den : null;
}

/**
 * Nový, vracející se, nebo už dnes započítaný.
 * Čte stav před přičtením komunity. Druhá návštěva téhož pražského dne lidi nezvýší.
 * Chybějící čas poslední návštěvy u člověka s historií je vracející se.
 * Nečitelný čas se nehádá a člověka v ten den nepřidá.
 */
export function klasifikaceNavstevnikaDne(
  uloziste: UlozisteDat,
  navstevnikId: string | undefined,
  referencniCas: Date,
): "novy" | "vracejici" | null {
  if (!navstevnikId) {
    return null;
  }

  const dnes = isoDenZData(dnesVPraze(referencniCas));
  const komunita = uloziste.komunitaNavstevnici?.[navstevnikId];
  const legacy = uloziste.metrikyAgregovane?.navstevyPodleNavstevnika?.[navstevnikId] ?? 0;
  const pocet = Math.max(nezaporne(komunita?.pocetNavstev), nezaporne(legacy));
  if (pocet <= 0) {
    return "novy";
  }
  if (!komunita?.posledniNavsteva) {
    return "vracejici";
  }

  const denPosledni = prahovyDen(komunita.posledniNavsteva);
  if (!denPosledni) {
    return null;
  }
  if (denPosledni === dnes) {
    return null;
  }
  return "vracejici";
}

/**
 * Přičte jednu sledovanou událost do pražského dne.
 * Blok vznikne až s první takovou událostí. Platné merenoOd se nemění.
 * Ostatní typy událostí nic nezapisují.
 */
export function pricistSledovanouMetrikuDne(
  uloziste: UlozisteDat,
  udalost: PayloadMetriky,
  referencniCas: Date,
  uzZapocteniLide: Set<string> = new Set(),
): void {
  if (!SLEDOVANE_TYPY.has(udalost.typ)) {
    return;
  }

  const dnes = isoDenZData(dnesVPraze(referencniCas));
  const stavajici = uloziste.metrikyPoDnech;
  if (!stavajici || !KLIC_DNE.test(stavajici.merenoOd)) {
    const maDny = Boolean(stavajici && Object.keys(stavajici.dny ?? {}).length > 0);
    if (maDny) {
      return;
    }
    uloziste.metrikyPoDnech = { merenoOd: dnes, dny: {} };
  }

  const blok = uloziste.metrikyPoDnech;
  if (!blok) {
    return;
  }

  if (dnes < blok.merenoOd) {
    return;
  }

  blok.dny = orezatDny(blok.dny ?? {}, referencniCas);
  const den = denZeUlozeneho(blok.dny[dnes]);

  if (udalost.typ === "navsteva") {
    den.navstevy += 1;
    const navstevnikId = udalost.navstevnikId;
    if (!(navstevnikId && uzZapocteniLide.has(navstevnikId))) {
      const klasifikace = klasifikaceNavstevnikaDne(uloziste, navstevnikId, referencniCas);
      if (klasifikace === "novy") {
        den.navstevniciNovi += 1;
      } else if (klasifikace === "vracejici") {
        den.navstevniciVracejici += 1;
      }
      if (navstevnikId) {
        uzZapocteniLide.add(navstevnikId);
      }
    }
  } else if (udalost.typ === "navsteva_standalone") {
    den.navstevyZIkony += 1;
  } else if (udalost.typ === "klik_chci_se_vracet") {
    den.klikChciSeVracet += 1;
  } else if (udalost.typ === "klik_pridat_na_plochu") {
    den.klikPridatNaPlochu += 1;
  }

  blok.dny[dnes] = den;
}

function denMereny(blok: MetrikyPoDnech | undefined, den: string, dnes: string): boolean {
  return Boolean(
    blok &&
      KLIC_DNE.test(blok.merenoOd) &&
      den >= blok.merenoOd &&
      jeDenDostupnyProGraf(den, dnes),
  );
}

function oknoJeKompletni(
  blok: MetrikyPoDnech | undefined,
  dny: readonly string[],
  dnes: string,
): boolean {
  return dny.length > 0 && dny.every((den) => denMereny(blok, den, dnes));
}

function hodnotaDne(
  blok: MetrikyPoDnech | undefined,
  den: string,
  dnes: string,
): MetrikyDenPoDnech | null {
  if (!denMereny(blok, den, dnes) || !blok) {
    return null;
  }
  return denZeUlozeneho(blok.dny?.[den]);
}

function skupinyDnu(
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

function bodyZDnu(
  blok: MetrikyPoDnech | undefined,
  dny: readonly string[],
  dnes: string,
  poMesicich: boolean,
): BodMetrikDne[] {
  return skupinyDnu(dny, poMesicich).map((skupina) => {
    const soucet = prazdnyDen();
    let dostupnych = 0;
    for (const den of skupina.dny) {
      const hodnoty = hodnotaDne(blok, den, dnes);
      if (!hodnoty) {
        continue;
      }
      dostupnych += 1;
      for (const klic of METRIKY_DNU_RADY) {
        soucet[klic] += hodnoty[klic];
      }
    }

    const bod: BodMetrikDne = {
      od: skupina.dny[0] ?? "",
      do: skupina.dny[skupina.dny.length - 1] ?? "",
      rok: skupina.rok,
      mesic: skupina.mesic,
      den: skupina.dny.length === 1 ? Number(skupina.dny[0]?.slice(8, 10)) : null,
      pocetDnu: skupina.dny.length,
      nedostupnychDnu: skupina.dny.length - dostupnych,
      navstevy: null,
      navstevniciNovi: null,
      navstevniciVracejici: null,
      navstevyZIkony: null,
      klikChciSeVracet: null,
      klikPridatNaPlochu: null,
    };
    if (dostupnych > 0) {
      for (const klic of METRIKY_DNU_RADY) {
        bod[klic] = soucet[klic];
      }
    }
    return bod;
  });
}

function souctyZBodu(body: readonly BodMetrikDne[]): SouctyMetrikDne {
  const soucty = {} as SouctyMetrikDne;
  for (const klic of METRIKY_DNU_RADY) {
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
    soucty[klic] = dostupnych === 0 ? null : soucet;
  }
  return soucty;
}

function zmenaProcent(aktualni: number | null, predchozi: number | null): number | null {
  if (aktualni === null || predchozi === null || predchozi === 0) {
    return null;
  }
  return (100 * (aktualni - predchozi)) / predchozi;
}

function zmenyRad(aktualni: SouctyMetrikDne, predchozi: SouctyMetrikDne): SouctyMetrikDne {
  const zmeny = {} as SouctyMetrikDne;
  for (const klic of METRIKY_DNU_RADY) {
    zmeny[klic] = zmenaProcent(aktualni[klic], predchozi[klic]);
  }
  return zmeny;
}

function sestavitObdobi(
  blok: MetrikyPoDnech | undefined,
  dnes: string,
  obdobi: MetrikyDnuObdobi,
): MetrikyDnuObdobiPodklady {
  const poMesicich = obdobi === 365;
  const dny = oknoDnu(dnes, obdobi);
  const body = bodyZDnu(blok, dny, dnes, poMesicich);
  const soucty = souctyZBodu(body);
  const merenoOd = blok && KLIC_DNE.test(blok.merenoOd) ? blok.merenoOd : null;

  let predchoziOkno: { od: string; do: string } | null = null;
  let souctyPredchozi: SouctyMetrikDne | null = null;
  let zmena: SouctyMetrikDne | null = null;

  if (!poMesicich && oknoJeKompletni(blok, dny, dnes)) {
    const predchoziDny = oknoDnu(posunDen(dny[0] ?? dnes, -1), obdobi);
    if (oknoJeKompletni(blok, predchoziDny, dnes)) {
      predchoziOkno = {
        od: predchoziDny[0] ?? "",
        do: predchoziDny[predchoziDny.length - 1] ?? "",
      };
      souctyPredchozi = souctyZBodu(bodyZDnu(blok, predchoziDny, dnes, false));
      zmena = zmenyRad(soucty, souctyPredchozi);
    }
  }

  return {
    obdobi,
    rozliseni: poMesicich ? "mesic" : "den",
    merenoOd,
    okno: { od: dny[0] ?? "", do: dny[dny.length - 1] ?? "" },
    predchoziOkno,
    body,
    soucty,
    souctyPredchozi,
    zmenaProcent: zmena,
  };
}

/** Čtyři období. Bez bloku jsou dny prázdné, ne nulové. */
export function sestavitMetrikyPoDnechGrafy(
  blok: MetrikyPoDnech | undefined,
  referencniCas: Date = new Date(),
): MetrikyPoDnechGrafy {
  const dnes = isoDenZData(dnesVPraze(referencniCas));
  const podklady = {} as MetrikyPoDnechGrafy;
  for (const obdobi of METRIKY_DNU_OBDOBI) {
    podklady[obdobi] = sestavitObdobi(blok, dnes, obdobi);
  }
  return podklady;
}

export function prazdneGrafyMetrikPoDnech(
  referencniCas: Date = new Date(),
): MetrikyPoDnechGrafy {
  return sestavitMetrikyPoDnechGrafy(undefined, referencniCas);
}
