/**
 * Jediné místo pro ladění časů prolnutí a replay.
 *
 * Cíl není animace, ale dojem, že stejné místo pomalu prochází jiným okamžikem.
 * Upravujte hodnoty podle reálného dojmu v prohlížeči, ne podle „správné“ animace.
 */
export const PROLNUTI_CASOVANI = {
  /** Kolik ms zůstane první fotografie úplně beze změny před prolínáním */
  cekaniPredStartemMs: 100,
  /** Délka prolínání mezi dvěma snímky (ms) – delší = klidnější */
  delkaProlnutiMs: 6_500,
  /**
   * O kolik ms dříve může začít další krok prolnutí (překrytí časování).
   * Zkracuje statickou pauzu mezi snímky, rychlost samotného fade zůstává stejná.
   */
  prekrytiProlnutiMs: 500,
  /** Aktivní fade-in posledního snímku (B→C u 3 fotek) – ms */
  nastupPoslednihoSnimkuMs: 3_500,
  /**
   * Prodleva po startu kroku 0 (nástup druhé fotky), než se spustí poslední krok B→C.
   * U 3 fotek zkracuje pocitové zastavení druhé fotografie.
   */
  prodlevaPredPoslednimKrokemMs: 2_800,
  /**
   * CSS timing-function pro opacity.
   * Jemný průběh s mírným počátečním náběhem (p1y > 0), aby B→C nebylo
   * první sekundy neviditelné; konec zůstává pomalý bez efektu.
   */
  easing: "cubic-bezier(0.4, 0.06, 0.22, 1)",
  /** Prodleva po dokončení prolnutí, než se objeví replay */
  replayZpozdeniMs: 1_200,
  /** Doba náběhu opacity replay tlačítka */
  replayFadeMs: 800,
} as const;

export type ProlnutiCasovani = typeof PROLNUTI_CASOVANI;

export const PROLNUTI_CEKANI_MS = PROLNUTI_CASOVANI.cekaniPredStartemMs;
export const PROLNUTI_DLOUHOTRVANI_MS = PROLNUTI_CASOVANI.delkaProlnutiMs;
export const PROLNUTI_EASING = PROLNUTI_CASOVANI.easing;
/**
 * Easing fade-out vrstvy B v posledním kroku B→C (3 fotky).
 * Strmější začátek než PROLNUTI_EASING – dřívější viditelný úbytek opacity,
 * pomalý konec zachová klidný charakter celé animace.
 */
export const PROLNUTI_EASING_FADEOUT_DRUHE = "cubic-bezier(0.33, 0, 0.2, 1)";
export const PROLNUTI_ZPOZDENI_SIPKA_MS = PROLNUTI_CASOVANI.replayZpozdeniMs;
export const PROLNUTI_SIPKA_FADE_MS = PROLNUTI_CASOVANI.replayFadeMs;
