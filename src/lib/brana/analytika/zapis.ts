import { BlobPreconditionFailedError } from "@vercel/blob";
import {
  aplikovatDavkuAnalytiky,
  parsovatDokumentAnalytiky,
  prazdnyDokumentAnalytiky,
  validovatDavkuAnalytiky,
  type BranaAnalytikaDokument,
  type VysledekBranaAnalytiky,
} from "./model";

export const BRANA_ANALYTIKA_CAS_MAX_POKUSU = 8;

export class BranaAnalytikaKonfliktError extends Error {
  constructor() {
    super(
      "Analytiku se nepodařilo zapsat kvůli opakovanému souběhu. Jiná data nebyla změněna.",
    );
    this.name = "BranaAnalytikaKonfliktError";
  }
}

export class BranaAnalytikaUlozisteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BranaAnalytikaUlozisteError";
  }
}

export type BranaAnalytikaCteni =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: BranaAnalytikaDokument; etag: string };

export class BranaAnalytikaUzExistujeError extends Error {
  constructor() {
    super("Analytický soubor už existuje. Nebyl přepsán.");
    this.name = "BranaAnalytikaUzExistujeError";
  }
}

export type VysledekZalozeniAnalytiky =
  | { ok: true }
  | { ok: false; duvod: "existuje" };

export type BranaAnalytikaIo = {
  nacist: () => Promise<BranaAnalytikaCteni>;
  /** První vložení. Nesmí přepsat existující soubor. */
  zalozit: (dokument: BranaAnalytikaDokument) => Promise<void>;
  /** Úprava existujícího souboru. etag je povinný a jde do ifMatch. */
  ulozit: (dokument: BranaAnalytikaDokument, etag: string) => Promise<void>;
};

function klonovat(dokument: BranaAnalytikaDokument): BranaAnalytikaDokument {
  return JSON.parse(JSON.stringify(dokument)) as BranaAnalytikaDokument;
}

function jePrazdnyDokument(dokument: BranaAnalytikaDokument): boolean {
  return dokument.verze === 1 && Object.keys(dokument.dny).length === 0;
}

/**
 * Založí prázdný dokument. Existující soubor se nezapisuje.
 * Selhání vložení se neopakuje přepisem.
 */
export async function zalozitPrazdnouAnalytiku(
  io: BranaAnalytikaIo,
): Promise<VysledekZalozeniAnalytiky> {
  const cteni = await io.nacist();
  if (cteni.stav === "ok") {
    return { ok: false, duvod: "existuje" };
  }

  const prazdny = prazdnyDokumentAnalytiky();
  if (!jePrazdnyDokument(prazdny)) {
    throw new BranaAnalytikaUlozisteError(
      "Počáteční dokument není prázdný. Soubor nebyl založen.",
    );
  }

  try {
    await io.zalozit(prazdny);
    return { ok: true };
  } catch (error) {
    if (error instanceof BranaAnalytikaUzExistujeError) {
      return { ok: false, duvod: "existuje" };
    }

    const poChybe = await io.nacist().catch(() => null);
    if (poChybe?.stav === "ok") {
      return { ok: false, duvod: "existuje" };
    }

    throw error;
  }
}

/**
 * Čte a zapisuje jen dokument předaný v IO.
 * Neplatná dávka se vrátí dřív, než se úložiště otevře.
 * Poškozený dokument se nepřepisuje.
 */
export async function zaznamenatDavkuAnalytiky(
  telo: unknown,
  io: BranaAnalytikaIo,
  referencniCas: Date = new Date(),
): Promise<VysledekBranaAnalytiky> {
  const davka = validovatDavkuAnalytiky(telo);
  if (!davka.ok) {
    return { ok: false, duvod: "neplatna-davka" };
  }

  for (let pokus = 1; pokus <= BRANA_ANALYTIKA_CAS_MAX_POKUSU; pokus += 1) {
    const cteni = await io.nacist();
    if (cteni.stav === "neexistuje") {
      try {
        await io.zalozit(prazdnyDokumentAnalytiky());
      } catch (error) {
        if (!(error instanceof BranaAnalytikaUzExistujeError)) {
          const poChybe = await io.nacist().catch(() => null);
          if (poChybe?.stav !== "ok") {
            throw error;
          }
        }
      }
      continue;
    }

    const overeny = parsovatDokumentAnalytiky(klonovat(cteni.dokument));
    if (!overeny) {
      throw new BranaAnalytikaUlozisteError(
        "Uložená analytika je poškozená. Soubor nebyl přepsán.",
      );
    }

    const dalsi = aplikovatDavkuAnalytiky(overeny, davka.udalosti, referencniCas);
    const zkontrolovany = parsovatDokumentAnalytiky(dalsi);
    if (!zkontrolovany) {
      throw new BranaAnalytikaUlozisteError(
        "Výsledná analytika neprošla kontrolou. Nic nebylo uloženo.",
      );
    }

    try {
      await io.ulozit(zkontrolovany, cteni.etag);
      return { ok: true };
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError)) {
        throw error;
      }
    }
  }

  throw new BranaAnalytikaKonfliktError();
}
