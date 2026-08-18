/**
 * Úzký fail-closed parser programu Třeboňského divadelního festivalu (tdf.cz).
 * Jedna homepage: `h3.title` + `h4.place` + `data-date` (+ volitelně iTřeboň id).
 * TDF v Třeboni (včetně Divadla J. K. Tyla) → kotva trebonsky-divadelni-festival.
 * Matching dělá scan ownership, ne obecný BEZNY podle místa (to by JKT místo
 * přiřadilo k divadlo-jk-tyla). Mimo Třeboň / neúplné / organizační → 0.
 * Úplná programová karta bez bezpečného třeboňského místa → kandidát bez kotvy
 * (existující Nezařazené). JKT parser TDF dál dropuje — tato větev ho nemění.
 */

export const BRANA_TDF_REDAKCNI_POLOZKA_ID = "trebonsky-divadelni-festival";

const TDF_HOST = "tdf.cz";
const MAX_KANDIDATU_TDF = 40;

export type TdfScanKandidat = {
  nazev: string;
  datumOd: string;
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  zdrojIdentita?: string;
};

export type TdfZarazeni =
  | { druh: "tdf"; kotva: typeof BRANA_TDF_REDAKCNI_POLOZKA_ID }
  | { druh: "mimo" }
  | { druh: "neuplne" }
  | { druh: "nezarazene" };

const MIMO_TREBON_TOKENY: readonly string[] = [
  "lomnice nad luznici",
  "suchdol nad luznici",
  "chlum u trebone",
  "veseli nad luznici",
  "ceske budejovice",
  "jindrichuv hradec",
  "cesky krumlov",
  "praha",
  "brno",
  "plzen",
];

