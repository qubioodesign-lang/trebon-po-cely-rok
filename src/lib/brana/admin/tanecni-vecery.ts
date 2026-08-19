/**
 * Úzký fail-closed parser tanečních večerů z hubu
 * trebonsko.cz/kategorie/lazensky-kulturni-program/.
 *
 * Jeden zdroj (hub) obslouží oba měsíční články:
 * - Aurora → Restaurace Harmonie
 * - Berta → Restaurace Adéla
 *
 * Aktuální měsíc se NESKLÁDÁ ze slugu (slug může lhát). Autorita je titulek
 * odkazu na hubu, stejný princip jako Třeboňsko kino.
 *
 * Pouze řádky s „Taneční večer“. Kapela/DJ se může přečíst ke kontrole,
 * do BRÁNY se nepřenáší. Třeboňská lázeňská matiné řeší lazenska-matine.ts
 * ze stejného měsíčního článku. Ostatní lázeňský program (kino, přednášky,
 * Křeslo, letní setkávání, …) → 0 kandidátů, žádné Nezařazené.
 *
 * Interní ID kotev se NEHÁDAJÍ podle starého názvu slotu. Scan je najde
 * v živém Redakčním pořadí podle přesného textu Položka + Používat=ANO.
 */

import { dnesVPraze } from "@/lib/brana/cas";
import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";
import type { BranaScanKandidat } from "./zdroj-scan-parser";

export const BRANA_TANECNI_VECER_CO = "Taneční večer";
export const BRANA_TANECNI_VECER_HARMONIE_POLOZKA = "Restaurace Harmonie";
export const BRANA_TANECNI_VECER_ADELA_POLOZKA = "Restaurace Adéla";

export const TREBONSKO_LAZENSKY_PROGRAM_HUB_PATH =
  "/kategorie/lazensky-kulturni-program";

const TREBONSKO_HOST = "trebonsko.cz";
const MAX_KANDIDATU = 40;

const MESIC_NOMINATIV: Readonly<Record<string, number>> = {
  leden: 1,
  unor: 2,
  brezen: 3,
  duben: 4,
  kveten: 5,
  cervenec: 7,
  cerven: 6,
  srpen: 8,
  zari: 9,
  rijen: 10,
  listopad: 11,
  prosinec: 12,
};

export type TanecniVecerSpa = "aurora" | "berta";

export type TrebonskoTanecniVecerMesicOdkaz = {
  url: string;
  rok: number;
  mesic: number;
  spa: TanecniVecerSpa;
};

export type TanecniVecerKandidat = BranaScanKandidat & {
  spa: TanecniVecerSpa;
  interpretKontrola: string;
};

