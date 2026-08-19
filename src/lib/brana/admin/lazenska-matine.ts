/**
 * Úzká větev Třeboňských lázeňských matiné ze stejného Třeboňsko
 * lázeňského hubu jako taneční večery.
 *
 * Discovery nemění: hub → měsíční článek Aurora/Berta.
 * Autorita místa je text řádku matiné, ne spa článku ani roční období.
 * Stejné matiné v Auroře i Bertě → stejná zdrojIdentita matine|{YYYY-MM-DD}.
 * Okolo Třeboně používá tutéž identitu (legacy okolo|… řeší scan alias).
 */

import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";
import { rokMesicSpaZTrebonskoLazenskyClanek } from "./tanecni-vecery";
import type { BranaScanKandidat } from "./zdroj-scan-parser";

export const BRANA_MATINE_REDAKCNI_POLOZKA_ID = "trebonska-lazenska-matine";
export const BRANA_MATINE_POLOZKA = "Třeboňská lázeňská matiné";
export const BRANA_MATINE_CO = "Lázeňské matiné";
export const BRANA_MATINE_KDE_ALTAN_BERTA = "Altán u lázeňského domu Berta";
export const BRANA_MATINE_KDE_LAZNE_AURORA = "Lázně Aurora";

const MAX_KANDIDATU_MATINE = 12;
const MATINE_IDENTITA_RE = /^matine\|(\d{4}-\d{2}-\d{2})$/;

export type LazenskaMatineKandidat = BranaScanKandidat;

