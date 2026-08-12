/**
 * Známý redakční zdroj BRÁNY a společné nastavení rytmu kontroly podle typu.
 * Ruční scan jednoho zdroje: skenovat-zdroj.ts (bez scheduleru).
 */

/** Dva typy známých zdrojů */
export type BranaZdrojTyp = "DLOUHODOBY" | "RYCHLY";

/**
 * Režim scanu jednoho zdroje.
 * BEZNY = současný tok (matching + Nezařazené).
 * HLIDANE_KOTVY = jen konkrétní redakční položky; neshody se ignorují.
 */
export type BranaZdrojRezimScanu = "BEZNY" | "HLIDANE_KOTVY";

export const BRANA_ZDROJ_REZIM_SCANU_VYCHOZI: BranaZdrojRezimScanu = "BEZNY";

export type BranaZdroj = {
  /** Stabilní identifikátor – nemění se s názvem */
  id: string;
  nazev: string;
  typ: BranaZdrojTyp;
  /** Veřejná URL ke kontrole – zatím se jen ukládá */
  url: string;
  /**
   * Chybí-li ve starém Blobu → při načtení doplnit BEZNY.
   * BEZNY = dnešní chování; HLIDANE_KOTVY = fail-closed jen proti kotvám.
   */
  rezimScanu: BranaZdrojRezimScanu;
  /**
   * Stabilní redakcniPolozkaId sledované u bohatého zdroje.
   * Chybí-li ve starém Blobu → [].
   * Při BEZNY se při scanu nepoužívají; při HLIDANE_KOTVY a [] → 0 zápisů.
   */
  hlidaneRedakcniPolozkaIds: string[];
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

export function popisekRezimuScanu(rezim: BranaZdrojRezimScanu): string {
  switch (rezim) {
    case "BEZNY":
      return "Běžný";
    case "HLIDANE_KOTVY":
      return "Hlídané kotvy";
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

export function jeBranaZdrojRezimScanu(
  hodnota: unknown,
): hodnota is BranaZdrojRezimScanu {
  return hodnota === "BEZNY" || hodnota === "HLIDANE_KOTVY";
}

export function jePlatnaZdrojUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Deduplikované neprázdné string ID; ne-string prvky se přeskočí. */
export function normalizovatHlidaneRedakcniPolozkaIds(
  hodnota: unknown,
): string[] {
  if (!Array.isArray(hodnota)) {
    return [];
  }
  const out: string[] = [];
  const videne = new Set<string>();
  for (const prvek of hodnota) {
    if (typeof prvek !== "string") {
      continue;
    }
    const id = prvek.trim();
    if (!id || videne.has(id)) {
      continue;
    }
    videne.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Doplní chybějící pole starého Blobu (zpětná kompatibilita).
 * Neplatný rezim → BEZNY; chybějící/neplatné ids → [].
 */
export function doplnVychoziPoleZdroje(vstup: {
  id: string;
  nazev: string;
  typ: BranaZdrojTyp;
  url: string;
  rezimScanu?: unknown;
  hlidaneRedakcniPolozkaIds?: unknown;
}): BranaZdroj {
  return {
    id: vstup.id,
    nazev: vstup.nazev,
    typ: vstup.typ,
    url: vstup.url,
    rezimScanu: jeBranaZdrojRezimScanu(vstup.rezimScanu)
      ? vstup.rezimScanu
      : BRANA_ZDROJ_REZIM_SCANU_VYCHOZI,
    hlidaneRedakcniPolozkaIds: normalizovatHlidaneRedakcniPolozkaIds(
      vstup.hlidaneRedakcniPolozkaIds,
    ),
  };
}

export type ValidaceZdrojeVysledek =
  | {
      ok: true;
      nazev: string;
      typ: BranaZdrojTyp;
      url: string;
      rezimScanu: BranaZdrojRezimScanu;
      hlidaneRedakcniPolozkaIds: string[];
    }
  | { ok: false; chyba: string };

export type ValidaceZdrojeVolby = {
  /**
   * Pokud je předáno: neznámá ID v hlidaneRedakcniPolozkaIds → fail-closed.
   * Pokud chybí (např. čtení Blobu): ID se jen normalizují; neznámá se ignorují při scanu.
   */
  povoleneRedakcniPolozkaIds?: ReadonlySet<string>;
};

/** Validace vstupních polí zdroje (bez id – id generuje / zachovává server) */
export function validovatZdrojVstup(
  vstup: unknown,
  volby?: ValidaceZdrojeVolby,
): ValidaceZdrojeVysledek {
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

  let rezimScanu: BranaZdrojRezimScanu = BRANA_ZDROJ_REZIM_SCANU_VYCHOZI;
  if (
    data.rezimScanu !== undefined &&
    data.rezimScanu !== null &&
    data.rezimScanu !== ""
  ) {
    if (!jeBranaZdrojRezimScanu(data.rezimScanu)) {
      return {
        ok: false,
        chyba: "Režim scanu musí být Běžný nebo Hlídané kotvy.",
      };
    }
    rezimScanu = data.rezimScanu;
  }

  if (
    data.hlidaneRedakcniPolozkaIds !== undefined &&
    data.hlidaneRedakcniPolozkaIds !== null &&
    !Array.isArray(data.hlidaneRedakcniPolozkaIds)
  ) {
    return {
      ok: false,
      chyba: "Hlídané kotvy musí být seznam identifikátorů.",
    };
  }

  let hlidaneRedakcniPolozkaIds = normalizovatHlidaneRedakcniPolozkaIds(
    data.hlidaneRedakcniPolozkaIds,
  );

  const povolene = volby?.povoleneRedakcniPolozkaIds;
  if (povolene) {
    const neznama = hlidaneRedakcniPolozkaIds.filter((id) => !povolene.has(id));
    if (neznama.length > 0) {
      return {
        ok: false,
        chyba: `Neznámá redakční kotva: ${neznama[0]}.`,
      };
    }
  }

  return {
    ok: true,
    nazev,
    typ,
    url,
    rezimScanu,
    hlidaneRedakcniPolozkaIds,
  };
}
