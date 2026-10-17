import { BRANA_ANALYTIKA_PRIJEM_ZAPNUT } from "./model";

export type OdmitnutiPrijmuAnalytiky = {
  status: 404 | 405;
  telo: { chyba: string };
};

/**
 * Dokud je příjem vypnutý, veřejnost dávku neodešle a statistiky nepřečte.
 * null znamená, že požadavek smí pokračovat do zápisu.
 */
export function vytvoritOdpovedPrijmu(
  metoda: string,
): OdmitnutiPrijmuAnalytiky | null {
  if (metoda !== "POST") {
    return { status: 405, telo: { chyba: "Metoda není povolena." } };
  }

  if (!BRANA_ANALYTIKA_PRIJEM_ZAPNUT) {
    return { status: 404, telo: { chyba: "Nenalezeno." } };
  }

  return null;
}
