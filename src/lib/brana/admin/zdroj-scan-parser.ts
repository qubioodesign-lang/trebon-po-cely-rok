/**
 * První verze parseru obsahu jednoho známého zdroje.
 * Preferuje JSON-LD schema.org Event – odděleně od Kalendáře a Blob zápisu.
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
