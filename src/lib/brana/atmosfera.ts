/** Sdílené schéma a mapování Atmosféry — jeden zdroj veřejných vět. */

export const BRANA_ATMOSFERA_BLOB_CESTA = "data/brana-atmosfera.json";
export const BRANA_ATMOSFERA_PREDCHOZI_JPEG_CESTA =
  "data/brana-atmosfera-predchozi.jpg";

/**
 * Interní stavy Atmosféry — AI nesmí tvořit veřejnou větu.
 * CHYSTA_SE, OZIVA, ZKLIDNUJE a ZTICHLO jsou jen dřívější hodnoty z Blobu.
 */
export const BRANA_ATMOSFERA_STAVY = [
  "KLIDNE",
  "ZIVO",
  "RUSNE",
  "ZTICHLE",
  "NIC",
  "CHYSTA_SE",
  "OZIVA",
  "ZKLIDNUJE",
  "ZTICHLO",
] as const;

export type BranaAtmosferaStav = (typeof BRANA_ATMOSFERA_STAVY)[number];

/** Stavy z jednoho snímku. ZTICHLE se AI nabízí jen v nočním režimu. */
export const BRANA_ATMOSFERA_STATICKE_STAVY = [
  "KLIDNE",
  "ZIVO",
  "RUSNE",
  "ZTICHLE",
  "NIC",
] as const;

export type BranaAtmosferaStatickyStav =
  (typeof BRANA_ATMOSFERA_STATICKE_STAVY)[number];

/** Dřívější přechodové stavy. Klasifikace je už nenabízí. */
export const BRANA_ATMOSFERA_DYNAMICKE_STAVY = [
  "OZIVA",
  "ZKLIDNUJE",
  "ZTICHLO",
] as const;

export type BranaAtmosferaDynamickyStav =
  (typeof BRANA_ATMOSFERA_DYNAMICKE_STAVY)[number];

export type BranaAtmosferaDuvodStavu =
  | "STATICKY"
  | "DYNAMICKY"
  | "CHYBA"
  | "NIC";

export type BranaAtmosferaDokument = {
  verze: 1;
  stav: BranaAtmosferaStav;
  zkontrolovanoAt: string;
  /** Čas snímku právě této kontroly; null pokud kontrola neměla platný snímek. */
  snimekAt: string | null;
  /** Čas snímku očekávaného v data/brana-atmosfera-predchozi.jpg. */
  pracovniJpegAt: string | null;
  /** SHA-256 hex bajtů očekávaného pracovního JPEG. */
  pracovniJpegSha256: string | null;
  /** Timestamp previous použitého při této kontrole (audit); null = nepoužit. */
  predchoziSnimekAt: string | null;
  model: string | null;
  duvodStavu: BranaAtmosferaDuvodStavu;
  /** Aktivní ruční override; null = veřejně platí automatický stav. */
  rucniText: string | null;
  /** ISO nastavení ručního textu (admin info); neovlivní cron dedup. */
  rucniTextAt: string | null;
  /** Krátký text za automatickou větou; null = bez dovětku. */
  dovetekText: string | null;
  /** ISO uložení dovětku. Při ponechání se neposouvá. */
  dovetekAt: string | null;
  /** Automatický stav, ke kterému dovětek patří. */
  dovetekStav: BranaAtmosferaStav | null;
};

/** Max. délka ruční věty po trimu (mobilní řádek s věží). */
export const BRANA_ATMOSFERA_RUCNI_TEXT_MAX = 90;

/** Max. délka dovětku po normalizaci. */
export const BRANA_ATMOSFERA_DOVETEK_MAX = 90;

/** Dovětek starší než toto se při dalším scanu stejného stavu odstraní. */
export const BRANA_ATMOSFERA_DOVETEK_MAX_MS = 3 * 60 * 60 * 1000;

export const BRANA_ATMOSFERA_VERZE = 1 as const;

/** Aktuální JPEG starší než toto → NIC. */
export const BRANA_ATMOSFERA_MAX_STARI_SNIMKU_MS = 30 * 60 * 1000;

/**
 * Historický limit porovnání snímků. Klasifikace ho už nepoužívá.
 * Konstanta zůstává kvůli stávajícímu exportu.
 */
export const BRANA_ATMOSFERA_MAX_STARI_PREDCHOZIHO_MS = 12 * 60 * 60 * 1000;

