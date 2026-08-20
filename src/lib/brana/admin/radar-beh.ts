/**
 * RADAR krok 4: zápis pracovních stop po produkčním cronu.
 * Fail-soft. Nevolá produkční scan, nezasahuje do razítka Rychlého/Dlouhého.
 */

import "server-only";

import { obalitRadarBehFailSoft } from "./radar";
import { spustitRadarScanReadOnly } from "./radar-scan";
import { zapsatRadarScanProScheduler } from "./radar-uloziste";
import { najitRadarVstup } from "./radar-vstupy";

/** Strop wall-clock uvnitř RADARU. Produkční cron je v tu chvíli už hotový. */
export const BRANA_RADAR_WALL_MS = 12_000;
export const BRANA_RADAR_FETCH_TIMEOUT_MS = 8_000;

async function spustitRadarBehAZapsat(): Promise<void> {
  const vysledek = await spustitRadarScanReadOnly({
    limitMs: BRANA_RADAR_WALL_MS,
    fetchTimeoutMs: BRANA_RADAR_FETCH_TIMEOUT_MS,
  });
  for (const chyba of vysledek.chyby) {
    const vstup = najitRadarVstup(chyba.radarVstupId);
    console.error(
      `[brana-radar] selhání vstupu ${vstup?.nazev ?? chyba.radarVstupId}`,
    );
  }
  await zapsatRadarScanProScheduler(vysledek.kandidati, {
    tedIso: new Date().toISOString(),
  });
}

/** Vlastní try/catch. Chyba RADARU nesmí změnit Rychlý/Dlouhý scan. */
export async function spustitRadarPoProdukcnimCronuFailSoft(): Promise<void> {
  await obalitRadarBehFailSoft(spustitRadarBehAZapsat);
}
