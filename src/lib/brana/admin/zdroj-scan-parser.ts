/**
 * Parser obsahu jednoho známého zdroje.
 * Preferuje JSON-LD schema.org Event; úzké HTML větve jen pro program
 * kinotrebon.cz (`.section-event`), trebonskanocturna.cz (karty `/koncert/`),
 * dumstepankanetolickeho.cz (`.home-block-wrapper.event-item`),
 * trebon105.cz (`article.event` jen v sekci Akce, ne Výstavy),
 * zameckalekarnatrebon.cz (měsíční `.articleContent` denní program),
 * rybarstvi.cz (podzimní výlovy – roční sekce / tabulka),
 * trebonsko.cz/remeslne-trhy-trebon (městské Trhy – fail-closed whitelist)
 * a cityevent.cz/pro-ucastniky (+ /festival/*trebon*) pro Street Food / Beer & Food Fest.
 * Odděleně od Kalendáře a Blob zápisu.
 * Datum/čas: Europe/Prague (včetně DST) přes stávající brana/cas.
 * Multi-měsíční fetch DSN / Zámecká lékárna / Rybářství žije ve scan orchestraci, ne zde.
 */

import { dnesVPraze, okamzikVPraze } from "@/lib/brana/cas";

export type BranaScanKandidat = {
  nazev: string;
  /** ISO YYYY-MM-DD – povinné, lokální den Europe/Prague */
  datumOd: string;
  datumDo: string;
  /** HH:mm nebo prázdný řetězec, pokud zdroj čas neudává */
  cas: string;
  mistoNeboTyp: string;
};

const MAX_KANDIDATU = 40;
/** Bohatý denní program Zámecké lékárny – bez redakčního filtru v parseru. */
const MAX_KANDIDATU_ZAMECKA_LEKARNA = 200;
const ZAMECKA_LEKARNA_HUB_PATH = "/c-24-denni-program.html";
const ZAMECKA_LEKARNA_MAX_MESICU = 4;
const ZAMECKA_LEKARNA_MESIC_HREF_RE =
  /\/c-\d+-(?:leden|unor|brezen|duben|kveten|cerven|cervenec|srpen|zari|rijen|listopad|prosinec)-\d{4}\.html/i;
const RYBARSTVI_PODZIMNI_VYLOVY_PATH = "/podzimni-vylov-rybniku";
const MAX_KANDIDATU_RYBARSTVI = 40;
/** Redakční kotva rodiny Trhů — ownership Třeboňsko / City Event / později MINT. */
export const BRANA_TRHY_REDAKCNI_POLOZKA_ID = "trhy";
const TREBONSKO_REMESLNE_TRHY_PATH = "/remeslne-trhy-trebon";
const MAX_KANDIDATU_TREBONSKO_TRHY = 40;
const CITYEVENT_PRO_UCASTNIKY_PATH = "/pro-ucastniky";
const MAX_KANDIDATU_CITYEVENT_TRHY = 20;

type RozkladDatumCas = {
  datum: string;
  /** Prázdné u date-only */
  cas: string;
};

function formatujIsoDen(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

function formatujCas(hodina: number, minuta: number): string {
  return `${String(hodina).padStart(2, "0")}:${String(minuta).padStart(2, "0")}`;
}

/** True, pokud `dalsi` je přesně kalendářní den po `od` (UTC denní aritmetika ISO). */
function jePresneNasledujiciIsoDen(od: string, dalsi: string): boolean {
  const casti = od.split("-").map(Number);
  if (casti.length !== 3 || casti.some((n) => !Number.isFinite(n))) {
    return false;
  }
  const [y, m, d] = casti;
  const kurzor = new Date(Date.UTC(y, m - 1, d));
  kurzor.setUTCDate(kurzor.getUTCDate() + 1);
  return (
    dalsi ===
    formatujIsoDen(
      kurzor.getUTCFullYear(),
      kurzor.getUTCMonth() + 1,
      kurzor.getUTCDate(),
    )
  );
}

function maExplicitniOffset(hodnota: string): boolean {
  return /(?:Z|[zZ]|[+-]\d{2}:?\d{2})$/.test(hodnota.trim());
}

/**
 * A) date-only → beze změny
 * B) datetime s Z/offset → okamžik → Europe/Prague den + čas
 * C) datetime bez offsetu → wall-clock Europe/Prague (ne UTC)
 */
function rozlozDatumCasZdroje(hodnota: unknown): RozkladDatumCas | null {
  if (typeof hodnota !== "string" || !hodnota.trim()) {
    return null;
  }
  const trim = hodnota.trim();

  // A) DATE-ONLY YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trim)) {
    return { datum: trim, cas: "" };
  }

  // A) české date-only
  const czJenDen = trim.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (czJenDen) {
    return {
      datum: formatujIsoDen(
        Number(czJenDen[3]),
        Number(czJenDen[2]),
        Number(czJenDen[1]),
      ),
      cas: "",
    };
  }

  // B) DATETIME s explicitním offsetem / Z
  if (maExplicitniOffset(trim) && trim.includes("T")) {
    const okamzik = new Date(trim);
    if (Number.isNaN(okamzik.getTime())) {
      return null;
    }
    const praha = okamzikVPraze(okamzik);
    return {
      datum: formatujIsoDen(praha.rok, praha.mesic, praha.den),
      cas: formatujCas(praha.hodina, praha.minuta),
    };
  }

  // C) DATETIME bez offsetu → lokální wall-clock Europe/Prague
  const lokalni = trim.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/,
  );
  if (lokalni) {
    const rok = Number(lokalni[1]);
    const mesic = Number(lokalni[2]);
    const den = Number(lokalni[3]);
    const hodina = Number(lokalni[4]);
    const minuta = Number(lokalni[5]);
    if (
      mesic < 1 ||
      mesic > 12 ||
      den < 1 ||
      den > 31 ||
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

  // české datum s časem bez offsetu → Prague wall-clock
  const czCas = trim.match(
    /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})$/,
  );
  if (czCas) {
    return {
      datum: formatujIsoDen(
        Number(czCas[3]),
        Number(czCas[2]),
        Number(czCas[1]),
      ),
      cas: formatujCas(Number(czCas[4]), Number(czCas[5])),
    };
  }

  return null;
}

function textZPole(hodnota: unknown): string {
  if (typeof hodnota === "string") {
    return hodnota.trim();
  }
  if (hodnota && typeof hodnota === "object") {
    const o = hodnota as Record<string, unknown>;
    if (typeof o.name === "string") {
      return o.name.trim();
    }
    if (typeof o["@value"] === "string") {
      return o["@value"].trim();
    }
  }
  return "";
}

function mistoZEventu(event: Record<string, unknown>): string {
  const location = event.location;
  if (typeof location === "string") {
    return location.trim();
  }
  if (location && typeof location === "object") {
    const loc = location as Record<string, unknown>;
    const name = textZPole(loc.name);
    if (name) {
      return name;
    }
    const address = loc.address;
    if (typeof address === "string") {
      return address.trim();
    }
    if (address && typeof address === "object") {
      const addr = address as Record<string, unknown>;
      const casti = [
        textZPole(addr.streetAddress),
        textZPole(addr.addressLocality),
      ].filter(Boolean);
      if (casti.length > 0) {
        return casti.join(", ");
      }
    }
  }
  return "";
}

function typEventu(hodnota: unknown): boolean {
  if (typeof hodnota === "string") {
    return /(^|\/)Event$/i.test(hodnota) || hodnota.toLowerCase() === "event";
  }
  if (Array.isArray(hodnota)) {
    return hodnota.some(typEventu);
  }
  return false;
}

function kandidatZEventu(
  event: Record<string, unknown>,
): BranaScanKandidat | null {
  if (!typEventu(event["@type"]) && !typEventu(event.type)) {
    return null;
  }

  const nazev = textZPole(event.name) || textZPole(event.headline);
  const start = rozlozDatumCasZdroje(event.startDate ?? event.start);
  if (!nazev || !start) {
    return null;
  }

  const konec =
    rozlozDatumCasZdroje(event.endDate ?? event.end) ?? start;

  let cas = start.cas;
  if (!cas) {
    const dvere = rozlozDatumCasZdroje(event.doorTime);
    if (dvere?.cas) {
      cas = dvere.cas;
    }
  }

  return {
    nazev,
    datumOd: start.datum,
    datumDo: konec.datum < start.datum ? start.datum : konec.datum,
    cas,
    mistoNeboTyp: mistoZEventu(event),
  };
}

