/**
 * Známý redakční zdroj BRÁNY a společné nastavení rytmu kontroly podle typu.
 * Samotné skenování se řeší později.
 */

/** Dva typy známých zdrojů */
export type BranaZdrojTyp = "DLOUHODOBY" | "RYCHLY";

export type BranaZdroj = {
  /** Stabilní identifikátor – nemění se s názvem */
  id: string;
  nazev: string;
  typ: BranaZdrojTyp;
};

/** Společný interval kontroly pro všechny dlouhodobé zdroje */
export type BranaDlouhodobyIntervalDni = 14 | 21 | 30;

/** Společný rytmus kontroly pro všechny rychlé zdroje */
export type BranaRychlyRytmus = "2X_TYDNE";

/** Nastavení rytmu – společné pro typ, ne pro jednotlivý zdroj */
export type BranaZdrojeRytmusNastaveni = {
  dlouhodobyIntervalDni: BranaDlouhodobyIntervalDni;
  rychlyRytmus: BranaRychlyRytmus;
};

export const BRANA_DLOUHODOBY_INTERVALY_DNI: readonly BranaDlouhodobyIntervalDni[] =
  [14, 21, 30];

export const BRANA_DLOUHODOBY_INTERVAL_VYCHOZI: BranaDlouhodobyIntervalDni = 21;

export const BRANA_RYCHLY_RYTMUS_VYCHOZI: BranaRychlyRytmus = "2X_TYDNE";

export const BRANA_ZDROJE_RYTMUS_VYCHOZI: BranaZdrojeRytmusNastaveni = {
  dlouhodobyIntervalDni: BRANA_DLOUHODOBY_INTERVAL_VYCHOZI,
  rychlyRytmus: BRANA_RYCHLY_RYTMUS_VYCHOZI,
};

export function popisekTypuZdroje(typ: BranaZdrojTyp): string {
  switch (typ) {
    case "DLOUHODOBY":
      return "Dlouhodobý zdroj";
    case "RYCHLY":
      return "Rychlý zdroj";
  }
}

export function popisekDlouhodobehoIntervalu(
  dny: BranaDlouhodobyIntervalDni,
): string {
  return `${dny} dní`;
}

export function popisekRychlehoRytmu(rytmus: BranaRychlyRytmus): string {
  switch (rytmus) {
    case "2X_TYDNE":
      return "2× týdně";
  }
}

export function jeDlouhodobyIntervalDni(
  hodnota: number,
): hodnota is BranaDlouhodobyIntervalDni {
  return (
    hodnota === 14 || hodnota === 21 || hodnota === 30
  );
}
