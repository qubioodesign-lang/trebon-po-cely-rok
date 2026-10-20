import "server-only";

import { BlobNotFoundError, get, head, put } from "@vercel/blob";
import { ziskatVolbyBranaAdminBlob } from "@/lib/brana/admin/env-blob-brana-admin";
import { BRANA_ANALYTIKA_BLOB_CESTA } from "./model";
import {
  zalozitPrazdnouAnalytiku,
  zaznamenatDavkuAnalytiky,
  type BranaAnalytikaCteni,
  type BranaAnalytikaIo,
  type VysledekZalozeniAnalytiky,
} from "./zapis";
import type {
  BranaAnalytikaDokument,
  BranaAnalytikaOblast,
  BranaAnalytikaZarizeni,
  VysledekBranaAnalytiky,
} from "./model";
import { parsovatDokumentAnalytiky } from "./model";

function volbyZapisu() {
  const volby = ziskatVolbyBranaAdminBlob();
  if (!volby.token) {
    throw new Error(
      "Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN. Analytika se nezapsala.",
    );
  }
  return volby;
}

async function nacistSEtag(): Promise<BranaAnalytikaCteni> {
  const volby = volbyZapisu();

  let etag: string;
  try {
    const meta = await head(BRANA_ANALYTIKA_BLOB_CESTA, volby);
    if (typeof meta.etag !== "string" || meta.etag.length === 0) {
      throw new Error(
        "Blob nevrátil etag analytiky. Soubor nebyl změněn.",
      );
    }
    etag = meta.etag;
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neexistuje" };
    }
    throw error;
  }

  const vysledek = await get(BRANA_ANALYTIKA_BLOB_CESTA, {
    access: "private",
    useCache: false,
    ...volby,
  });

  if (vysledek === null || !vysledek.stream) {
    throw new Error("Analytika zmizela mezi čtením metadat a těla. Nic nebylo uloženo.");
  }

  const text = await new Response(vysledek.stream).text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Analytika není platný JSON. Soubor nebyl přepsán.");
  }

  const dokument = parsovatDokumentAnalytiky(parsed);
  if (!dokument) {
    throw new Error("Analytika má neplatnou strukturu. Soubor nebyl přepsán.");
  }

  return { stav: "ok", dokument, etag };
}

async function zalozitBezPrepsani(
  dokument: BranaAnalytikaDokument,
): Promise<void> {
  const volby = volbyZapisu();

  await put(BRANA_ANALYTIKA_BLOB_CESTA, JSON.stringify(dokument), {
    ...volby,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

async function ulozitSIfMatch(
  dokument: BranaAnalytikaDokument,
  etag: string,
): Promise<void> {
  if (etag.length === 0) {
    throw new Error("Chybí etag analytiky. Soubor nebyl přepsán.");
  }

  const volby = volbyZapisu();

  await put(BRANA_ANALYTIKA_BLOB_CESTA, JSON.stringify(dokument), {
    ...volby,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ifMatch: etag,
  });
}

function vytvoritIo(): BranaAnalytikaIo {
  return {
    nacist: nacistSEtag,
    zalozit: zalozitBezPrepsani,
    ulozit: ulozitSIfMatch,
  };
}

/**
 * Pouhé čtení analytiky. Etag se nevrací a soubor se nezakládá ani nepřepisuje.
 * Poškozený dokument zůstane na Blobu beze změny.
 */
export async function nacistBranaAnalytikuKeCteni(): Promise<
  | { stav: "ok"; dokument: BranaAnalytikaDokument }
  | { stav: "neexistuje" }
  | { stav: "poskozeny" }
  | { stav: "chyba" }
> {
  try {
    const cteni = await nacistSEtag();
    if (cteni.stav === "neexistuje") {
      return { stav: "neexistuje" };
    }
    return { stav: "ok", dokument: cteni.dokument };
  } catch (error) {
    const zprava = error instanceof Error ? error.message : "";
    if (zprava.includes("není platný JSON") || zprava.includes("neplatnou strukturu")) {
      return { stav: "poskozeny" };
    }
    return { stav: "chyba" };
  }
}

/** Jednorázové založení prázdného souboru. Existující dokument nepřepisuje. */
export async function zalozitPrazdnouBranaAnalytikuVBlobu(): Promise<VysledekZalozeniAnalytiky> {
  return zalozitPrazdnouAnalytiku(vytvoritIo());
}

/** Zapíše dávku jen do data/brana-analytika.json. Volá se, až bude příjem zapnutý. */
export async function zaznamenatBranaAnalytikuDoBlobu(
  telo: unknown,
  referencniCas?: Date,
  oblast?: BranaAnalytikaOblast,
  zarizeni?: BranaAnalytikaZarizeni,
): Promise<VysledekBranaAnalytiky> {
  return zaznamenatDavkuAnalytiky(telo, vytvoritIo(), referencniCas, oblast, zarizeni);
}