function projdiUzel(
  uzel: unknown,
  vysledek: BranaScanKandidat[],
): void {
  if (vysledek.length >= MAX_KANDIDATU) {
    return;
  }
  if (!uzel) {
    return;
  }
  if (Array.isArray(uzel)) {
    for (const polozka of uzel) {
      projdiUzel(polozka, vysledek);
      if (vysledek.length >= MAX_KANDIDATU) {
        return;
      }
    }
    return;
  }
  if (typeof uzel !== "object") {
    return;
  }
  const obj = uzel as Record<string, unknown>;
  if (obj["@graph"]) {
    projdiUzel(obj["@graph"], vysledek);
  }
  const kandidat = kandidatZEventu(obj);
  if (kandidat) {
    vysledek.push(kandidat);
  }
  if (obj.itemListElement) {
    projdiUzel(obj.itemListElement, vysledek);
  }
  if (obj.item) {
    projdiUzel(obj.item, vysledek);
  }
}

function vytahnoutJsonLdBloky(html: string): unknown[] {
  const bloky: unknown[] = [];
  const re =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }
    try {
      bloky.push(JSON.parse(raw) as unknown);
    } catch {
      // Neplatný JSON-LD blok přeskočíme
    }
  }
  return bloky;
}

/** Úzká detekce programu Kino Třeboň / kinotrebon.cz (Colosseum šablona). */
function jeKinotrebonProgramHtml(html: string): boolean {
  return (
    /kinotrebon\.cz/i.test(html) &&
    /class=["'][^"']*\bsection-event\b/i.test(html) &&
    /class=["']heading-time["']/i.test(html) &&
    /button-tickets-websale/i.test(html)
  );
}

/**
 * kinotrebon heading-time: „po, 10. 8. 2026“ → ISO den.
 * Bez vymyšleného data – neznámý tvar → null.
 */
function datumZKinotrebonHeading(heading: string): string | null {
  const m = heading
    .trim()
    .match(/^[^,]*,\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*$/);
  if (!m) {
    return null;
  }
  return (
    rozlozDatumCasZdroje(`${m[1]}.${m[2]}.${m[3]}`)?.datum ?? null
  );
}

const KINOSAL_AURORA_SUFFIX =
  /\s*KINOSÁL\s+LÁZEŇSKÝ\s+DŮM\s+AURORA\s*$/i;

function nazevAMistoZKinotrebonTitulu(titul: string): {
  nazev: string;
  mistoNeboTyp: string;
} {
  const raw = titul.replace(/\s+/g, " ").trim();
  const jeAurora = KINOSAL_AURORA_SUFFIX.test(raw);
  const nazev = (jeAurora ? raw.replace(KINOSAL_AURORA_SUFFIX, "") : raw).trim();
  return {
    nazev: nazev || raw,
    // Přesná shoda s redakční položkou (ne obecné „Kino“).
    mistoNeboTyp: jeAurora ? "Kino Aurora" : "Kino Světozor",
  };
}

/**
 * HTML program kinotrebon.cz → BranaScanKandidat.
 * Jedna projekce = jeden kandidát (název + datum + čas).
 */
function parsovatKinotrebonSectionEvent(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  const blokRe =
    /<div class="section-event-text">([\s\S]*?)<\/div>\s*<\/div>/gi;
  let blokMatch: RegExpExecArray | null;
  while (
    (blokMatch = blokRe.exec(html)) !== null &&
    vysledek.length < MAX_KANDIDATU
  ) {
    const blok = blokMatch[1] ?? "";
    const titulRaw =
      blok
        .match(/<h2>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i)?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim() ?? "";
    if (!titulRaw) {
      continue;
    }
    const { nazev, mistoNeboTyp } = nazevAMistoZKinotrebonTitulu(titulRaw);

    const programy = [
      ...blok.matchAll(
        /<div class="program-small">([\s\S]*?)(?=<div class="program-small">|$)/gi,
      ),
    ].map((m) => m[1] ?? "");
    const casti = programy.length > 0 ? programy : [blok];

    for (const cast of casti) {
      if (vysledek.length >= MAX_KANDIDATU) {
        return;
      }
      const heading =
        cast.match(/class=["']heading-time["']>([^<]+)</i)?.[1]?.trim() ??
        "";
      const datum = datumZKinotrebonHeading(heading);
      if (!datum) {
        continue;
      }
      const casy = [
        ...cast.matchAll(
          /button-tickets-websale[\s\S]*?<span>\s*(\d{1,2}:\d{2})\s*<\/span>/gi,
        ),
      ].map((m) => m[1]);
      for (const casRaw of casy) {
        if (vysledek.length >= MAX_KANDIDATU) {
          return;
        }
        const casMatch = casRaw.match(/^(\d{1,2}):(\d{2})$/);
        if (!casMatch) {
          continue;
        }
        const hodina = Number(casMatch[1]);
        const minuta = Number(casMatch[2]);
        if (hodina > 23 || minuta > 59) {
          continue;
        }
        vysledek.push({
          nazev,
          datumOd: datum,
          datumDo: datum,
          cas: formatujCas(hodina, minuta),
          mistoNeboTyp,
        });
      }
    }
  }
}

/** Minimální dekódování HTML entit v textu z nocturny (číselné + běžné české). */
function dekodovatHtmlText(raw: string): string {
  const pojmenovane: Record<string, string> = {
    nbsp: " ",
    amp: "&",
    quot: '"',
    lt: "<",
    gt: ">",
    aacute: "á",
    Aacute: "Á",
    eacute: "é",
    Eacute: "É",
    iacute: "í",
    Iacute: "Í",
    oacute: "ó",
    Oacute: "Ó",
    uacute: "ú",
    Uacute: "Ú",
    yacute: "ý",
    Yacute: "Ý",
    scaron: "š",
    Scaron: "Š",
    ccaron: "č",
    Ccaron: "Č",
    rcaron: "ř",
    Rcaron: "Ř",
    zcaron: "ž",
    Zcaron: "Ž",
    ecaron: "ě",
    Ecaron: "Ě",
    ncaron: "ň",
    Ncaron: "Ň",
    uring: "ů",
    Uring: "Ů",
  };
  return raw
    .replace(/&#(\d+);/g, (_, n: string) => {
      const kod = Number(n);
      return Number.isFinite(kod) ? String.fromCharCode(kod) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => {
      const kod = Number.parseInt(n, 16);
      return Number.isFinite(kod) ? String.fromCharCode(kod) : "";
    })
    .replace(/&([a-zA-Z]+);/g, (cele, jmeno: string) => {
      return pojmenovane[jmeno] ?? cele;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function textBezHtmlTagu(html: string): string {
  return dekodovatHtmlText(html.replace(/<[^>]+>/g, " "));
}

/** Úzká detekce programu Třeboňské nocturny (WordPress / Oxygen karty koncertů). */
function jeTrebonskaNocturnaProgramHtml(html: string): boolean {
  return (
    /trebonskanocturna\.cz/i.test(html) &&
    /\/koncert\//i.test(html) &&
    /\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\s+\d{1,2}:\d{2}/.test(html)
  );
}

function jePouzitelnyNazevNocturnaKoncertu(nazev: string): boolean {
  if (!nazev || nazev.length < 2) {
    return false;
  }
  if (/^více informací$/i.test(nazev)) {
    return false;
  }
  if (/^vstupenky$/i.test(nazev)) {
    return false;
  }
  if (/^\d+\.\s*abonentní\s+koncert$/i.test(nazev)) {
    return false;
  }
  return true;
}

/**
 * HTML program trebonskanocturna.cz → BranaScanKandidat.
 * Jedna karta koncertu = jeden kandidát (datum+čas → název z /koncert/ → místo).
 * Nejednoznačné karty se vynechají.
 */
function parsovatTrebonskaNocturnaKoncerty(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  const datumRe =
    /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})/g;
  const datumMatches = [...html.matchAll(datumRe)];
  if (datumMatches.length === 0) {
    return;
  }

  for (let i = 0; i < datumMatches.length; i++) {
    if (vysledek.length >= MAX_KANDIDATU) {
      return;
    }
    const match = datumMatches[i];
    const start = match.index ?? 0;
    const end =
      i + 1 < datumMatches.length
        ? (datumMatches[i + 1].index ?? start + 2500)
        : Math.min(html.length, start + 2500);
    const okno = html.slice(start, end);

    const rozklad = rozlozDatumCasZdroje(
      `${match[1]}.${match[2]}.${match[3]} ${match[4]}:${match[5]}`,
    );
    if (!rozklad?.datum || !rozklad.cas) {
      continue;
    }

    const odkazy = [
      ...okno.matchAll(
        /<a[^>]*href=["'][^"']*\/koncert\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
      ),
    ];
    let nazev = "";
    for (const odkaz of odkazy) {
      const kandidatNazev = textBezHtmlTagu(odkaz[1] ?? "");
      if (jePouzitelnyNazevNocturnaKoncertu(kandidatNazev)) {
        nazev = kandidatNazev;
        break;
      }
    }
    if (!nazev) {
      // /program/: název bývá v h2.program-h2 se spanem uvnitř odkazu na /koncert/.
      const h2 = okno.match(
        /class=["'][^"']*program-h2[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
      );
      const zH2 = textBezHtmlTagu(h2?.[1] ?? "");
      if (jePouzitelnyNazevNocturnaKoncertu(zH2)) {
        nazev = zH2;
      }
    }
    if (!nazev) {
      continue;
    }

    let mistoNeboTyp = "";
    const spanTexty = [
      ...okno.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi),
    ].map((m) => textBezHtmlTagu(m[1] ?? ""));
    for (const text of spanTexty) {
      if (!text || text === nazev) {
        continue;
      }
      if (/^\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/.test(text)) {
        continue;
      }
      if (/abonentní\s+koncert/i.test(text)) {
        continue;
      }
      if (/^více informací$/i.test(text) || /^vstupenky$/i.test(text)) {
        continue;
      }
      // Místo typicky obsahuje čárku nebo známé slovo místa.
      if (/,/.test(text) || /divadlo|nádvoří|zámek|sál|kasár/i.test(text)) {
        mistoNeboTyp = text;
        break;
      }
    }

    vysledek.push({
      nazev,
      datumOd: rozklad.datum,
      datumDo: rozklad.datum,
      cas: rozklad.cas,
      mistoNeboTyp,
    });
  }
}

/** True, pokud URL zdroje míří na oficiální web DSN (s/bez www). */
export function jeDumStepankaNetolickehoZdrojUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    return host === "dumstepankanetolickeho.cz";
  } catch {
    return false;
  }
}

/**
 * 4 SSR URL kalendáře DSN: aktuální měsíc + 3 následující (Europe/Prague).
 * Přechod roku: 12 → 1 následujícího roku.
 * Origin (protokol + host) bere ze zdrojové URL.
 */
export function sestavDumStepankaKalendarUrlkyCtyriMesice(
  zdrojUrl: string,
  okamzik: Date = new Date(),
): string[] {
  if (!jeDumStepankaNetolickehoZdrojUrl(zdrojUrl)) {
    return [];
  }
  const base = new URL(zdrojUrl);
  const dnes = dnesVPraze(okamzik);
  let mesic = dnes.mesic;
  let rok = dnes.rok;
  const urlky: string[] = [];
  for (let i = 0; i < 4; i++) {
    urlky.push(
      `${base.protocol}//${base.host}/kalendar-akci/?mesic=${mesic}&rok=${rok}`,
    );
    mesic += 1;
    if (mesic > 12) {
      mesic = 1;
      rok += 1;
    }
  }
  return urlky;
}

/** Úzká detekce měsíčního kalendáře DSN (WordPress `.event-item`). */
function jeDumStepankaProgramHtml(html: string): boolean {
  return (
    /dumstepankanetolickeho\.cz/i.test(html) &&
    /home-block-wrapper[^>]*event-item|event-item[^>]*home-block-wrapper/i.test(
      html,
    )
  );
}

/**
 * Normalizace času z karty DSN → HH:mm, nebo "" pokud čas chybí.
 * Podporuje: 17:00 | 14 | 18 hod. Neznámý tvar → null (karta se vynechá).
 */
function normalizujCasDumStepanka(casSurovy: string): string | null {
  const t = casSurovy.trim().toLowerCase();
  if (!t) {
    return "";
  }
  const hhmm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const hodina = Number(hhmm[1]);
    const minuta = Number(hhmm[2]);
    if (hodina > 23 || minuta > 59) {
      return null;
    }
    return formatujCas(hodina, minuta);
  }
  const hod = t.match(/^(\d{1,2})\s*hod\.?$/);
  if (hod) {
    const hodina = Number(hod[1]);
    if (hodina > 23) {
      return null;
    }
    return formatujCas(hodina, 0);
  }
  const jenHodina = t.match(/^(\d{1,2})$/);
  if (jenHodina) {
    const hodina = Number(jenHodina[1]);
    if (hodina > 23) {
      return null;
    }
    return formatujCas(hodina, 0);
  }
  return null;
}

/**
 * HTML kalendář dumstepankanetolickeho.cz → BranaScanKandidat.
 * Jedna karta `.home-block-wrapper.event-item` = jeden kandidát.
 * Místo v kartě typicky chybí → mistoNeboTyp prázdné (matching přes zdrojNazev).
 */
function parsovatDumStepankaEventItem(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  const bloky = [
    ...html.matchAll(
      /home-block-wrapper[^"']*event-item[\s\S]*?(?=home-block-wrapper[^"']*event-item|<\/body>|$)/gi,
    ),
  ];
  for (const blokMatch of bloky) {
    if (vysledek.length >= MAX_KANDIDATU) {
      return;
    }
    const blok = blokMatch[0];
    const nazevZTitle = blok.match(
      /<a[^>]*title=["']([^"']+)["'][^>]*>/i,
    );
    const nazevZTextu = blok.match(
      /<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
    );
    const nazev = textBezHtmlTagu(
      nazevZTitle?.[1] ?? nazevZTextu?.[1] ?? "",
    );
    if (!nazev || nazev.length < 2) {
      continue;
    }

    const small = blok.match(/<small[^>]*>([\s\S]*?)<\/small>/i);
    const smallText = textBezHtmlTagu(small?.[1] ?? "");
    const datumCas = smallText.match(
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(.+))?$/,
    );
    if (!datumCas) {
      continue;
    }
    const datum = formatujIsoDen(
      Number(datumCas[3]),
      Number(datumCas[2]),
      Number(datumCas[1]),
    );
    // Ověření, že den/měsíc dávají smysl.
    if (
      Number(datumCas[2]) < 1 ||
      Number(datumCas[2]) > 12 ||
      Number(datumCas[1]) < 1 ||
      Number(datumCas[1]) > 31
    ) {
      continue;
    }
    const cas = normalizujCasDumStepanka(datumCas[4] ?? "");
    if (cas === null) {
      continue;
    }

    vysledek.push({
      nazev,
      datumOd: datum,
      datumDo: datum,
      cas,
      mistoNeboTyp: "",
    });
  }
}

/** Úzká detekce programu trebon105.cz (Kirby karty `article.event`). */
function jeTrebon105ProgramHtml(html: string): boolean {
  return (
    /trebon105\.cz/i.test(html) && /<article\b[^>]*\bclass=["'][^"']*\bevent\b/i.test(html)
  );
}

/**
 * Rok pro den/měsíc bez explicitního roku (Aktuální program trebon105).
 * Bere Europe/Prague „dnes“; pokud by den vyšel >60 dní v minulosti, +1 rok.
 */
function rokProTrebon105BezRoku(
  den: number,
  mesic: number,
  referencniRok: number,
  dnesIso: string,
): number {
  let rok = referencniRok;
  let iso = formatujIsoDen(rok, mesic, den);
  if (iso < dnesIso) {
    const dnes = dnesIso.split("-").map(Number);
    const d0 = Date.UTC(dnes[0], dnes[1] - 1, dnes[2]);
    const d1 = Date.UTC(rok, mesic - 1, den);
    const dni = Math.floor((d0 - d1) / 86_400_000);
    if (dni > 60) {
      rok += 1;
      iso = formatujIsoDen(rok, mesic, den);
    }
  }
  void iso;
  return rok;
}

type Trebon105DatumRozklad = {
  datumOd: string;
  datumDo: string;
  /** HH:mm nebo "" */
  cas: string;
};

/**
 * Parsování textu `.event__date` (weekday / rozsah / čas / overnight).
 * Čas DO se do BranaScanKandidat neukládá – bere se jen čas OD.
 */
function rozlozTrebon105EventDate(
  surovy: string,
  referencniRok: number,
  dnesIso: string,
): Trebon105DatumRozklad | null {
  let text = surovy
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(
    /^(pondělí|úterý|středa|čtvrtek|pátek|sobota|neděle)\s+/i,
    "",
  );

  // Overnight: 21. 8. 22:00 - 22. 8. 2026 23:59
  const overnight = text.match(
    /^(\d{1,2})\.\s*(\d{1,2})\.\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})$/,
  );
  if (overnight) {
    const denOd = Number(overnight[1]);
    const mesicOd = Number(overnight[2]);
    const hodina = Number(overnight[3]);
    const minuta = Number(overnight[4]);
    const denDo = Number(overnight[5]);
    const mesicDo = Number(overnight[6]);
    const rokDo = Number(overnight[7]);
    const hodinaDo = Number(overnight[8]);
    const minutaDo = Number(overnight[9]);
    if (
      mesicOd < 1 ||
      mesicOd > 12 ||
      denOd < 1 ||
      denOd > 31 ||
      mesicDo < 1 ||
      mesicDo > 12 ||
      denDo < 1 ||
      denDo > 31 ||
      hodina > 23 ||
      minuta > 59 ||
      hodinaDo > 23 ||
      minutaDo > 59
    ) {
      return null;
    }
    const rokOd =
      mesicOd > mesicDo || (mesicOd === mesicDo && denOd > denDo)
        ? rokDo - 1
        : rokDo;
    const datumOd = formatujIsoDen(rokOd, mesicOd, denOd);
    let datumDo = formatujIsoDen(rokDo, mesicDo, denDo);
    const cas = formatujCas(hodina, minuta);
    // CMS falešný overnight u timed Akce: konec přesně +1 den v 23:59
    // → kandidát jen den začátku (čas OD beze změny).
    if (
      cas !== "" &&
      hodinaDo === 23 &&
      minutaDo === 59 &&
      jePresneNasledujiciIsoDen(datumOd, datumDo)
    ) {
      datumDo = datumOd;
    }
    return {
      datumOd,
      datumDo,
      cas,
    };
  }

  // Rozsah výstav: 27. 6. - 30. 8. 2026
  const rozsah = text.match(
    /^(\d{1,2})\.\s*(\d{1,2})\.\s*-\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/,
  );
  if (rozsah) {
    const denOd = Number(rozsah[1]);
    const mesicOd = Number(rozsah[2]);
    const denDo = Number(rozsah[3]);
    const mesicDo = Number(rozsah[4]);
    const rokDo = Number(rozsah[5]);
    if (
      mesicOd < 1 ||
      mesicOd > 12 ||
      denOd < 1 ||
      denOd > 31 ||
      mesicDo < 1 ||
      mesicDo > 12 ||
      denDo < 1 ||
      denDo > 31
    ) {
      return null;
    }
    const rokOd = mesicOd > mesicDo ? rokDo - 1 : rokDo;
    return {
      datumOd: formatujIsoDen(rokOd, mesicOd, denOd),
      datumDo: formatujIsoDen(rokDo, mesicDo, denDo),
      cas: "",
    };
  }

  // Jednodenní s časem (rok volitelný): 14. 8. 21:15 - 23:00 | 4. 9. 2026 18:00
  const sCasem = text.match(
    /^(\d{1,2})\.\s*(\d{1,2})\.\s*(?:(\d{4})\s+)?(\d{1,2}):(\d{2})(?:\s*-\s*\d{1,2}:\d{2})?$/,
  );
  if (sCasem) {
    const den = Number(sCasem[1]);
    const mesic = Number(sCasem[2]);
    const hodina = Number(sCasem[4]);
    const minuta = Number(sCasem[5]);
    if (
      mesic < 1 ||
      mesic > 12 ||
      den < 1 ||
      den > 31 ||
      hodina > 23 ||
      minuta > 59
    ) {
      return null;
    }
    const rok = sCasem[3]
      ? Number(sCasem[3])
      : rokProTrebon105BezRoku(den, mesic, referencniRok, dnesIso);
    const datum = formatujIsoDen(rok, mesic, den);
    return {
      datumOd: datum,
      datumDo: datum,
      cas: formatujCas(hodina, minuta),
    };
  }

  // Jednodenní bez času s rokem: 14. 8. 2026
  const jenDen = text.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (jenDen) {
    const den = Number(jenDen[1]);
    const mesic = Number(jenDen[2]);
    const rok = Number(jenDen[3]);
    if (mesic < 1 || mesic > 12 || den < 1 || den > 31) {
      return null;
    }
    const datum = formatujIsoDen(rok, mesic, den);
    return { datumOd: datum, datumDo: datum, cas: "" };
  }

  return null;
}

/**
 * Vnitřek sekcí `event-list` BEZ `event-list--exhibitions` (programová Akce).
 * Sekci Výstavy (`event-list--exhibitions`) úplně vynechá – bez textové heuristiky.
 */
function vytahnoutTrebon105AkceSekceHtml(html: string): string {
  const sekce = [
    ...html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi),
  ];
  const casti: string[] = [];
  for (const m of sekce) {
    const attrs = m[1] ?? "";
    const classAttr = attrs.match(/\bclass=["']([^"']*)["']/i)?.[1] ?? "";
    const classes = classAttr.split(/\s+/).filter(Boolean);
    if (!classes.includes("event-list")) {
      continue;
    }
    if (classes.includes("event-list--exhibitions")) {
      continue;
    }
    casti.push(m[2] ?? "");
  }
  return casti.join("\n");
}

/**
 * HTML program trebon105.cz → BranaScanKandidat.
 * Jen `article.event` uvnitř sekce Akce (`event-list` bez `--exhibitions`).
 */
function parsovatTrebon105EventArticles(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  const dnes = dnesVPraze();
  const dnesIso = formatujIsoDen(dnes.rok, dnes.mesic, dnes.den);
  const referencniRok = dnes.rok;

  const akceHtml = vytahnoutTrebon105AkceSekceHtml(html);
  if (!akceHtml.trim()) {
    return;
  }

  const karty = [
    ...akceHtml.matchAll(
      /<article\b[^>]*\bclass=["'][^"']*\bevent\b[^"']*["'][^>]*>[\s\S]*?<\/article>/gi,
    ),
  ];

  for (const kartaMatch of karty) {
    if (vysledek.length >= MAX_KANDIDATU) {
      return;
    }
    const karta = kartaMatch[0];

    const titleMatch = karta.match(
      /<h4\b[^>]*\bclass=["'][^"']*\bevent__title\b[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i,
    );
    const artistMatch = karta.match(
      /<div\b[^>]*\bclass=["'][^"']*\bevent__artist\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    );
    const title = textBezHtmlTagu(titleMatch?.[1] ?? "");
    const artist = textBezHtmlTagu(artistMatch?.[1] ?? "");
    const nazev = title || artist;
    if (!nazev || nazev.length < 2) {
      continue;
    }

    const dateMatch = karta.match(
      /<div\b[^>]*\bclass=["'][^"']*\bevent__date\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    );
    const datumText = dateMatch?.[1] ?? "";
    if (!datumText.trim()) {
      continue;
    }
    const rozklad = rozlozTrebon105EventDate(
      datumText,
      referencniRok,
      dnesIso,
    );
    if (!rozklad) {
      continue;
    }

    const venueMatch = karta.match(
      /<div\b[^>]*\bclass=["'][^"']*\bevent__venue\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    );
    const mistoNeboTyp = textBezHtmlTagu(venueMatch?.[1] ?? "");

    vysledek.push({
      nazev,
      datumOd: rozklad.datumOd,
      datumDo: rozklad.datumDo,
      cas: rozklad.cas,
      mistoNeboTyp,
    });
  }
}

/** True, pokud URL zdroje míří na oficiální web Zámecké lékárny (s/bez www). */
export function jeZameckaLekarnaZdrojUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    return host === "zameckalekarnatrebon.cz";
  } catch {
    return false;
  }
}

/**
 * Hub Denní program – discovery měsíčních stránek.
 * Origin (protokol + host) bere ze zdrojové URL (homepage / hub / měsíc).
 */
export function sestavZameckaLekarnaHubUrl(zdrojUrl: string): string {
  if (!jeZameckaLekarnaZdrojUrl(zdrojUrl)) {
    return "";
  }
  const base = new URL(zdrojUrl);
  return `${base.protocol}//${base.host}${ZAMECKA_LEKARNA_HUB_PATH}`;
}

/**
 * Z HTML hubu vytáhne zveřejněné měsíční programové URL (max 4).
 * Jen odkazy, které hub skutečně nabízí – bez syntetických měsíců.
 */
export function vytahnoutZameckaLekarnaMesicUrlky(
  hubHtml: string,
  hubUrl: string,
): string[] {
  if (!jeZameckaLekarnaZdrojUrl(hubUrl) || !hubHtml.trim()) {
    return [];
  }
  let origin: string;
  try {
    origin = new URL(hubUrl).origin;
  } catch {
    return [];
  }

  const nalezene: string[] = [];
  const videne = new Set<string>();

  const pridej = (hrefSurovy: string): void => {
    const href = hrefSurovy.trim();
    if (!ZAMECKA_LEKARNA_MESIC_HREF_RE.test(href.split("?")[0] ?? href)) {
      return;
    }
    let abs: URL;
    try {
      abs = new URL(href, origin);
    } catch {
      return;
    }
    const host = abs.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "zameckalekarnatrebon.cz") {
      return;
    }
    const normalizovana = `${abs.origin}${abs.pathname}`;
    if (videne.has(normalizovana.toLowerCase())) {
      return;
    }
    videne.add(normalizovana.toLowerCase());
    nalezene.push(normalizovana);
  };

  // Preferuj karty .subcategory (stejná data jako menu).
  const karty = [
    ...hubHtml.matchAll(
      /class=["'][^"']*\bsubcategory\b[^"']*["'][\s\S]*?href=["']([^"']+)["']/gi,
    ),
  ];
  for (const k of karty) {
    pridej(k[1] ?? "");
    if (nalezene.length >= ZAMECKA_LEKARNA_MAX_MESICU) {
      return nalezene;
    }
  }

  // Fallback: všechny měsíční /c-… odkazy na hubu.
  if (nalezene.length === 0) {
    for (const m of hubHtml.matchAll(/href=["']([^"']+)["']/gi)) {
      pridej(m[1] ?? "");
      if (nalezene.length >= ZAMECKA_LEKARNA_MAX_MESICU) {
        break;
      }
    }
  }

  return nalezene.slice(0, ZAMECKA_LEKARNA_MAX_MESICU);
}

/** Úzká detekce měsíčního denního programu Zámecké lékárny. */
function jeZameckaLekarnaMesicProgramHtml(html: string): boolean {
  return (
    /zameckalekarnatrebon\.cz/i.test(html) &&
    /class=["']articleContent["']/i.test(html) &&
    /<p>\s*<strong>\s*\d{1,2}\.\d{1,2}/i.test(html)
  );
}

function rokZameckaLekarnaZHtml(html: string): number | null {
  const zUrl = html.match(
    /zameckalekarnatrebon\.cz\/c-\d+-[a-z]+-(\d{4})\.html/i,
  );
  if (zUrl) {
    return Number(zUrl[1]);
  }
  const zH1 = html.match(
    /<(?:h1|title)[^>]*>[\s\S]*?\b(?:leden|únor|unor|březen|brezen|duben|květen|kveten|červen|cerven|červenec|cervenec|srpen|září|zari|říjen|rijen|listopad|prosinec)\s+(\d{4})\b/i,
  );
  if (zH1) {
    return Number(zH1[1]);
  }
  return null;
}

function vytahnoutCasZameckaLekarna(text: string): string {
  const t = text.trim();
  if (!t) {
    return "";
  }

  const od = t.match(/\bOD\s+(\d{1,2})[,.:](\d{2})\s*HOD\.?/i);
  if (od) {
    const hodina = Number(od[1]);
    const minuta = Number(od[2]);
    if (hodina <= 23 && minuta <= 59) {
      return formatujCas(hodina, minuta);
    }
  }

  const zac = t.match(
    /\bzač\.?\s*(\d{1,2})[,.:](\d{2})(?:\s*;\s*\d{1,2}[,.:]\d{2})*/i,
  );
  if (zac) {
    const hodina = Number(zac[1]);
    const minuta = Number(zac[2]);
    if (hodina <= 23 && minuta <= 59) {
      return formatujCas(hodina, minuta);
    }
  }

  const prefix = t.match(/^(\d{1,2})[,.:](\d{2})\s*HOD\.?/i);
  if (prefix) {
    const hodina = Number(prefix[1]);
    const minuta = Number(prefix[2]);
    if (hodina <= 23 && minuta <= 59) {
      return formatujCas(hodina, minuta);
    }
  }

  const jednorazovy = t.match(/\b(\d{1,2})[,.:](\d{2})\s*HOD\.?/i);
  if (jednorazovy) {
    const hodina = Number(jednorazovy[1]);
    const minuta = Number(jednorazovy[2]);
    if (hodina <= 23 && minuta <= 59) {
      return formatujCas(hodina, minuta);
    }
  }

  const rozsah =
    t.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*HOD\.?/i) ??
    t.match(/\b(\d{1,2})\s+-\s+(\d{1,2})\s*HOD\.?/i);
  if (rozsah) {
    const hodina = Number(rozsah[1]);
    if (hodina <= 23) {
      return formatujCas(hodina, 0);
    }
  }

  return "";
}

/**
 * Název bez časových / vstupenkových suffixů.
 * Nefiltruje redakčně – jen oddělí provozní přípony od textu položky.
 */
function cistyNazevZameckaLekarna(text: string): string {
  let t = text.trim();
  t = t.replace(/\s*-\s*(VSTUPENKY|INFO)\s*$/i, "");
  t = t.replace(/\s*-\s*OD\s+\d{1,2}[,.:]\d{2}\s*HOD\.?\s*$/i, "");
  t = t.replace(/\s*-\s*zač\.?\s*[\d:;,.\s]+$/i, "");
  t = t.replace(/\s*-\s*\d{1,2}\s*[-–]\s*\d{1,2}\s*HOD\.?\s*$/i, "");
  t = t.replace(/\s*-\s*\d{1,2}\s+-\s+\d{1,2}\s*HOD\.?\s*$/i, "");
  t = t.replace(/\s*-\s*\d{1,2}[,.:]\d{2}\s*HOD\.?\s*$/i, "");
  t = t.replace(/^\s*\d{1,2}[,.:]\d{2}\s*HOD\.?\s*/i, "");
  return t.replace(/\s+/g, " ").trim();
}

/**
 * HTML měsíční program zameckalekarnatrebon.cz → BranaScanKandidat.
 * Jedna položka &lt;li&gt; pod denním záhlavím = jeden kandidát.
 * Bez redakčního filtru (prohlídky / večery) – ochranu dělá HLIDANE_KOTVY.
 */
function parsovatZameckaLekarnaDenniProgram(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  const rok = rokZameckaLekarnaZHtml(html);
  if (!rok || rok < 2000 || rok > 2100) {
    return;
  }

  const scopeMatch = html.match(
    /<div\s+class=["']articleContent["'][^>]*>([\s\S]*?)(?:<\/div>\s*<div\s+class\s*=\s*["']cleaner["']|<\/div>\s*<div\s+id=["']content-2|$)/i,
  );
  const scope = scopeMatch?.[1] ?? "";
  if (!scope) {
    return;
  }

  const denRe =
    /<p>\s*<strong>\s*(\d{1,2})\.(\d{1,2})\.?(?:&nbsp;|\u00a0|\s)*<\/strong>\s*\.?\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>/gi;
  let denMatch: RegExpExecArray | null;
  while (
    (denMatch = denRe.exec(scope)) !== null &&
    vysledek.length < MAX_KANDIDATU_ZAMECKA_LEKARNA
  ) {
    const den = Number(denMatch[1]);
    const mesic = Number(denMatch[2]);
    if (mesic < 1 || mesic > 12 || den < 1 || den > 31) {
      continue;
    }
    const datum = formatujIsoDen(rok, mesic, den);
    const ul = denMatch[3] ?? "";
    for (const liMatch of ul.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      if (vysledek.length >= MAX_KANDIDATU_ZAMECKA_LEKARNA) {
        return;
      }
      const surovy = textBezHtmlTagu(liMatch[1] ?? "");
      if (!surovy || surovy.length < 2) {
        continue;
      }
      const cas = vytahnoutCasZameckaLekarna(surovy);
      const nazev = cistyNazevZameckaLekarna(surovy);
      if (!nazev || nazev.length < 2) {
        continue;
      }
      vysledek.push({
        nazev,
        datumOd: datum,
        datumDo: datum,
        cas,
        mistoNeboTyp: "",
      });
    }
  }
}

/** True, pokud URL zdroje míří na oficiální web Rybářství Třeboň (s/bez www). */
export function jeRybarstviZdrojUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    return host === "rybarstvi.cz";
  } catch {
    return false;
  }
}

/**
 * Autoritativní stránka podzimních výlovů.
 * Origin bere ze zdrojové URL (homepage / hub / detail).
 */
export function sestavRybarstviPodzimniVylovyUrl(zdrojUrl: string): string {
  if (!jeRybarstviZdrojUrl(zdrojUrl)) {
    return "";
  }
  const base = new URL(zdrojUrl);
  return `${base.protocol}//${base.host}${RYBARSTVI_PODZIMNI_VYLOVY_PATH}`;
}

function jeRybarstviPodzimniVylovyHtml(html: string): boolean {
  return (
    /rybarstvi\.cz/i.test(html) &&
    /podzimn[ií]ch\s+v[ýy]lov/i.test(html) &&
    /\b20\d{2}\b/.test(html)
  );
}

const RYBARSTVI_MESICE: Record<string, number> = {
  ledna: 1,
  unor: 2,
  unora: 2,
  "února": 2,
  brezna: 3,
  "března": 3,
  dubna: 4,
  kvetna: 5,
  "května": 5,
  cervna: 6,
  "června": 6,
  cervence: 7,
  "července": 7,
  srpna: 8,
  zari: 9,
  "září": 9,
  rijna: 10,
  "října": 10,
  listopadu: 11,
  prosince: 12,
};

function normalizovatProRybarstviShodu(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function kanonickyNazevVylovuRybarstvi(rybnikSurovy: string): string | null {
  const n = normalizovatProRybarstviShodu(rybnikSurovy);
  if (!n) {
    return null;
  }
  // Nepleť Světozor / jiné.
  if (/\brozmberk/.test(n)) {
    return "Výlov Rožmberk";
  }
  if (/\bsvet\b/.test(n) && !/svetozor/.test(n)) {
    return "Výlov Svět";
  }
  return null;
}

function nazevVylovuZRybniku(rybnik: string): string {
  const kanon = kanonickyNazevVylovuRybarstvi(rybnik);
  if (kanon) {
    return kanon;
  }
  const cisty = rybnik.replace(/\s+/g, " ").trim();
  return cisty ? `Výlov ${cisty}` : "";
}

/**
 * Rozsah data v roční sekci.
 * Podporuje: 16. – 18. 10. 2026 | 16. - 18. 10. | 16. až 18. října 2026 | 3, – 6. 11.
 */
function rozsahDataRybarstvi(
  text: string,
  rokSekce: number,
): { datumOd: string; datumDo: string } | null {
  const t = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (!t) {
    return null;
  }

  const seJmenem = t.match(
    /(\d{1,2})\s*[.,]?\s*(?:–|-|až)\s*(\d{1,2})\s*[.,]?\s*([a-záčďéěíňóřšťúůýž]+)\s+(\d{4})/i,
  );
  if (seJmenem) {
    const mesic =
      RYBARSTVI_MESICE[normalizovatProRybarstviShodu(seJmenem[3])] ??
      RYBARSTVI_MESICE[seJmenem[3].toLowerCase()];
    const rok = Number(seJmenem[4]);
    const denOd = Number(seJmenem[1]);
    const denDo = Number(seJmenem[2]);
    if (mesic && rok === rokSekce && denOd >= 1 && denDo >= denOd && denDo <= 31) {
      return {
        datumOd: formatujIsoDen(rok, mesic, denOd),
        datumDo: formatujIsoDen(rok, mesic, denDo),
      };
    }
  }

  const ciselny = t.match(
    /(\d{1,2})\s*[.,]?\s*(?:–|-|až)\s*(\d{1,2})\s*[.,]?\s*(\d{1,2})\s*[.,]?(?:\s*(\d{4}))?/i,
  );
  if (ciselny) {
    const denOd = Number(ciselny[1]);
    const denDo = Number(ciselny[2]);
    const mesic = Number(ciselny[3]);
    const rok = ciselny[4] ? Number(ciselny[4]) : rokSekce;
    if (
      rok === rokSekce &&
      mesic >= 1 &&
      mesic <= 12 &&
      denOd >= 1 &&
      denDo >= denOd &&
      denDo <= 31
    ) {
      return {
        datumOd: formatujIsoDen(rok, mesic, denOd),
        datumDo: formatujIsoDen(rok, mesic, denDo),
      };
    }
  }

  return null;
}

/**
 * Roční sekce: od nadpisu s rokem do následujícího ročníhokotu (jakéhokoli roku).
 * Parsuje se jen rok ≥ aktuální Europe/Prague rok (historické tabulky se nečtou).
 */
function vytahnoutAktualniRocniSekceRybarstvi(
  html: string,
  minimalniRok: number,
): { rok: number; html: string }[] {
  // Entity pryč dřív, než se hledá rok (rybníků&nbsp;2025).
  const normalizovane = html
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8212;|&mdash;/gi, "—");

  const re =
    /Termíny\s+podzimních\s+výlovů\s+vybraných\s+rybníků\s+(20\d{2})|Slavnostní\s+výlov\s+Rožmberka\s+v\s+roce\s+(20\d{2})|<h[1-4][^>]*>[^<]*?(20\d{2})[^<]*<\/h[1-4]>/gi;
  const hits: { rok: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalizovane)) !== null) {
    const rok = Number(m[1] || m[2] || m[3]);
    if (!Number.isFinite(rok)) {
      continue;
    }
    hits.push({ rok, index: m.index });
  }
  hits.sort((a, b) => a.index - b.index);

  const sekce: { rok: number; html: string }[] = [];
  for (let i = 0; i < hits.length; i++) {
    const { rok, index } = hits[i];
    if (rok < minimalniRok) {
      continue;
    }
    const konec =
      i + 1 < hits.length ? hits[i + 1].index : normalizovane.length;
    sekce.push({ rok, html: normalizovane.slice(index, konec) });
  }
  return sekce;
}

function parsovatTabulkuVylovuRybarstvi(
  sekceHtml: string,
  rok: number,
  vysledek: BranaScanKandidat[],
): void {
  for (const tableMatch of sekceHtml.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const table = tableMatch[1] ?? "";
    for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      if (vysledek.length >= MAX_KANDIDATU_RYBARSTVI) {
        return;
      }
      const bunky = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
        (b) => textBezHtmlTagu(b[1] ?? ""),
      );
      if (bunky.length < 2) {
        continue;
      }
      // Hlavička
      if (/^datum$/i.test(bunky[0]) || /^rybník$/i.test(bunky[1])) {
        continue;
      }
      const rozsah = rozsahDataRybarstvi(bunky[0], rok);
      if (!rozsah) {
        continue;
      }
      const nazev = nazevVylovuZRybniku(bunky[1]);
      if (!nazev) {
        continue;
      }
      vysledek.push({
        nazev,
        datumOd: rozsah.datumOd,
        datumDo: rozsah.datumDo,
        cas: "",
        mistoNeboTyp: "",
      });
    }
  }
}

function parsovatProzuVylovuRybarstvi(
  sekceHtml: string,
  rok: number,
  vysledek: BranaScanKandidat[],
): void {
  const text = textBezHtmlTagu(sekceHtml).replace(/\u00a0/g, " ");
  const vzory: {
    kotva: RegExp;
    label: string;
    rival: RegExp;
  }[] = [
    {
      label: "Rožmberk",
      kotva: /rožmberk|rozmberk/i,
      rival: /\bsvět\b|\bsvet\b/i,
    },
    {
      label: "Svět",
      kotva: /rybník(?:a)?\s+svět\b|v[ýy]lov\s+světa\b|v[ýy]lov\s+rybník(?:a)?\s+svět\b/i,
      rival: /rožmberk|rozmberk/i,
    },
  ];
  for (const { kotva, label, rival } of vzory) {
    if (vysledek.length >= MAX_KANDIDATU_RYBARSTVI) {
      return;
    }
    const kanon = nazevVylovuZRybniku(label);
    if (vysledek.some((k) => k.nazev === kanon && k.datumOd.startsWith(`${rok}-`))) {
      continue;
    }

    let nalezeno: { datumOd: string; datumDo: string } | null = null;
    const re = new RegExp(kotva.source, "gi");
    let hit: RegExpExecArray | null;
    while ((hit = re.exec(text)) !== null) {
      const od = Math.max(0, hit.index - 100);
      const doIdx = Math.min(text.length, hit.index + hit[0].length + 140);
      const okno = text.slice(od, doIdx);
      if (!/v[ýy]lov/i.test(okno)) {
        continue;
      }
      if (!new RegExp(String(rok)).test(okno)) {
        continue;
      }
      // Okno nesmí být primárně o jiném rybníku (Rožmberk datum + „Svět“ v menu/článku).
      if (rival.test(okno)) {
        const kotvaPos = hit.index - od;
        const rivalMatch = okno.match(rival);
        const rivalPos = rivalMatch?.index ?? -1;
        const datumMatch = okno.match(
          /(\d{1,2})\s*[.,]?\s*(?:–|-|až)\s*(\d{1,2})/i,
        );
        const datumPos = datumMatch?.index ?? -1;
        if (datumPos >= 0 && rivalPos >= 0) {
          if (Math.abs(rivalPos - datumPos) < Math.abs(kotvaPos - datumPos)) {
            continue;
          }
        }
      }
      const rozsah = rozsahDataRybarstvi(okno, rok);
      if (rozsah) {
        nalezeno = rozsah;
        break;
      }
    }
    if (!nalezeno) {
      continue;
    }
    vysledek.push({
      nazev: kanon,
      datumOd: nalezeno.datumOd,
      datumDo: nalezeno.datumDo,
      cas: "",
      mistoNeboTyp: "",
    });
  }
}

/**
 * HTML podzimní výlovy rybarstvi.cz → BranaScanKandidat.
 * Jen roční sekce ≥ aktuální rok Europe/Prague. Čas se nevymýšlí.
 * Rožmberk / Svět → kanonický název pro HLIDANE_KOTVY.
 */
function parsovatRybarstviPodzimniVylovy(
  html: string,
  vysledek: BranaScanKandidat[],
  referencniOkamzik: Date = new Date(),
): void {
  const minimalniRok = dnesVPraze(referencniOkamzik).rok;
  const sekce = vytahnoutAktualniRocniSekceRybarstvi(html, minimalniRok);
  for (const s of sekce) {
    parsovatTabulkuVylovuRybarstvi(s.html, s.rok, vysledek);
    parsovatProzuVylovuRybarstvi(s.html, s.rok, vysledek);
  }
}

/** True, pokud URL míří na trebonsko.cz řemeslné trhy (s/bez www). */
export function jeTrebonskoRemeslneTrhyZdrojUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "trebonsko.cz") {
      return false;
    }
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return path === TREBONSKO_REMESLNE_TRHY_PATH;
  } catch {
    return false;
  }
}

