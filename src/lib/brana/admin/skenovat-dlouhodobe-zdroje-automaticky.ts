import "server-only";

import { skenovatZnamyZdrojProScheduler } from "./skenovat-zdroj";
import { nazevChybnehoZdrojeProStopu } from "./skupinovy-scan-stav";
import { nacistZdrojeProScheduler } from "./zdroje-uloziste";

/**
 * Agregovaný technický výsledek automatického Dlouhodobého batch scanu.
 * Počty odpovídají existujícímu skenovatZnamyZdroj; neukládá se jako historie.
 */
export type BranaDlouhodobyAutomatickyScanVysledek = {
  pocetZdroju: number;
  uspesneZdroje: number;
  chybneZdroje: number;
  chybneZdrojeNazvy: string[];
  nalezeno: number;
  pridanoDoKalendare: number;
  jizExistuje: number;
  nezarazeno: number;
};

function prazdnyVysledek(): BranaDlouhodobyAutomatickyScanVysledek {
  return {
    pocetZdroju: 0,
    uspesneZdroje: 0,
    chybneZdroje: 0,
    chybneZdrojeNazvy: [],
    nalezeno: 0,
    pridanoDoKalendare: 0,
    jizExistuje: 0,
    nezarazeno: 0,
  };
}

/**
 * Sekvenční scan všech zdrojů typ === "DLOUHODOBY" z data/brana-zdroje.json.
 * Pouze pro důvěryhodný scheduler (po ověření CRON_SECRET).
 * Nové události → CEKA_NA_SCHVALENI. Nemění posledniScanDokoncen. Žádný push.
 * Chyba jednoho zdroje se započítá a pokračuje se (atomický put per zdroj).
 * Nula DLOUHODOBY zdrojů = bezpečný konec batch (počty 0).
 */
export async function skenovatDlouhodobeZdrojeAutomaticky(): Promise<BranaDlouhodobyAutomatickyScanVysledek> {
  const zdroje = await nacistZdrojeProScheduler();
  if (!zdroje.ok) {
    throw new Error("Seznam zdrojů se nepodařilo načíst.");
  }

  const dlouhodobe = zdroje.zdroje.filter((z) => z.typ === "DLOUHODOBY");
  if (dlouhodobe.length === 0) {
    return prazdnyVysledek();
  }

  const agregace = prazdnyVysledek();
  agregace.pocetZdroju = dlouhodobe.length;

  for (const zdroj of dlouhodobe) {
    try {
      const vysledek = await skenovatZnamyZdrojProScheduler(zdroj.id);
      agregace.uspesneZdroje += 1;
      agregace.nalezeno += vysledek.nalezeno;
      agregace.pridanoDoKalendare += vysledek.pridanoDoKalendare;
      agregace.jizExistuje += vysledek.jizExistuje;
      agregace.nezarazeno += vysledek.nezarazeno;
    } catch (error) {
      agregace.chybneZdroje += 1;
      agregace.chybneZdrojeNazvy.push(
        nazevChybnehoZdrojeProStopu(zdroj.nazev, zdroj.id),
      );
      console.error(
        `[brana-dlouhodoby-scan] selhání zdroje id=${zdroj.id}`,
        error,
      );
    }
  }

  return agregace;
}
