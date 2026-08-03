/** Pravidla víceřádkového popisu fotky / prolnutí (Třeboň). */

export const MAX_RADKU_POPISU = 4;

/**
 * Konzervativní max. šířka řádku v px – bezpečně mezi krajními šipkami
 * na typickém mobilu (~390px), uvnitř px-6 overlay.
 */
export const MAX_SIRKA_RADKU_POPISU_PX = 240;

/** Pevné řádkování jen u 2–4 řádků (jednořádkové zůstává výchozí text-sm). */
export const LINE_HEIGHT_VICE_RADKU = 1.625;

/** Tailwind tracking-wide = 0.025em */
const TRACKING_WIDE_EM = 0.025;
const FONT_SIZE_PX = 14;

export function radkyPopisu(popis: string): string[] {
  return popis.split("\n");
}

export function maViceRadkuPopisu(popis: string): boolean {
  return popis.includes("\n");
}

export function prekrocilMaxRadku(popis: string): boolean {
  return radkyPopisu(popis).length > MAX_RADKU_POPISU;
}

/** Šířka řádku produkčním fontem (Inter light 14px + tracking-wide). */
export function zmeritSirkuRadkuPopisu(radek: string): number {
  if (typeof document === "undefined") {
    return 0;
  }

  const platno = document.createElement("canvas");
  const ctx = platno.getContext("2d");
  if (!ctx) {
    return 0;
  }

  ctx.font = `300 ${FONT_SIZE_PX}px Inter, ui-sans-serif, system-ui, sans-serif`;
  const zaklad = ctx.measureText(radek).width;
  const tracking =
    radek.length > 1 ? (radek.length - 1) * FONT_SIZE_PX * TRACKING_WIDE_EM : 0;
  return zaklad + tracking;
}

export function maPrilisDlouhyRadek(popis: string): boolean {
  return radkyPopisu(popis).some(
    (radek) => zmeritSirkuRadkuPopisu(radek) > MAX_SIRKA_RADKU_POPISU_PX,
  );
}

export const HLASKA_MAX_RADKU = "Maximálně 4 řádky.";
export const HLASKA_DLOUHY_RADEK =
  "Řádek přesahuje šířku textu na mobilu.";

/**
 * Nová hodnota popisu: při > 4 řádcích zachová předchozí text a vrátí hlášku.
 * Dlouhý řádek text nemění – jen upozorní.
 */
export function navrhnoutZmenuPopisu(
  predchozi: string,
  kandidat: string,
): { popis: string; hlaskaMaxRadku: string | null; hlaskaSirka: string | null } {
  if (prekrocilMaxRadku(kandidat)) {
    return {
      popis: predchozi,
      hlaskaMaxRadku: HLASKA_MAX_RADKU,
      hlaskaSirka: maPrilisDlouhyRadek(predchozi) ? HLASKA_DLOUHY_RADEK : null,
    };
  }

  return {
    popis: kandidat,
    hlaskaMaxRadku: null,
    hlaskaSirka: maPrilisDlouhyRadek(kandidat) ? HLASKA_DLOUHY_RADEK : null,
  };
}
