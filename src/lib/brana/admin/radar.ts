/**
 * Jazyk a pure logika RADARU (výzkumné oddělení BRÁNY).
 * RADAR hledá. Člověk rozhoduje. BRÁNA publikuje.
 * Tento modul nic nezapisuje do Kalendáře, Nezařazených, Zdrojů ani Redakčního pořadí.
 */

import { dnesVPraze } from "@/lib/brana/cas";

export const BRANA_RADAR_VERZE_ULOZISTE = 1;

export const BRANA_RADAR_PUVOD_RUCNE_NALEZENO = "RUCNE_NALEZENO";
export const BRANA_RADAR_PUVOD_POUZITO = "RADAR_POUZITO";

export type BranaRadarPuvodHistorie =
  | typeof BRANA_RADAR_PUVOD_RUCNE_NALEZENO
  | typeof BRANA_RADAR_PUVOD_POUZITO;

/** Pracovní stopa inboxu. Fingerprint se neukládá na stopě – počítá se. */
export type BranaRadarPracovniStopa = {
  id: string;
  radarVstupId: string;
  datumOd: string;
  cas: string;
  nazev: string;
  kde: string;
  url: string;
  nalezenoAt: string;
};

export type BranaRadarSmazatOtisk = {
  klic: string;
  datumOd: string;
};

export type BranaRadarHistorieZaznam = {
  id: string;
  puvod: BranaRadarPuvodHistorie;
  datumOd: string;
  cas: string;
  nazev: string;
  kde: string;
  radarVstupId: string;
  url: string;
  rozhodnutoAt: string;
  nalezenoAt: string;
};

export type BranaRadarDokument = {
  verzeUloziste: number;
  pracovni: BranaRadarPracovniStopa[];
  smazatOtisky: BranaRadarSmazatOtisk[];
  historie: BranaRadarHistorieZaznam[];
  posledniBehAt: string | null;
};

export type BranaRadarRucniNalezVstup = {
  datumOd: string;
  cas: string;
  nazev: string;
  kde: string;
  url: string;
};

export type ValidaceRucnihoRadarNalezuVysledek =
  | { ok: true; nalez: BranaRadarRucniNalezVstup }
  | { ok: false; chyba: string };

const ISO_DEN = /^\d{4}-\d{2}-\d{2}$/;
const CAS = /^([01]\d|2[0-3]):[0-5]\d$/;
const CAS_SE_SEKUNDAMI = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

const NAZEV_MAX = 200;
const KDE_MAX = 200;
const URL_MAX = 2000;

function jePlatnyIsoDen(iso: string): boolean {
  if (!ISO_DEN.test(iso)) {
    return false;
  }
  const [y, m, d] = iso.split("-").map(Number);
  const datum = new Date(Date.UTC(y, m - 1, d));
  return (
    datum.getUTCFullYear() === y &&
    datum.getUTCMonth() + 1 === m &&
    datum.getUTCDate() === d
  );
}

function jeNeprazdnyText(hodnota: unknown): hodnota is string {
  return typeof hodnota === "string" && hodnota.trim().length > 0;
}

function jeText(hodnota: unknown): hodnota is string {
  return typeof hodnota === "string";
}

function normalizovatCas(surovy: string): string | null {
  const cas = surovy.trim();
  if (!cas) {
    return "";
  }
  if (CAS.test(cas)) {
    return cas;
  }
  if (CAS_SE_SEKUNDAMI.test(cas)) {
    return cas.slice(0, 5);
  }
  return null;
}

export function vychoziRadarDokument(): BranaRadarDokument {
  return {
    verzeUloziste: BRANA_RADAR_VERZE_ULOZISTE,
    pracovni: [],
    smazatOtisky: [],
    historie: [],
    posledniBehAt: null,
  };
}

