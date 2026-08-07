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
  /** Veřejná URL ke kontrole – zatím se jen ukládá */
  url: string;
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

export const BRANA_ZDROJ_NAZEV_MAX = 200;
export const BRANA_ZDROJ_URL_MAX = 2000;

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
  return hodnota === 14 || hodnota === 21 || hodnota === 30;
}

export function jeBranaZdrojTyp(hodnota: unknown): hodnota is BranaZdrojTyp {
  return hodnota === "DLOUHODOBY" || hodnota === "RYCHLY";
}

export function jePlatnaZdrojUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export type ValidaceZdrojeVysledek =
  | {
      ok: true;
      nazev: string;
      typ: BranaZdrojTyp;
      url: string;
    }
  | { ok: false; chyba: string };

/** Validace vstupních polí zdroje (bez id – id generuje / zachovává server) */
export function validovatZdrojVstup(vstup: unknown): ValidaceZdrojeVysledek {
  if (!vstup || typeof vstup !== "object") {
    return { ok: false, chyba: "Neplatný vstup." };
  }

  const data = vstup as Record<string, unknown>;
  const nazev = typeof data.nazev === "string" ? data.nazev.trim() : "";
  const url = typeof data.url === "string" ? data.url.trim() : "";
  const typ = data.typ;

  if (!nazev) {
    return { ok: false, chyba: "Název nesmí být prázdný." };
  }
  if (nazev.length > BRANA_ZDROJ_NAZEV_MAX) {
    return { ok: false, chyba: "Název je příliš dlouhý." };
  }
  if (!jeBranaZdrojTyp(typ)) {
    return { ok: false, chyba: "Typ musí být Dlouhodobý nebo Rychlý." };
  }
  if (!url) {
    return { ok: false, chyba: "URL nesmí být prázdná." };
  }
  if (url.length > BRANA_ZDROJ_URL_MAX) {
    return { ok: false, chyba: "URL je příliš dlouhá." };
  }
  if (!jePlatnaZdrojUrl(url)) {
    return { ok: false, chyba: "URL musí začínat http:// nebo https://." };
  }

  return { ok: true, nazev, typ, url };
}
