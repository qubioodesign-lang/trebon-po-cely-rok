import "server-only";

import {
  verejnaVetaAtmosfery,
  type BranaAtmosferaDokument,
  type BranaAtmosferaDuvodStavu,
} from "./atmosfera";
import {
  BranaAtmosferaAiChyba,
  klasifikovatAtmosferuObrazy,
} from "./atmosfera-ai";
import {
  BranaAtmosferaKameraChyba,
  nacistAktualniSnimekKamery,
} from "./atmosfera-kamera";
import {
  nacistAtmosferaDokument,
  ulozitAtmosferaDokument,
} from "./atmosfera-uloziste";

export type BranaAtmosferaKontrolaVysledek = {
  dokument: BranaAtmosferaDokument;
  verejnaVeta: string | null;
  /** Vždy false. Pole zůstává, aby cron a admin route nemusely měnit tvar odpovědi. */
  pouzitPredchozi: boolean;
};

/**
 * Chyba aktuální kontroly: NIC + snimekAt=null.
 * Metadata pracovního JPEG (at + sha) zachována — popisují uložený soubor.
 */
async function zapsatNicPoChybe(
  predchoziStav: BranaAtmosferaDokument | null,
): Promise<BranaAtmosferaKontrolaVysledek> {
  const dokument: BranaAtmosferaDokument = {
    verze: 1,
    stav: "NIC",
    zkontrolovanoAt: new Date().toISOString(),
    snimekAt: null,
    pracovniJpegAt: predchoziStav?.pracovniJpegAt ?? null,
    pracovniJpegSha256: predchoziStav?.pracovniJpegSha256 ?? null,
    predchoziSnimekAt: null,
    model: null,
    duvodStavu: "CHYBA",
    rucniText: null,
    rucniTextAt: null,
  };
  await ulozitAtmosferaDokument(dokument);
  return {
    dokument,
    verejnaVeta: null,
    pouzitPredchozi: false,
  };
}

/**
 * Jedna kontrola Atmosféry z aktuálního snímku.
 * Nevolá Kalendář/RADAR/Učení. Nevykresluje veřejnou BRÁNU.
 */
export async function spustitAtmosferaKontrolu(): Promise<BranaAtmosferaKontrolaVysledek> {
  const predchoziStav = await nacistAtmosferaDokument();

  let aktualni: Awaited<ReturnType<typeof nacistAktualniSnimekKamery>>;
  try {
    aktualni = await nacistAktualniSnimekKamery();
  } catch (error) {
    if (!(error instanceof BranaAtmosferaKameraChyba)) {
      console.error("[brana-atmosfera] kamera neočekávaně selhala", error);
    } else {
      console.error(`[brana-atmosfera] ${error.message}`);
    }
    try {
      return await zapsatNicPoChybe(predchoziStav);
    } catch (zapisError) {
      console.error("[brana-atmosfera] zápis NIC po chybě kamery", zapisError);
      throw zapisError;
    }
  }

  let ai: Awaited<ReturnType<typeof klasifikovatAtmosferuObrazy>>;
  try {
    ai = await klasifikovatAtmosferuObrazy({
      aktualniJpeg: aktualni.bajty,
    });
  } catch (error) {
    if (!(error instanceof BranaAtmosferaAiChyba)) {
      console.error("[brana-atmosfera] OpenAI neočekávaně selhalo", error);
    } else {
      console.error(`[brana-atmosfera] ${error.message}`);
    }
    try {
      return await zapsatNicPoChybe(predchoziStav);
    } catch (zapisError) {
      console.error("[brana-atmosfera] zápis NIC po chybě OpenAI", zapisError);
      throw zapisError;
    }
  }

  const duvodStavu: BranaAtmosferaDuvodStavu =
    ai.stav === "NIC" ? "NIC" : "STATICKY";

  const dokument: BranaAtmosferaDokument = {
    verze: 1,
    stav: ai.stav,
    zkontrolovanoAt: new Date().toISOString(),
    snimekAt: aktualni.snimekAtIso,
    pracovniJpegAt: null,
    pracovniJpegSha256: null,
    predchoziSnimekAt: null,
    model: ai.model,
    duvodStavu,
    rucniText: null,
    rucniTextAt: null,
  };

  await ulozitAtmosferaDokument(dokument);

  return {
    dokument,
    verejnaVeta: verejnaVetaAtmosfery(dokument.stav),
    pouzitPredchozi: false,
  };
}
