/**
 * Známý redakční zdroj BRÁNY.
 * Frekvence kontroly a skenování se řeší později – zde jen typ.
 */

/** Dva typy známých zdrojů – frekvence se zatím neimplementuje */
export type BranaZdrojTyp = "DLOUHODOBY" | "RYCHLY";

export type BranaZdroj = {
  /** Stabilní identifikátor – nemění se s názvem */
  id: string;
  nazev: string;
  typ: BranaZdrojTyp;
};

export function popisekTypuZdroje(typ: BranaZdrojTyp): string {
  switch (typ) {
    case "DLOUHODOBY":
      return "Dlouhodobý zdroj";
    case "RYCHLY":
      return "Rychlý zdroj";
  }
}
