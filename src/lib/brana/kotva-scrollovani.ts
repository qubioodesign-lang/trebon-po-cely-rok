/** Konfigurace časové kotvy reagující na denní předěly ve scrollovatelném obsahu. */
export type BranaKotvaScrollConfig = {
  /** Kotva před prvním předělem. */
  vychoziLabel: string;
  /** Kotvy po přechodu jednotlivých předělů, v pořadí shora dolů. */
  poPredelu: string[];
};
