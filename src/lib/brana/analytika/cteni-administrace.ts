import "server-only";

import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  BRANA_ANALYTIKA_GRAF_VYCHOZI_OBDOBI,
  type BranaAnalytikaGrafObdobi,
} from "./grafy";
import { pripravitPodkladyGrafu, type VysledekPodkladuGrafu } from "./podklady-grafu";
import { nacistBranaAnalytikuKeCteni } from "./uloziste";

/**
 * Podklady grafů pro administraci. Ověření je na serveru, ne jen v layoutu.
 * Nepřihlášený uživatel se k dokumentu ani k tokenu nedostane.
 */
export async function nacistPodkladyGrafuProAdministraci(
  obdobi: BranaAnalytikaGrafObdobi = BRANA_ANALYTIKA_GRAF_VYCHOZI_OBDOBI,
  ted: Date = new Date(),
): Promise<VysledekPodkladuGrafu> {
  const prihlasen = await jeAdminPrihlasen();
  if (!prihlasen) {
    return { ok: false, duvod: "neprihlasen" };
  }

  return pripravitPodkladyGrafu({
    obdobi,
    ted,
    jePrihlasen: async () => true,
    nacist: () => nacistBranaAnalytikuKeCteni(),
  });
}