function jeTrebonskoRemeslneTrhyHtml(html: string): boolean {
  return (
    /trebonsko\.cz/i.test(html) &&
    (/remeslne-trhy-trebon/i.test(html) ||
      /[řr]emesln[ée]\s+trhy/i.test(html)) &&
    /kalend[aá][rř]\s+trh/i.test(html)
  );
}

function normalizovatProTrhyShodu(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&nbsp;/gi, " ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Explicitní whitelist městských Trhů (Třeboňsko).
 * Pořadí: konkrétnější aliasy dřív (andělé před obecným adventním).
 * Cizí vlastníci (MINT / Street Food / Beer & Food) zde nejsou.
 */
const TREBONSKO_TRHY_ALIAS_MAPA: readonly {
  aliasNorm: string;
  rozliseni: string;
}[] = [
  {
    aliasNorm: normalizovatProTrhyShodu("Začínáme sezónu trhem"),
    rozliseni: "Otevíráme Třeboň",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Velikonoční trh"),
    rozliseni: "Velikonoční",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Květinový jarmark"),
    rozliseni: "Květinový jarmark",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Košt vín s trhem"),
    rozliseni: "Košt vín",
  },
  {
    aliasNorm: normalizovatProTrhyShodu(
      "Historické slavnosti Jakuba Krčína + trh",
    ),
    rozliseni: "Slavnosti Jakuba Krčína",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Lázeňská Třeboň + trh"),
    rozliseni: "Lázeňská Třeboň",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Myslivecká Třeboň + trh"),
    rozliseni: "Myslivecká Třeboň",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Letní tečka s trhem"),
    rozliseni: "Letní tečka",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Vinobraní s trhem"),
    rozliseni: "Vinobraní",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Svatováclavské slavnosti + trh"),
    rozliseni: "Svatováclavské slavnosti",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Svatováclavské slavnosti s trhem"),
    rozliseni: "Svatováclavské slavnosti",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Svatomartinský trh"),
    rozliseni: "Svatomartinské slavnosti",
  },
  {
    aliasNorm: normalizovatProTrhyShodu(
      "Třeboň plná andělů s rozsvícením stromu + adventní trh",
    ),
    rozliseni: "Třeboň plná andělů",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Třeboň plná andělů + adventní trh"),
    rozliseni: "Třeboň plná andělů",
  },
  {
    aliasNorm: normalizovatProTrhyShodu("Adventní trh"),
    rozliseni: "Adventní",
  },
];

function mapovatTrebonskoTrhRozliseni(nazevSurovy: string): string | null {
  const n = normalizovatProTrhyShodu(nazevSurovy);
  if (!n) {
    return null;
  }
  for (const radek of TREBONSKO_TRHY_ALIAS_MAPA) {
    if (n === radek.aliasNorm) {
      return radek.rozliseni;
    }
  }
  return null;
}

function rokKalendareTrebonskoTrhy(
  html: string,
  referencniOkamzik: Date,
): number | null {
  const zTitle = html.match(
    /[řr]emesln[ée]\s+trhy[^<]{0,80}\b(20\d{2})\b/i,
  );
  if (zTitle) {
    return Number(zTitle[1]);
  }
  const zH1 = html.match(
    /<h1[^>]*>[\s\S]{0,120}?\b(20\d{2})\b[\s\S]{0,80}?<\/h1>/i,
  );
  if (zH1) {
    return Number(zH1[1]);
  }
  return dnesVPraze(referencniOkamzik).rok;
}

function cistyTextZHtmlFragmentu(fragment: string): string {
  return fragment
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fail-closed: jen městské Trhy z kalendářového seznamu.
 * Řádky v závorkách (externí pořadatelé) se neemitují.
 * cas vždy "". Historický rok stránky < aktuální rok → 0.
 */
function parsovatTrebonskoRemeslneTrhy(
  html: string,
  vysledek: BranaScanKandidat[],
  referencniOkamzik: Date = new Date(),
): void {
  const aktualniRok = dnesVPraze(referencniOkamzik).rok;
  const rokStranky = rokKalendareTrebonskoTrhy(html, referencniOkamzik);
  if (rokStranky === null || rokStranky < aktualniRok) {
    return;
  }

  const liShody = html.matchAll(/<li>([\s\S]*?)<\/li>/gi);
  for (const m of liShody) {
    if (vysledek.length >= MAX_KANDIDATU_TREBONSKO_TRHY) {
      return;
    }
    const surovy = cistyTextZHtmlFragmentu(m[1] ?? "");
    if (!surovy) {
      continue;
    }
    // Externí / doprovodné v závorkách — MINT, Street Food, maraton, …
    if (/^\(/.test(surovy) || /\)$/.test(surovy)) {
      continue;
    }
    const radek = surovy.match(
      /^(\d{1,2})\.\s*(\d{1,2})\.\s+(.+)$/u,
    );
    if (!radek) {
      continue;
    }
    const den = Number(radek[1]);
    const mesic = Number(radek[2]);
    const nazevCast = (radek[3] ?? "").trim();
    if (
      !Number.isFinite(den) ||
      !Number.isFinite(mesic) ||
      den < 1 ||
      den > 31 ||
      mesic < 1 ||
      mesic > 12 ||
      !nazevCast
    ) {
      continue;
    }
    const rozliseni = mapovatTrebonskoTrhRozliseni(nazevCast);
    if (!rozliseni) {
      continue;
    }
    const datum = formatujIsoDen(rokStranky, mesic, den);
    vysledek.push({
      nazev: rozliseni,
      datumOd: datum,
      datumDo: datum,
      cas: "",
      mistoNeboTyp: rozliseni,
    });
  }
}

/** True, pokud URL míří na cityevent.cz přehled účastníků (listing Trhů). */
export function jeCityEventProUcastnikyZdrojUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "cityevent.cz") {
      return false;
    }
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return path === CITYEVENT_PRO_UCASTNIKY_PATH;
  } catch {
    return false;
  }
}

