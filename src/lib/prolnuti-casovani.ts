import { PROLNUTI_CASOVANI } from "./prolnuti-konstanty";

/** Upravitelné časy prolnutí (ms) – sdílené mezi adminem a galerií */
export interface ProlnutiCasovaniNastaveni {
  cekaniPredStartemMs: number;
  delkaProlnutiMs: number;
  /** Překrytí – další krok může začít o tolik ms dříve než po dokončení fade */
  prekrytiProlnutiMs: number;
  /** Aktivní nástup posledního snímku (opacity 0→1) u prolnutí se 3 fotografiemi */
  nastupPoslednihoSnimkuMs: number;
  /**
   * Prodleva po startu kroku 0 (nástup druhé fotky), než se spustí poslední krok B→C.
   * Platí jen u prolnutí se 3 fotografiemi.
   */
  prodlevaPredPoslednimKrokemMs: number;
  replayZpozdeniMs: number;
  replayFadeMs: number;
}

export type ProlnutiCasovaniUlozene = Partial<ProlnutiCasovaniNastaveni>;

export const PROLNUTI_CASOVANI_VYCHOZI: ProlnutiCasovaniNastaveni = {
  cekaniPredStartemMs: PROLNUTI_CASOVANI.cekaniPredStartemMs,
  delkaProlnutiMs: PROLNUTI_CASOVANI.delkaProlnutiMs,
  prekrytiProlnutiMs: PROLNUTI_CASOVANI.prekrytiProlnutiMs,
  nastupPoslednihoSnimkuMs: PROLNUTI_CASOVANI.nastupPoslednihoSnimkuMs,
  prodlevaPredPoslednimKrokemMs: PROLNUTI_CASOVANI.prodlevaPredPoslednimKrokemMs,
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
    nastupPoslednihoSnimkuMs:
      platnaMs(ulozene?.nastupPoslednihoSnimkuMs) ??
      PROLNUTI_CASOVANI_VYCHOZI.nastupPoslednihoSnimkuMs,
    prodlevaPredPoslednimKrokemMs:
      platnaMs(ulozene?.prodlevaPredPoslednimKrokemMs) ??
      PROLNUTI_CASOVANI_VYCHOZI.prodlevaPredPoslednimKrokemMs,
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
  const nastupPosledniho = platnaMs(vstup.nastupPoslednihoSnimkuMs);
  const prodlevaPredPoslednim = platnaMs(vstup.prodlevaPredPoslednimKrokemMs);
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
  if (
    nastupPosledniho === undefined ||
    nastupPosledniho < 1_500 ||
    nastupPosledniho > 5_000
  ) {
    return { chyba: "Nástup posledního snímku musí být mezi 1500 a 5000 ms" };
  }
  if (
    prodlevaPredPoslednim === undefined ||
    prodlevaPredPoslednim < 1_500 ||
    prodlevaPredPoslednim > 5_000
  ) {
    return {
      chyba: "Prodleva před posledním krokem musí být mezi 1500 a 5000 ms",
    };
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
      nastupPoslednihoSnimkuMs: nastupPosledniho,
      prodlevaPredPoslednimKrokemMs: prodlevaPredPoslednim,
      replayZpozdeniMs: replay,
      replayFadeMs: fade,
    },
  };
}
