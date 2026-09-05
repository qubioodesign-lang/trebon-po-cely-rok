/**
 * CAS / ifMatch smyčka pro RMW zápisy data/brana-atmosfera.json.
 * Samostatný obal — nesdílí kalendářní, RADAR ani Učení mutátory.
 */

export const BRANA_ATMOSFERA_CAS_MAX_POKUSU = 8;

export const BRANA_ATMOSFERA_CAS_CHYBA_KONFLIKT =
  "Atmosféra mezitím opakovaně změnila jiný zápis. Změna se neuložila.";

export class BranaAtmosferaCasKonfliktLimitError extends Error {
  constructor() {
    super(BRANA_ATMOSFERA_CAS_CHYBA_KONFLIKT);
    this.name = "BranaAtmosferaCasKonfliktLimitError";
  }
}

export type BranaAtmosferaDokumentMutace<TDokument, TVysledek> =
  | { typ: "zapsat"; dokument: TDokument; vysledek: TVysledek }
  | { typ: "bezZmeny"; vysledek: TVysledek };

export type BranaAtmosferaCasCteni<TDokument> =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: TDokument; etag: string };

export type BranaAtmosferaCasIo<TDokument> = {
  nacist: () => Promise<BranaAtmosferaCasCteni<TDokument>>;
  vychoziDokument: () => TDokument;
  validovat: (dokument: TDokument) => TDokument | null;
  ulozit: (dokument: TDokument, etag: string | null) => Promise<void>;
  jePreconditionChyba: (error: unknown) => boolean;
};

function klonovatJson<T>(hodnota: T): T {
  return JSON.parse(JSON.stringify(hodnota)) as T;
}

export async function zmenitAtmosferaDokumentAtomickySIo<
  TDokument,
  TVysledek,
>(
  io: BranaAtmosferaCasIo<TDokument>,
  mutator: (
    dokument: TDokument,
  ) => BranaAtmosferaDokumentMutace<TDokument, TVysledek>,
  maxPokusy: number = BRANA_ATMOSFERA_CAS_MAX_POKUSU,
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

  throw new BranaAtmosferaCasKonfliktLimitError();
}