/**
 * True, pokud URL míří na detail festivalu City Event v Třeboni
 * (/festival/…trebon…).
 */
export function jeCityEventFestivalTrebonZdrojUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "cityevent.cz") {
      return false;
    }
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return path.startsWith("/festival/") && path.includes("trebon");
  } catch {
    return false;
  }
}

/** Ownership gate: listing nebo Třeboň festival detail City Event. */
export function jeCityEventTrhyZdrojUrl(url: string): boolean {
  return (
    jeCityEventProUcastnikyZdrojUrl(url) ||
    jeCityEventFestivalTrebonZdrojUrl(url)
  );
}

function jeCityEventProUcastnikyHtml(html: string): boolean {
  return (
    /cityevent\.cz/i.test(html) &&
    (/pro-ucastniky/i.test(html) || /P[rř]ehled festival/i.test(html)) &&
    /name=["']festivaly\[\]["']/i.test(html)
  );
}

function jeCityEventFestivalTrebonHtml(html: string): boolean {
  if (!/cityevent\.cz/i.test(html)) {
    return false;
  }
  if (!maCityEventLokalituTrebon(html)) {
    return false;
  }
  const nazev = vytahnoutCityEventNazevZDetailu(html);
  return mapovatCityEventTrebonRozliseni(nazev ?? "") !== null;
}

function dekodovatCityEventText(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8211;/g, "–")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, kod: string) =>
      String.fromCharCode(Number(kod)),
    )
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function maCityEventLokalituTrebon(text: string): boolean {
  const n = normalizovatProTrhyShodu(dekodovatCityEventText(text));
  // Třeboň ano; Třebíč / jiná města ne (slovo trebon, ne trebic).
  return /\btrebon\b/.test(n);
}

