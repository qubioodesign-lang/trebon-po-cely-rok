/**
 * Parser obsahu jednoho známého zdroje.
 * Preferuje JSON-LD schema.org Event; úzká HTML větev jen pro program
 * kinotrebon.cz (`.section-event`). Odděleně od Kalendáře a Blob zápisu.
 * Datum/čas: Europe/Prague (včetně DST) přes stávající brana/cas.
 */

import { okamzikVPraze } from "@/lib/brana/cas";

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
      return deduplikovatKandidaty(vysledek);
    } catch {
      return [];
    }
  }

  for (const blok of vytahnoutJsonLdBloky(telo)) {
    projdiUzel(blok, vysledek);
  }

  // Jen když stránka nese kinotrebon programovou šablonu – jiné zdroje beze změny.
  if (jeKinotrebonProgramHtml(telo)) {
    parsovatKinotrebonSectionEvent(telo, vysledek);
  }

  return deduplikovatKandidaty(vysledek);
}

function klicKandidata(k: BranaScanKandidat): string {
  return `${k.nazev}\0${k.datumOd}\0${k.cas}\0${k.mistoNeboTyp}`.toLowerCase();
}

function deduplikovatKandidaty(
  kandidati: BranaScanKandidat[],
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
