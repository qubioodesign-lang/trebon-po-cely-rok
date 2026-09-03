/**
 * Jazyk a pure logika archivu Učení (vedlejší redakční kopie).
 * Kalendář, RADAR, scany ani veřejná BRÁNA odtud nic nečtou.
 */

export const BRANA_UCENI_VERZE = 1;

export type BranaUceniPolozkaVstup = {
  datumOd: string;
  cas: string;
  nazev: string;
  kde: string;
  url?: string;
};

export type BranaUceniPolozka = {
  id: string;
  ulozenoAt: string;
  datumOd: string;
  cas: string;
  nazev: string;
  kde: string;
  /** Prázdné = bez zdroje (typicky ruční kalendářní událost). */
  url: string;
};

export type BranaUceniDokument = {
  verze: number;
  polozky: BranaUceniPolozka[];
};

const ISO_DEN = /^\d{4}-\d{2}-\d{2}$/;
const CAS = /^([01]\d|2[0-3]):[0-5]\d$/;
const NAZEV_MAX = 200;
const KDE_MAX = 200;
const URL_MAX = 2000;

export function vychoziUceniDokument(): BranaUceniDokument {
  return {
    verze: BRANA_UCENI_VERZE,
    polozky: [],
  };
}

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

function normalizovatCas(cas: string): string | null {
  const trim = cas.trim();
  if (trim === "") {
    return "";
  }
  if (!CAS.test(trim)) {
    return null;
  }
  return trim;
}

function jeNeprazdnyText(hodnota: unknown): hodnota is string {
  return typeof hodnota === "string";
}

function jePlatnaPolozka(hodnota: unknown): hodnota is BranaUceniPolozka {
  if (!hodnota || typeof hodnota !== "object" || Array.isArray(hodnota)) {
    return false;
  }
  const p = hodnota as Record<string, unknown>;
  if (!jeNeprazdnyText(p.id) || p.id.trim().length === 0) {
    return false;
  }
  if (!jeNeprazdnyText(p.ulozenoAt) || Number.isNaN(Date.parse(p.ulozenoAt))) {
    return false;
  }
  if (!jeNeprazdnyText(p.datumOd) || !jePlatnyIsoDen(p.datumOd.trim())) {
    return false;
  }
  if (!jeNeprazdnyText(p.cas)) {
    return false;
  }
  const cas = normalizovatCas(p.cas);
  if (cas === null) {
    return false;
  }
  if (!jeNeprazdnyText(p.nazev) || p.nazev.trim().length === 0) {
    return false;
  }
  if (!jeNeprazdnyText(p.kde)) {
    return false;
  }
  if (!jeNeprazdnyText(p.url)) {
    return false;
  }
  return true;
}

/** Fail-closed parse. Neplatný dokument → null. */
export function parsovatUceniDokument(surovy: unknown): BranaUceniDokument | null {
  if (!surovy || typeof surovy !== "object" || Array.isArray(surovy)) {
    return null;
  }
  const raw = surovy as Record<string, unknown>;
  if (raw.verze !== BRANA_UCENI_VERZE) {
    return null;
  }
  if (!Array.isArray(raw.polozky)) {
    return null;
  }
  const polozky: BranaUceniPolozka[] = [];
  for (const polozka of raw.polozky) {
    if (!jePlatnaPolozka(polozka)) {
      return null;
    }
    polozky.push({
      id: polozka.id.trim(),
      ulozenoAt: polozka.ulozenoAt.trim(),
      datumOd: polozka.datumOd.trim(),
      cas: polozka.cas.trim() === "" ? "" : polozka.cas.trim(),
      nazev: polozka.nazev.trim(),
      kde: polozka.kde.trim(),
      url: polozka.url.trim(),
    });
  }
  return { verze: BRANA_UCENI_VERZE, polozky };
}

export function vytvoritUceniPolozku(
  vstup: BranaUceniPolozkaVstup,
  args: { noveId: () => string; tedIso: string },
): BranaUceniPolozka | { chyba: string } {
  const datumOd = vstup.datumOd.trim();
  if (!jePlatnyIsoDen(datumOd)) {
    return { chyba: "Učení: neplatné datum." };
  }
  const cas = normalizovatCas(vstup.cas);
  if (cas === null) {
    return { chyba: "Učení: neplatný čas." };
  }
  const nazev = vstup.nazev.trim();
  if (nazev.length === 0 || nazev.length > NAZEV_MAX) {
    return { chyba: "Učení: neplatný název." };
  }
  const kde = vstup.kde.trim();
  if (kde.length > KDE_MAX) {
    return { chyba: "Učení: neplatné místo." };
  }
  const url = (vstup.url ?? "").trim();
  if (url.length > URL_MAX) {
    return { chyba: "Učení: neplatné URL." };
  }
  const tedIso = args.tedIso.trim();
  if (!tedIso || Number.isNaN(Date.parse(tedIso))) {
    return { chyba: "Učení: neplatný čas uložení." };
  }
  return {
    id: args.noveId(),
    ulozenoAt: tedIso,
    datumOd,
    cas,
    nazev,
    kde,
    url,
  };
}

export function pridatUceniPolozkuDoDokumentu(
  dokument: BranaUceniDokument,
  vstup: BranaUceniPolozkaVstup,
  args: { noveId: () => string; tedIso: string },
): BranaUceniDokument | { chyba: string } {
  const polozka = vytvoritUceniPolozku(vstup, args);
  if ("chyba" in polozka) {
    return polozka;
  }
  return {
    verze: BRANA_UCENI_VERZE,
    polozky: [...dokument.polozky, polozka],
  };
}

/** http(s) URL k otevření. Jiný text není odkaz. */
export function uceniZdrojOdkaz(url: string): string | null {
  const u = url.trim();
  if (u.startsWith("https://") || u.startsWith("http://")) {
    return u;
  }
  return null;
}

export function formatujUceniDatum(iso: string): string {
  const casti = iso.trim().split("-");
  if (casti.length !== 3) {
    return iso;
  }
  return `${Number(casti[2])}. ${Number(casti[1])}. ${Number(casti[0])}`;
}

/** Období od nejstaršího po nejnovější datumOd (ISO dny). */
export function obdobiUceniPolozek(
  polozky: readonly BranaUceniPolozka[],
): { od: string; do: string } | null {
  if (polozky.length === 0) {
    return null;
  }
  const dny = polozky.map((p) => p.datumOd).sort();
  return { od: dny[0], do: dny[dny.length - 1] };
}
