import { dnesVPraze, pridatDny, type BranaDatum } from "@/lib/brana/cas";
import {
  BRANA_ANALYTIKA_MAX_DNU,
  BRANA_ANALYTIKA_POHLEDY,
  isoDenZData,
  type BranaAnalytikaDen,
  type BranaAnalytikaDokument,
  type BranaAnalytikaPohled,
} from "./model";

/** Období budoucích grafů. Výchozí je 30 dní. */
export const BRANA_ANALYTIKA_GRAF_OBDOBI = [7, 30, 90, 365] as const;
export const BRANA_ANALYTIKA_GRAF_VYCHOZI_OBDOBI = 30;

export type BranaAnalytikaGrafObdobi = (typeof BRANA_ANALYTIKA_GRAF_OBDOBI)[number];

/**
 * Bod řady. Nula v `hodnota` je naměřená nula.
 * `hodnota: null` znamená, že den už v uchování není a nesmí se kreslit jako nula.
 */
export type BodPoctuGrafu = {
  od: string;
  do: string;
  rok: number;
  mesic: number;
  den: number | null;
  pocetDnu: number;
  nedostupnychDnu: number;
  hodnota: number | null;
};

/** Procházení. `procento: null` znamená, že delší seznam v bodu nebyl. */
export type BodProchazeniGrafu = {
  od: string;
  do: string;
  rok: number;
  mesic: number;
  den: number | null;
  pocetDnu: number;
  nedostupnychDnu: number;
  delsi: number | null;
  konec: number | null;
  procento: number | null;
};

export type OknoGrafu = {
  od: string;
  do: string;
  pocetDnu: number;
};

export type SouctyGeografieGrafu = {
  trebonsko: number | null;
  mimo_trebonsko: number | null;
  neurceno: number | null;
};

export type SouctyZarizeniGrafu = {
  android: number | null;
  ios: number | null;
  pocitac: number | null;
  ostatni: number | null;
};

export type SoucetProchazeniGrafu = {
  delsi: number | null;
  konec: number | null;
  procento: number | null;
};

export type PodkladyGrafuBrany = {
  obdobi: BranaAnalytikaGrafObdobi;
  dnes: string;
  rozliseni: "den" | "mesic";
  okno: OknoGrafu;
  predchoziOkno: OknoGrafu | null;
  navstevnost: {
    aktualni: BodPoctuGrafu[];
    predchozi: BodPoctuGrafu[] | null;
    soucet: number | null;
    soucetPredchozi: number | null;
    zmenaProcent: number | null;
  };
  navratovost: {
    novi: BodPoctuGrafu[];
    vracejici: BodPoctuGrafu[];
    soucetNovi: number | null;
    soucetVracejici: number | null;
  };
  spusteni: {
    ikona: BodPoctuGrafu[];
    prohlizec: BodPoctuGrafu[];
    soucetIkona: number | null;
    soucetProhlizec: number | null;
  };
  zarizeni: {
    mereniOd: string | null;
    android: BodPoctuGrafu[];
    ios: BodPoctuGrafu[];
    pocitac: BodPoctuGrafu[];
    ostatni: BodPoctuGrafu[];
    soucty: SouctyZarizeniGrafu;
    procenta: SouctyZarizeniGrafu;
  };
  geografie: {
    trebonsko: BodPoctuGrafu[];
    mimo_trebonsko: BodPoctuGrafu[];
    neurceno: BodPoctuGrafu[];
    soucty: SouctyGeografieGrafu;
    procenta: SouctyGeografieGrafu;
  };
  kalendar: {
    rady: Record<BranaAnalytikaPohled, BodPoctuGrafu[]>;
    soucty: Record<BranaAnalytikaPohled, number | null>;
  };
  prochazeni: {
    rady: Record<BranaAnalytikaPohled, BodProchazeniGrafu[]>;
    soucty: Record<BranaAnalytikaPohled, SoucetProchazeniGrafu>;
  };
  sdileni: {
    klik: BodPoctuGrafu[];
    prichod: BodPoctuGrafu[];
    soucetKlik: number | null;
    soucetPrichod: number | null;
  };
  proklikTrebon: {
    klik: BodPoctuGrafu[];
    soucet: number | null;
  };
  qr: {
    celkem: BodPoctuGrafu[];
    desktop: BodPoctuGrafu[];
    soucetCelkem: number | null;
    soucetDesktop: number | null;
  };
};

