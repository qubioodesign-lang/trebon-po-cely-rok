import "server-only";

import { BlobNotFoundError, get, put } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";
import type { BranaKonkretniUdalost } from "./konkretni-udalost";
import { validovatRucniUdalostVstup } from "./rucni-udalost-validace";

/**
 * Samostatný objekt v PRIVATE Blob store administrace BRÁNY.
 * Nesmí se míchat s data/brana-redakcni-poradi.json.
 * Obsahuje jen ručně uložené konkrétní události + stav posledního scanu.
 */
export const BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA =
  "data/brana-konkretni-udalosti.json";

const VERZE_ULOZISTE = 1;

export const BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI =
  "Konkrétní události se nepodařilo načíst. Žádná data nebyla změněna.";

export type BranaKonkretniUdalostiDokument = {
  verzeUloziste: number;
  /** Odemyká výjimečný ruční zápis – nastaví skutečný scan Zdrojů */
  posledniScanDokoncen: boolean;
  /** Pouze ručně uložené události (redakcniPolozkaId = null) */
  udalosti: BranaKonkretniUdalost[];
};

export type NacistKonkretniUdalostiVysledek =
  | {
      ok: true;
      posledniScanDokoncen: boolean;
      udalosti: BranaKonkretniUdalost[];
    }
  | { ok: false };

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

