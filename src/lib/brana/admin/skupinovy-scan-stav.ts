/**
 * Provozní stopa posledního dokončeného skupinového Rychlého / Dlouhého scanu.
 * Bez server-only – čistá validace a zobrazení (Kalendář, verify).
 * Historii běhů neukládá; nový běh přepíše jen svůj stav.
 */

import { okamzikVPraze } from "@/lib/brana/cas";
import { BRANA_ZDROJ_NAZEV_MAX } from "./zdroj";

export type BranaSkupinovyScanTyp = "RYCHLY" | "DLOUHY";

export type BranaSkupinovyScanStav = {
  /** ISO-8601 UTC okamžik dokončení průchodu seznamem. */
  dokoncenoAt: string;
  chybneZdroje: number;
  /** Názvy Zdrojů, které v tomto běhu selhaly (stopa, UI je teď nezobrazuje). */
  chybneZdrojeNazvy: string[];
};

export type BranaSkupinoveScanStavy = {
  posledniRychlySkupinovyScan: BranaSkupinovyScanStav | null;
  posledniDlouhySkupinovyScan: BranaSkupinovyScanStav | null;
};

const ISO_DATE_TIME_Z =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const MAX_CHYBNYCH_NAZVU = 100;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDenZPrahy(okamzik: Date): string {
  const praha = okamzikVPraze(okamzik);
  return `${praha.rok}-${pad2(praha.mesic)}-${pad2(praha.den)}`;
}

export function nazevChybnehoZdrojeProStopu(
  nazev: string,
  id: string,
): string {
  const zNazvu = nazev.trim().slice(0, BRANA_ZDROJ_NAZEV_MAX);
  if (zNazvu) {
    return zNazvu;
  }
  const zId = id.trim().slice(0, BRANA_ZDROJ_NAZEV_MAX);
  return zId || "zdroj";
}

export function sestavitSkupinovyScanStav(
  chybneZdrojeNazvy: readonly string[],
  okamzik: Date = new Date(),
): BranaSkupinovyScanStav {
  const nazvy = chybneZdrojeNazvy
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .slice(0, MAX_CHYBNYCH_NAZVU)
    .map((n) => n.slice(0, BRANA_ZDROJ_NAZEV_MAX));
  return {
    dokoncenoAt: okamzik.toISOString(),
    chybneZdroje: nazvy.length,
    chybneZdrojeNazvy: nazvy,
  };
}

export function nahraditSkupinovyScanStav<T extends BranaSkupinoveScanStavy>(
  dokument: T,
  typ: BranaSkupinovyScanTyp,
  stav: BranaSkupinovyScanStav,
): T {
  if (typ === "RYCHLY") {
    return { ...dokument, posledniRychlySkupinovyScan: stav };
  }
  return { ...dokument, posledniDlouhySkupinovyScan: stav };
}

export function validovatVolitelnySkupinovyScanStav(
  hodnota: unknown,
  nazevPole: string,
): { ok: true; hodnota: BranaSkupinovyScanStav | null } | { ok: false; chyba: string } {
  if (hodnota === null || hodnota === undefined) {
    return { ok: true, hodnota: null };
  }
  if (!hodnota || typeof hodnota !== "object") {
    return {
      ok: false,
      chyba: `${nazevPole} musí být objekt posledního skupinového scanu nebo prázdné.`,
    };
  }
  const raw = hodnota as Record<string, unknown>;
  if (
    typeof raw.dokoncenoAt !== "string" ||
    !ISO_DATE_TIME_Z.test(raw.dokoncenoAt) ||
    !Number.isFinite(Date.parse(raw.dokoncenoAt))
  ) {
    return {
      ok: false,
      chyba: `${nazevPole} musí mít platný čas dokončení (ISO UTC).`,
    };
  }
  if (
    typeof raw.chybneZdroje !== "number" ||
    !Number.isInteger(raw.chybneZdroje) ||
    raw.chybneZdroje < 0
  ) {
    return {
      ok: false,
      chyba: `${nazevPole} musí mít nezáporný počet chybných Zdrojů.`,
    };
  }
  if (!Array.isArray(raw.chybneZdrojeNazvy)) {
    return {
      ok: false,
      chyba: `${nazevPole} musí mít seznam názvů chybných Zdrojů.`,
    };
  }
  if (raw.chybneZdrojeNazvy.length > MAX_CHYBNYCH_NAZVU) {
    return {
      ok: false,
      chyba: `${nazevPole} má příliš mnoho názvů chybných Zdrojů.`,
    };
  }
  const nazvy: string[] = [];
  for (const polozka of raw.chybneZdrojeNazvy) {
    if (typeof polozka !== "string") {
      return {
        ok: false,
        chyba: `${nazevPole} smí v seznamu chyb obsahovat jen textové názvy.`,
      };
    }
    const nazev = polozka.trim();
    if (!nazev || nazev.length > BRANA_ZDROJ_NAZEV_MAX) {
      return {
        ok: false,
        chyba: `${nazevPole} má neplatný název chybného Zdroje.`,
      };
    }
    nazvy.push(nazev);
  }
  if (nazvy.length !== raw.chybneZdroje) {
    return {
      ok: false,
      chyba: `${nazevPole}: počet chyb se neshoduje se seznamem názvů.`,
    };
  }
  return {
    ok: true,
    hodnota: {
      dokoncenoAt: raw.dokoncenoAt,
      chybneZdroje: nazvy.length,
      chybneZdrojeNazvy: nazvy,
    },
  };
}

export function textPoctuChybSkupinovehoScanu(pocet: number): string {
  if (pocet <= 0) {
    return "bez chyb";
  }
  if (pocet === 1) {
    return "1 chyba";
  }
  if (pocet >= 2 && pocet <= 4) {
    return `${pocet} chyby`;
  }
  return `${pocet} chyb`;
}

export function formatovatSkupinovyScanKdy(
  dokoncenoAt: string,
  dnesIso: string,
): string {
  const praha = okamzikVPraze(new Date(dokoncenoAt));
  const denIso = isoDenZPrahy(new Date(dokoncenoAt));
  const cas = `${praha.hodina}:${pad2(praha.minuta)}`;
  if (denIso === dnesIso) {
    return `dnes ${cas}`;
  }
  return `${praha.den}. ${praha.mesic}. ${cas}`;
}

export function textSkupinovehoScanuProKalendar(
  popisek: "Rychlý scan" | "Dlouhý scan",
  stav: BranaSkupinovyScanStav | null,
  dnesIso: string,
): string {
  if (!stav) {
    return `${popisek}: —`;
  }
  return `${popisek}: ${formatovatSkupinovyScanKdy(stav.dokoncenoAt, dnesIso)} · ${textPoctuChybSkupinovehoScanu(stav.chybneZdroje)}`;
}
