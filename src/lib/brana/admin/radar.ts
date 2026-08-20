/**
 * Jazyk a pure logika RADARU (výzkumné oddělení BRÁNY).
 * RADAR hledá. Člověk rozhoduje. BRÁNA publikuje.
 * Tento modul nic nezapisuje do Kalendáře, Nezařazených, Zdrojů ani Redakčního pořadí.
 */

export const BRANA_RADAR_VERZE_ULOZISTE = 1;

export const BRANA_RADAR_PUVOD_RUCNE_NALEZENO = "RUCNE_NALEZENO";
export const BRANA_RADAR_PUVOD_POUZITO = "RADAR_POUZITO";

export type BranaRadarPuvodHistorie =
  | typeof BRANA_RADAR_PUVOD_RUCNE_NALEZENO
  | typeof BRANA_RADAR_PUVOD_POUZITO;

export type BranaRadarPracovniDruh = "UDALOST" | "OZIVENI";

/** Pracovní stopa inboxu. V tomto řezu se ještě nevytváří. */
export type BranaRadarPracovniStopa = {
  id: string;
  klic: string;
  radarVstupId: string;
  datumOd: string;
  cas: string;
  nazev: string;
  kde: string;
  upresneni: string;
  url: string;
  druh: BranaRadarPracovniDruh;
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
    jeNeprazdnyText(n.klic) &&
    jeText(n.radarVstupId) &&
    jeNeprazdnyText(n.datumOd) &&
    jeText(n.cas) &&
    jeNeprazdnyText(n.nazev) &&
    jeText(n.kde) &&
    jeText(n.upresneni) &&
    jeText(n.url) &&
    (n.druh === "UDALOST" || n.druh === "OZIVENI") &&
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
    klic: n.klic,
    radarVstupId: n.radarVstupId.trim(),
    datumOd: n.datumOd.trim(),
    cas: n.cas.trim(),
    nazev: n.nazev.trim(),
    kde: n.kde.trim(),
    upresneni: n.upresneni.trim(),
    url: n.url.trim(),
    druh: n.druh,
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