const MAPOVANI_VETY: Record<BranaAtmosferaStav, string | null> = {
  KLIDNE: "Náměstí je klidné",
  ZIVO: "Náměstí je živé",
  RUSNE: "Náměstí je rušné",
  ZTICHLE: "Náměstí je ztichlé",
  NIC: null,
  CHYSTA_SE: null,
  OZIVA: null,
  ZKLIDNUJE: null,
  ZTICHLO: null,
};

export function verejnaVetaAtmosfery(
  stav: BranaAtmosferaStav,
): string | null {
  return MAPOVANI_VETY[stav];
}

/** Veřejná věta: ruční override má přednost před automatickou větou a dovětkem. */
export function verejnaVetaZDokumentuAtmosfery(
  dokument: BranaAtmosferaDokument,
): string | null {
  const rucni = dokument.rucniText?.trim() ?? "";
  if (rucni) {
    return rucni;
  }
  const veta = verejnaVetaAtmosfery(dokument.stav);
  if (!veta) {
    return null;
  }
  const dovetek = platnyDovetekAtmosfery(dokument);
  if (!dovetek) {
    return veta;
  }
  return pripojitDovetekAtmosfery(veta, dovetek);
}

/** Dovětek se připojí přesně tak, jak je napsaný. Bez přidané mezery a interpunkce. */
export function pripojitDovetekAtmosfery(veta: string, dovetek: string): string {
  return `${veta}${dovetek}`;
}

/** Živý náhled z neuloženého vstupu. Stejné připojení jako veřejný text. */
export function nahledDovetkuAtmosfery(
  automatickaVeta: string | null,
  surovyDovetek: string,
): string | null {
  const slozeny = slozitTextDovetkuAtmosfery(surovyDovetek);
  if (!automatickaVeta || !slozeny) {
    return automatickaVeta;
  }
  return pripojitDovetekAtmosfery(automatickaVeta, slozeny);
}

/**
 * Zalomení a tabulátory na mezeru, víc mezer na jednu, bez koncových mezer.
 * Jedna úvodní mezera zůstává. Samé mezery jsou prázdný řetězec.
 */
export function slozitTextDovetkuAtmosfery(vstup: string): string {
  const text = vstup.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trimEnd();
  if (!text.trim()) {
    return "";
  }
  return text;
}

export function normalizovatDovetekAtmosfery(
  vstup: unknown,
): { ok: true; text: string } | { ok: false; chyba: string } {
  if (typeof vstup !== "string") {
    return { ok: false, chyba: "Text musí být řetězec." };
  }
  const text = slozitTextDovetkuAtmosfery(vstup);
  if (!text) {
    return { ok: false, chyba: "Text nesmí být prázdný." };
  }
  if (text.length > BRANA_ATMOSFERA_DOVETEK_MAX) {
    return {
      ok: false,
      chyba: `Text smí mít nejvýše ${BRANA_ATMOSFERA_DOVETEK_MAX} znaků.`,
    };
  }
  if (/[<>]/.test(text)) {
    return { ok: false, chyba: "Text nesmí obsahovat HTML značky." };
  }
  return { ok: true, text };
}

export type BranaAtmosferaDovetekPole = {
  dovetekText: string | null;
  dovetekAt: string | null;
  dovetekStav: BranaAtmosferaStav | null;
};

const PRAZDNY_DOVETEK: BranaAtmosferaDovetekPole = {
  dovetekText: null,
  dovetekAt: null,
  dovetekStav: null,
};

/** Dovětek se připojí jen ke stejnému stavu, který má veřejnou větu. */
export function platnyDovetekAtmosfery(
  dokument: Pick<
    BranaAtmosferaDokument,
    "stav" | "dovetekText" | "dovetekAt" | "dovetekStav"
  >,
): string | null {
  if (!dokument.dovetekText || !dokument.dovetekAt || !dokument.dovetekStav) {
    return null;
  }
  if (dokument.dovetekStav !== dokument.stav) {
    return null;
  }
  if (!verejnaVetaAtmosfery(dokument.stav)) {
    return null;
  }
  return dokument.dovetekText;
}

/**
 * Rozhodnutí při skutečném scanu. Čas vložení se při ponechání nemění.
 * NIC a stavy bez veřejné věty dovětek mažou.
 */