function jeCityEventZruseno(text: string): boolean {
  const n = normalizovatProTrhyShodu(dekodovatCityEventText(text));
  return (
    /\bzruseno\b/.test(n) ||
    /\bzrusena\b/.test(n) ||
    /\bzruseny\b/.test(n) ||
    /\beventcancelled\b/.test(n) ||
    /\bcancelled\b/.test(n)
  );
}

/**
 * Fail-closed mapování City Event → veřejné rozlišení rodiny Trh.
 * Jen Street Food Festival / Beer & Food Fest v Třeboni.
 */
function mapovatCityEventTrebonRozliseni(nazevSurovy: string): string | null {
  const text = dekodovatCityEventText(nazevSurovy);
  if (!text || !maCityEventLokalituTrebon(text)) {
    return null;
  }
  if (jeCityEventZruseno(text)) {
    return null;
  }
  const n = normalizovatProTrhyShodu(text);
  if (/\bbeer\b/.test(n) && /\bfood\b/.test(n) && /\bfest\b/.test(n)) {
    return "Beer & Food Fest";
  }
  if (/\bstreet\b/.test(n) && /\bfood\b/.test(n) && /\bfestival\b/.test(n)) {
    return "Street Food Festival";
  }
  return null;
}

function parsovatCityEventDatumyZTextu(
  text: string,
): { datumOd: string; datumDo: string } | null {
  const t = dekodovatCityEventText(text);
  const rozsah = t.match(
    /(\d{1,2})\s*[-–]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/,
  );
  if (rozsah) {
    const denOd = Number(rozsah[1]);
    const denDo = Number(rozsah[2]);
    const mesic = Number(rozsah[3]);
    const rok = Number(rozsah[4]);
    if (
      !Number.isFinite(denOd) ||
      !Number.isFinite(denDo) ||
      !Number.isFinite(mesic) ||
      !Number.isFinite(rok) ||
      denOd < 1 ||
      denOd > 31 ||
      denDo < 1 ||
      denDo > 31 ||
      mesic < 1 ||
      mesic > 12 ||
      denDo < denOd
    ) {
      return null;
    }
    return {
      datumOd: formatujIsoDen(rok, mesic, denOd),
      datumDo: formatujIsoDen(rok, mesic, denDo),
    };
  }
  const jeden = t.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (!jeden) {
    return null;
  }
  const den = Number(jeden[1]);
  const mesic = Number(jeden[2]);
  const rok = Number(jeden[3]);
  if (
    !Number.isFinite(den) ||
    !Number.isFinite(mesic) ||
    !Number.isFinite(rok) ||
    den < 1 ||
    den > 31 ||
    mesic < 1 ||
    mesic > 12
  ) {
    return null;
  }
  const iso = formatujIsoDen(rok, mesic, den);
  return { datumOd: iso, datumDo: iso };
}

