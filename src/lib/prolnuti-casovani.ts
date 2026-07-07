import { PROLNUTI_CASOVANI } from "./prolnuti-konstanty";

/** Upravitelné časy prolnutí (ms) – sdílené mezi adminem a galerií */
export interface ProlnutiCasovaniNastaveni {
  cekaniPredStartemMs: number;
  delkaProlnutiMs: number;
  /** Překrytí – další krok může začít o tolik ms dříve než po dokončení fade */
  prekrytiProlnutiMs: number;
  replayZpozdeniMs: number;
  replayFadeMs: number;
}

export type ProlnutiCasovaniUlozene = Partial<ProlnutiCasovaniNastaveni>;

export const PROLNUTI_CASOVANI_VYCHOZI: ProlnutiCasovaniNastaveni = {
  cekaniPredStartemMs: PROLNUTI_CASOVANI.cekaniPredStartemMs,
  delkaProlnutiMs: PROLNUTI_CASOVANI.delkaProlnutiMs,
  prekrytiProlnutiMs: PROLNUTI_CASOVANI.prekrytiProlnutiMs,
  replayZpozdeniMs: PROLNUTI_CASOVANI.replayZpozdeniMs,
  replayFadeMs: PROLNUTI_CASOVANI.replayFadeMs,
};

function platnaMs(hodnota: unknown): number | undefined {
  if (typeof hodnota !== "number" || !Number.isFinite(hodnota) || hodnota < 0) {
    return undefined;
  }
  return Math.round(hodnota);
}

export function sloucitProlnutiCasovani(
  ulozene?: ProlnutiCasovaniUlozene | null
): ProlnutiCasovaniNastaveni {
  return {
    cekaniPredStartemMs:
      platnaMs(ulozene?.cekaniPredStartemMs) ??
      PROLNUTI_CASOVANI_VYCHOZI.cekaniPredStartemMs,
    delkaProlnutiMs:
      platnaMs(ulozene?.delkaProlnutiMs) ??
      PROLNUTI_CASOVANI_VYCHOZI.delkaProlnutiMs,
    prekrytiProlnutiMs:
      platnaMs(ulozene?.prekrytiProlnutiMs) ??
      PROLNUTI_CASOVANI_VYCHOZI.prekrytiProlnutiMs,
    replayZpozdeniMs:
      platnaMs(ulozene?.replayZpozdeniMs) ??
      PROLNUTI_CASOVANI_VYCHOZI.replayZpozdeniMs,
    replayFadeMs:
      platnaMs(ulozene?.replayFadeMs) ??
      PROLNUTI_CASOVANI_VYCHOZI.replayFadeMs,
  };
}

export function validovatProlnutiCasovani(
  vstup: ProlnutiCasovaniNastaveni
): { uspech: true; data: ProlnutiCasovaniNastaveni } | { chyba: string } {
  const cekani = platnaMs(vstup.cekaniPredStartemMs);
  const delka = platnaMs(vstup.delkaProlnutiMs);
  const prekryti = platnaMs(vstup.prekrytiProlnutiMs);
  const replay = platnaMs(vstup.replayZpozdeniMs);
  const fade = platnaMs(vstup.replayFadeMs);

  if (cekani === undefined) {
    return { chyba: "Neplatná hodnota čekání před startem" };
  }
  if (delka === undefined || delka < 100) {
    return { chyba: "Délka prolnutí musí být alespoň 100 ms" };
  }
  if (prekryti === undefined || prekryti < 0) {
    return { chyba: "Překrytí prolnutí musí být 0 nebo více ms" };
  }
  if (prekryti >= delka) {
    return { chyba: "Překrytí prolnutí musí být menší než délka prolnutí" };
  }
  if (replay === undefined) {
    return { chyba: "Neplatná hodnota zpoždění replay" };
  }
  if (fade === undefined) {
    return { chyba: "Neplatná hodnota fade-in replay" };
  }

  return {
    uspech: true,
    data: {
      cekaniPredStartemMs: cekani,
      delkaProlnutiMs: delka,
      prekrytiProlnutiMs: prekryti,
      replayZpozdeniMs: replay,
      replayFadeMs: fade,
    },
  };
}