function normalizovatTanecni(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dekodovatTanecniText(raw: string): string {
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

function textBezHtmlTanecni(html: string): string {
  return dekodovatTanecniText(html.replace(/<[^>]+>/g, " "));
}

function hostTrebonsko(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function cestaTrebonsko(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

export function jeTrebonskoLazenskyKulturniProgramZdrojUrl(
  url: string,
): boolean {
  if (hostTrebonsko(url) !== TREBONSKO_HOST) {
    return false;
  }
  const path = cestaTrebonsko(url);
  if (!path) {
    return false;
  }
  if (path === TREBONSKO_LAZENSKY_PROGRAM_HUB_PATH) {
    return true;
  }
  return /^\/kultura-v-lazenskem-dome-/i.test(path);
}

export function sestavTrebonskoLazenskyKulturniProgramHubUrl(
  zdrojUrl: string,
): string {
  if (!jeTrebonskoLazenskyKulturniProgramZdrojUrl(zdrojUrl)) {
    return "";
  }
  try {
    const base = new URL(zdrojUrl);
    return `${base.protocol}//${base.host}${TREBONSKO_LAZENSKY_PROGRAM_HUB_PATH}/`;
  } catch {
    return "";
  }
}

function mesicNominativZTextu(text: string): number | null {
  const n = normalizovatTanecni(text);
  let nalezeny: { mesic: number; delka: number } | null = null;
  for (const [slug, mesic] of Object.entries(MESIC_NOMINATIV)) {
    if (new RegExp(`(?:^|[^a-z])${slug}(?:[^a-z]|$)`, "i").test(n)) {
      if (!nalezeny || slug.length > nalezeny.delka) {
        nalezeny = { mesic, delka: slug.length };
      }
    }
  }
  return nalezeny?.mesic ?? null;
}

function rokZTextu(text: string): number | null {
  const m = text.match(/\b(20\d{2})\b/);
  if (!m) {
    return null;
  }
  const rok = Number(m[1]);
  return Number.isFinite(rok) ? rok : null;
}

function urcitSpaZPopisku(text: string): TanecniVecerSpa | null {
  const n = normalizovatTanecni(text);
  if (!/\bkultura\b/.test(n)) {
    return null;
  }
  const aurora =
    /lazenskem\s+dome\s+aurora/.test(n) ||
    /lazenskeho\s+domu\s+aurora/.test(n);
  const berta =
    /lazenskem\s+dome\s+berta/.test(n) ||
    /lazenskeho\s+domu\s+berta/.test(n) ||
    /bertin(?:ych)?\s+lazn/.test(n);
  if (aurora && !berta) {
    return "aurora";
  }
  if (berta && !aurora) {
    return "berta";
  }
  return null;
}

function atributZTagu(tagAttrs: string, jmeno: string): string {
  const re = new RegExp(
    `\\b${jmeno}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "i",
  );
  const m = tagAttrs.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

function nasledujiciRokMesic(
  rok: number,
  mesic: number,
): { rok: number; mesic: number } {
  if (mesic >= 12) {
    return { rok: rok + 1, mesic: 1 };
  }
  return { rok, mesic: mesic + 1 };
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

function kdeProSpa(spa: TanecniVecerSpa): string {
  return spa === "aurora"
    ? BRANA_TANECNI_VECER_HARMONIE_POLOZKA
    : BRANA_TANECNI_VECER_ADELA_POLOZKA;
}

export function sestavTanecniVecerZdrojIdentitu(args: {
  spa: TanecniVecerSpa;
  datumOd: string;
  cas: string;
}): string {
  return `trebonsko|tanecni-vecer|${args.spa}|${args.datumOd}|${args.cas}`;
}

function spaZIdentity(identita: string | undefined): TanecniVecerSpa | null {
  const m = (identita ?? "").match(
    /^trebonsko\|tanecni-vecer\|(aurora|berta)\|/,
  );
  const spa = m?.[1];
  return spa === "aurora" || spa === "berta" ? spa : null;
}

/**
 * Unikátní ANO kotva podle přesného živého textu Položka.
 * 0 nebo 2+ shody → null (fail-closed, bez hádání starého ID).
 */
export function najitTanecniVecerKotvuPodlePolozky(
  polozky: readonly BranaRedakcniPolozkaStav[],
  polozkaNazev: string,
): string | null {
  const cil = polozkaNazev.trim();
  if (!cil) {
    return null;
  }
  const shody = polozky.filter(
    (p) => p.pouzivat === "ANO" && (p.polozka ?? "").trim() === cil,
  );
  return shody.length === 1 ? shody[0].id : null;
}

export function urcitTanecniVecerKotvu(
  kandidat: Pick<BranaScanKandidat, "zdrojIdentita">,
  polozky: readonly BranaRedakcniPolozkaStav[],
): string | null {
  const spa = spaZIdentity(kandidat.zdrojIdentita);
  if (!spa) {
    return null;
  }
  return najitTanecniVecerKotvuPodlePolozky(polozky, kdeProSpa(spa));
}

function nadpisZHtml(html: string): string {
  const title = textBezHtmlTanecni(
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
  );
  if (urcitSpaZPopisku(title) && mesicNominativZTextu(title) && rokZTextu(title)) {
    return title;
  }
  for (const re of [/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi]) {
    for (const m of html.matchAll(re)) {
      const t = textBezHtmlTanecni(m[1] ?? "");
      if (urcitSpaZPopisku(t) && mesicNominativZTextu(t) && rokZTextu(t)) {
        return t;
      }
    }
  }
  return title;
}

function rokMesicSpaZHtml(
  html: string,
): { rok: number; mesic: number; spa: TanecniVecerSpa } | null {
  const nadpis = nadpisZHtml(html);
  const spa = urcitSpaZPopisku(nadpis);
  const mesic = mesicNominativZTextu(nadpis);
  const rok = rokZTextu(nadpis);
  if (!spa || mesic == null || rok == null) {
    return null;
  }
  return { rok, mesic, spa };
}

/** Rok/měsíc z titulku měsíčního lázeňského článku — sdílené s větví matiné. */
export function rokMesicSpaZTrebonskoLazenskyClanek(
  html: string,
): { rok: number; mesic: number; spa: TanecniVecerSpa } | null {
  return rokMesicSpaZHtml(html);
}

export function jeTanecniVeceryMesicHtml(html: string): boolean {
  if (!/trebonsko\.cz/i.test(html)) {
    return false;
  }
  return rokMesicSpaZHtml(html) != null;
}

/**
 * Z HTML hubu vytáhne aktuální + následující měsíc pro Auroru i Bertu.
 * Titulek odkazu je autorita; slug se nepoužívá k určení spa/měsíce.
 */
export function vytahnoutTrebonskoTanecniVecerMesicUrlky(
  hubHtml: string,
  hubUrl: string,
  referencniOkamzik: Date = new Date(),
): TrebonskoTanecniVecerMesicOdkaz[] {
  if (!jeTrebonskoLazenskyKulturniProgramZdrojUrl(hubUrl) || !hubHtml.trim()) {
    return [];
  }
  let origin: string;
  try {
    origin = new URL(hubUrl).origin;
  } catch {
    return [];
  }
  const hubPath = TREBONSKO_LAZENSKY_PROGRAM_HUB_PATH;

  const dnes = dnesVPraze(referencniOkamzik);
  const aktualni = { rok: dnes.rok, mesic: dnes.mesic };
  const nasledujici = nasledujiciRokMesic(aktualni.rok, aktualni.mesic);

  const podleKlice = new Map<string, TrebonskoTanecniVecerMesicOdkaz>();

  const pridej = (hrefSurovy: string, popisek: string): void => {
    const href = hrefSurovy.trim();
    if (!href || href.startsWith("#") || href.toLowerCase().startsWith("mailto:")) {
      return;
    }
    let abs: URL;
    try {
      abs = new URL(href, origin);
    } catch {
      return;
    }
    if (abs.hostname.replace(/^www\./i, "").toLowerCase() !== TREBONSKO_HOST) {
      return;
    }
    const path = abs.pathname.replace(/\/+$/, "") || "/";
    if (path === hubPath || path.startsWith("/kategorie/")) {
      return;
    }

    const spa = urcitSpaZPopisku(popisek);
    const mesic = mesicNominativZTextu(popisek);
    const rok = rokZTextu(popisek);
    if (!spa || mesic == null || rok == null) {
      return;
    }

    const jeCil =
      (rok === aktualni.rok && mesic === aktualni.mesic) ||
      (rok === nasledujici.rok && mesic === nasledujici.mesic);
    if (!jeCil) {
      return;
    }

    const klic = `${spa}-${rok}-${String(mesic).padStart(2, "0")}`;
    if (podleKlice.has(klic)) {
      return;
    }
    podleKlice.set(klic, {
      url: `${abs.origin}${path}`,
      rok,
      mesic,
      spa,
    });
  };

  for (const m of hubHtml.matchAll(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
  )) {
    const attrs = m[1] ?? "";
    const href = atributZTagu(attrs, "href");
    const title = atributZTagu(attrs, "title");
    const vnitr = textBezHtmlTanecni(m[2] ?? "");
    pridej(href, title || vnitr);
  }

  const out: TrebonskoTanecniVecerMesicOdkaz[] = [];
  for (const spa of ["aurora", "berta"] as const) {
    for (const cil of [aktualni, nasledujici]) {
      const klic = `${spa}-${cil.rok}-${String(cil.mesic).padStart(2, "0")}`;
      const nalezeny = podleKlice.get(klic);
      if (nalezeny) {
        out.push(nalezeny);
      }
    }
  }
  return out;
}

function vytahnoutInterpret(zbytek: string): string {
  const m = zbytek.match(/\bhraje\s+([^,]+)/i);
  return (m?.[1] ?? "").replace(/\s+/g, " ").trim();
}

function parsovatRadekTanecnihoVecera(
  radek: string,
  meta: { rok: number; mesic: number; spa: TanecniVecerSpa },
): TanecniVecerKandidat | null {
  const text = radek.replace(/\s+/g, " ").trim();
  if (!/Taneční večer/i.test(text)) {
    return null;
  }
  const m = text.match(
    /^(\d{1,2})\.(\d{1,2})\.(?:\s+\S+)?\s+(\d{1,2})[.:](\d{2})\s+Taneční večer\b(.*)$/iu,
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
  const cas = formatujCas(hodina, minuta);
  const datumOd = formatujIsoDen(meta.rok, meta.mesic, den);
  const kde = kdeProSpa(meta.spa);
  return {
    nazev: kde,
    datumOd,
    datumDo: datumOd,
    cas,
    mistoNeboTyp: BRANA_TANECNI_VECER_CO,
    zdrojIdentita: sestavTanecniVecerZdrojIdentitu({
      spa: meta.spa,
      datumOd,
      cas,
    }),
    spa: meta.spa,
    interpretKontrola: vytahnoutInterpret(m[5] ?? ""),
  };
}

export function parsovatTanecniVeceryProgram(
  html: string,
): TanecniVecerKandidat[] {
  const meta = rokMesicSpaZHtml(html);
  if (!meta) {
    return [];
  }

  const videne = new Set<string>();
  const out: TanecniVecerKandidat[] = [];

  const pridej = (kandidat: TanecniVecerKandidat | null): void => {
    if (!kandidat || out.length >= MAX_KANDIDATU) {
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
      pridej(parsovatRadekTanecnihoVecera(textBezHtmlTanecni(m[1] ?? ""), meta));
    }
    return out;
  }

  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d)>/gi, "\n");
  for (const radek of textBezHtmlTanecni(text).split(/\n+/)) {
    pridej(parsovatRadekTanecnihoVecera(radek, meta));
  }
  return out;
}

export function parsovatTanecniVecery(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  for (const k of parsovatTanecniVeceryProgram(html)) {
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
