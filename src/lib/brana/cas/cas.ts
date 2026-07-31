import { BRANA_CASOVA_KONFIGURACE } from "./konfigurace";

const MAPA_DNU: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Kalendářní datum bez času – den v pásmu Europe/Prague. */
export type BranaDatum = {
  rok: number;
  mesic: number;
  den: number;
};

/** Okamžik rozložený podle Europe/Prague. */
export type BranaOkamzikVPraze = BranaDatum & {
  denVTydnu: number;
  hodina: number;
  minuta: number;
};

const rozkladovacVPraze = new Intl.DateTimeFormat("en-US", {
  timeZone: BRANA_CASOVA_KONFIGURACE.casovePasmo,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hour12: false,
});

function hodnotaCasti(
  casti: Intl.DateTimeFormatPart[],
  typ: Intl.DateTimeFormatPartTypes,
): string {
  const cast = casti.find((p) => p.type === typ);
  if (!cast) {
    throw new Error(`Chybí část ${typ} pro ${BRANA_CASOVA_KONFIGURACE.casovePasmo}.`);
  }
  return cast.value;
}

/** Vrátí okamžik rozložený podle Europe/Prague (výchozí = nyní). */
export function okamzikVPraze(okamzik: Date = new Date()): BranaOkamzikVPraze {
  const casti = rozkladovacVPraze.formatToParts(okamzik);
  const denVTydnu = MAPA_DNU[hodnotaCasti(casti, "weekday")];

  if (denVTydnu === undefined) {
    throw new Error("Neznámý den v týdnu z Intl.DateTimeFormat.");
  }

  return {
    rok: Number(hodnotaCasti(casti, "year")),
    mesic: Number(hodnotaCasti(casti, "month")),
    den: Number(hodnotaCasti(casti, "day")),
    denVTydnu,
    hodina: Number(hodnotaCasti(casti, "hour")) % 24,
    minuta: Number(hodnotaCasti(casti, "minute")),
  };
}

/** Přičte kalendářní dny k datu (nezávisle na letním/zimním čase). */
export function pridatDny(datum: BranaDatum, dny: number): BranaDatum {
  const vysledek = new Date(Date.UTC(datum.rok, datum.mesic - 1, datum.den + dny, 12));

  return {
    rok: vysledek.getUTCFullYear(),
    mesic: vysledek.getUTCMonth() + 1,
    den: vysledek.getUTCDate(),
  };
}

/**
 * Sestaví UTC okamžik odpovídající zadanému lokálnímu času v Europe/Prague.
 * Určeno pro testy a budoucí simulace – produkční kód používá okamzikVPraze().
 */
export function okamzikZPrahy(
  rok: number,
  mesic: number,
  den: number,
  hodina: number,
  minuta: number,
): Date {
  const zakladUtc = Date.UTC(rok, mesic - 1, den, hodina, minuta);

  for (let posunHodin = -14; posunHodin <= 14; posunHodin++) {
    for (const posunMinut of [0, -30, 30]) {
      const kandidat = new Date(zakladUtc + posunHodin * 3_600_000 + posunMinut * 60_000);
      const rozklad = okamzikVPraze(kandidat);

      if (
        rozklad.rok === rok &&
        rozklad.mesic === mesic &&
        rozklad.den === den &&
        rozklad.hodina === hodina &&
        rozklad.minuta === minuta
      ) {
        return kandidat;
      }
    }
  }

  throw new Error(
    `Nelze sestavit okamžik ${rok}-${mesic}-${den} ${hodina}:${String(minuta).padStart(2, "0")} v ${BRANA_CASOVA_KONFIGURACE.casovePasmo}.`,
  );
}

/** Kalendářní datum (den) aktuálního okamžiku v Europe/Prague. */
export function dnesVPraze(okamzik: Date = new Date()): BranaDatum {
  const { rok, mesic, den } = okamzikVPraze(okamzik);
  return { rok, mesic, den };
}
