/**
 * CAS / ifMatch smyčka pro RMW zápisy data/brana-nezarazene.json.
 * Samostatný obal — nesdílí kalendářní, zdrojové ani upozornění mutátory.
 * Mutator = operace na čerstvém dokumentu, ne snapshot.
 */

export const BRANA_NEZARAZENE_CAS_MAX_POKUSU = 8;

export const BRANA_NEZARAZENE_CAS_CHYBA_KONFLIKT =
  "Nezařazené mezitím opakovaně změnil jiný zápis. Změna se neuložila.";

export class BranaNezarazeneCasKonfliktLimitError extends Error {
  constructor() {
    super(BRANA_NEZARAZENE_CAS_CHYBA_KONFLIKT);
    this.name = "BranaNezarazeneCasKonfliktLimitError";
  }
}

export type BranaNezarazeneDokumentMutace<TDokument, TVysledek> =
  | { typ: "zapsat"; dokument: TDokument; vysledek: TVysledek }
  | { typ: "bezZmeny"; vysledek: TVysledek };

export type BranaNezarazeneCasCteni<TDokument> =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: TDokument; etag: string };

export type BranaNezarazeneCasIo<TDokument> = {
  nacist: () => Promise<BranaNezarazeneCasCteni<TDokument>>;
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
export async function zmenitNezarazeneDokumentAtomickySIo<TDokument, TVysledek>(
  io: BranaNezarazeneCasIo<TDokument>,
  mutator: (
    dokument: TDokument,
  ) => BranaNezarazeneDokumentMutace<TDokument, TVysledek>,
  maxPokusy: number = BRANA_NEZARAZENE_CAS_MAX_POKUSU,
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

  throw new BranaNezarazeneCasKonfliktLimitError();
}
