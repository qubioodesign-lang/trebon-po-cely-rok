import "server-only";

import {
  vyhodnotitBranaCasovyPlan,
  type BranaCasovyPlan,
} from "@/lib/brana/admin/casovy-motor";
import {
  BRANA_UPOZORNENI_CHYBA_CTENI,
  nacistUpozorneniNastaveni,
} from "@/lib/brana/admin/upozorneni-uloziste";

export type BranaCasovyPlanZNastaveniVysledek =
  | { ok: true; plan: BranaCasovyPlan }
  | { ok: false; chyba: string };

/**
 * Načte PRIVATE kotvu pristiDlouhodobaKontrola a vyhodnotí časový plán.
 * Neexistující dokument → dlouhodobý termín false (kotva null).
 * Chyba čtení → ok: false (neignoruje se).
 * Žádný put.
 */
export async function vyhodnotitBranaCasovyPlanZNastaveni(
  okamzik: Date = new Date(),
): Promise<BranaCasovyPlanZNastaveniVysledek> {
  const nacist = await nacistUpozorneniNastaveni();
  if (!nacist.ok) {
    return { ok: false, chyba: BRANA_UPOZORNENI_CHYBA_CTENI };
  }

  return {
    ok: true,
    plan: vyhodnotitBranaCasovyPlan(
      okamzik,
      nacist.dokument.pristiDlouhodobaKontrola,
    ),
  };
}