export function dovetekPoKontrole(
  aktualni: BranaAtmosferaDokument,
  novyStav: BranaAtmosferaStav,
  ted: Date,
): BranaAtmosferaDovetekPole {
  if (!verejnaVetaAtmosfery(novyStav)) {
    return PRAZDNY_DOVETEK;
  }
  if (
    !aktualni.dovetekText ||
    !aktualni.dovetekAt ||
    aktualni.dovetekStav !== novyStav
  ) {
    return PRAZDNY_DOVETEK;
  }
  const vlozeno = Date.parse(aktualni.dovetekAt);
  if (!Number.isFinite(vlozeno)) {
    return PRAZDNY_DOVETEK;
  }
  if (ted.getTime() - vlozeno >= BRANA_ATMOSFERA_DOVETEK_MAX_MS) {
    return PRAZDNY_DOVETEK;
  }
  return {
    dovetekText: aktualni.dovetekText,
    dovetekAt: aktualni.dovetekAt,
    dovetekStav: aktualni.dovetekStav,
  };
}

export function normalizovatRucniTextAtmosfery(
  vstup: unknown,
): { ok: true; text: string } | { ok: false; chyba: string } {
  if (typeof vstup !== "string") {
    return { ok: false, chyba: "Text musí být řetězec." };
  }
  const text = vstup.trim();
  if (!text) {
    return { ok: false, chyba: "Text nesmí být prázdný." };
  }
  if (text.length > BRANA_ATMOSFERA_RUCNI_TEXT_MAX) {
    return {
      ok: false,
      chyba: `Text smí mít nejvýše ${BRANA_ATMOSFERA_RUCNI_TEXT_MAX} znaků.`,
    };
  }
  if (/[<>]/.test(text)) {
    return { ok: false, chyba: "Text nesmí obsahovat HTML značky." };
  }
  return { ok: true, text };
}

export function jeAtmosferaStav(hodnota: unknown): hodnota is BranaAtmosferaStav {
  return (
    typeof hodnota === "string" &&
    (BRANA_ATMOSFERA_STAVY as readonly string[]).includes(hodnota)
  );
}

export function jeAtmosferaStatickyStav(
  hodnota: unknown,
): hodnota is BranaAtmosferaStatickyStav {
  return (
    typeof hodnota === "string" &&
    (BRANA_ATMOSFERA_STATICKE_STAVY as readonly string[]).includes(hodnota)
  );
}

export function jeAtmosferaDynamickyStav(
  hodnota: unknown,
): hodnota is BranaAtmosferaDynamickyStav {
  return (
    typeof hodnota === "string" &&
    (BRANA_ATMOSFERA_DYNAMICKE_STAVY as readonly string[]).includes(hodnota)
  );
}

/** Stavy, které smí AI vrátit. ZTICHLE jen když je noční režim BRÁNY. */
export function povoleneStavyKlasifikace(
  nocniRezim: boolean,
): readonly BranaAtmosferaStav[] {
  if (nocniRezim) {
    return ["KLIDNE", "ZIVO", "RUSNE", "ZTICHLE", "NIC"];
  }
  return ["KLIDNE", "ZIVO", "RUSNE", "NIC"];
}

export function vychoziAtmosferaDokument(
  tedIso: string = new Date().toISOString(),
): BranaAtmosferaDokument {
  return {
    verze: BRANA_ATMOSFERA_VERZE,
    stav: "NIC",
    zkontrolovanoAt: tedIso,
    snimekAt: null,
    pracovniJpegAt: null,
    pracovniJpegSha256: null,
    predchoziSnimekAt: null,
    model: null,
    duvodStavu: "NIC",
    rucniText: null,
    rucniTextAt: null,
    dovetekText: null,
    dovetekAt: null,
    dovetekStav: null,
  };
}

function jeIso(hodnota: unknown): hodnota is string {
  if (typeof hodnota !== "string" || !hodnota.trim()) return false;
  const t = Date.parse(hodnota);
  return Number.isFinite(t);
}

function jeSha256Hex(hodnota: unknown): hodnota is string {
  return typeof hodnota === "string" && /^[a-f0-9]{64}$/i.test(hodnota);
}