function normalizovatMatine(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dekodovatMatineText(raw: string): string {
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
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textBezHtmlMatine(html: string): string {
  return dekodovatMatineText(html.replace(/<[^>]+>/g, " "));
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

function formatujIsoDen(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

function formatujCas(hodina: number, minuta: number): string {
  return `${String(hodina).padStart(2, "0")}:${String(minuta).padStart(2, "0")}`;
}

/** Invariant: jedno veřejné matiné v kalendářní den. */
export function sestavMatineZdrojIdentitu(datumOd: string): string {
  const d = datumOd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return "";
  }
  return `matine|${d}`;
}

export function jeMatineZdrojIdentita(
  identita: string | undefined | null,
): boolean {
  return MATINE_IDENTITA_RE.test((identita ?? "").trim());
}

export function datumZMatineZdrojIdentity(
  identita: string | undefined | null,
): string | null {
  const m = (identita ?? "").trim().match(MATINE_IDENTITA_RE);
  return m?.[1] ?? null;
}

/**
 * Primární místo z publikovaného textu. Varianta deště se ignoruje.
 * Fail-closed: neznámý text → null (nehádat z Aurora/Berta článku).
 */
export function kanonizovatMatinePrimarniMisto(text: string): string | null {
  const n = normalizovatMatine(text);
  if (!n) {
    return null;
  }
  const maAltan = /\baltan\b/.test(n);
  const maBertaNeboLdb = /\bberta\b/.test(n) || /\bldb\b/.test(n);
  if (maAltan && maBertaNeboLdb) {
    return BRANA_MATINE_KDE_ALTAN_BERTA;
  }
  if (maAltan && /\blazenskeho domu berta\b/.test(n)) {
    return BRANA_MATINE_KDE_ALTAN_BERTA;
  }
  if (maAltan) {
    return null;
  }
  const maAuroraNeboLda = /\baurora\b/.test(n) || /\blda\b/.test(n);
  const maSal = /\bsal\b/.test(n) || /\bspolecensk/.test(n);
  if (maAuroraNeboLda && maSal) {
    return BRANA_MATINE_KDE_LAZNE_AURORA;
  }
  if (/\blazne aurora\b/.test(n) || /\bld aurora\b/.test(n)) {
    return BRANA_MATINE_KDE_LAZNE_AURORA;
  }
  return null;
}

function sestavMatineNazev(zbytek: string): string | null {
  const t = zbytek.replace(/\s+/g, " ").trim();
  if (!t || /připravujeme/i.test(t)) {
    return null;
  }
  const q = t.match(/"([^"]+)"/);
  const program = (q?.[1] ?? "").replace(/\s+/g, " ").trim();
  let rest = t;
  if (q && q.index != null) {
    rest = `${t.slice(0, q.index)} ${t.slice(q.index + q[0].length)}`;
  }
  rest = rest.replace(/^[,.\s]+/, "");
  rest = rest.split(/vstupné/i)[0] ?? "";
  rest = rest.split(/\bLDB\b/i)[0] ?? "";
  rest = rest.split(/\bLDA\b/i)[0] ?? "";
  rest = rest.split(/Altán/i)[0] ?? "";
  rest = rest.replace(/\([^)]*\)/g, " ");
  rest = rest.replace(/[–—-]\s*v případě[\s\S]*$/i, "");
  rest = rest.replace(/[,;:./–—-]+$/g, "").replace(/\s+/g, " ").trim();
  const interpreti = rest.length >= 3 ? rest : "";
  if (program && interpreti) {
    return `${program} / ${interpreti}`;
  }
  if (program) {
    return program;
  }
  if (interpreti) {
    return interpreti;
  }
  return null;
}

export function najitMatineKotvuPodlePolozky(
  polozky: readonly BranaRedakcniPolozkaStav[],
): string | null {
  const shody = polozky.filter(
    (p) =>
      p.pouzivat === "ANO" && (p.polozka ?? "").trim() === BRANA_MATINE_POLOZKA,
  );
  return shody.length === 1 ? shody[0].id : null;
}

export function urcitLazenskaMatineKotvu(
  kandidat: Pick<BranaScanKandidat, "zdrojIdentita">,
  polozky: readonly BranaRedakcniPolozkaStav[],
): string | null {
  if (!jeMatineZdrojIdentita(kandidat.zdrojIdentita)) {
    return null;
  }
  return najitMatineKotvuPodlePolozky(polozky);
}

function parsovatRadekMatine(
  radek: string,
  meta: { rok: number; mesic: number },
): LazenskaMatineKandidat | null {
  const text = radek.replace(/\s+/g, " ").trim();
  if (!/Třeboňská lázeňská matiné/i.test(text)) {
    return null;
  }
  if (/Taneční večer/i.test(text)) {
    return null;
  }
  const m = text.match(
    /^(\d{1,2})\.(\d{1,2})\.(?:\s+\S+)?\s+(\d{1,2})[.:](\d{2})\s+Třeboňská lázeňská matiné(?:\s+|$)(.*)$/iu,
  );
  if (!m) {
    return null;
  }
  const den = Number(m[1]);
  const mesicRadek = Number(m[2]);
  const hodina = Number(m[3]);
  const minuta = Number(m[4]);
  if (mesicRadek !== meta.mesic) {
    return null;
  }
  if (
    !jePlatnyDen(meta.rok, meta.mesic, den) ||
    hodina > 23 ||
    minuta > 59
  ) {
    return null;
  }
  const zbytek = (m[5] ?? "").trim();
  const nazev = sestavMatineNazev(zbytek);
  const kde = kanonizovatMatinePrimarniMisto(zbytek);
  if (!nazev || !kde) {
    return null;
  }
  const datumOd = formatujIsoDen(meta.rok, meta.mesic, den);
  const identita = sestavMatineZdrojIdentitu(datumOd);
  if (!identita) {
    return null;
  }
  return {
    nazev,
    datumOd,
    datumDo: datumOd,
    cas: formatujCas(hodina, minuta),
    mistoNeboTyp: kde,
    zdrojIdentita: identita,
  };
}

export function parsovatLazenskaMatineProgram(
  html: string,
): LazenskaMatineKandidat[] {
  const meta = rokMesicSpaZTrebonskoLazenskyClanek(html);
  if (!meta) {
    return [];
  }

  const videne = new Set<string>();
  const out: LazenskaMatineKandidat[] = [];

  const pridej = (kandidat: LazenskaMatineKandidat | null): void => {
    if (!kandidat || out.length >= MAX_KANDIDATU_MATINE) {
      return;
    }
    const klic = kandidat.zdrojIdentita ?? "";
    if (!klic || videne.has(klic)) {
      return;
    }
    videne.add(klic);
    out.push(kandidat);
  };

  const li = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
  if (li.length > 0) {
    for (const m of li) {
      pridej(parsovatRadekMatine(textBezHtmlMatine(m[1] ?? ""), meta));
    }
    return out;
  }

  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d)>/gi, "\n");
  for (const radek of textBezHtmlMatine(text).split(/\n+/)) {
    pridej(parsovatRadekMatine(radek, meta));
  }
  return out;
}

export function parsovatLazenskaMatine(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  for (const k of parsovatLazenskaMatineProgram(html)) {
    vysledek.push({
      nazev: k.nazev,
      datumOd: k.datumOd,
      datumDo: k.datumDo,
      cas: k.cas,
      mistoNeboTyp: k.mistoNeboTyp,
      zdrojIdentita: k.zdrojIdentita,
    });
  }
}
