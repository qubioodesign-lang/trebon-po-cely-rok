/**
 * Úzký fail-closed parser programu Divadla J. K. Tyla (iTřeboň kalendář).
 * Jen karty s přesným hlavním místem `Divadlo J. K. Tyla`.
 * TDF / Třeboňská nocturna / foyer / dlouhodobá výstava (rozsah + slovo výstava) → 0.
 * Samotný vícedenní termín výstavu nedokládá. Explicitní Vernisáž / Zahájení výstavy zůstává.
 * GBU parser a obecný iTřeboň HTML dispatcher tento modul nevolají.
 */

import { BRANA_GBU_REDAKCNI_POLOZKA_ID } from "./gbu-titulek";
import type { BranaScanKandidat } from "./zdroj-scan-parser";
import { readFileSync } from "node:fs";
import jktItrebonMezidokument from "./divadlo-jk-tyla-itrebon.json";

export const BRANA_JKT_REDAKCNI_POLOZKA_ID = "divadlo-jk-tyla";

export const BRANA_JKT_CO = "Divadlo J. K. Tyla";

const JKT_MISTO_PRESNE = "Divadlo J. K. Tyla";
const JKT_FOYER_PRESNE = "Foyer Divadla J.K. Tyla";
const JKT_TDF_MISTO_PREFIX = "Divadlo J. K. Tyla - TDF";
const JKT_TDF_NAZEV_PREFIX = "TDF:";
const JKT_NOCTURNA_ZIMNI_PREFIX = "Třeboňská zimní nocturna";
const JKT_NOCTURNA_PREFIX = "Třeboňská nocturna";

const MAX_KANDIDATU_JKT = 40;

export type ItrebonJktVyrazeni =
  | "tdf"
  | "nocturna"
  | "foyer"
  | "vystava"
  | "jine";

const JKT_VERNISAZ_PREFIX = "Vernisáž";
const JKT_ZAHAJENI_VYSTAVY_PREFIX = "Zahájení výstavy";

function normalizovatItrebonMezery(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function dekodovatHtmlText(raw: string): string {
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
    .replace(/\s+/g, " ")
    .trim();
}

function textBezHtmlTagu(html: string): string {
  return dekodovatHtmlText(html.replace(/<[^>]+>/g, " "));
}

function obsahPrvkuPodleTridy(html: string, className: string): string {
  const re = new RegExp(
    `<[^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)</`,
    "i",
  );
  const shoda = html.match(re);
  return textBezHtmlTagu(shoda?.[1] ?? "");
}

function formatujIsoDen(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

function formatujCas(hodina: number, minuta: number): string {
  return `${String(hodina).padStart(2, "0")}:${String(minuta).padStart(2, "0")}`;
}

function jeItrebonKalendarZdrojUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "itrebon.cz") {
      return false;
    }
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return path === "/kalendar.html" || path === "/kalendar";
  } catch {
    return false;
  }
}

/**
 * True = zdroj má stejnou iTřeboň URL jako GBU, ale hlídá kotvu JKT
 * (a ne GBU). Scan větev musí běžet před GBU URL větví.
 */
export function jeItrebonDivadloJkTylaZdroj(zdroj: {
  url: string;
  rezimScanu?: string;
  hlidaneRedakcniPolozkaIds?: readonly string[];
}): boolean {
  if (!jeItrebonKalendarZdrojUrl(zdroj.url)) {
    return false;
  }
  if (zdroj.rezimScanu !== "HLIDANE_KOTVY") {
    return false;
  }
  const ids = (zdroj.hlidaneRedakcniPolozkaIds ?? []).map((id) => id.trim());
  if (!ids.includes(BRANA_JKT_REDAKCNI_POLOZKA_ID)) {
    return false;
  }
  if (ids.includes(BRANA_GBU_REDAKCNI_POLOZKA_ID)) {
    return false;
  }
  return true;
}

export function jePresneItrebonJktHlavniMisto(misto: string): boolean {
  return normalizovatItrebonMezery(misto) === JKT_MISTO_PRESNE;
}

