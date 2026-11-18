import "server-only";

import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from "@vercel/blob";
import { ziskatVolbyBranaAdminBlob } from "@/lib/brana/admin/env-blob-brana-admin";

/** Vlastní soubor počítadla. Mimo analytiku i redakční zálohu. */
export const BRANA_VZTAH_CESTA = "data/brana-vztah.json";

const BRANA_VZTAH_ZAKLAD = 1247;
const BRANA_VZTAH_VERZE = 1;
const MAX_POKUSU = 8;

type BranaVztahDokument = {
  verze: typeof BRANA_VZTAH_VERZE;
  zaklad: typeof BRANA_VZTAH_ZAKLAD;
  pribytek: number;
};

type Cteni =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: BranaVztahDokument; etag: string }
  | { stav: "poskozeny" };

export type VysledekCteniVztahu =
  | { stav: "ok"; pocet: number }
  | { stav: "chyba" };

export type VysledekPricteniVztahu =
  | { ok: true; pocet: number }
  | { ok: false };

function volby() {
  const nactene = ziskatVolbyBranaAdminBlob();
  if (!nactene.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }
  return nactene;
}

function jeDokument(hodnota: unknown): hodnota is BranaVztahDokument {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const dokument = hodnota as Record<string, unknown>;
  return (
    dokument.verze === BRANA_VZTAH_VERZE &&
    dokument.zaklad === BRANA_VZTAH_ZAKLAD &&
    typeof dokument.pribytek === "number" &&
    Number.isInteger(dokument.pribytek) &&
    dokument.pribytek >= 0 &&
    dokument.pribytek <= Number.MAX_SAFE_INTEGER - BRANA_VZTAH_ZAKLAD
  );
}

function soucet(dokument: BranaVztahDokument): number {
  return dokument.zaklad + dokument.pribytek;
}

async function nacistDokument(): Promise<Cteni> {
  const nastaveni = volby();
  let etag: string;
  try {
    const meta = await head(BRANA_VZTAH_CESTA, nastaveni);
    if (typeof meta.etag !== "string" || meta.etag.length === 0) {
      return { stav: "poskozeny" };
    }
    etag = meta.etag;
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neexistuje" };
    }
    throw error;
  }

  const vysledek = await get(BRANA_VZTAH_CESTA, {
    access: "private",
    useCache: false,
    ...nastaveni,
  });
  if (vysledek === null || vysledek.statusCode !== 200 || !vysledek.stream) {
    return { stav: "poskozeny" };
  }

  const text = await new Response(vysledek.stream).text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { stav: "poskozeny" };
  }
  if (!jeDokument(parsed)) {
    return { stav: "poskozeny" };
  }
  return { stav: "ok", dokument: parsed, etag };
}

async function zalozitPrvni(): Promise<void> {
  const nastaveni = volby();
  const dokument: BranaVztahDokument = {
    verze: BRANA_VZTAH_VERZE,
    zaklad: BRANA_VZTAH_ZAKLAD,
    pribytek: 1,
  };
  await put(BRANA_VZTAH_CESTA, JSON.stringify(dokument), {
    ...nastaveni,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

async function ulozitPrictek(
  dokument: BranaVztahDokument,
  etag: string,
): Promise<void> {
  const nastaveni = volby();
  await put(BRANA_VZTAH_CESTA, JSON.stringify(dokument), {
    ...nastaveni,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ifMatch: etag,
  });
}

/** Chybějící soubor znamená základ 1 247. Chyba čtení počet nezná. */
export async function nacistVztahPocet(): Promise<VysledekCteniVztahu> {
  try {
    const cteni = await nacistDokument();
    if (cteni.stav === "neexistuje") {
      return { stav: "ok", pocet: BRANA_VZTAH_ZAKLAD };
    }
    if (cteni.stav === "poskozeny") {
      return { stav: "chyba" };
    }
    return { stav: "ok", pocet: soucet(cteni.dokument) };
  } catch {
    return { stav: "chyba" };
  }
}

/** Přičte jedničku. Souběh řeší etag. Poškozený soubor se nepřepisuje. */
export async function pricistVztah(): Promise<VysledekPricteniVztahu> {
  for (let pokus = 1; pokus <= MAX_POKUSU; pokus += 1) {
    let cteni: Cteni;
    try {
      cteni = await nacistDokument();
    } catch {
      return { ok: false };
    }

    if (cteni.stav === "poskozeny") {
      return { ok: false };
    }

    if (cteni.stav === "neexistuje") {
      try {
        await zalozitPrvni();
        return { ok: true, pocet: BRANA_VZTAH_ZAKLAD + 1 };
      } catch {
        continue;
      }
    }

    const dalsi: BranaVztahDokument = {
      ...cteni.dokument,
      pribytek: cteni.dokument.pribytek + 1,
    };
    try {
      await ulozitPrictek(dalsi, cteni.etag);
      return { ok: true, pocet: soucet(dalsi) };
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) {
        continue;
      }
      return { ok: false };
    }
  }

  return { ok: false };
}
