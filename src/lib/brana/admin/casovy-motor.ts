/**
 * Časový motor BRÁNA – pouze rozhodnutí, žádný side effect.
 * Určeno pro server / budoucí scheduler; bez Blob zápisu, scanu a push.
 *
 * Čisté jádro (bez `server-only`), aby šlo deterministicky ověřit
 * stejně jako `scripts/verify-brana-cas.ts`. Produkční načtení kotvy
 * je v `casovy-motor-uloziste.ts` (server-only).
 */

import { okamzikVPraze, pridatDny, type BranaDatum } from "@/lib/brana/cas";

/**
 * Hodina slotu v Europe/Prague – shodná s BRANA_UPOZORNENI_CAS_HODINA.
 * Okno: 09:00–09:59 (celá hodina 9), vhodné pro budoucí cron.
 */
export const BRANA_CASOVY_MOTOR_SLOT_HODINA = 9;

/** Připomínka asistovaných zdrojů: kotva dlouhého scanu minus tolik kalendářních dnů. */
export const BRANA_ASISTOVANE_PRIPRAVA_DNI_PRED_KOTVOU = 3;

export type BranaCasovyPlan = {
  jeRychlyTermin: boolean;
  jeDlouhodobyTermin: boolean;
  /**
   * Připomínka asistovaných zdrojů: slot 9:00, den = kotva − 3.
   * Nespouští scan.
   */
  jeAsistovanyPripravnyTermin: boolean;
  /** YYYY-MM-DD v Europe/Prague */
  datumVPraze: string;
  /** HH:mm v Europe/Prague */
  casVPraze: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parsujIsoNaDatum(iso: string): BranaDatum | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null;
  }
  const [rok, mesic, den] = iso.split("-").map(Number);
  return { rok, mesic, den };
}

function formatujIsoDen(datum: BranaDatum): string {
  return `${datum.rok}-${pad2(datum.mesic)}-${pad2(datum.den)}`;
}

/** Den připomínky asistovaných zdrojů = kotva dlouhého scanu − 3 kalendářní dny. */
export function isoDenPripravyAsistovanychZdroju(
  pristiDlouhodobaKontrola: string | null,
): string | null {
  if (typeof pristiDlouhodobaKontrola !== "string") {
    return null;
  }
  const kotva = parsujIsoNaDatum(pristiDlouhodobaKontrola);
  if (!kotva) {
    return null;
  }
  return formatujIsoDen(
    pridatDny(kotva, -BRANA_ASISTOVANE_PRIPRAVA_DNI_PRED_KOTVOU),
  );
}

/**
 * Vyhodnotí rychlý (Po/Čt), dlouhodobý (kotva) a přípravný (kotva − 3) termín.
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

  const denPripravy = isoDenPripravyAsistovanychZdroju(
    pristiDlouhodobaKontrola,
  );
  const jeAsistovanyPripravnyTermin =
    veSlotu9 && denPripravy !== null && denPripravy === datumVPraze;

  return {
    jeRychlyTermin,
    jeDlouhodobyTermin,
    jeAsistovanyPripravnyTermin,
    datumVPraze,
    casVPraze,
  };
}
