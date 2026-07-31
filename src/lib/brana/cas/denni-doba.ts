import { getTimes } from "suncalc";
import { BRANA_CASOVA_KONFIGURACE } from "./konfigurace";
import { dnesVPraze, okamzikZPrahy, pridatDny, type BranaDatum } from "./cas";

const { trebon, denniDoba } = BRANA_CASOVA_KONFIGURACE;

export type BranaPrepnutiDenniDoby = {
  ranniPrepnuti: Date;
  vecerniPrepnuti: Date;
};

function jePlatnyOkamzik(okamzik: Date | null | undefined): okamzik is Date {
  return okamzik instanceof Date && !Number.isNaN(okamzik.getTime());
}

function posunoutOkamzik(okamzik: Date, minuty: number): Date {
  return new Date(okamzik.getTime() + minuty * 60_000);
}

function fallbackPrepnuti(datum: BranaDatum): BranaPrepnutiDenniDoby {
  const { fallback } = denniDoba;

  return {
    ranniPrepnuti: okamzikZPrahy(
      datum.rok,
      datum.mesic,
      datum.den,
      fallback.zacatekDne.hodina,
      fallback.zacatekDne.minuta,
    ),
    vecerniPrepnuti: okamzikZPrahy(
      datum.rok,
      datum.mesic,
      datum.den,
      fallback.zacatekNoci.hodina,
      fallback.zacatekNoci.minuta,
    ),
  };
}

function vypocetSlunce(datum: BranaDatum): { vychod: Date; zapad: Date } | null {
  try {
    const reference = okamzikZPrahy(datum.rok, datum.mesic, datum.den, 12, 0);
    const casy = getTimes(reference, trebon.lat, trebon.lng);

    if (!jePlatnyOkamzik(casy.sunrise) || !jePlatnyOkamzik(casy.sunset)) {
      return null;
    }

    return {
      vychod: casy.sunrise,
      zapad: casy.sunset,
    };
  } catch {
    return null;
  }
}

/** Okamžiky přepnutí denní/noční verze pro kalendářní den v Třeboni. */
export function prepnutiDenniDobyVPraze(
  datum: BranaDatum,
): BranaPrepnutiDenniDoby {
  const slunce = vypocetSlunce(datum);

  if (!slunce) {
    return fallbackPrepnuti(datum);
  }

  return {
    ranniPrepnuti: posunoutOkamzik(slunce.vychod, denniDoba.posunRanoMinuty),
    vecerniPrepnuti: posunoutOkamzik(slunce.zapad, denniDoba.posunVecerMinuty),
  };
}

/** Určí, zda je v daném okamžiku aktivní noční verze pozadí. */
export function jeNocniRezimVPraze(okamzik: Date = new Date()): boolean {
  const datum = dnesVPraze(okamzik);
  const { ranniPrepnuti, vecerniPrepnuti } = prepnutiDenniDobyVPraze(datum);

  if (okamzik.getTime() >= vecerniPrepnuti.getTime()) {
    return true;
  }

  if (okamzik.getTime() < ranniPrepnuti.getTime()) {
    return true;
  }

  return false;
}

/** Vrátí okamžik další změny denní/noční verze (pro plánování na klientu). */
export function dalsiZmenaDenniDobyVPraze(
  okamzik: Date = new Date(),
): Date {
  const datum = dnesVPraze(okamzik);
  const { ranniPrepnuti, vecerniPrepnuti } = prepnutiDenniDobyVPraze(datum);

  if (jeNocniRezimVPraze(okamzik)) {
    if (okamzik.getTime() < ranniPrepnuti.getTime()) {
      return ranniPrepnuti;
    }

    const zitra = pridatDny(datum, 1);
    return prepnutiDenniDobyVPraze(zitra).ranniPrepnuti;
  }

  return vecerniPrepnuti;
}
