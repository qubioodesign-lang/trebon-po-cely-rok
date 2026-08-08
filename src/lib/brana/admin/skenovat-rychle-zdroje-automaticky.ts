import "server-only";

import { skenovatZnamyZdrojProScheduler } from "./skenovat-zdroj";
import { nacistZdrojeProScheduler } from "./zdroje-uloziste";

/**
 * Agregovaný technický výsledek automatického Rychlého batch scanu.
 * Počty odpovídají existujícímu skenovatZnamyZdroj; neukládá se jako historie.
 */
export type BranaRychlyAutomatickyScanVysledek = {
  pocetZdroju: number;
  uspesneZdroje: number;
  chybneZdroje: number;
  nalezeno: number;
  pridanoDoKalendare: number;
  jizExistuje: number;
  nezarazeno: number;
};

function prazdnyVysledek(): BranaRychlyAutomatickyScanVysledek {
  return {
    pocetZdroju: 0,
    uspesneZdroje: 0,
    chybneZdroje: 0,
    nalezeno: 0,
    pridanoDoKalendare: 0,
    jizExistuje: 0,
    nezarazeno: 0,
  };
}

/**
 * Sekvenční scan všech zdrojů typ === "RYCHLY" z data/brana-zdroje.json.
 * Pouze pro důvěryhodný scheduler (po ověření CRON_SECRET).
 * Nové události → CEKA_NA_SCHVALENI. Nemění posledniScanDokoncen. Žádný push.
 * Chyba jednoho zdroje se započítá a pokračuje se (atomický put per zdroj).
 */
export async function skenovatRychleZdrojeAutomaticky(): Promise<BranaRychlyAutomatickyScanVysledek> {
  const zdroje = await nacistZdrojeProScheduler();
  if (!zdroje.ok) {
    throw new Error("Seznam zdrojů se nepodařilo načíst.");
  }

  const rychle = zdroje.zdroje.filter((z) => z.typ === "RYCHLY");
  if (rychle.length === 0) {
    return prazdnyVysledek();
  }

  const agregace = prazdnyVysledek();
  agregace.pocetZdroju = rychle.length;

  for (const zdroj of rychle) {
    try {
      const vysledek = await skenovatZnamyZdrojProScheduler(zdroj.id);
      agregace.uspesneZdroje += 1;
      agregace.nalezeno += vysledek.nalezeno;
      agregace.pridanoDoKalendare += vysledek.pridanoDoKalendare;
      agregace.jizExistuje += vysledek.jizExistuje;
      agregace.nezarazeno += vysledek.nezarazeno;
    } catch (error) {
      agregace.chybneZdroje += 1;
      console.error(
        `[brana-rychly-scan] selhání zdroje id=${zdroj.id}`,
        error,
      );
    }
  }

  return agregace;
}
