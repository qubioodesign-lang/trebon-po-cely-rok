import { BRANA_CASOVA_KONFIGURACE } from "./konfigurace";
import {
  dnesVPraze,
  okamzikVPraze,
  pridatDny,
  type BranaDatum,
} from "./cas";

/** Sobota a neděle aktuálního víkendu podle pravidel BRÁNY. */
export type BranaVikend = {
  sobota: BranaDatum;
  nedele: BranaDatum;
};

function jePoPrepnuVikendu(okamzik: Date): boolean {
  const { denPrepnuti, casPrepnuti } = BRANA_CASOVA_KONFIGURACE.vikend;
  const praha = okamzikVPraze(okamzik);

  if (praha.denVTydnu !== denPrepnuti) {
    return false;
  }

  const minuty = praha.hodina * 60 + praha.minuta;
  const minutyPrepnuti = casPrepnuti.hodina * 60 + casPrepnuti.minuta;

  return minuty >= minutyPrepnuti;
}

/**
 * Vrátí sobotu a neděli aktuálního víkendu v pásmu Europe/Prague.
 *
 * Po–So: nejbližší nadcházející víkend.
 * Ne před 22:00: právě probíhající víkend.
 * Ne od 22:00: následující víkend.
 */
export function aktualniVikendVPraze(okamzik: Date = new Date()): BranaVikend {
  const praha = okamzikVPraze(okamzik);
  const dnes = dnesVPraze(okamzik);

  if (praha.denVTydnu === 0) {
    if (jePoPrepnuVikendu(okamzik)) {
      return {
        sobota: pridatDny(dnes, 6),
        nedele: pridatDny(dnes, 7),
      };
    }

    return {
      sobota: pridatDny(dnes, -1),
      nedele: dnes,
    };
  }

  if (praha.denVTydnu === 6) {
    return {
      sobota: dnes,
      nedele: pridatDny(dnes, 1),
    };
  }

  const dnuDoSoboty = 6 - praha.denVTydnu;

  return {
    sobota: pridatDny(dnes, dnuDoSoboty),
    nedele: pridatDny(dnes, dnuDoSoboty + 1),
  };
}
