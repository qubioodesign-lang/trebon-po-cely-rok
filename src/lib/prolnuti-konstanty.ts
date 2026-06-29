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
   * CSS timing-function pro opacity.
   * Velmi jemná křivka – pomalý začátek i konec, bez „efektu“.
   */
  easing: "cubic-bezier(0.42, 0, 0.18, 1)",
  /** Prodleva po dokončení prolnutí, než se objeví replay */
  replayZpozdeniMs: 1_200,
  /** Doba náběhu opacity replay tlačítka */
  replayFadeMs: 800,
} as const;

export type ProlnutiCasovani = typeof PROLNUTI_CASOVANI;

export const PROLNUTI_CEKANI_MS = PROLNUTI_CASOVANI.cekaniPredStartemMs;
export const PROLNUTI_DLOUHOTRVANI_MS = PROLNUTI_CASOVANI.delkaProlnutiMs;
export const PROLNUTI_EASING = PROLNUTI_CASOVANI.easing;
export const PROLNUTI_ZPOZDENI_SIPKA_MS = PROLNUTI_CASOVANI.replayZpozdeniMs;
export const PROLNUTI_SIPKA_FADE_MS = PROLNUTI_CASOVANI.replayFadeMs;