export function validovatRucniRadarNalezVstup(
  vstup: unknown,
): ValidaceRucnihoRadarNalezuVysledek {
  if (!vstup || typeof vstup !== "object") {
    return { ok: false, chyba: "Neplatný vstup." };
  }

  const data = vstup as Record<string, unknown>;
  const datumOd = typeof data.datumOd === "string" ? data.datumOd.trim() : "";
  const casNormalizovany =
    typeof data.cas === "string" ? normalizovatCas(data.cas) : "";
  const nazev = typeof data.nazev === "string" ? data.nazev.trim() : "";
  const kde = typeof data.kde === "string" ? data.kde.trim() : "";
  const url = typeof data.url === "string" ? data.url.trim() : "";

  if (!jePlatnyIsoDen(datumOd)) {
    return { ok: false, chyba: "Vyplňte platné datum." };
  }
  if (casNormalizovany === null) {
    return { ok: false, chyba: "Čas musí být ve formátu HH:MM." };
  }
  if (!nazev) {
    return { ok: false, chyba: "Vyplňte CO / název." };
  }
  if (nazev.length > NAZEV_MAX) {
    return { ok: false, chyba: "CO / název je příliš dlouhý." };
  }
  if (kde.length > KDE_MAX) {
    return { ok: false, chyba: "KDE je příliš dlouhé." };
  }
  if (url.length > URL_MAX) {
    return { ok: false, chyba: "Zdroj / URL je příliš dlouhé." };
  }

  return {
    ok: true,
    nalez: {
      datumOd,
      cas: casNormalizovany,
      nazev,
      kde,
      url,
    },
  };
}

function jePlatnaPracovniStopa(
  hodnota: unknown,
): hodnota is BranaRadarPracovniStopa {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const n = hodnota as Record<string, unknown>;
  return (
    jeNeprazdnyText(n.id) &&
    jeNeprazdnyText(n.radarVstupId) &&
    jeNeprazdnyText(n.datumOd) &&
    jeText(n.cas) &&
    jeNeprazdnyText(n.nazev) &&
    jeText(n.kde) &&
    jeText(n.url) &&
    jeNeprazdnyText(n.nalezenoAt)
  );
}

function jePlatnySmazatOtisk(
  hodnota: unknown,
): hodnota is BranaRadarSmazatOtisk {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const n = hodnota as Record<string, unknown>;
  return jeNeprazdnyText(n.klic) && jeNeprazdnyText(n.datumOd);
}

function jePlatnyHistorieZaznam(
  hodnota: unknown,
): hodnota is BranaRadarHistorieZaznam {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const n = hodnota as Record<string, unknown>;
  return (
    jeNeprazdnyText(n.id) &&
    (n.puvod === BRANA_RADAR_PUVOD_RUCNE_NALEZENO ||
      n.puvod === BRANA_RADAR_PUVOD_POUZITO) &&
    jeNeprazdnyText(n.datumOd) &&
    jeText(n.cas) &&
    jeNeprazdnyText(n.nazev) &&
    jeText(n.kde) &&
    jeText(n.radarVstupId) &&
    jeText(n.url) &&
    jeNeprazdnyText(n.rozhodnutoAt) &&
    jeNeprazdnyText(n.nalezenoAt)
  );
}

function normalizovatPracovniStopu(
  n: BranaRadarPracovniStopa,
): BranaRadarPracovniStopa {
  return {
    id: n.id.trim(),
    radarVstupId: n.radarVstupId.trim(),
    datumOd: n.datumOd.trim(),
    cas: n.cas.trim(),
    nazev: n.nazev.trim(),
    kde: n.kde.trim(),
    url: n.url.trim(),
    nalezenoAt: n.nalezenoAt.trim(),
  };
}

function normalizovatSmazatOtisk(
  n: BranaRadarSmazatOtisk,
): BranaRadarSmazatOtisk {
  return {
    klic: n.klic,
    datumOd: n.datumOd.trim(),
  };
}

function normalizovatHistorieZaznam(
  n: BranaRadarHistorieZaznam,
): BranaRadarHistorieZaznam {
  return {
    id: n.id.trim(),
    puvod: n.puvod,
    datumOd: n.datumOd.trim(),
    cas: n.cas.trim(),
    nazev: n.nazev.trim(),
    kde: n.kde.trim(),
    radarVstupId: n.radarVstupId.trim(),
    url: n.url.trim(),
    rozhodnutoAt: n.rozhodnutoAt.trim(),
    nalezenoAt: n.nalezenoAt.trim(),
  };
}

/**
 * Parsuje Blob dokument RADARU.
 * Chybějící známá pole doplní prázdnou hodnotou, aby zápis historie
 * nezahodil pracovni / smazatOtisky / posledniBehAt.
 */