type MetrikyDne = {
  navstevy: number;
  novi: number;
  vracejici: number;
  ikona: number;
  prohlizec: number;
  trebonsko: number;
  mimo_trebonsko: number;
  neurceno: number;
  pohledy: Record<BranaAnalytikaPohled, number>;
  prochazeni: Record<BranaAnalytikaPohled, { delsi: number; konec: number }>;
  sdileniKlik: number;
  sdileni: number;
  proklikTrebon: number;
  qr: number;
  qrDesktop: number;
};

function datumZIso(iso: string): BranaDatum {
  const [rok, mesic, den] = iso.split("-").map(Number);
  return { rok, mesic, den };
}

function posunDen(iso: string, dny: number): string {
  return isoDenZData(pridatDny(datumZIso(iso), dny));
}

/** Nejstarší den, který dokument ještě smí držet. Starší údaj už není dostupný. */
export function hraniceUchovaniGrafu(dnesIso: string): string {
  return posunDen(dnesIso, -(BRANA_ANALYTIKA_MAX_DNU - 1));
}

export function jeDenDostupnyProGraf(den: string, dnesIso: string): boolean {
  return den >= hraniceUchovaniGrafu(dnesIso) && den <= dnesIso;
}

function oknoDnu(konecIso: string, pocet: number): string[] {
  const zacatek = posunDen(konecIso, -(pocet - 1));
  return Array.from({ length: pocet }, (_, poradi) => posunDen(zacatek, poradi));
}

function popisOkna(dny: readonly string[]): OknoGrafu {
  return {
    od: dny[0] ?? "",
    do: dny[dny.length - 1] ?? "",
    pocetDnu: dny.length,
  };
}

function prazdneMetriky(): MetrikyDne {
  const pohledy = {} as Record<BranaAnalytikaPohled, number>;
  const prochazeni = {} as Record<BranaAnalytikaPohled, { delsi: number; konec: number }>;
  for (const pohled of BRANA_ANALYTIKA_POHLEDY) {
    pohledy[pohled] = 0;
    prochazeni[pohled] = { delsi: 0, konec: 0 };
  }

  return {
    navstevy: 0,
    novi: 0,
    vracejici: 0,
    ikona: 0,
    prohlizec: 0,
    trebonsko: 0,
    mimo_trebonsko: 0,
    neurceno: 0,
    pohledy,
    prochazeni,
    sdileniKlik: 0,
    sdileni: 0,
    proklikTrebon: 0,
    qr: 0,
    qrDesktop: 0,
  };
}

function metrikyZDne(den: BranaAnalytikaDen): MetrikyDne {
  const pohledy = {} as Record<BranaAnalytikaPohled, number>;
  const prochazeni = {} as Record<BranaAnalytikaPohled, { delsi: number; konec: number }>;
  for (const pohled of BRANA_ANALYTIKA_POHLEDY) {
    pohledy[pohled] = den.pohledy[pohled].prvni + den.pohledy[pohled].dalsi;
    prochazeni[pohled] = {
      delsi: den.prochazeni[pohled].delsi,
      konec: den.prochazeni[pohled].konec,
    };
  }

  return {
    navstevy: den.navstevy,
    novi: den.novi,
    vracejici: den.vracejici,
    ikona: den.spusteni.ikona,
    prohlizec: den.spusteni.prohlizec,
    trebonsko: den.oblast.trebonsko,
    mimo_trebonsko: den.oblast.mimo_trebonsko,
    neurceno: den.oblast.neurceno,
    pohledy,
    prochazeni,
    sdileniKlik: den.sdileniKlik,
    sdileni: den.zdroje.sdileni,
    proklikTrebon: den.proklikTrebon,
    qr: den.zdroje.qr,
    qrDesktop: den.qrDesktop,
  };
}

