import "server-only";

import {
  BRANA_ATMOSFERA_MAX_STARI_PREDCHOZIHO_MS,
  jeAtmosferaDynamickyStav,
  otiskJpegSha256,
  verejnaVetaAtmosfery,
  type BranaAtmosferaDokument,
  type BranaAtmosferaDuvodStavu,
  type BranaAtmosferaStav,
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
  nacistPredchoziPracovniJpeg,
  ulozitAtmosferaDokument,
  ulozitPredchoziPracovniJpeg,
} from "./atmosfera-uloziste";

export type BranaAtmosferaKontrolaVysledek = {
  dokument: BranaAtmosferaDokument;
  verejnaVeta: string | null;
  pouzitPredchozi: boolean;
};

function jePredchoziPouzitelnýVuciCasu(
  predchoziAtIso: string,
  aktualniAtIso: string,
): boolean {
  const pred = Date.parse(predchoziAtIso);
  const akt = Date.parse(aktualniAtIso);
  if (!Number.isFinite(pred) || !Number.isFinite(akt)) return false;
  const diff = akt - pred;
  return diff >= 0 && diff <= BRANA_ATMOSFERA_MAX_STARI_PREDCHOZIHO_MS;
}

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
 * Jedna kontrola Atmosféry.
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

  const predchoziJpeg = await nacistPredchoziPracovniJpeg();
  let predchoziProAi: Buffer | null = null;
  let predchoziSnimekAt: string | null = null;

  if (
    predchoziJpeg &&
    jePredchoziPouzitelnýVuciCasu(
      predchoziJpeg.snimekAtIso,
      aktualni.snimekAtIso,
    )
  ) {
    predchoziProAi = predchoziJpeg.bajty;
    predchoziSnimekAt = predchoziJpeg.snimekAtIso;
  }

  let ai: Awaited<ReturnType<typeof klasifikovatAtmosferuObrazy>>;
  try {
    ai = await klasifikovatAtmosferuObrazy({
      aktualniJpeg: aktualni.bajty,
      predchoziJpeg: predchoziProAi,
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

  if (jeAtmosferaDynamickyStav(ai.stav) && !predchoziProAi) {
    try {
      return await zapsatNicPoChybe(predchoziStav);
    } catch (zapisError) {
      console.error(
        "[brana-atmosfera] zápis NIC po neplatné dynamice",
        zapisError,
      );
      throw zapisError;
    }
  }

  const duvodStavu: BranaAtmosferaDuvodStavu =
    ai.stav === "NIC"
      ? "NIC"
      : jeAtmosferaDynamickyStav(ai.stav)
        ? "DYNAMICKY"
        : "STATICKY";

  const sha256 = otiskJpegSha256(aktualni.bajty);

  try {
    await ulozitPredchoziPracovniJpeg(aktualni.bajty);
  } catch (error) {
    console.error("[brana-atmosfera] zápis pracovního JPEG selhal", error);
    try {
      return await zapsatNicPoChybe(predchoziStav);
    } catch (zapisError) {
      console.error(
        "[brana-atmosfera] zápis NIC po chybě JPEG",
        zapisError,
      );
      throw zapisError;
    }
  }

  const dokument: BranaAtmosferaDokument = {
    verze: 1,
    stav: ai.stav,
    zkontrolovanoAt: new Date().toISOString(),
    snimekAt: aktualni.snimekAtIso,
    pracovniJpegAt: aktualni.snimekAtIso,
    pracovniJpegSha256: sha256,
    predchoziSnimekAt: predchoziProAi ? predchoziSnimekAt : null,
    model: ai.model,
    duvodStavu,
    rucniText: null,
    rucniTextAt: null,
  };

  try {
    await ulozitAtmosferaDokument(dokument);
  } catch (error) {
    console.error(
      "[brana-atmosfera] JSON po úspěšném JPEG selhal — previous příště odmítne hash",
      error,
    );
    throw error;
  }

  return {
    dokument,
    verejnaVeta: verejnaVetaAtmosfery(dokument.stav),
    pouzitPredchozi: Boolean(predchoziProAi),
  };
}
