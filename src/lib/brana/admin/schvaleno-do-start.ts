/**
 * Dočasná fail-closed logika jednorázového startu 14denního rytmu.
 * Není trvalou součástí redakčního workflow.
 * Žádný Blob, žádný scan – jen rozhodnutí nad už načteným dokumentem.
 */

export const BRANA_START_SCHVALENO_DO_ISO = "2026-09-13";
export const BRANA_START_PRISTI_KONTROLA_ISO = "2026-08-31";

const ISO_DEN = /^\d{4}-\d{2}-\d{2}$/;

export type BranaStartSchvalenoDoDokument = {
  pristiDlouhodobaKontrola: string | null;
  schvalenoDoIso: string | null;
};

export type BranaStartSchvalenoDoRozhodnuti =
  | {
      typ: "zapsat";
      puvodniSchvalenoDoIso: string | null;
      cilSchvalenoDoIso: typeof BRANA_START_SCHVALENO_DO_ISO;
    }
  | {
      typ: "uz-nastaveno";
      puvodniSchvalenoDoIso: string | null;
      cilSchvalenoDoIso: typeof BRANA_START_SCHVALENO_DO_ISO;
    }
  | { typ: "stop"; duvod: string };

export type BranaStartSchvalenoDoRollbackRozhodnuti =
  | {
      typ: "zapsat";
      aktualniSchvalenoDoIso: string | null;
      cilSchvalenoDoIso: string | null;
    }
  | {
      typ: "beze-zmeny";
      aktualniSchvalenoDoIso: string | null;
      cilSchvalenoDoIso: string | null;
    }
  | { typ: "stop"; duvod: string };

export function jeIsoDenSchvalenoDo(hodnota: string): boolean {
  return ISO_DEN.test(hodnota);
}

/**
 * Null / chybějící / prázdný řetězec → null.
 * Platné ISO → datum. Jinak fail.
 */
export function parsovatSchvalenoDoVstup(
  hodnota: unknown,
): { ok: true; hodnota: string | null } | { ok: false; chyba: string } {
  if (hodnota === null || hodnota === undefined || hodnota === "") {
    return { ok: true, hodnota: null };
  }
  if (typeof hodnota !== "string" || !jeIsoDenSchvalenoDo(hodnota)) {
    return {
      ok: false,
      chyba: "Původní SCHVÁLENO DO musí být YYYY-MM-DD nebo prázdné.",
    };
  }
  return { ok: true, hodnota };
}

export function navrhnoutDokumentSeSchvalenoDo<T extends object>(
  dokument: T,
  schvalenoDoIso: string | null,
): T & { schvalenoDoIso: string | null } {
  return { ...dokument, schvalenoDoIso };
}

export function jsonBezSchvalenoDo(dokument: object): string {
  const { schvalenoDoIso: _ignorovat, ...zbytek } = dokument as {
    schvalenoDoIso?: unknown;
  } & Record<string, unknown>;
  void _ignorovat;
  return JSON.stringify(zbytek);
}

export function rozhodnoutZapisSchvalenoDoStartu(
  dokument: BranaStartSchvalenoDoDokument,
): BranaStartSchvalenoDoRozhodnuti {
  if (dokument.pristiDlouhodobaKontrola !== BRANA_START_PRISTI_KONTROLA_ISO) {
    return {
      typ: "stop",
      duvod: "Příští dlouhodobá kontrola není 2026-08-31. Nic nebylo uloženo.",
    };
  }

  const puvodni = parsovatSchvalenoDoVstup(dokument.schvalenoDoIso);
  if (!puvodni.ok) {
    return {
      typ: "stop",
      duvod: "SCHVÁLENO DO má neplatnou hodnotu. Nic nebylo uloženo.",
    };
  }

  if (puvodni.hodnota === BRANA_START_SCHVALENO_DO_ISO) {
    return {
      typ: "uz-nastaveno",
      puvodniSchvalenoDoIso: puvodni.hodnota,
      cilSchvalenoDoIso: BRANA_START_SCHVALENO_DO_ISO,
    };
  }

  if (puvodni.hodnota !== null) {
    return {
      typ: "stop",
      duvod: "SCHVÁLENO DO už obsahuje jiné datum. Nic nebylo uloženo.",
    };
  }

  return {
    typ: "zapsat",
    puvodniSchvalenoDoIso: null,
    cilSchvalenoDoIso: BRANA_START_SCHVALENO_DO_ISO,
  };
}

export function rozhodnoutRollbackSchvalenoDoStartu(
  dokument: BranaStartSchvalenoDoDokument,
  puvodniVstup: unknown,
): BranaStartSchvalenoDoRollbackRozhodnuti {
  if (dokument.pristiDlouhodobaKontrola !== BRANA_START_PRISTI_KONTROLA_ISO) {
    return {
      typ: "stop",
      duvod: "Příští dlouhodobá kontrola není 2026-08-31. Nic nebylo uloženo.",
    };
  }

  const puvodni = parsovatSchvalenoDoVstup(puvodniVstup);
  if (!puvodni.ok) {
    return { typ: "stop", duvod: puvodni.chyba };
  }

  const aktualni = parsovatSchvalenoDoVstup(dokument.schvalenoDoIso);
  if (!aktualni.ok) {
    return {
      typ: "stop",
      duvod: "Aktuální SCHVÁLENO DO má neplatnou hodnotu. Nic nebylo uloženo.",
    };
  }

  if (aktualni.hodnota === puvodni.hodnota) {
    return {
      typ: "beze-zmeny",
      aktualniSchvalenoDoIso: aktualni.hodnota,
      cilSchvalenoDoIso: puvodni.hodnota,
    };
  }

  if (aktualni.hodnota !== BRANA_START_SCHVALENO_DO_ISO) {
    return {
      typ: "stop",
      duvod:
        "Rollback je povolen jen z jednorázového startu 2026-09-13. Nic nebylo uloženo.",
    };
  }

  return {
    typ: "zapsat",
    aktualniSchvalenoDoIso: aktualni.hodnota,
    cilSchvalenoDoIso: puvodni.hodnota,
  };
}
