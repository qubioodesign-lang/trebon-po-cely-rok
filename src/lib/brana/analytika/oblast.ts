import hranice from "./orp-trebon-hranice.json";
import type { BranaAnalytikaOblast } from "./model";

/**
 * Správní obvod ORP Třeboň podle RÚIAN.
 * Není to město Třeboň, CHKO, okres Jindřichův Hradec ani Jihočeský kraj.
 * Geometrie je prsten z ČÚZK, vrstva ObecSRozsirenouPusobnosti, kód 353.
 */
export const ORP_TREBON_KOD = 353;

export type VstupOblasti = {
  zeme?: string | null;
  zemepisnaSirka?: number | null;
  zemepisnaDelka?: number | null;
};

const PRSTEN = hranice.prsten;

if (
  hranice.kod !== ORP_TREBON_KOD ||
  hranice.nazev !== "Třeboň" ||
  hranice.srs !== "EPSG:4326" ||
  PRSTEN.length !== hranice.vrcholu ||
  PRSTEN.length < 1000
) {
  throw new Error("Hranice ORP Třeboň neodpovídá uloženému zdroji RÚIAN.");
}

/** Bod je uvnitř polygonu podle pravidla sudá/lichá. Bez tolerančního pásma. */
function jeUvnitr(sirka: number, delka: number): boolean {
  let uvnitr = false;
  for (
    let index = 0, predchozi = PRSTEN.length - 1;
    index < PRSTEN.length;
    predchozi = index, index += 1
  ) {
    const [delkaA, sirkaA] = PRSTEN[index];
    const [delkaB, sirkaB] = PRSTEN[predchozi];
    const protina =
      sirkaA > sirka !== sirkaB > sirka &&
      delka < ((delkaB - delkaA) * (sirka - sirkaA)) / (sirkaB - sirkaA) + delkaA;
    if (protina) {
      uvnitr = !uvnitr;
    }
  }
  return uvnitr;
}

function normalizovatZemi(zeme: string | null | undefined): string | null {
  if (typeof zeme !== "string") {
    return null;
  }
  const kod = zeme.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(kod) ? kod : null;
}

function precistSouradnice(
  vstup: VstupOblasti,
): { sirka: number; delka: number } | "chybi" | "neplatne" {
  const sirka = vstup.zemepisnaSirka;
  const delka = vstup.zemepisnaDelka;
  const sirkaChybi = sirka === undefined || sirka === null;
  const delkaChybi = delka === undefined || delka === null;
  if (sirkaChybi && delkaChybi) {
    return "chybi";
  }
  if (
    typeof sirka !== "number" ||
    typeof delka !== "number" ||
    !Number.isFinite(sirka) ||
    !Number.isFinite(delka) ||
    sirka < -90 ||
    sirka > 90 ||
    delka < -180 ||
    delka > 180
  ) {
    return "neplatne";
  }
  return { sirka, delka };
}

/**
 * Odhad souřadnic veřejné IP proti polygonu ORP.
 * Uvnitř je trebonsko, vně mimo_trebonsko.
 * Cizí země na bodu uvnitř ORP si protiřečí a zůstane neurčená.
 * Město ani kraj se nepoužijí a chybějící údaj se nenahrazuje.
 */
export function klasifikovatOblast(vstup: VstupOblasti): BranaAnalytikaOblast {
  const zeme = normalizovatZemi(vstup.zeme);
  const souradnice = precistSouradnice(vstup);

  if (souradnice === "chybi" || souradnice === "neplatne") {
    return "neurceno";
  }

  const uvnitr = jeUvnitr(souradnice.sirka, souradnice.delka);
  if (uvnitr && zeme && zeme !== "CZ") {
    return "neurceno";
  }
  return uvnitr ? "trebonsko" : "mimo_trebonsko";
}