function zalogovatChybuCteni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-konkretni-udalosti] ${duvod}`);
    return;
  }
  console.error(`[brana-konkretni-udalosti] ${duvod}`, error);
}

function vychoziDokument(): BranaKonkretniUdalostiDokument {
  return {
    verzeUloziste: VERZE_ULOZISTE,
    posledniScanDokoncen: false,
    udalosti: [],
  };
}

function jeRucniUdalostZBlobu(hodnota: unknown): hodnota is BranaKonkretniUdalost {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const u = hodnota as Record<string, unknown>;
  return (
    typeof u.id === "string" &&
    u.id.length > 0 &&
    u.redakcniPolozkaId === null &&
    typeof u.datumOd === "string" &&
    typeof u.datumDo === "string" &&
    typeof u.cas === "string" &&
    typeof u.mistoNeboTyp === "string" &&
    typeof u.nazev === "string" &&
    typeof u.rucniPoziceVDni === "number" &&
    Number.isInteger(u.rucniPoziceVDni) &&
    u.rucniPoziceVDni >= 0
  );
}

function parsovatDokument(
  parsed: unknown,
): BranaKonkretniUdalostiDokument | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const data = parsed as Record<string, unknown>;
  if (data.verzeUloziste !== VERZE_ULOZISTE) {
    return null;
  }
  if (typeof data.posledniScanDokoncen !== "boolean") {
    return null;
  }
  if (!Array.isArray(data.udalosti)) {
    return null;
  }
  if (!data.udalosti.every(jeRucniUdalostZBlobu)) {
    return null;
  }
  return {
    verzeUloziste: VERZE_ULOZISTE,
    posledniScanDokoncen: data.posledniScanDokoncen,
    udalosti: data.udalosti,
  };
}

async function nacistTextZPrivateBlob(): Promise<BlobCteniTextu> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA, {
      access: "private",
      ...volby,
    });

    if (vysledek === null) {
      return { stav: "neexistuje" };
    }

    if (!vysledek.stream) {
      throw new Error("Blob get vrátil odpověď bez použitelného streamu.");
    }

    const text = await new Response(vysledek.stream).text();
    return { stav: "ok", text };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neexistuje" };
    }
    throw error;
  }
}

async function ulozitDokument(
  dokument: BranaKonkretniUdalostiDokument,
): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error(
      "Nelze uložit konkrétní události: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await put(
    BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA,
    JSON.stringify(dokument, null, 2),
    {
      ...volby,
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    },
  );
}

/**
 * Načte ruční konkrétní události a stav posledního scanu.
 * - Objekt neexistuje → prázdný seznam, scan nedokončen (Blob se nevytváří).
 * - Jiná chyba → ok: false.
 */
export async function nacistKonkretniUdalosti(): Promise<NacistKonkretniUdalostiVysledek> {
  noStore();

  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    zalogovatChybuCteni(
      "chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN",
    );
    return { ok: false };
  }

  try {
    const cteni = await nacistTextZPrivateBlob();

    if (cteni.stav === "neexistuje") {
      const prazdny = vychoziDokument();
      return {
        ok: true,
        posledniScanDokoncen: prazdny.posledniScanDokoncen,
        udalosti: prazdny.udalosti,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cteni.text) as unknown;
    } catch (error) {
      zalogovatChybuCteni("neplatný JSON v Blob dokumentu", error);
      return { ok: false };
    }

    const dokument = parsovatDokument(parsed);
    if (!dokument) {
      zalogovatChybuCteni("Blob dokument neprošel validací");
      return { ok: false };
    }

    return {
      ok: true,
      posledniScanDokoncen: dokument.posledniScanDokoncen,
      udalosti: dokument.udalosti,
    };
  } catch (error) {
    zalogovatChybuCteni("selhání čtení PRIVATE Blobu", error);
    return { ok: false };
  }
}

async function nacistDokumentProZapis(): Promise<BranaKonkretniUdalostiDokument> {
  const cteni = await nacistTextZPrivateBlob();
  if (cteni.stav === "neexistuje") {
    return vychoziDokument();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cteni.text) as unknown;
  } catch (error) {
    zalogovatChybuCteni("neplatný JSON při zápisu", error);
    throw new Error(BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI);
  }

  const dokument = parsovatDokument(parsed);
  if (!dokument) {
    throw new Error(BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI);
  }
  return dokument;
}

/** Nastaví stav „poslední scan dokončen“ – bez falešného scanu Zdrojů. */
export async function nastavitPosledniScanDokoncen(
  dokoncen: boolean,
): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit stav scanu: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const dokument = await nacistDokumentProZapis();
  dokument.posledniScanDokoncen = dokoncen;
  await ulozitDokument(dokument);
}

/** Přidá jednu ruční konkrétní událost. Ukázková data se nezapisují. */
export async function pridatRucniKonkretniUdalost(
  vstup: unknown,
): Promise<BranaKonkretniUdalost> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit událost: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const validace = validovatRucniUdalostVstup(vstup);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  const dokument = await nacistDokumentProZapis();

  if (!dokument.posledniScanDokoncen) {
    throw new Error(
      "Ruční zápis je dostupný až po dokončení posledního scanu.",
    );
  }

  const nova: BranaKonkretniUdalost = {
    id: `rucni-${crypto.randomUUID()}`,
    ...validace.udalost,
  };

  dokument.udalosti = [...dokument.udalosti, nova];
  await ulozitDokument(dokument);
  return nova;
}

/**
 * Aktualizuje jednu existující ruční událost podle id.
 * Při chybě čtení nic nezapisuje. Ukázková data a Redakční pořadí nemění.
 */
export async function upravitRucniKonkretniUdalost(
  id: string,
  vstup: unknown,
): Promise<BranaKonkretniUdalost> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit událost: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const idTrim = typeof id === "string" ? id.trim() : "";
  if (!idTrim) {
    throw new Error("Chybí id události.");
  }

  const validace = validovatRucniUdalostVstup(vstup);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  const dokument = await nacistDokumentProZapis();

  if (!dokument.posledniScanDokoncen) {
    throw new Error(
      "Ruční zápis je dostupný až po dokončení posledního scanu.",
    );
  }

  const index = dokument.udalosti.findIndex((u) => u.id === idTrim);
  if (index < 0) {
    throw new Error("Ruční událost nebyla nalezena.");
  }

  const aktualizovana: BranaKonkretniUdalost = {
    id: idTrim,
    ...validace.udalost,
  };

  const noveUdalosti = dokument.udalosti.slice();
  noveUdalosti[index] = aktualizovana;
  dokument.udalosti = noveUdalosti;

  const overeni = parsovatDokument(dokument);
  if (!overeni) {
    throw new Error("Výsledný dokument neprošel validací. Nic nebylo uloženo.");
  }

  await ulozitDokument(overeni);
  return aktualizovana;
}

/**
 * Odstraní jednu ruční událost podle id.
 * Při chybě čtení nic nezapisuje.
 */
export async function smazatRucniKonkretniUdalost(id: string): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze smazat událost: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const idTrim = typeof id === "string" ? id.trim() : "";
  if (!idTrim) {
    throw new Error("Chybí id události.");
  }

  const dokument = await nacistDokumentProZapis();

  if (!dokument.posledniScanDokoncen) {
    throw new Error(
      "Ruční zápis je dostupný až po dokončení posledního scanu.",
    );
  }

  const pred = dokument.udalosti.length;
  const noveUdalosti = dokument.udalosti.filter((u) => u.id !== idTrim);
  if (noveUdalosti.length === pred) {
    throw new Error("Ruční událost nebyla nalezena.");
  }

  dokument.udalosti = noveUdalosti;

  const overeni = parsovatDokument(dokument);
  if (!overeni) {
    throw new Error("Výsledný dokument neprošel validací. Nic nebylo uloženo.");
  }

  await ulozitDokument(overeni);
}
