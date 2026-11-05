/**
 * Opsané parametry mobilního popisu prolnutí.
 * Dílna je na nich nezávislá: žádný import z galerie.
 *
 * Inter 300, 14 px, tracking 0,025 em, bílá 90 %.
 * Více řádků: řádkování 22,75 px, sloupec 240 px.
 * Jeden řádek: výška řádku text-sm, tedy 20 px.
 * Gradient: 208 px, zdola rgba(0,0,0,0.65) → 0.35 → 0.
 * Rám náhledu 390×844. Bezpečný okraj textu 44 px.
 */

export const DILNA_RAM_SIRKA = 390;
export const DILNA_RAM_VYSKA = 844;

export const DILNA_FONT_PX = 14;
export const DILNA_VAHA = 300;
export const DILNA_TRACKING_EM = 0.025;
export const DILNA_BARVA_TEXTU = "rgba(255, 255, 255, 0.9)";

export const DILNA_RADKOVANI_JEDEN = 20;
export const DILNA_RADKOVANI_VICE = 22.75;
export const DILNA_SLOUPEC_PX = 240;

export const DILNA_GRADIENT_PX = 208;
export const DILNA_OKRAJ_PX = 44;

/** Nejdelší strana exportu. Výřez se nezvětšuje nad zdroj. */
export const DILNA_MAX_STRANA = 4096;

export const DILNA_POSUN_MIN = -40;
export const DILNA_POSUN_MAX = 40;
