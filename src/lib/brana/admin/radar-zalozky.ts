/**
 * Osobní redakční záložky na stránce RADAR.
 * Čistá data a kontrola adres. Bez Blobu, scanu a Kalendáře.
 */

export const BRANA_RADAR_ZALOZKY_BLOB_CESTA = "data/brana-radar-zalozky.json";

export const BRANA_RADAR_ZALOZKY_VERZE = 1;

export const BRANA_RADAR_ZALOZKY_MAX = 50;

const NAZEV_MAX = 200;
const URL_MAX = 2000;
const ID = /^zalozka-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BranaRadarZalozka = {
  id: string;
  nazev: string;
  url: string;
  pridanoAt: string;
};

export type BranaRadarZalozkyDokument = {
  verzeUloziste: typeof BRANA_RADAR_ZALOZKY_VERZE;
  polozky: BranaRadarZalozka[];
};

export type BranaRadarZalozkaVstup = {
  nazev: string;
  url: string;
};

export function vychoziRadarZalozkyDokument(): BranaRadarZalozkyDokument {
  return {
    verzeUloziste: BRANA_RADAR_ZALOZKY_VERZE,
    polozky: [],
  };
}

function maRidiciZnak(text: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(text);
}

/**
 * Platná http(s) adresa bez přihlašovacích údajů.
 * Vrací kanonický tvar, který se ukládá a otevírá.
 */
export function normalizovatHttpAdresu(vstup: string): string | null {
  const text = vstup.trim();
  if (!text || text.length > URL_MAX || maRidiciZnak(text) || /\s/.test(text)) {
    return null;
  }
  if (!text.startsWith("https://") && !text.startsWith("http://")) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  if (url.username || url.password) {
    return null;
  }
  if (!url.hostname || url.hostname === ".") {
    return null;
  }

  const href = url.href;
  if (href.length > URL_MAX) {
    return null;
  }
  if (!href.startsWith("https://") && !href.startsWith("http://")) {
    return null;
  }
  return href;
}

export function validovatRadarZalozkuVstup(
  vstup: unknown,
):
  | { ok: true; hodnota: BranaRadarZalozkaVstup }
  | { ok: false; chyba: string } {
  if (!vstup || typeof vstup !== "object") {
    return { ok: false, chyba: "Neplatný vstup." };
  }

  const data = vstup as Record<string, unknown>;
  const nazev = typeof data.nazev === "string" ? data.nazev.trim() : "";
  const urlSurova = typeof data.url === "string" ? data.url.trim() : "";

  if (!nazev) {
    return { ok: false, chyba: "Vyplňte název." };
  }
  if (nazev.length > NAZEV_MAX || maRidiciZnak(nazev)) {
    return { ok: false, chyba: "Název je příliš dlouhý." };
  }
  if (!urlSurova) {
    return { ok: false, chyba: "Vyplňte webovou adresu." };
  }
  if (urlSurova.length > URL_MAX) {
    return { ok: false, chyba: "Webová adresa je příliš dlouhá." };
  }

  const url = normalizovatHttpAdresu(urlSurova);
  if (!url) {
    return {
      ok: false,
      chyba: "Zadejte platnou adresu s http:// nebo https://.",
    };
  }

  return { ok: true, hodnota: { nazev, url } };
}

function jeIsoOkamzik(hodnota: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(hodnota)) {
    return false;
  }
  const cas = Date.parse(hodnota);
  return Number.isFinite(cas) && new Date(cas).toISOString() === hodnota;
}

function parsovatPolozku(hodnota: unknown): BranaRadarZalozka | null {
  if (!hodnota || typeof hodnota !== "object") {
    return null;
  }
  const data = hodnota as Record<string, unknown>;
  if (typeof data.id !== "string" || !ID.test(data.id)) {
    return null;
  }
  if (typeof data.nazev !== "string") {
    return null;
  }
  const nazev = data.nazev.trim();
  if (!nazev || nazev.length > NAZEV_MAX || nazev !== data.nazev || maRidiciZnak(nazev)) {
    return null;
  }
  if (typeof data.url !== "string") {
    return null;
  }
  const url = normalizovatHttpAdresu(data.url);
  if (!url || url !== data.url) {
    return null;
  }
  if (typeof data.pridanoAt !== "string" || !jeIsoOkamzik(data.pridanoAt)) {
    return null;
  }
  return {
    id: data.id,
    nazev,
    url,
    pridanoAt: data.pridanoAt,
  };
}

export function parsovatRadarZalozkyDokument(
  parsed: unknown,
): BranaRadarZalozkyDokument | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const data = parsed as Record<string, unknown>;
  if (data.verzeUloziste !== BRANA_RADAR_ZALOZKY_VERZE) {
    return null;
  }
  if (!Array.isArray(data.polozky) || data.polozky.length > BRANA_RADAR_ZALOZKY_MAX) {
    return null;
  }

  const polozky: BranaRadarZalozka[] = [];
  const id = new Set<string>();
  for (const surova of data.polozky) {
    const polozka = parsovatPolozku(surova);
    if (!polozka || id.has(polozka.id)) {
      return null;
    }
    id.add(polozka.id);
    polozky.push(polozka);
  }

  return {
    verzeUloziste: BRANA_RADAR_ZALOZKY_VERZE,
    polozky,
  };
}

export function pridatPolozkuDoZalozekDokumentu(
  dokument: BranaRadarZalozkyDokument,
  polozka: BranaRadarZalozka,
):
  | { ok: true; dokument: BranaRadarZalozkyDokument }
  | { ok: false; chyba: string } {
  if (dokument.polozky.length >= BRANA_RADAR_ZALOZKY_MAX) {
    return {
      ok: false,
      chyba: "Seznam má nejvýše 50 adres. Nejdřív nějakou smažte.",
    };
  }
  if (dokument.polozky.some((p) => p.id === polozka.id)) {
    return { ok: false, chyba: "Odkaz se nepodařilo uložit." };
  }

  const overena = parsovatPolozku(polozka);
  if (!overena) {
    return { ok: false, chyba: "Odkaz se nepodařilo uložit." };
  }

  return {
    ok: true,
    dokument: {
      verzeUloziste: BRANA_RADAR_ZALOZKY_VERZE,
      polozky: [overena, ...dokument.polozky],
    },
  };
}

export function smazatPolozkuZeZalozekDokumentu(
  dokument: BranaRadarZalozkyDokument,
  id: string,
):
  | { ok: true; dokument: BranaRadarZalozkyDokument }
  | { ok: false; chyba: string } {
  const idTrim = id.trim();
  if (!dokument.polozky.some((p) => p.id === idTrim)) {
    return { ok: false, chyba: "Odkaz už v seznamu není." };
  }
  return {
    ok: true,
    dokument: {
      verzeUloziste: BRANA_RADAR_ZALOZKY_VERZE,
      polozky: dokument.polozky.filter((p) => p.id !== idTrim),
    },
  };
}