function metrikyDokumentu(
  dokument: BranaAnalytikaDokument,
  den: string,
  dnesIso: string,
): MetrikyDne | null {
  if (!jeDenDostupnyProGraf(den, dnesIso)) {
    return null;
  }
  const ulozeny = dokument.dny[den];
  return ulozeny ? metrikyZDne(ulozeny) : prazdneMetriky();
}

function procentoProchazeni(konec: number, delsi: number): number | null {
  if (delsi === 0) {
    return null;
  }
  return (100 * konec) / delsi;
}

function zmenaProcent(aktualni: number | null, predchozi: number | null): number | null {
  if (aktualni === null || predchozi === null || predchozi === 0) {
    return null;
  }
  return (100 * (aktualni - predchozi)) / predchozi;
}

function podilyGeografie(
  trebonsko: number | null,
  mimo: number | null,
  neurceno: number | null,
): SouctyGeografieGrafu {
  if (trebonsko === null || mimo === null || neurceno === null) {
    return { trebonsko: null, mimo_trebonsko: null, neurceno: null };
  }
  const soucet = trebonsko + mimo + neurceno;
  if (soucet === 0) {
    return { trebonsko: null, mimo_trebonsko: null, neurceno: null };
  }
  return {
    trebonsko: (100 * trebonsko) / soucet,
    mimo_trebonsko: (100 * mimo) / soucet,
    neurceno: (100 * neurceno) / soucet,
  };
}

function podilyZarizeni(
  android: number | null,
  ios: number | null,
  pocitac: number | null,
  ostatni: number | null,
): SouctyZarizeniGrafu {
  if (android === null || ios === null || pocitac === null || ostatni === null) {
    return { android: null, ios: null, pocitac: null, ostatni: null };
  }
  const soucet = android + ios + pocitac + ostatni;
  if (soucet === 0) {
    return { android: null, ios: null, pocitac: null, ostatni: null };
  }
  return {
    android: (100 * android) / soucet,
    ios: (100 * ios) / soucet,
    pocitac: (100 * pocitac) / soucet,
    ostatni: (100 * ostatni) / soucet,
  };
}

function soucetHodnot(body: readonly BodPoctuGrafu[]): number | null {
  let soucet = 0;
  let dostupnych = 0;
  for (const bod of body) {
    if (bod.hodnota === null) {
      continue;
    }
    dostupnych += 1;
    soucet += bod.hodnota;
  }
  return dostupnych === 0 ? null : soucet;
}

type SkupinaDnu = {
  rok: number;
  mesic: number;
  dny: string[];
};