export function parsovatRadarDokument(
  parsed: unknown,
): BranaRadarDokument | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const root = parsed as {
    verzeUloziste?: unknown;
    pracovni?: unknown;
    smazatOtisky?: unknown;
    historie?: unknown;
    posledniBehAt?: unknown;
  };

  const pracovniSurove = root.pracovni === undefined ? [] : root.pracovni;
  const smazatSurove =
    root.smazatOtisky === undefined ? [] : root.smazatOtisky;
  const historieSurove = root.historie === undefined ? [] : root.historie;

  if (
    !Array.isArray(pracovniSurove) ||
    !pracovniSurove.every(jePlatnaPracovniStopa)
  ) {
    return null;
  }
  if (!Array.isArray(smazatSurove) || !smazatSurove.every(jePlatnySmazatOtisk)) {
    return null;
  }
  if (
    !Array.isArray(historieSurove) ||
    !historieSurove.every(jePlatnyHistorieZaznam)
  ) {
    return null;
  }

  if (
    root.posledniBehAt !== undefined &&
    root.posledniBehAt !== null &&
    typeof root.posledniBehAt !== "string"
  ) {
    return null;
  }

  const posledniBehAt =
    typeof root.posledniBehAt === "string" && root.posledniBehAt.trim()
      ? root.posledniBehAt.trim()
      : null;

  return {
    verzeUloziste:
      typeof root.verzeUloziste === "number"
        ? root.verzeUloziste
        : BRANA_RADAR_VERZE_ULOZISTE,
    pracovni: pracovniSurove.map(normalizovatPracovniStopu),
    smazatOtisky: smazatSurove.map(normalizovatSmazatOtisk),
    historie: historieSurove.map(normalizovatHistorieZaznam),
    posledniBehAt,
  };
}

/**
 * Ruční nález jde jen do historie. Pracovní inbox, otisky Smazat
 * a posledniBehAt se nemění. Kalendář se nevolá.
 */
export function pridatRucniNalezDoHistorie(
  dokument: BranaRadarDokument,
  nalez: BranaRadarRucniNalezVstup,
  args: { noveId: () => string; tedIso: string },
): BranaRadarDokument {
  const tedIso = args.tedIso.trim();
  const zaznam: BranaRadarHistorieZaznam = {
    id: args.noveId(),
    puvod: BRANA_RADAR_PUVOD_RUCNE_NALEZENO,
    datumOd: nalez.datumOd,
    cas: nalez.cas,
    nazev: nalez.nazev,
    kde: nalez.kde,
    radarVstupId: "",
    url: nalez.url,
    rozhodnutoAt: tedIso,
    nalezenoAt: tedIso,
  };

  return {
    verzeUloziste: BRANA_RADAR_VERZE_ULOZISTE,
    pracovni: dokument.pracovni.slice(),
    smazatOtisky: dokument.smazatOtisky.slice(),
    historie: [...dokument.historie, zaznam],
    posledniBehAt: dokument.posledniBehAt,
  };
}

/** Dnešní ISO den YYYY-MM-DD v Europe/Prague. */
export function radarDnesIso(okamzik: Date = new Date()): string {
  const d = dnesVPraze(okamzik);
  return `${d.rok}-${String(d.mesic).padStart(2, "0")}-${String(d.den).padStart(2, "0")}`;
}

/** Přesný otisk: vstup + datum konání + normalizovaný název. Bez času, bez fuzzy. */
export function vytvoritRadarOtiskKlic(args: {
  radarVstupId: string;
  datumOd: string;
  nazev: string;
}): string {
  return [
    args.radarVstupId.trim(),
    args.datumOd.trim(),
    args.nazev.replace(/\s+/g, " ").trim().toLowerCase(),
  ].join("\0");
}

export function validovatPracovniRadarStopu(
  hodnota: unknown,
): { ok: true; stopa: BranaRadarPracovniStopa } | { ok: false; chyba: string } {
  if (!jePlatnaPracovniStopa(hodnota)) {
    return { ok: false, chyba: "Neplatná pracovní stopa." };
  }
  if (!jePlatnyIsoDen(hodnota.datumOd.trim())) {
    return { ok: false, chyba: "Datum pracovní stopy není platné." };
  }
  return { ok: true, stopa: normalizovatPracovniStopu(hodnota) };
}

export function seraditPracovniStopy(
  stopy: readonly BranaRadarPracovniStopa[],
): BranaRadarPracovniStopa[] {
  return stopy.slice().sort((a, b) => {
    if (a.datumOd !== b.datumOd) {
      return a.datumOd < b.datumOd ? -1 : 1;
    }
    const casA = a.cas.trim();
    const casB = b.cas.trim();
    if (casA === casB) {
      return 0;
    }
    if (!casA) {
      return -1;
    }
    if (!casB) {
      return 1;
    }
    return casA < casB ? -1 : 1;
  });
}

