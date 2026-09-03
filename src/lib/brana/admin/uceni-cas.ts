/**
 * CAS / ifMatch smyčka pro RMW zápisy data/brana-uceni.json.
 * Samostatný obal — nesdílí kalendářní ani RADAR mutátory.
 */

export const BRANA_UCENI_CAS_MAX_POKUSU = 8;

export const BRANA_UCENI_CAS_CHYBA_KONFLIKT =
  "Archiv Učení mezitím opakovaně změnil jiný zápis. Změna se neuložila.";

export class BranaUceniCasKonfliktLimitError extends Error {
  constructor() {
    super(BRANA_UCENI_CAS_CHYBA_KONFLIKT);
    this.name = "BranaUceniCasKonfliktLimitError";
  }
}

export type BranaUceniDokumentMutace<TDokument, TVysledek> =
  | { typ: "zapsat"; dokument: TDokument; vysledek: TVysledek }
  | { typ: "bezZmeny"; vysledek: TVysledek };

export type BranaUceniCasCteni<TDokument> =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: TDokument; etag: string };

export type BranaUceniCasIo<TDokument> = {
  nacist: () => Promise<BranaUceniCasCteni<TDokument>>;
  vychoziDokument: () => TDokument;
  validovat: (dokument: TDokument) => TDokument | null;
  ulozit: (dokument: TDokument, etag: string | null) => Promise<void>;
  jePreconditionChyba: (error: unknown) => boolean;
};

function klonovatJson<T>(hodnota: T): T {
  return JSON.parse(JSON.stringify(hodnota)) as T;
}

/**
 * 1. čerstvé čtení (HEAD etag + GET tělo)  2. mutator na kopii  3. validace
 * 4. PUT s ifMatch z HEAD  5. BlobPreconditionFailed → znovu od HEAD
 * Jiná chyba → okamžitě fail. Limit pokusů → fail-closed.
 */
export async function zmenitUceniDokumentAtomickySIo<TDokument, TVysledek>(
  io: BranaUceniCasIo<TDokument>,
  mutator: (
    dokument: TDokument,
  ) => BranaUceniDokumentMutace<TDokument, TVysledek>,
  maxPokusy: number = BRANA_UCENI_CAS_MAX_POKUSU,
): Promise<TVysledek> {
  if (!Number.isInteger(maxPokusy) || maxPokusy < 1) {
    throw new Error("Neplatný limit CAS pokusů.");
  }

  for (let pokus = 1; pokus <= maxPokusy; pokus += 1) {
    const cteni = await io.nacist();
    const zaklad =
      cteni.stav === "neexistuje"
        ? io.vychoziDokument()
        : klonovatJson(cteni.dokument);
    const etag = cteni.stav === "neexistuje" ? null : cteni.etag;

    const mutace = mutator(zaklad);
    if (mutace.typ === "bezZmeny") {
      return mutace.vysledek;
    }

    const overeny = io.validovat(mutace.dokument);
    if (!overeny) {
      throw new Error(
        "Výsledný dokument neprošel validací. Nic nebylo uloženo.",
      );
    }

    try {
      await io.ulozit(overeny, etag);
      return mutace.vysledek;
    } catch (error) {
      if (!io.jePreconditionChyba(error)) {
        throw error;
      }
    }
  }

  throw new BranaUceniCasKonfliktLimitError();
}