export function jeItrebonJktFoyerMisto(misto: string): boolean {
  return normalizovatItrebonMezery(misto) === JKT_FOYER_PRESNE;
}

export function jeItrebonJktTdfMisto(misto: string): boolean {
  return normalizovatItrebonMezery(misto).startsWith(JKT_TDF_MISTO_PREFIX);
}

export function jeItrebonJktTdfNazev(nazev: string): boolean {
  return normalizovatItrebonMezery(nazev).startsWith(JKT_TDF_NAZEV_PREFIX);
}

export function jeItrebonJktNocturnaNazev(nazev: string): boolean {
  const n = normalizovatItrebonMezery(nazev);
  return (
    n.startsWith(JKT_NOCTURNA_ZIMNI_PREFIX) ||
    n.startsWith(JKT_NOCTURNA_PREFIX)
  );
}

/** Explicitní jednorázové zahájení — ne první den dlouhodobé výstavy. */
export function jeItrebonJktJednorazovaVernisazNazev(nazev: string): boolean {
  const n = normalizovatItrebonMezery(nazev);
  return (
    n.startsWith(JKT_VERNISAZ_PREFIX) ||
    n.startsWith(JKT_ZAHAJENI_VYSTAVY_PREFIX)
  );
}

/** Dva různé dny v `kalTerminDatum`. Samo o sobě to není výstava. */
export function jeItrebonJktDlouhodobyTermin(datumText: string): boolean {
  const datumy = itrebonDatumyZTextu(datumText);
  return Boolean(datumy && datumy.datumOd !== datumy.datumDo);
}

/** Samostatné slovo `výstava` v `kal-nazev` — ne 2. pád `výstavy`. */
export function jeItrebonJktNazevSamostatnaVystava(nazev: string): boolean {
  return /(^|[^\p{L}\p{M}])výstava($|[^\p{L}\p{M}])/iu.test(
    normalizovatItrebonMezery(nazev),
  );
}

/**
 * Dlouhodobá výstava: vícedenní rozsah a explicitní slovo výstava,
 * a název není jednorázová Vernisáž / Zahájení výstavy.
 */
export function jeItrebonJktDlouhodobaVystava(
  nazev: string,
  datumText: string,
): boolean {
  if (!jeItrebonJktDlouhodobyTermin(datumText)) {
    return false;
  }
  if (jeItrebonJktJednorazovaVernisazNazev(nazev)) {
    return false;
  }
  return jeItrebonJktNazevSamostatnaVystava(nazev);
}