export function formatujRadarDatum(iso: string): string {
  const casti = iso.trim().split("-");
  if (casti.length !== 3) {
    return iso;
  }
  return `${Number(casti[2])}. ${Number(casti[1])}.`;
}

/** http(s) URL k otevření. Jiný text není odkaz. */
export function radarZdrojOdkaz(url: string): string | null {
  const u = url.trim();
  if (u.startsWith("https://") || u.startsWith("http://")) {
    return u;
  }
  return null;
}

/**
 * Prošlé pracovní stopy a otisky pryč. Historie se stářím nemaže.
 * Prošlé = datumOd < dnesIso (Europe/Prague). Dnešek zůstává.
 */
export function uklidRadarDokument(
  dokument: BranaRadarDokument,
  dnesIso: string,
): BranaRadarDokument {
  return {
    verzeUloziste: BRANA_RADAR_VERZE_ULOZISTE,
    pracovni: dokument.pracovni.filter((s) => s.datumOd >= dnesIso),
    smazatOtisky: dokument.smazatOtisky.filter((o) => o.datumOd >= dnesIso),
    historie: dokument.historie.slice(),
    posledniBehAt: dokument.posledniBehAt,
  };
}

function pridatOtiskPokudChybi(
  otisky: readonly BranaRadarSmazatOtisk[],
  stopa: BranaRadarPracovniStopa,
): BranaRadarSmazatOtisk[] {
  const klic = vytvoritRadarOtiskKlic(stopa);
  if (otisky.some((o) => o.klic === klic)) {
    return otisky.slice();
  }
  return [...otisky, { klic, datumOd: stopa.datumOd }];
}

/**
 * Použít: pryč z pracovních, do historie RADAR_POUZITO, otisk proti opětovnému nabídnutí.
 * Kalendář se nevolá.
 */
export function pouzitRadarStopu(
  dokument: BranaRadarDokument,
  id: string,
  args: { tedIso: string },
): BranaRadarDokument | { chyba: string } {
  const idTrim = id.trim();
  if (!idTrim) {
    return { chyba: "Chybí id stopy." };
  }
  const stopa = dokument.pracovni.find((s) => s.id === idTrim);
  if (!stopa) {
    return { chyba: "Stopa už není v pracovním RADARU." };
  }

  const tedIso = args.tedIso.trim();
  const zaznam: BranaRadarHistorieZaznam = {
    id: stopa.id,
    puvod: BRANA_RADAR_PUVOD_POUZITO,
    datumOd: stopa.datumOd,
    cas: stopa.cas,
    nazev: stopa.nazev,
    kde: stopa.kde,
    radarVstupId: stopa.radarVstupId,
    url: stopa.url,
    rozhodnutoAt: tedIso,
    nalezenoAt: stopa.nalezenoAt,
  };

  return {
    verzeUloziste: BRANA_RADAR_VERZE_ULOZISTE,
    pracovni: dokument.pracovni.filter((s) => s.id !== idTrim),
    smazatOtisky: pridatOtiskPokudChybi(dokument.smazatOtisky, stopa),
    historie: [...dokument.historie, zaznam],
    posledniBehAt: dokument.posledniBehAt,
  };
}

/**
 * Smazat: pryč z pracovních, jen dočasný otisk. Historie beze změny.
 */
export function smazatRadarStopu(
  dokument: BranaRadarDokument,
  id: string,
): BranaRadarDokument | { chyba: string } {
  const idTrim = id.trim();
  if (!idTrim) {
    return { chyba: "Chybí id stopy." };
  }
  const stopa = dokument.pracovni.find((s) => s.id === idTrim);
  if (!stopa) {
    return { chyba: "Stopa už není v pracovním RADARU." };
  }

  return {
    verzeUloziste: BRANA_RADAR_VERZE_ULOZISTE,
    pracovni: dokument.pracovni.filter((s) => s.id !== idTrim),
    smazatOtisky: pridatOtiskPokudChybi(dokument.smazatOtisky, stopa),
    historie: dokument.historie.slice(),
    posledniBehAt: dokument.posledniBehAt,
  };
}

export function jeStejnyRadarDokument(
  a: BranaRadarDokument,
  b: BranaRadarDokument,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