function skupinyDnu(dny: readonly string[], poMesicich: boolean): SkupinaDnu[] {
  if (!poMesicich) {
    return dny.map((den) => ({
      rok: Number(den.slice(0, 4)),
      mesic: Number(den.slice(5, 7)),
      dny: [den],
    }));
  }

  const skupiny: SkupinaDnu[] = [];
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

function bodPoctu(
  skupina: SkupinaDnu,
  dokument: BranaAnalytikaDokument,
  dnesIso: string,
  vyber: (metriky: MetrikyDne) => number,
): BodPoctuGrafu {
  let soucet = 0;
  let dostupnych = 0;
  for (const den of skupina.dny) {
    const metriky = metrikyDokumentu(dokument, den, dnesIso);
    if (!metriky) {
      continue;
    }
    dostupnych += 1;
    soucet += vyber(metriky);
  }

  return {
    od: skupina.dny[0] ?? "",
    do: skupina.dny[skupina.dny.length - 1] ?? "",
    rok: skupina.rok,
    mesic: skupina.mesic,
    den: skupina.dny.length === 1 ? Number(skupina.dny[0]?.slice(8, 10)) : null,
    pocetDnu: skupina.dny.length,
    nedostupnychDnu: skupina.dny.length - dostupnych,
    hodnota: dostupnych === 0 ? null : soucet,
  };
}

function radaPoctu(
  dny: readonly string[],
  poMesicich: boolean,
  dokument: BranaAnalytikaDokument,
  dnesIso: string,
  vyber: (metriky: MetrikyDne) => number,
): BodPoctuGrafu[] {
  return skupinyDnu(dny, poMesicich).map((skupina) =>
    bodPoctu(skupina, dokument, dnesIso, vyber),
  );
}

/**
 * Den před začátkem měření nemá číslo. Naměřená nula je až od uloženého data.
 * Chybějící den po začátku měření je nula, stejně jako u ostatních grafů.
 */
function bodZarizeni(
  skupina: SkupinaDnu,
  dokument: BranaAnalytikaDokument,
  dnesIso: string,
  mereniOd: string | null,
  vyber: (den: BranaAnalytikaDen) => number,
): BodPoctuGrafu {
  let soucet = 0;
  let merenych = 0;
  let mimoMereni = 0;
  for (const den of skupina.dny) {
    if (!jeDenDostupnyProGraf(den, dnesIso)) {
      mimoMereni += 1;
      continue;
    }
    if (!mereniOd || den < mereniOd) {
      mimoMereni += 1;
      continue;
    }
    merenych += 1;
    const ulozeny = dokument.dny[den];
    soucet += ulozeny ? vyber(ulozeny) : 0;
  }

  return {
    od: skupina.dny[0] ?? "",
    do: skupina.dny[skupina.dny.length - 1] ?? "",
    rok: skupina.rok,
    mesic: skupina.mesic,
    den: skupina.dny.length === 1 ? Number(skupina.dny[0]?.slice(8, 10)) : null,
    pocetDnu: skupina.dny.length,
    nedostupnychDnu: mimoMereni,
    hodnota: merenych === 0 ? null : soucet,
  };
}

function radaZarizeni(
  dny: readonly string[],
  poMesicich: boolean,
  dokument: BranaAnalytikaDokument,
  dnesIso: string,
  mereniOd: string | null,
  vyber: (den: BranaAnalytikaDen) => number,
): BodPoctuGrafu[] {
  return skupinyDnu(dny, poMesicich).map((skupina) =>
    bodZarizeni(skupina, dokument, dnesIso, mereniOd, vyber),
  );
}

function bodProchazeni(
  skupina: SkupinaDnu,
  dokument: BranaAnalytikaDokument,
  dnesIso: string,
  pohled: BranaAnalytikaPohled,
): BodProchazeniGrafu {
  let delsi = 0;
  let konec = 0;
  let dostupnych = 0;
  for (const den of skupina.dny) {
    const metriky = metrikyDokumentu(dokument, den, dnesIso);
    if (!metriky) {
      continue;
    }
    dostupnych += 1;
    delsi += metriky.prochazeni[pohled].delsi;
    konec += metriky.prochazeni[pohled].konec;
  }

  return {
    od: skupina.dny[0] ?? "",
    do: skupina.dny[skupina.dny.length - 1] ?? "",
    rok: skupina.rok,
    mesic: skupina.mesic,
    den: skupina.dny.length === 1 ? Number(skupina.dny[0]?.slice(8, 10)) : null,
    pocetDnu: skupina.dny.length,
    nedostupnychDnu: skupina.dny.length - dostupnych,
    delsi: dostupnych === 0 ? null : delsi,
    konec: dostupnych === 0 ? null : konec,
    procento: dostupnych === 0 ? null : procentoProchazeni(konec, delsi),
  };
}

function soucetProchazeni(body: readonly BodProchazeniGrafu[]): SoucetProchazeniGrafu {
  let delsi = 0;
  let konec = 0;
  let dostupnych = 0;
  for (const bod of body) {
    if (bod.delsi === null || bod.konec === null) {
      continue;
    }
    dostupnych += 1;
    delsi += bod.delsi;
    konec += bod.konec;
  }
  if (dostupnych === 0) {
    return { delsi: null, konec: null, procento: null };
  }
  return { delsi, konec, procento: procentoProchazeni(konec, delsi) };
}

/**
 * Návštěvy jednoho dne. Null znamená, že den už v uchování není.
 * Chybějící den uvnitř uchování je naměřená nula.
 */
export function hodnotaNavstevZaDen(
  dokument: BranaAnalytikaDokument,
  den: string,
  dnesIso: string,
): number | null {
  const metriky = metrikyDokumentu(dokument, den, dnesIso);
  return metriky ? metriky.navstevy : null;
}

/**
 * Sestaví řady grafů z denního dokumentu.
 * Rok je 365 dní po kalendářních měsících a nemá předchozí období.
 * Zařízení před uloženým začátkem měření zůstávají prázdná, ne nulová.
 */
export function sestavitPodkladyGrafu(
  dokument: BranaAnalytikaDokument,
  referencniCas: Date,
  obdobi: BranaAnalytikaGrafObdobi = BRANA_ANALYTIKA_GRAF_VYCHOZI_OBDOBI,
): PodkladyGrafuBrany {
  const dnes = isoDenZData(dnesVPraze(referencniCas));
  const poMesicich = obdobi === 365;
  const aktualniDny = oknoDnu(dnes, obdobi);
  const predchoziDny = poMesicich
    ? null
    : oknoDnu(posunDen(aktualniDny[0] ?? dnes, -1), obdobi);

  const rada = (
    dny: readonly string[],
    vyber: (metriky: MetrikyDne) => number,
  ): BodPoctuGrafu[] => radaPoctu(dny, poMesicich, dokument, dnes, vyber);

  const navstevy = rada(aktualniDny, (metriky) => metriky.navstevy);
  const navstevyPredchozi = predchoziDny
    ? radaPoctu(predchoziDny, false, dokument, dnes, (metriky) => metriky.navstevy)
    : null;
  const soucet = soucetHodnot(navstevy);
  const soucetPredchozi = navstevyPredchozi ? soucetHodnot(navstevyPredchozi) : null;

  const novi = rada(aktualniDny, (metriky) => metriky.novi);
  const vracejici = rada(aktualniDny, (metriky) => metriky.vracejici);
  const ikona = rada(aktualniDny, (metriky) => metriky.ikona);
  const prohlizec = rada(aktualniDny, (metriky) => metriky.prohlizec);
  const mereniOd = dokument.zarizeniMereniOd ?? null;
  const radaZarizeniObdobi = (
    vyber: (den: BranaAnalytikaDen) => number,
  ): BodPoctuGrafu[] =>
    radaZarizeni(aktualniDny, poMesicich, dokument, dnes, mereniOd, vyber);
  const android = radaZarizeniObdobi((den) => den.zarizeni.android);
  const ios = radaZarizeniObdobi((den) => den.zarizeni.ios);
  const pocitac = radaZarizeniObdobi((den) => den.zarizeni.pocitac);
  const ostatniZarizeni = radaZarizeniObdobi((den) => den.zarizeni.ostatni);
  const souctyZarizeni = {
    android: soucetHodnot(android),
    ios: soucetHodnot(ios),
    pocitac: soucetHodnot(pocitac),
    ostatni: soucetHodnot(ostatniZarizeni),
  };
  const trebonsko = rada(aktualniDny, (metriky) => metriky.trebonsko);
  const mimo = rada(aktualniDny, (metriky) => metriky.mimo_trebonsko);
  const neurceno = rada(aktualniDny, (metriky) => metriky.neurceno);
  const souctyGeografie = {
    trebonsko: soucetHodnot(trebonsko),
    mimo_trebonsko: soucetHodnot(mimo),
    neurceno: soucetHodnot(neurceno),
  };

  const kalendarRady = {} as Record<BranaAnalytikaPohled, BodPoctuGrafu[]>;
  const kalendarSoucty = {} as Record<BranaAnalytikaPohled, number | null>;
  const prochazeniRady = {} as Record<BranaAnalytikaPohled, BodProchazeniGrafu[]>;
  const prochazeniSoucty = {} as Record<BranaAnalytikaPohled, SoucetProchazeniGrafu>;
  for (const pohled of BRANA_ANALYTIKA_POHLEDY) {
    kalendarRady[pohled] = rada(aktualniDny, (metriky) => metriky.pohledy[pohled]);
    kalendarSoucty[pohled] = soucetHodnot(kalendarRady[pohled]);
    prochazeniRady[pohled] = skupinyDnu(aktualniDny, poMesicich).map((skupina) =>
      bodProchazeni(skupina, dokument, dnes, pohled),
    );
    prochazeniSoucty[pohled] = soucetProchazeni(prochazeniRady[pohled]);
  }

  const klik = rada(aktualniDny, (metriky) => metriky.sdileniKlik);
  const prichod = rada(aktualniDny, (metriky) => metriky.sdileni);
  const proklikTrebon = rada(aktualniDny, (metriky) => metriky.proklikTrebon);
  const qrCelkem = rada(aktualniDny, (metriky) => metriky.qr);
  const qrDesktop = rada(aktualniDny, (metriky) => metriky.qrDesktop);

  return {
    obdobi,
    dnes,
    rozliseni: poMesicich ? "mesic" : "den",
    okno: popisOkna(aktualniDny),
    predchoziOkno: predchoziDny ? popisOkna(predchoziDny) : null,
    navstevnost: {
      aktualni: navstevy,
      predchozi: navstevyPredchozi,
      soucet,
      soucetPredchozi,
      zmenaProcent: zmenaProcent(soucet, soucetPredchozi),
    },
    navratovost: {
      novi,
      vracejici,
      soucetNovi: soucetHodnot(novi),
      soucetVracejici: soucetHodnot(vracejici),
    },
    spusteni: {
      ikona,
      prohlizec,
      soucetIkona: soucetHodnot(ikona),
      soucetProhlizec: soucetHodnot(prohlizec),
    },
    zarizeni: {
      mereniOd,
      android,
      ios,
      pocitac,
      ostatni: ostatniZarizeni,
      soucty: souctyZarizeni,
      procenta: podilyZarizeni(
        souctyZarizeni.android,
        souctyZarizeni.ios,
        souctyZarizeni.pocitac,
        souctyZarizeni.ostatni,
      ),
    },
    geografie: {
      trebonsko,
      mimo_trebonsko: mimo,
      neurceno,
      soucty: souctyGeografie,
      procenta: podilyGeografie(
        souctyGeografie.trebonsko,
        souctyGeografie.mimo_trebonsko,
        souctyGeografie.neurceno,
      ),
    },
    kalendar: {
      rady: kalendarRady,
      soucty: kalendarSoucty,
    },
    prochazeni: {
      rady: prochazeniRady,
      soucty: prochazeniSoucty,
    },
    sdileni: {
      klik,
      prichod,
      soucetKlik: soucetHodnot(klik),
      soucetPrichod: soucetHodnot(prichod),
    },
    proklikTrebon: {
      klik: proklikTrebon,
      soucet: soucetHodnot(proklikTrebon),
    },
    qr: {
      celkem: qrCelkem,
      desktop: qrDesktop,
      soucetCelkem: soucetHodnot(qrCelkem),
      soucetDesktop: soucetHodnot(qrDesktop),
    },
  };
}