function obsahKalTerminDatum(karta: string): string {
  const shoda = karta.match(
    /<[^>]*\bclass=["'][^"']*\bkalTerminDatum\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  return textBezHtmlTagu(shoda?.[1] ?? "");
}

/** Ownership sit před přijetím. `jine` = není přesné hlavní místo JKT. */
export function klasifikovatItrebonJktKartu(
  misto: string,
  nazev: string,
  datumText = "",
): "prijmout" | ItrebonJktVyrazeni {
  if (jeItrebonJktTdfNazev(nazev) || jeItrebonJktTdfMisto(misto)) {
    return "tdf";
  }
  if (jeItrebonJktNocturnaNazev(nazev)) {
    return "nocturna";
  }
  if (jeItrebonJktFoyerMisto(misto)) {
    return "foyer";
  }
  if (!jePresneItrebonJktHlavniMisto(misto)) {
    return "jine";
  }
  if (jeItrebonJktDlouhodobaVystava(nazev, datumText)) {
    return "vystava";
  }
  return "prijmout";
}

function itrebonHrefAId(karta: string): { href: string; id: string } | null {
  const shoda = karta.match(
    /href=["']([^"']*\/kalendar\/[^"'?#]*_(\d+)\.html[^"']*)["']/i,
  );
  const href = (shoda?.[1] ?? "").trim();
  const id = (shoda?.[2] ?? "").trim();
  if (!href || !id) {
    return null;
  }
  return { href, id };
}

function itrebonDatumyZTextu(
  datumText: string,
): { datumOd: string; datumDo: string } | null {
  const shody = [
    ...normalizovatItrebonMezery(datumText).matchAll(
      /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/g,
    ),
  ];
  if (shody.length === 0) {
    return null;
  }
  const prvni = shody[0];
  const den = Number(prvni[1]);
  const mesic = Number(prvni[2]);
  const rok = Number(prvni[3]);
  if (mesic < 1 || mesic > 12 || den < 1 || den > 31) {
    return null;
  }
  const datumOd = formatujIsoDen(rok, mesic, den);
  if (shody.length < 2) {
    return { datumOd, datumDo: datumOd };
  }
  const druhy = shody[1];
  const denDo = Number(druhy[1]);
  const mesicDo = Number(druhy[2]);
  const rokDo = Number(druhy[3]);
  if (mesicDo < 1 || mesicDo > 12 || denDo < 1 || denDo > 31) {
    return { datumOd, datumDo: datumOd };
  }
  return { datumOd, datumDo: formatujIsoDen(rokDo, mesicDo, denDo) };
}

function itrebonZacatekCasu(casText: string): string {
  const shoda = normalizovatItrebonMezery(casText).match(/(\d{1,2}):(\d{2})/);
  if (!shoda) {
    return "";
  }
  const hodina = Number(shoda[1]);
  const minuta = Number(shoda[2]);
  if (hodina > 23 || minuta > 59) {
    return "";
  }
  return formatujCas(hodina, minuta);
}

/**
 * HTML výpis itrebon.cz/kalendar.html → jen program JKT.
 * Cizí místa a cizí kotvy se tiše zahodí (ne Nezařazené).
 * Název jen z `kal-nazev` — bez fallbacku na anotaci, bez žánrového přepisu.
 */
export function parsovatItrebonDivadloJkTyla(html: string): BranaScanKandidat[] {
  const vysledek: BranaScanKandidat[] = [];
  const karty = [
    ...html.matchAll(
      /<div[^>]*\bclass=["'][^"']*\bkalendarAkceBox\b[^"']*["'][^>]*>[\s\S]*?(?=<div[^>]*\bclass=["'][^"']*\bkalendarAkceBox\b|<\/body>|$)/gi,
    ),
  ];
  for (const kartaMatch of karty) {
    if (vysledek.length >= MAX_KANDIDATU_JKT) {
      return vysledek;
    }
    const karta = kartaMatch[0];
    const misto = obsahPrvkuPodleTridy(karta, "kalTerminMisto");
    const nazev = obsahPrvkuPodleTridy(karta, "kal-nazev");
    const datumText = obsahKalTerminDatum(karta);
    if (klasifikovatItrebonJktKartu(misto, nazev, datumText) !== "prijmout") {
      continue;
    }
    if (!nazev || nazev.length < 2) {
      continue;
    }

    const identita = itrebonHrefAId(karta);
    if (!identita) {
      continue;
    }

    const datumy = itrebonDatumyZTextu(datumText);
    if (!datumy) {
      continue;
    }

    vysledek.push({
      nazev,
      datumOd: datumy.datumOd,
      datumDo: datumy.datumDo,
      cas: itrebonZacatekCasu(obsahPrvkuPodleTridy(karta, "kalTerminCas")),
      mistoNeboTyp: JKT_MISTO_PRESNE,
      zdrojIdentita: `itrebon|${identita.id}`,
    });
  }
  return vysledek;
}

const JKT_IDENTITA_RE = /^itrebon\|[1-9]\d*$/;
const JKT_ISO_DEN_RE = /^\d{4}-\d{2}-\d{2}$/;
const JKT_CAS_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const JKT_MEZIDOKUMENT_CHYBA_KONEC = "Nic nebylo uloženo.";

export const BRANA_JKT_ITREBON_MEZIDOKUMENT_RELATIVNI_CESTA =
  "src/lib/brana/admin/divadlo-jk-tyla-itrebon.json";

function jktMezidokumentChyba(duvod: string): never {
  throw new Error(
    `JKT mezidokument iTřeboň ${duvod} ${JKT_MEZIDOKUMENT_CHYBA_KONEC}`,
  );
}

function jeNeprazdnyText(hodnota: unknown): hodnota is string {
  return typeof hodnota === "string";
}

/**
 * Fail-closed čtení mezidokumentu. Nevolá iTřeboň.
 * `vytvoreno` se zachovává v souboru, stáří se zde neblokuje.
 */
export function parsovatItrebonJktMezidokument(
  surovy: unknown,
): BranaScanKandidat[] {
  let data: unknown = surovy;
  if (typeof surovy === "string") {
    try {
      data = JSON.parse(surovy);
    } catch {
      jktMezidokumentChyba("není validní JSON.");
    }
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    jktMezidokumentChyba("má neočekávanou strukturu.");
  }
  const dokument = data as Record<string, unknown>;
  if (!Array.isArray(dokument.kandidati)) {
    jktMezidokumentChyba("nemá pole kandidati.");
  }
  if (dokument.kandidati.length > MAX_KANDIDATU_JKT) {
    jktMezidokumentChyba("má příliš mnoho kandidátů.");
  }

  const vysledek: BranaScanKandidat[] = [];
  const videne = new Set<string>();
  for (const polozka of dokument.kandidati) {
    if (
      polozka === null ||
      typeof polozka !== "object" ||
      Array.isArray(polozka)
    ) {
      jktMezidokumentChyba("obsahuje neplatného kandidáta.");
    }
    const k = polozka as Record<string, unknown>;
    if (
      !jeNeprazdnyText(k.zdrojIdentita) ||
      k.zdrojIdentita.trim().length === 0
    ) {
      jktMezidokumentChyba("obsahuje kandidáta bez zdrojIdentita.");
    }
    const zdrojIdentita = k.zdrojIdentita.trim();
    if (!JKT_IDENTITA_RE.test(zdrojIdentita)) {
      jktMezidokumentChyba("má neplatnou zdrojIdentita.");
    }
    if (videne.has(zdrojIdentita)) {
      jktMezidokumentChyba("obsahuje duplicitní zdrojIdentita.");
    }
    videne.add(zdrojIdentita);
    if (!jeNeprazdnyText(k.nazev) || k.nazev.trim().length < 2) {
      jktMezidokumentChyba("obsahuje kandidáta s neplatným názvem.");
    }
    if (!jeNeprazdnyText(k.datumOd) || !JKT_ISO_DEN_RE.test(k.datumOd)) {
      jktMezidokumentChyba("obsahuje kandidáta s neplatným datumOd.");
    }
    if (!jeNeprazdnyText(k.datumDo) || !JKT_ISO_DEN_RE.test(k.datumDo)) {
      jktMezidokumentChyba("obsahuje kandidáta s neplatným datumDo.");
    }
    if (!jeNeprazdnyText(k.cas) || (k.cas !== "" && !JKT_CAS_RE.test(k.cas))) {
      jktMezidokumentChyba("obsahuje kandidáta s neplatným časem.");
    }
    if (
      !jeNeprazdnyText(k.mistoNeboTyp) ||
      k.mistoNeboTyp.trim() !== JKT_MISTO_PRESNE
    ) {
      jktMezidokumentChyba("obsahuje kandidáta s neplatným místem.");
    }
    vysledek.push({
      nazev: k.nazev,
      datumOd: k.datumOd,
      datumDo: k.datumDo,
      cas: k.cas,
      mistoNeboTyp: JKT_MISTO_PRESNE,
      zdrojIdentita,
    });
  }
  return vysledek;
}

/** Produkční JKT scan: zabalený ověřený JSON, bez HTTP. */
export function nacistItrebonJktKandidatyZMezidokumentu(): BranaScanKandidat[] {
  return parsovatItrebonJktMezidokument(jktItrebonMezidokument);
}

/** Ověření chybějícího souboru. Produkční scan používá zabalený JSON. */
export function nacistItrebonJktMezidokumentZeSouboru(
  cesta: string,
): BranaScanKandidat[] {
  let text: string;
  try {
    text = readFileSync(cesta, "utf8");
  } catch {
    jktMezidokumentChyba("chybí.");
  }
  return parsovatItrebonJktMezidokument(text);
}
