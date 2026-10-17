import {
  BRANA_ANALYTIKA_GRAF_VYCHOZI_OBDOBI,
  sestavitPodkladyGrafu,
  type BranaAnalytikaGrafObdobi,
  type PodkladyGrafuBrany,
} from "./grafy";
import { prazdnyDokumentAnalytiky, type BranaAnalytikaDokument } from "./model";

export type VysledekCteniDokumentuAnalytiky =
  | { stav: "ok"; dokument: BranaAnalytikaDokument }
  | { stav: "neexistuje" }
  | { stav: "poskozeny" }
  | { stav: "chyba" };

export type VysledekPodkladuGrafu =
  | ({ ok: true } & PodkladyGrafuBrany)
  | { ok: false; duvod: "neprihlasen" | "chyba-cteni" | "poskozeny-dokument" };

/**
 * Složí podklady grafů až po ověření přístupu.
 * Čtení je předané zvenčí a tato funkce ho nesmí použít bez přihlášení.
 * Neexistující dokument je prázdný výsledek. Chyba čtení není nula návštěv.
 */
export async function pripravitPodkladyGrafu(vstup: {
  obdobi?: BranaAnalytikaGrafObdobi;
  ted: Date;
  jePrihlasen: () => Promise<boolean>;
  nacist: () => Promise<VysledekCteniDokumentuAnalytiky>;
}): Promise<VysledekPodkladuGrafu> {
  let prihlasen = false;
  try {
    prihlasen = await vstup.jePrihlasen();
  } catch {
    return { ok: false, duvod: "neprihlasen" };
  }
  if (!prihlasen) {
    return { ok: false, duvod: "neprihlasen" };
  }

  let cteni: VysledekCteniDokumentuAnalytiky;
  try {
    cteni = await vstup.nacist();
  } catch {
    return { ok: false, duvod: "chyba-cteni" };
  }

  if (cteni.stav === "chyba") {
    return { ok: false, duvod: "chyba-cteni" };
  }
  if (cteni.stav === "poskozeny") {
    return { ok: false, duvod: "poskozeny-dokument" };
  }

  const dokument = cteni.stav === "ok" ? cteni.dokument : prazdnyDokumentAnalytiky();
  return {
    ok: true,
    ...sestavitPodkladyGrafu(
      dokument,
      vstup.ted,
      vstup.obdobi ?? BRANA_ANALYTIKA_GRAF_VYCHOZI_OBDOBI,
    ),
  };
}
