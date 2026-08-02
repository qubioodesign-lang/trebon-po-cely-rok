import { jeVikendPouzeNedeleVPraze } from "./cas";
import {
  branaNavigace,
  BRANA_NAVIGACE_POLOZKY,
  type BranaNavPolozka,
} from "./cesty";

/** Veřejné navigační stránky BRÁNY – /brana a podcesty */
export type BranaVerejnaStranka = "dnes" | "zitra" | "vikend" | "7-dni" | "vyhled";

/** @deprecated Použijte {@link branaNavigace} – statické href neodráží subdoménu. */
export const BRANA_NAVIGACE = BRANA_NAVIGACE_POLOZKY.map((polozka) => ({
  ...polozka,
  href: polozka.id === "dnes" ? "/brana" : `/brana/${polozka.id}`,
})) as BranaNavPolozka[];

export function opakovaniSeznamuAkci(stranka: BranaVerejnaStranka): number {
  switch (stranka) {
    case "dnes":
    case "zitra":
    case "vyhled":
      return 1;
    case "vikend":
      return jeVikendPouzeNedeleVPraze() ? 1 : 2;
    case "7-dni":
      return 7;
  }
}

/** Sousední pohled pro swipe – stejné pořadí a href jako navigační odkazy. */
export function sousedniBranaStranka(
  stranka: BranaVerejnaStranka,
  smer: "predchozi" | "nasledujici",
  host?: string | null,
): BranaNavPolozka | null {
  const navigace = branaNavigace(host);
  const index = navigace.findIndex((polozka) => polozka.id === stranka);
  const sousedniIndex = smer === "nasledujici" ? index + 1 : index - 1;

  return navigace[sousedniIndex] ?? null;
}
