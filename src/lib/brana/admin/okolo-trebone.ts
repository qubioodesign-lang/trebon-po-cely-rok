/**
 * Úzký fail-closed parser programu Okolo Třeboně (okolotrebone.cz/program/).
 * Automaticky jen:
 * - koncerty na Schwarzenberské hrobce → schwarzenberska-hrobka
 * - Třeboňská lázeňská matiné → trebonska-lazenska-matine
 * JKT / foyer / TDF / nocturna / mimo Třeboň / bez data, času, názvu nebo
 * místa → 0 kandidátů. Ostatní úplná třeboňská událost → kandidát bez kotvy
 * (scan ji pošle do existujících Nezařazených). Matching A/B dělá scan
 * ownership, ne obecný BEZNY (ten by JKT místo přiřadil k divadlo-jk-tyla).
 * Počet neznámých položek není důvod k zahození.
 */

export const BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID = "schwarzenberska-hrobka";
export const BRANA_OKOLO_MATINE_REDAKCNI_POLOZKA_ID =
  "trebonska-lazenska-matine";

export const OKOLO_TREBONE_PROGRAM_PATH = "/program";
const OKOLO_HOST = "okolotrebone.cz";
const MAX_KANDIDATU_OKOLO = 40;

export type OkoloTreboneScanKandidat = {
  nazev: string;
  datumOd: string;
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  zdrojIdentita?: string;
};

export type OkoloTreboneKotvaId =
  | typeof BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID
  | typeof BRANA_OKOLO_MATINE_REDAKCNI_POLOZKA_ID;

export type OkoloTreboneZarazeni =
  | { druh: "hrobka"; kotva: typeof BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID }
  | { druh: "matine"; kotva: typeof BRANA_OKOLO_MATINE_REDAKCNI_POLOZKA_ID }
  | { druh: "jkt" }
  | { druh: "nocturna" }
  | { druh: "tdf" }
  | { druh: "mimo" }
  | { druh: "neuplne" }
  | { druh: "nezarazene" };

export type OkoloTreboneZahazenaPolozka = {
  skupina: "jkt" | "nocturna" | "tdf" | "mimo" | "neuplne";
  nazev: string;
  datumOd: string;
  cas: string;
  mistoNeboTyp: string;
};

export type OkoloTreboneParseShrnuti = {
  kandidati: OkoloTreboneScanKandidat[];
  nalezeno: number;
  prijetoHrobka: number;
  prijetoMatine: number;
  prijetoNezarazene: number;
  odmitnutoJkt: number;
  odmitnutoNocturna: number;
  odmitnutoTdf: number;
  odmitnutoMimo: number;
  odmitnutoNeuplne: number;
  odmitnutoBezTerminu: number;
  zahazene: OkoloTreboneZahazenaPolozka[];
};

const MESICE_GENITIV: Record<string, number> = {
  ledna: 1,
  unor: 2,
  unora: 2,
  brezna: 3,
  dubna: 4,
  kvetna: 5,
  cervna: 6,
  cervence: 7,
  srpna: 8,
  zari: 9,
  rijna: 10,
  listopadu: 11,
  prosince: 12,
};

/** Obce mimo Třeboň, které Okolo občas uvádí — v1 vždy drop. */
const MIMO_TREBON_TOKENY: readonly string[] = [
  "lomnice nad luznici",
  "suchdol nad luznici",
  "chlum u trebone",
  "veseli nad luznici",
  "ceske budejovice",
  "jindrichuv hradec",
  "cesky krumlov",
];