function vytahnoutCityEventNazevZDetailu(html: string): string | null {
  const og = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (og?.[1]) {
    return dekodovatCityEventText(og[1]);
  }
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) {
    return dekodovatCityEventText(cistyTextZHtmlFragmentu(h1[1]));
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) {
    return dekodovatCityEventText(
      cistyTextZHtmlFragmentu(title[1]).replace(/\s*[–-]\s*City Event.*$/i, ""),
    );
  }
  return null;
}

/**
 * Listing /pro-ucastniky/: checkboxy festivaly[] — jen Třeboň whitelist.
 * cas vždy "". Zrušené řádky neemituje.
 */
function parsovatCityEventProUcastniky(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  const hodnoty = html.matchAll(
    /<input[^>]*name=["']festivaly\[\]["'][^>]*value=["']([^"']+)["'][^>]*>/gi,
  );
  for (const m of hodnoty) {
    if (vysledek.length >= MAX_KANDIDATU_CITYEVENT_TRHY) {
      return;
    }
    const surovy = dekodovatCityEventText(m[1] ?? "");
    if (!surovy || jeCityEventZruseno(surovy)) {
      continue;
    }
    const rozliseni = mapovatCityEventTrebonRozliseni(surovy);
    if (!rozliseni) {
      continue;
    }
    const data = parsovatCityEventDatumyZTextu(surovy);
    if (!data) {
      continue;
    }
    vysledek.push({
      nazev: rozliseni,
      datumOd: data.datumOd,
      datumDo: data.datumDo,
      cas: "",
      mistoNeboTyp: rozliseni,
    });
  }
}

/**
 * Detail /festival/…trebon… — JSON-LD / title, lokalita Třeboň, cas "".
 * Zrušené (EventCancelled / text zrušeno) neemituje.
 */
function parsovatCityEventFestivalTrebonDetail(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  if (vysledek.length >= MAX_KANDIDATU_CITYEVENT_TRHY) {
    return;
  }
  if (jeCityEventZruseno(html)) {
    return;
  }
  if (!maCityEventLokalituTrebon(html)) {
    return;
  }
  const nazev = vytahnoutCityEventNazevZDetailu(html);
  if (!nazev) {
    return;
  }
  const rozliseni = mapovatCityEventTrebonRozliseni(nazev);
  if (!rozliseni) {
    return;
  }

  let datumOd: string | null = null;
  let datumDo: string | null = null;
  const start = html.match(/"startDate"\s*:\s*"([^"]+)"/i);
  const end = html.match(/"endDate"\s*:\s*"([^"]+)"/i);
  if (start?.[1]) {
    const iso = start[1].slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      datumOd = iso;
    }
  }
  if (end?.[1]) {
    const iso = end[1].slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      datumDo = iso;
    }
  }
  if (!datumOd) {
    const zNazvu = parsovatCityEventDatumyZTextu(nazev);
    if (!zNazvu) {
      return;
    }
    datumOd = zNazvu.datumOd;
    datumDo = zNazvu.datumDo;
  }
  if (!datumDo) {
    datumDo = datumOd;
  }
  if (datumDo < datumOd) {
    return;
  }

  vysledek.push({
    nazev: rozliseni,
    datumOd,
    datumDo,
    cas: "",
    mistoNeboTyp: rozliseni,
  });
}

