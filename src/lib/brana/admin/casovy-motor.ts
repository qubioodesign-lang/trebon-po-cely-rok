/**
 * Časový motor BRÁNA – pouze rozhodnutí, žádný side effect.
 * Určeno pro server / budoucí scheduler; bez Blob zápisu, scanu a push.
 *
 * Čisté jádro (bez `server-only`), aby šlo deterministicky ověřit
 * stejně jako `scripts/verify-brana-cas.ts`. Produkční načtení kotvy
 * je v `casovy-motor-uloziste.ts` (server-only).
 */

import { okamzikVPraze } from "@/lib/brana/cas";

/**
 * Hodina slotu v Europe/Prague – shodná s BRANA_UPOZORNENI_CAS_HODINA.
 * Okno: 09:00–09:59 (celá hodina 9), vhodné pro budoucí cron.
 */
export const BRANA_CASOVY_MOTOR_SLOT_HODINA = 9;

export type BranaCasovyPlan = {
  jeRychlyTermin: boolean;
  jeDlouhodobyTermin: boolean;
  /** YYYY-MM-DD v Europe/Prague */
  datumVPraze: string;
  /** HH:mm v Europe/Prague */
  casVPraze: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Vyhodnotí rychlý (Po/Čt) a dlouhodobý (kotva) termín pro daný okamžik.
 * Časové okno: hodina === 9 → 09:00–09:59 Europe/Prague.
 * Žádný zápis, žádný scan, žádný push.
 */
export function vyhodnotitBranaCasovyPlan(
  okamzik: Date,
  pristiDlouhodobaKontrola: string | null,
): BranaCasovyPlan {
  const praha = okamzikVPraze(okamzik);
  const datumVPraze = `${praha.rok}-${pad2(praha.mesic)}-${pad2(praha.den)}`;
  const casVPraze = `${pad2(praha.hodina)}:${pad2(praha.minuta)}`;

  const veSlotu9 = praha.hodina === BRANA_CASOVY_MOTOR_SLOT_HODINA;
  const jePondeli = praha.denVTydnu === 1;
  const jeCtvrtek = praha.denVTydnu === 4;

  const jeRychlyTermin = veSlotu9 && (jePondeli || jeCtvrtek);

  const jeDlouhodobyTermin =
    veSlotu9 &&
    jePondeli &&
    typeof pristiDlouhodobaKontrola === "string" &&
    pristiDlouhodobaKontrola === datumVPraze;

  return {
    jeRychlyTermin,
    jeDlouhodobyTermin,
    datumVPraze,
    casVPraze,
  };
}