function normalizovatOkolo(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dekodovatOkoloText(raw: string): string {
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
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textBezHtmlOkolo(html: string): string {
  return dekodovatOkoloText(html.replace(/<[^>]+>/g, ""));
}

function slugProOkoloIdentitu(text: string): string {
  return normalizovatOkolo(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatujIsoDen(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

function formatujCas(hodina: number, minuta: number): string {
  return `${String(hodina).padStart(2, "0")}:${String(minuta).padStart(2, "0")}`;
}

function jePlatnyDen(rok: number, mesic: number, den: number): boolean {
  if (den < 1 || den > 31 || mesic < 1 || mesic > 12 || rok < 2000) {
    return false;
  }
  const dt = new Date(Date.UTC(rok, mesic - 1, den));
  return (
    dt.getUTCFullYear() === rok &&
    dt.getUTCMonth() + 1 === mesic &&
    dt.getUTCDate() === den
  );
}

function hostOkoloTrebone(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function jeOkoloTreboneZdrojUrl(url: string): boolean {
  return hostOkoloTrebone(url) === OKOLO_HOST;
}

/** Jedna programová stránka — 1 HTTP, i když je v Zdroji uložená homepage. */
export function sestavOkoloTreboneProgramUrl(zdrojUrl: string): string {
  if (!jeOkoloTreboneZdrojUrl(zdrojUrl)) {
    return "";
  }
  try {
    const base = new URL(zdrojUrl);
    return `${base.protocol}//${base.host}${OKOLO_TREBONE_PROGRAM_PATH}/`;
  } catch {
    return "";
  }
}

export function jeOkoloTreboneProgramHtml(html: string): boolean {
  return /okolotrebone\.cz/i.test(html);
}

function jeMistoJkt(misto: string, nazev: string): boolean {
  const t = normalizovatOkolo(`${nazev} ${misto}`);
  if (/divadlo j\.?\s*k\.?\s*tyla/.test(t)) {
    return true;
  }
  if (/foyer/.test(t) && /tyla/.test(t)) {
    return true;
  }
  return false;
}

function jeMimoTrebon(misto: string): boolean {
  const t = normalizovatOkolo(misto);
  if (!t) {
    return false;
  }
  for (const token of MIMO_TREBON_TOKENY) {
    if (t.includes(token)) {
      return true;
    }
  }
  if (/\bpraha\b/.test(t) && !t.includes("trebon")) {
    return true;
  }
  return false;
}

function jeHrobkaMisto(misto: string): boolean {
  const t = normalizovatOkolo(misto);
  return t.includes("schwarzenbersk") && t.includes("hrobk");
}

function jeMatineNazev(nazev: string): boolean {
  const t = normalizovatOkolo(nazev);
  return t.includes("lazensk") && t.includes("matine");
}

/**
 * A = hrobka podle místa, B = matiné podle názvu.
 * JKT místo má přednost — nikdy se nevykrývá program JKT.
 * Úplný třeboňský zbytek → nezarazene (bez kotvy).
 */
export function zaraditOkoloTreboneUdalost(
  nazev: string,
  misto: string,
): OkoloTreboneZarazeni {
  const nazevCisty = nazev.replace(/\s+/g, " ").trim();
  const mistoCiste = misto.replace(/\s+/g, " ").trim();
  if (!nazevCisty || !mistoCiste) {
    return { druh: "neuplne" };
  }
  if (jeMistoJkt(mistoCiste, nazevCisty)) {
    return { druh: "jkt" };
  }
  const t = normalizovatOkolo(`${nazevCisty} ${mistoCiste}`);
  if (/trebonsk/.test(t) && /nocturn/.test(t)) {
    return { druh: "nocturna" };
  }
  if (/\btdf\b/.test(t) || t.includes("trebonsky divadelni festival")) {
    return { druh: "tdf" };
  }
  if (jeMimoTrebon(mistoCiste)) {
    return { druh: "mimo" };
  }
  if (jeHrobkaMisto(mistoCiste)) {
    return {
      druh: "hrobka",
      kotva: BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID,
    };
  }
  if (jeMatineNazev(nazevCisty)) {
    return {
      druh: "matine",
      kotva: BRANA_OKOLO_MATINE_REDAKCNI_POLOZKA_ID,
    };
  }
  return { druh: "nezarazene" };
}

export function urcitOkoloTreboneKotvu(
  kandidat: Pick<OkoloTreboneScanKandidat, "nazev" | "mistoNeboTyp">,
): OkoloTreboneKotvaId | null {
  const zarazeni = zaraditOkoloTreboneUdalost(
    kandidat.nazev,
    kandidat.mistoNeboTyp,
  );
  if (zarazeni.druh === "hrobka" || zarazeni.druh === "matine") {
    return zarazeni.kotva;
  }
  return null;
}

function vytahnoutEntradioId(html: string): string | null {
  const m = html.match(/shop\.entradio\.cz\/event\/(\d+)/i);
  const id = m?.[1]?.trim() ?? "";
  return /^\d+$/.test(id) ? id : null;
}

export function sestavOkoloTreboneZdrojIdentitu(args: {
  entradioId: string | null;
  datumOd: string;
  cas: string;
  nazev: string;
}): string {
  const entradio = args.entradioId?.trim() ?? "";
  if (/^\d+$/.test(entradio)) {
    return `okolo|entradio|${entradio}`;
  }
  const slug = slugProOkoloIdentitu(args.nazev);
  return `okolo|${args.datumOd}|${args.cas}|${slug}`;
}

function mesicZTextu(surovy: string): number | null {
  const klic = normalizovatOkolo(surovy);
  return MESICE_GENITIV[klic] ?? null;
}

function rozlozTerminOkolo(
  text: string,
): { datum: string; cas: string } | null {
  const t = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const genitiv = t.match(
    /(\d{1,2})\.\s*([A-Za-zÁáČčĎďÉéĚěÍíŇňÓóŘřŠšŤťÚúŮůÝýŽž]+)\s+(20\d{2})\s+od\s+(\d{1,2}):(\d{2})/i,
  );
  if (genitiv) {
    const den = Number(genitiv[1]);
    const mesic = mesicZTextu(genitiv[2] ?? "");
    const rok = Number(genitiv[3]);
    const hodina = Number(genitiv[4]);
    const minuta = Number(genitiv[5]);
    if (
      mesic &&
      jePlatnyDen(rok, mesic, den) &&
      hodina >= 0 &&
      hodina <= 23 &&
      minuta >= 0 &&
      minuta <= 59
    ) {
      return {
        datum: formatujIsoDen(rok, mesic, den),
        cas: formatujCas(hodina, minuta),
      };
    }
    return null;
  }
  const ciselne = t.match(
    /(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})\s+od\s+(\d{1,2}):(\d{2})/,
  );
  if (!ciselne) {
    return null;
  }
  const den = Number(ciselne[1]);
  const mesic = Number(ciselne[2]);
  const rok = Number(ciselne[3]);
  const hodina = Number(ciselne[4]);
  const minuta = Number(ciselne[5]);
  if (
    !jePlatnyDen(rok, mesic, den) ||
    hodina > 23 ||
    minuta > 59
  ) {
    return null;
  }
  return {
    datum: formatujIsoDen(rok, mesic, den),
    cas: formatujCas(hodina, minuta),
  };
}

function rozdelNazevAMisto(radek: string): {
  nazev: string;
  misto: string;
} | null {
  const cisty = radek
    .replace(/\s+/g, " ")
    .replace(/\s*Koupit lístky\s*/gi, " ")
    .trim();
  if (!cisty) {
    return null;
  }
  const carka = cisty.lastIndexOf(",");
  if (carka <= 0 || carka >= cisty.length - 1) {
    return null;
  }
  const nazev = cisty.slice(0, carka).replace(/\s+/g, " ").trim();
  const misto = cisty.slice(carka + 1).replace(/\s+/g, " ").trim();
  if (nazev.length < 2 || misto.length < 2) {
    return null;
  }
  return { nazev, misto };
}

function klicOkoloKandidata(k: OkoloTreboneScanKandidat): string {
  const identita = k.zdrojIdentita?.trim();
  if (identita) {
    return `id\0${identita}`;
  }
  return `${k.nazev}\0${k.datumOd}\0${k.cas}\0${k.mistoNeboTyp}`.toLowerCase();
}

function vytahnoutTextoveBloky(html: string): string[] {
  const bloky: string[] = [];
  const re = /<div class="b-c b-text-c[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const vnitr = m[1] ?? "";
    if (vnitr.trim().length > 0) {
      bloky.push(vnitr);
    }
  }
  return bloky;
}

function prvniOdstavecBezPopisu(blokHtml: string): string | null {
  const odstavce = [
    ...blokHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi),
  ].map((m) => m[0] ?? "");
  if (odstavce.length === 0) {
    return null;
  }
  for (let i = 1; i < odstavce.length; i++) {
    const raw = odstavce[i] ?? "";
    if (/wnd-align-justify/i.test(raw)) {
      continue;
    }
    const text = textBezHtmlOkolo(raw);
    if (text.length >= 2) {
      return text;
    }
  }
  return null;
}

function prazdneOkoloShrnuti(): OkoloTreboneParseShrnuti {
  return {
    kandidati: [],
    nalezeno: 0,
    prijetoHrobka: 0,
    prijetoMatine: 0,
    prijetoNezarazene: 0,
    odmitnutoJkt: 0,
    odmitnutoNocturna: 0,
    odmitnutoTdf: 0,
    odmitnutoMimo: 0,
    odmitnutoNeuplne: 0,
    odmitnutoBezTerminu: 0,
    zahazene: [],
  };
}

function pridejZahazenou(
  shrnuti: OkoloTreboneParseShrnuti,
  skupina: OkoloTreboneZahazenaPolozka["skupina"],
  nazev: string,
  misto: string,
  termin: { datum: string; cas: string },
): void {
  shrnuti.zahazene.push({
    skupina,
    nazev,
    datumOd: termin.datum,
    cas: termin.cas,
    mistoNeboTyp: misto,
  });
}

/**
 * Webnode program: jeden `.b-text-c` blok = nejvýš jedna událost.
 * Bez data, času nebo místa se blok nevrací jako kandidát.
 * A/B se berou zvlášť (stávající strop jen na ně). Neznámý úplný třeboňský
 * zbytek se nevydává podle počtu.
 */
export function parsovatOkoloTreboneProgram(
  html: string,
): OkoloTreboneParseShrnuti {
  const shrnuti = prazdneOkoloShrnuti();
  if (!jeOkoloTreboneProgramHtml(html)) {
    return shrnuti;
  }

  const auto: OkoloTreboneScanKandidat[] = [];
  const nezarazene: OkoloTreboneScanKandidat[] = [];
  const videne = new Set<string>();

  for (const blok of vytahnoutTextoveBloky(html)) {
    const termin = rozlozTerminOkolo(textBezHtmlOkolo(blok));
    if (!termin) {
      shrnuti.odmitnutoBezTerminu += 1;
      continue;
    }
    shrnuti.nalezeno += 1;

    const radek = prvniOdstavecBezPopisu(blok);
    const rozdel = radek ? rozdelNazevAMisto(radek) : null;
    if (!rozdel) {
      shrnuti.odmitnutoNeuplne += 1;
      pridejZahazenou(shrnuti, "neuplne", radek ?? "", "", termin);
      continue;
    }

    const zarazeni = zaraditOkoloTreboneUdalost(rozdel.nazev, rozdel.misto);
    if (
      zarazeni.druh === "jkt" ||
      zarazeni.druh === "nocturna" ||
      zarazeni.druh === "tdf" ||
      zarazeni.druh === "mimo" ||
      zarazeni.druh === "neuplne"
    ) {
      if (zarazeni.druh === "jkt") {
        shrnuti.odmitnutoJkt += 1;
      } else if (zarazeni.druh === "nocturna") {
        shrnuti.odmitnutoNocturna += 1;
      } else if (zarazeni.druh === "tdf") {
        shrnuti.odmitnutoTdf += 1;
      } else if (zarazeni.druh === "mimo") {
        shrnuti.odmitnutoMimo += 1;
      } else {
        shrnuti.odmitnutoNeuplne += 1;
      }
      pridejZahazenou(
        shrnuti,
        zarazeni.druh,
        rozdel.nazev,
        rozdel.misto,
        termin,
      );
      continue;
    }

    const entradioId = vytahnoutEntradioId(blok);
    const kandidat: OkoloTreboneScanKandidat = {
      nazev: rozdel.nazev,
      datumOd: termin.datum,
      datumDo: termin.datum,
      cas: termin.cas,
      mistoNeboTyp: rozdel.misto,
      zdrojIdentita: sestavOkoloTreboneZdrojIdentitu({
        entradioId,
        datumOd: termin.datum,
        cas: termin.cas,
        nazev: rozdel.nazev,
      }),
    };
    const klic = klicOkoloKandidata(kandidat);
    if (videne.has(klic)) {
      continue;
    }
    videne.add(klic);

    if (zarazeni.druh === "hrobka" || zarazeni.druh === "matine") {
      if (auto.length >= MAX_KANDIDATU_OKOLO) {
        continue;
      }
      auto.push(kandidat);
      if (zarazeni.druh === "hrobka") {
        shrnuti.prijetoHrobka += 1;
      } else {
        shrnuti.prijetoMatine += 1;
      }
      continue;
    }

    nezarazene.push(kandidat);
    shrnuti.prijetoNezarazene += 1;
  }

  shrnuti.kandidati = [...auto, ...nezarazene];
  return shrnuti;
}

export function parsovatOkoloTrebone(
  html: string,
  vysledek: OkoloTreboneScanKandidat[],
): void {
  const shrnuti = parsovatOkoloTreboneProgram(html);
  for (const k of shrnuti.kandidati) {
    vysledek.push(k);
  }
}