export function parsovatAtmosferaDokument(
  surovy: unknown,
): BranaAtmosferaDokument | null {
  if (!surovy || typeof surovy !== "object") return null;
  const root = surovy as Record<string, unknown>;
  if (root.verze !== 1) return null;
  if (!jeAtmosferaStav(root.stav)) return null;
  if (!jeIso(root.zkontrolovanoAt)) return null;

  const duvod = root.duvodStavu;
  if (
    duvod !== "STATICKY" &&
    duvod !== "DYNAMICKY" &&
    duvod !== "CHYBA" &&
    duvod !== "NIC"
  ) {
    return null;
  }

  const snimekAt =
    root.snimekAt === null || root.snimekAt === undefined
      ? null
      : jeIso(root.snimekAt)
        ? root.snimekAt
        : null;
  if (root.snimekAt != null && snimekAt === null) return null;

  // Zpětná kompatibilita: chybějící nová pole → null (previous se nepoužije).
  const pracovniJpegAt =
    root.pracovniJpegAt === null || root.pracovniJpegAt === undefined
      ? null
      : jeIso(root.pracovniJpegAt)
        ? root.pracovniJpegAt
        : null;
  if (root.pracovniJpegAt != null && pracovniJpegAt === null) return null;

  const pracovniJpegSha256 =
    root.pracovniJpegSha256 === null || root.pracovniJpegSha256 === undefined
      ? null
      : jeSha256Hex(root.pracovniJpegSha256)
        ? root.pracovniJpegSha256.toLowerCase()
        : null;
  if (root.pracovniJpegSha256 != null && pracovniJpegSha256 === null) {
    return null;
  }

  const predchoziSnimekAt =
    root.predchoziSnimekAt === null || root.predchoziSnimekAt === undefined
      ? null
      : jeIso(root.predchoziSnimekAt)
        ? root.predchoziSnimekAt
        : null;
  if (root.predchoziSnimekAt != null && predchoziSnimekAt === null) {
    return null;
  }

  const model =
    root.model === null || root.model === undefined
      ? null
      : typeof root.model === "string" && root.model.trim()
        ? root.model.trim()
        : null;
  if (root.model != null && model === null) return null;

  // Zpětná kompatibilita: chybějící ruční pole → null.
  let rucniText: string | null;
  if (root.rucniText === null || root.rucniText === undefined) {
    rucniText = null;
  } else if (typeof root.rucniText === "string") {
    const trim = root.rucniText.trim();
    if (!trim) {
      rucniText = null;
    } else if (
      trim.length > BRANA_ATMOSFERA_RUCNI_TEXT_MAX ||
      /[<>]/.test(trim)
    ) {
      return null;
    } else {
      rucniText = trim;
    }
  } else {
    return null;
  }

  const rucniTextAt =
    root.rucniTextAt === null || root.rucniTextAt === undefined
      ? null
      : jeIso(root.rucniTextAt)
        ? root.rucniTextAt
        : null;
  if (root.rucniTextAt != null && rucniTextAt === null) return null;
  if (rucniText === null && rucniTextAt !== null) return null;

  return {
    verze: 1,
    stav: root.stav,
    zkontrolovanoAt: root.zkontrolovanoAt,
    snimekAt,
    pracovniJpegAt,
    pracovniJpegSha256,
    predchoziSnimekAt,
    model,
    duvodStavu: duvod,
    rucniText,
    rucniTextAt,
    ...precistDovetek(root),
  };
}

/** Neúplný nebo neplatný dovětek se ignoruje. Dokument tím nepadá. */
function precistDovetek(
  root: Record<string, unknown>,
): BranaAtmosferaDovetekPole {
  const textChybi = root.dovetekText === null || root.dovetekText === undefined;
  const atChybi = root.dovetekAt === null || root.dovetekAt === undefined;
  const stavChybi = root.dovetekStav === null || root.dovetekStav === undefined;
  if (textChybi && atChybi && stavChybi) {
    return PRAZDNY_DOVETEK;
  }

  const text =
    typeof root.dovetekText === "string"
      ? normalizovatDovetekAtmosfery(root.dovetekText)
      : null;
  const at = jeIso(root.dovetekAt) ? root.dovetekAt : null;
  const stav =
    jeAtmosferaStav(root.dovetekStav) && verejnaVetaAtmosfery(root.dovetekStav)
      ? root.dovetekStav
      : null;
  if (!text?.ok || !at || !stav) {
    return PRAZDNY_DOVETEK;
  }
  return {
    dovetekText: text.text,
    dovetekAt: at,
    dovetekStav: stav,
  };
}