function normalizovatTdf(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dekodovatTdfText(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_, n: string) => {
      const kod = Number(n);
      return Number.isFinite(kod) ? String.fromCharCode(kod) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => {
      const kod = Number.parseInt(n, 16);
      return Number.isFinite(kod) ? String.fromCharCode(kod) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textBezHtmlTdf(html: string): string {
  return dekodovatTdfText(html.replace(/<[^>]+>/g, " "));
}

function normalizovatJktBezMesta(text: string): string {
  return text.replace(
    /Divadlo\s+J\.\s*K\.\s*Tyla(?:\s*,\s*Třeboň|\s+v\s+Třeboni)?/gi,
    "Divadlo J. K. Tyla",
  );
}

function normalizovatNadvoriBezMesta(text: string): string {
  return text.replace(/Malé nádvoří zámku(?:\s+Třeboň)?/gi, "Malé nádvoří zámku");
}

/**
 * Jen veřejné KDE TDF: bez přívěsku města u JKT a u Malého nádvoří zámku.
 * Závorka s náhradním místem při dešti zůstane. Klasifikace / identita
 * dál vidí surový text ze zdroje.
 */
export function normalizovatTdfMistoProKde(misto: string): string {
  const surove = misto.replace(/\s+/g, " ").trim();
  if (!surove) {
    return surove;
  }
  const seZavorkou = surove.match(/^(.*?)\s*\((.*)\)\s*$/);
  const hlavni = (seZavorkou?.[1] ?? surove).trim();
  const zavorka = seZavorkou?.[2]?.trim() ?? null;
  const hlavniKde = normalizovatJktBezMesta(
    normalizovatNadvoriBezMesta(hlavni),
  ).replace(/\s+/g, " ").trim();
  if (!zavorka) {
    return hlavniKde;
  }
  const zavorkaKde = normalizovatJktBezMesta(zavorka).replace(/\s+/g, " ").trim();
  return `${hlavniKde} (${zavorkaKde})`;
}

function slugProTdfIdentitu(text: string): string {
  return normalizovatTdf(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hostTdf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function jeTdfZdrojUrl(url: string): boolean {
  return hostTdf(url) === TDF_HOST;
}

/** Vždy homepage — 1 HTTP, i když je v Zdroji uložená podstránka. */
export function sestavTdfProgramUrl(zdrojUrl: string): string {
  if (!jeTdfZdrojUrl(zdrojUrl)) {
    return "";
  }
  try {
    const base = new URL(zdrojUrl);
    return `${base.protocol}//${base.host}/`;
  } catch {
    return "";
  }
}

export function jeTdfProgramHtml(html: string): boolean {
  if (!/tdf\.cz/i.test(html)) {
    return false;
  }
  return /data-date=["']\d{4}-\d{2}-\d{2}T/i.test(html);
}

function jeMimoTrebon(misto: string): boolean {
  const t = normalizovatTdf(misto);
  if (!t) {
    return false;
  }
  for (const token of MIMO_TREBON_TOKENY) {
    if (t.includes(token) && !t.includes("trebon")) {
      return true;
    }
  }
  return false;
}

function jeMistoTdfVTreboni(misto: string): boolean {
  const t = normalizovatTdf(misto);
  if (!t) {
    return false;
  }
  if (t.includes("trebon")) {
    return true;
  }
  if (/divadlo j\.?\s*k\.?\s*tyla/.test(t)) {
    return true;
  }
  if (t.includes("nadvori") || t.includes("zamek") || t.includes("zamku")) {
    return true;
  }
  if (t.includes("schwarzenbersk")) {
    return true;
  }
  return false;
}

/**
 * Třeboňské TDF (včetně JKT) → kotva festivalu.
 * Jiné město / prázdné místo → drop.
 * Úplné, ale místo není bezpečně Třeboň → Nezařazené.
 */
export function zaraditTdfUdalost(nazev: string, misto: string): TdfZarazeni {
  const nazevCisty = nazev.replace(/\s+/g, " ").trim();
  const mistoCiste = misto.replace(/\s+/g, " ").trim();
  if (!nazevCisty || !mistoCiste) {
    return { druh: "neuplne" };
  }
  if (jeMimoTrebon(mistoCiste)) {
    return { druh: "mimo" };
  }
  if (jeMistoTdfVTreboni(mistoCiste)) {
    return { druh: "tdf", kotva: BRANA_TDF_REDAKCNI_POLOZKA_ID };
  }
  return { druh: "nezarazene" };
}

export function urcitTdfKotvu(
  kandidat: Pick<TdfScanKandidat, "nazev" | "mistoNeboTyp">,
): typeof BRANA_TDF_REDAKCNI_POLOZKA_ID | null {
  const zarazeni = zaraditTdfUdalost(kandidat.nazev, kandidat.mistoNeboTyp);
  if (zarazeni.druh === "tdf") {
    return zarazeni.kotva;
  }
  return null;
}

function vytahnoutItrebonCmsId(html: string): string | null {
  const shoda = html.match(
    /https?:\/\/(?:www\.)?itrebon\.cz\/kalendar\/[^"'?\s]*_(\d+)\.html/i,
  );
  const id = shoda?.[1]?.trim() ?? "";
  return /^\d+$/.test(id) ? id : null;
}

export function sestavTdfZdrojIdentitu(args: {
  itrebonCmsId: string | null;
  datumOd: string;
  cas: string;
  nazev: string;
  misto: string;
}): string {
  const cms = args.itrebonCmsId?.trim() ?? "";
  if (/^\d+$/.test(cms)) {
    return `tdf|itrebon|${cms}`;
  }
  const nazevSlug = slugProTdfIdentitu(args.nazev);
  const mistoSlug = slugProTdfIdentitu(args.misto);
  return `tdf|${args.datumOd}|${args.cas}|${nazevSlug}|${mistoSlug}`;
}

function rozlozDataDate(
  surovy: string,
): { datum: string; cas: string } | null {
  const t = surovy.trim();
  const shoda = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!shoda) {
    return null;
  }
  const rok = Number(shoda[1]);
  const mesic = Number(shoda[2]);
  const den = Number(shoda[3]);
  const hodina = Number(shoda[4]);
  const minuta = Number(shoda[5]);
  if (mesic < 1 || mesic > 12 || den < 1 || den > 31) {
    return null;
  }
  if (hodina > 23 || minuta > 59) {
    return null;
  }
  const dt = new Date(Date.UTC(rok, mesic - 1, den));
  if (
    dt.getUTCFullYear() !== rok ||
    dt.getUTCMonth() + 1 !== mesic ||
    dt.getUTCDate() !== den
  ) {
    return null;
  }
  return {
    datum: `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`,
    cas: `${String(hodina).padStart(2, "0")}:${String(minuta).padStart(2, "0")}`,
  };
}

function klicTdfKandidata(k: TdfScanKandidat): string {
  const identita = k.zdrojIdentita?.trim();
  if (identita) {
    return `id\0${identita}`;
  }
  return `${k.nazev}\0${k.datumOd}\0${k.cas}\0${k.mistoNeboTyp}`.toLowerCase();
}

function vytahnoutTitlePlaceBloky(html: string): string[] {
  const re =
    /<h3\b[^>]*\bclass=["'][^"']*\btitle\b[^"']*["'][^>]*>[\s\S]*?(?=<h3\b[^>]*\bclass=["'][^"']*\btitle\b|$)/gi;
  return [...html.matchAll(re)].map((m) => m[0]);
}

export function parsovatTdfProgram(html: string): TdfScanKandidat[] {
  if (!jeTdfProgramHtml(html)) {
    return [];
  }
  const vysledek: TdfScanKandidat[] = [];
  const videne = new Set<string>();
  for (const blok of vytahnoutTitlePlaceBloky(html)) {
    if (vysledek.length >= MAX_KANDIDATU_TDF) {
      return vysledek;
    }
    const titleMatch = blok.match(
      /<h3\b[^>]*\bclass=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i,
    );
    const placeMatch = blok.match(
      /<h4\b[^>]*\bclass=["'][^"']*\bplace\b[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i,
    );
    const dateMatch = blok.match(/data-date=["']([^"']+)["']/i);
    const nazev = textBezHtmlTdf(titleMatch?.[1] ?? "");
    const misto = textBezHtmlTdf(placeMatch?.[1] ?? "");
    const termin = rozlozDataDate(dateMatch?.[1] ?? "");
    if (!nazev || nazev.length < 2 || !misto || !termin) {
      continue;
    }
    const zarazeni = zaraditTdfUdalost(nazev, misto);
    if (zarazeni.druh === "mimo" || zarazeni.druh === "neuplne") {
      continue;
    }
    const kandidat: TdfScanKandidat = {
      nazev,
      datumOd: termin.datum,
      datumDo: termin.datum,
      cas: termin.cas,
      mistoNeboTyp: normalizovatTdfMistoProKde(misto),
      zdrojIdentita: sestavTdfZdrojIdentitu({
        itrebonCmsId: vytahnoutItrebonCmsId(blok),
        datumOd: termin.datum,
        cas: termin.cas,
        nazev,
        misto,
      }),
    };
    const klic = klicTdfKandidata(kandidat);
    if (videne.has(klic)) {
      continue;
    }
    videne.add(klic);
    vysledek.push(kandidat);
  }
  return vysledek;
}

export function parsovatTdf(
  html: string,
  vysledek: TdfScanKandidat[],
): void {
  for (const k of parsovatTdfProgram(html)) {
    vysledek.push(k);
  }
}
