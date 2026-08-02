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

/** Neděle – pohled Víkend zobrazuje pouze aktuální neděli (jako Dnes). */
export function jeVikendPouzeNedeleVPraze(okamzik: Date = new Date()): boolean {
  return okamzikVPraze(okamzik).denVTydnu === 0;
}

/**
 * Vrátí sobotu a neděli víkendu v pásmu Europe/Prague.
 *
 * Po–Pá: nejbližší nadcházející sobota a neděle.
 * So: aktuální sobota a neděle.
 * Ne: pouze aktuální neděle (sobota = neděle = dnes).
 * Přechod na příští víkend až v pondělí 00:00:00.
 */
export function aktualniVikendVPraze(okamzik: Date = new Date()): BranaVikend {
  const praha = okamzikVPraze(okamzik);
  const dnes = dnesVPraze(okamzik);

  if (praha.denVTydnu === 0) {
    return {
      sobota: dnes,
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