/**
 * Z HTML (nebo čistého JSON) vytáhne kandidátní události.
 * Bez vymyšlených údajů – chybí-li název nebo datum, kandidát se zahodí.
 */
export function parsovatUdalostiZeZdroje(
  telo: string,
  contentType: string | null,
): BranaScanKandidat[] {
  const vysledek: BranaScanKandidat[] = [];
  const ct = (contentType ?? "").toLowerCase();

  if (ct.includes("application/json") && !ct.includes("ld+json")) {
    try {
      projdiUzel(JSON.parse(telo) as unknown, vysledek);
      return deduplikovatScanKandidaty(vysledek);
    } catch {
      return [];
    }
  }

  // Třeboňsko řemeslné trhy: jen fail-closed whitelist — bez JSON-LD mixu.
  if (jeTrebonskoRemeslneTrhyHtml(telo)) {
    parsovatTrebonskoRemeslneTrhy(telo, vysledek);
    return deduplikovatScanKandidaty(vysledek);
  }

  // City Event: listing účastníků — jen Třeboň Street Food / Beer & Food.
  if (jeCityEventProUcastnikyHtml(telo)) {
    parsovatCityEventProUcastniky(telo, vysledek);
    return deduplikovatScanKandidaty(vysledek);
  }

  // City Event: detail festivalu Třeboň — bez obecného JSON-LD mixu.
  if (jeCityEventFestivalTrebonHtml(telo)) {
    parsovatCityEventFestivalTrebonDetail(telo, vysledek);
    return deduplikovatScanKandidaty(vysledek);
  }

  for (const blok of vytahnoutJsonLdBloky(telo)) {
    projdiUzel(blok, vysledek);
  }

  // Jen když stránka nese kinotrebon programovou šablonu – jiné zdroje beze změny.
  if (jeKinotrebonProgramHtml(telo)) {
    parsovatKinotrebonSectionEvent(telo, vysledek);
  }

  // Jen trebonskanocturna.cz – karty koncertů bez Event JSON-LD.
  if (jeTrebonskaNocturnaProgramHtml(telo)) {
    parsovatTrebonskaNocturnaKoncerty(telo, vysledek);
  }

  // Jen dumstepankanetolickeho.cz – měsíční karty .event-item.
  if (jeDumStepankaProgramHtml(telo)) {
    parsovatDumStepankaEventItem(telo, vysledek);
  }

  // Jen trebon105.cz – karty article.event (Galerie / program).
  if (jeTrebon105ProgramHtml(telo)) {
    parsovatTrebon105EventArticles(telo, vysledek);
  }

  // Jen zameckalekarnatrebon.cz – měsíční denní program v .articleContent.
  if (jeZameckaLekarnaMesicProgramHtml(telo)) {
    parsovatZameckaLekarnaDenniProgram(telo, vysledek);
  }

  // Jen rybarstvi.cz – podzimní výlovy (roční sekce / tabulka).
  if (jeRybarstviPodzimniVylovyHtml(telo)) {
    parsovatRybarstviPodzimniVylovy(telo, vysledek);
  }

  return deduplikovatScanKandidaty(vysledek);
}

function klicKandidata(k: BranaScanKandidat): string {
  return `${k.nazev}\0${k.datumOd}\0${k.cas}\0${k.mistoNeboTyp}`.toLowerCase();
}

/** Stejný klíč jako uvnitř parseru – pro merge kandidátů z více HTML těl. */
export function deduplikovatScanKandidaty(
  kandidati: readonly BranaScanKandidat[],
): BranaScanKandidat[] {
  const videne = new Set<string>();
  const out: BranaScanKandidat[] = [];
  for (const k of kandidati) {
    const klic = klicKandidata(k);
    if (videne.has(klic)) {
      continue;
    }
    videne.add(klic);
    out.push(k);
  }
  return out;
}
