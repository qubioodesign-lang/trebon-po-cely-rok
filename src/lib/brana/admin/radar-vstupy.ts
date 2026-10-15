/**
 * Katalog vstupů RADARU — krok 3.
 * Jen veřejné URL. Žádný zápis, žádný cron, žádná produkční větev.
 */

import { TREBONSKO_LAZENSKY_PROGRAM_HUB_PATH } from "./tanecni-vecery";

export type BranaRadarVstup = {
  id: string;
  nazev: string;
  url: string;
};

export const BRANA_RADAR_VSTUP_TREBONSKO = "trebonsko-prehled";
export const BRANA_RADAR_VSTUP_ZAMEK = "zamek-trebon";
export const BRANA_RADAR_VSTUP_KPH = "kultura-pod-hvezdami";
export const BRANA_RADAR_VSTUP_TLS = "trebonska-letni-setkavani";
/** Úzký vstup: jen Třeboňská lázeňská matiné z měsíčních článků hubu. */
export const BRANA_RADAR_VSTUP_MATINE = "lazenske-matine";
/** Jen výchozí Kalendář akcí Charity Třeboň, bez historie. */
export const BRANA_RADAR_VSTUP_CHARITA = "charita-trebon-kalendar";

export const BRANA_RADAR_VSTUPY: readonly BranaRadarVstup[] = [
  {
    id: BRANA_RADAR_VSTUP_TREBONSKO,
    nazev: "Třeboňsko — přehled akcí",
    url: "https://www.trebonsko.cz/prehled-akci-trebonsko",
  },
  {
    id: BRANA_RADAR_VSTUP_ZAMEK,
    nazev: "Státní zámek Třeboň",
    url: "https://www.zamek-trebon.cz/cs/akce",
  },
  {
    id: BRANA_RADAR_VSTUP_KPH,
    nazev: "Kultura pod hvězdami",
    url: "https://www.kulturapodhvezdami.cz/",
  },
  {
    id: BRANA_RADAR_VSTUP_TLS,
    nazev: "Třeboňská letní setkávání",
    url: "https://www.trebon-kurzy.cz/",
  },
  {
    id: BRANA_RADAR_VSTUP_MATINE,
    nazev: "Lázeňské matiné",
    url: `https://www.trebonsko.cz${TREBONSKO_LAZENSKY_PROGRAM_HUB_PATH}/`,
  },
  {
    id: BRANA_RADAR_VSTUP_CHARITA,
    nazev: "Charita Třeboň — kalendář akcí",
    url: "https://trebon.charita.cz/aktualne/kalendar-akci/",
  },
];

export function najitRadarVstup(id: string): BranaRadarVstup | null {
  return BRANA_RADAR_VSTUPY.find((v) => v.id === id) ?? null;
}
