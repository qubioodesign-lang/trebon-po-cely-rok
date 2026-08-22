import "server-only";

import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  get,
  head,
  put,
} from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";
import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";
import {
  BRANA_REDAKCNI_VSECHNY_VYCHOZI,
  vytvoritVychoziRedakcniPoradi,
} from "./redakcni-kostra";
import {
  zmenitRedakcniPoradiDokumentAtomickySIo,
} from "./redakcni-poradi-cas";
import {
  aplikovatRedakcniPoradiPatcheNaPolozky,
  sloucitUlozeneSKostrou,
  validovatRedakcniPoradiDokument,
  validovatRedakcniPoradiVstup,
  type BranaRedakcniPatchZmena,
} from "./redakcni-poradi-validace";

/**
 * Objekt v PRIVATE Blob store administrace BRÁNY.
 * Odděleně od PUBLIC store Třeboně i od vzkazů BRÁNY.
 */
export const BRANA_REDAKCNI_PORADI_BLOB_CESTA =
  "data/brana-redakcni-poradi.json";

/**
 * Verze dokumentu redakčního pořadí.
 * 1 (nebo chybí) = stará automatická kostra před prioritním seznamem.
 * 2 = prioritní seznam (22 ANO + ostatní NE) vědomě uložený redaktorem.
 *
 * Načtení starší verze vrátí v paměti nový seed; Blob se přepíše až při Uložit.
 */
export const BRANA_REDAKCNI_VERZE_ULOZISTE = 2;

/** Bezpečná zpráva pro klienta – bez tokenů a interních podrobností */
export const BRANA_REDAKCNI_CHYBA_CTENI =
  "Redakční pořadí se nepodařilo načíst. Žádná data nebyla změněna.";

export type BranaRedakcniPoradiDokument = {
  verzeUloziste: number;
  polozky: BranaRedakcniPolozkaStav[];
};

export type NacistRedakcniPoradiVysledek =
  | { ok: true; polozky: BranaRedakcniPolozkaStav[] }
  | { ok: false };

/**
 * True = dokument už nese vědomě uložený prioritní seznam (verze ≥ 2).
 * False = legacy Blob → jednorázový přechod na seed jen v paměti.
 * Rozpoznání výhradně podle číselné verze, bez heuristiky nad texty položek.
 */
export function dokumentMaPrioritniSeznam(
  verzeUloziste: unknown,
): boolean {
  return (
    typeof verzeUloziste === "number" &&
    Number.isInteger(verzeUloziste) &&
    verzeUloziste >= BRANA_REDAKCNI_VERZE_ULOZISTE
  );
}

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

function zalogovatChybuCteni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-redakcni-poradi] ${duvod}`);
    return;
  }
  console.error(`[brana-redakcni-poradi] ${duvod}`, error);
}

async function nacistTextZPrivateBlob(): Promise<BlobCteniTextu> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(BRANA_REDAKCNI_PORADI_BLOB_CESTA, {
      access: "private",
      ...volby,
    });

    // Vercel Blob get() vrací null, pokud objekt ještě neexistuje
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

/**
 * Načte redakční pořadí z PRIVATE Blobu (bez admin kontroly).
 * - Objekt neexistuje → výchozí kostra (editovatelná, Blob se nevytváří).
 * - verzeUloziste < 2 → v paměti nový prioritní seed (bez zápisu do Blobu).
 * - verzeUloziste ≥ 2 → uložené položky beze změny seedem.
 * - Jiná chyba / neplatný dokument → ok: false (bez tichého fallbacku).
 */
async function nacistRedakcniPoradiDokument(): Promise<NacistRedakcniPoradiVysledek> {
  noStore();

  if (!maBranaAdminBlobKonfiguraci()) {
    zalogovatChybuCteni(
      "chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN",
    );
    return { ok: false };
  }

  try {
    const cteni = await nacistTextZPrivateBlob();

    if (cteni.stav === "neexistuje") {
      return { ok: true, polozky: vytvoritVychoziRedakcniPoradi() };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cteni.text) as unknown;
    } catch (error) {
      zalogovatChybuCteni("neplatný JSON v Blob dokumentu", error);
      return { ok: false };
    }

    if (!parsed || typeof parsed !== "object") {
      zalogovatChybuCteni("Blob dokument nemá platný objekt");
      return { ok: false };
    }

    const root = parsed as { verzeUloziste?: unknown; polozky?: unknown };
    const validace = validovatRedakcniPoradiVstup(root.polozky, {
      legacyVyhled: true,
    });
    if (!validace.ok) {
      /**
       * Rozšíření katalogu: starší Blob bez nových ID → sloučit v paměti.
       * Žádný put. Blob se doplní až při vědomém Uložit.
       */
      if (
        Array.isArray(root.polozky) &&
        root.polozky.length < BRANA_REDAKCNI_VSECHNY_VYCHOZI.length
      ) {
        const slouceni = sloucitUlozeneSKostrou(root);
        const poSlouceni = validovatRedakcniPoradiVstup(slouceni, {
          legacyVyhled: true,
        });
        if (poSlouceni.ok) {
          if (!dokumentMaPrioritniSeznam(root.verzeUloziste)) {
            return { ok: true, polozky: vytvoritVychoziRedakcniPoradi() };
          }
          return { ok: true, polozky: poSlouceni.polozky };
        }
      }
      zalogovatChybuCteni(`Blob dokument neprošel validací: ${validace.chyba}`);
      return { ok: false };
    }

    /**
     * Jednorázový přechod: stará verze dokumentu (1 / chybí) → v paměti nový seed.
     * Žádný put. Blob se přepíše až při vědomém Uložit (verze 2).
     */
    if (!dokumentMaPrioritniSeznam(root.verzeUloziste)) {
      return { ok: true, polozky: vytvoritVychoziRedakcniPoradi() };
    }

    return { ok: true, polozky: validace.polozky };
  } catch (error) {
    zalogovatChybuCteni("selhání čtení PRIVATE Blobu", error);
    return { ok: false };
  }
}

/**
 * Načte redakční pořadí z PRIVATE Blob store.
 * - Objekt neexistuje → výchozí kostra (editovatelná, Blob se nevytváří).
 * - Jiná chyba / neplatný dokument → ok: false (bez tichého fallbacku).
 */
export async function nacistRedakcniPoradi(): Promise<NacistRedakcniPoradiVysledek> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  return nacistRedakcniPoradiDokument();
}

/**
 * Read-only načtení pro důvěryhodný scheduler (po ověření CRON_SECRET).
 * Bez admin session. Žádný put.
 */
export async function nacistRedakcniPoradiProScheduler(): Promise<NacistRedakcniPoradiVysledek> {
  return nacistRedakcniPoradiDokument();
}

function vychoziRedakcniPoradiDokument(): BranaRedakcniPoradiDokument {
  return {
    verzeUloziste: BRANA_REDAKCNI_VERZE_ULOZISTE,
    polozky: vytvoritVychoziRedakcniPoradi(),
  };
}

function polozkyZNactenehoBlobu(parsed: unknown): BranaRedakcniPolozkaStav[] {
  if (!parsed || typeof parsed !== "object") {
    throw new Error(BRANA_REDAKCNI_CHYBA_CTENI);
  }

  const root = parsed as { verzeUloziste?: unknown; polozky?: unknown };
  const validace = validovatRedakcniPoradiVstup(root.polozky, {
    legacyVyhled: true,
  });
  if (!validace.ok) {
    if (
      Array.isArray(root.polozky) &&
      root.polozky.length < BRANA_REDAKCNI_VSECHNY_VYCHOZI.length
    ) {
      const slouceni = sloucitUlozeneSKostrou(root);
      const poSlouceni = validovatRedakcniPoradiVstup(slouceni, {
        legacyVyhled: true,
      });
      if (poSlouceni.ok) {
        if (!dokumentMaPrioritniSeznam(root.verzeUloziste)) {
          return vytvoritVychoziRedakcniPoradi();
        }
        return poSlouceni.polozky;
      }
    }
    throw new Error(BRANA_REDAKCNI_CHYBA_CTENI);
  }

  if (!dokumentMaPrioritniSeznam(root.verzeUloziste)) {
    return vytvoritVychoziRedakcniPoradi();
  }

  return validace.polozky;
}

type BlobCteniProZapis =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: BranaRedakcniPoradiDokument; etag: string };

async function nacistDokumentSEtagProZapis(): Promise<BlobCteniProZapis> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  let etag: string;
  try {
    const meta = await head(BRANA_REDAKCNI_PORADI_BLOB_CESTA, volby);
    if (typeof meta.etag !== "string" || meta.etag.length === 0) {
      throw new Error(
        "Nelze bezpečně uložit: Blob HEAD nevrátil etag. Nic nebylo změněno.",
      );
    }
    etag = meta.etag;
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neexistuje" };
    }
    throw error;
  }

  try {
    const vysledek = await get(BRANA_REDAKCNI_PORADI_BLOB_CESTA, {
      access: "private",
      useCache: false,
      ...volby,
    });

    if (vysledek === null || !vysledek.stream) {
      throw new Error("Blob zmizel mezi HEAD a GET. Nic nebylo uloženo.");
    }

    const text = await new Response(vysledek.stream).text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new Error(BRANA_REDAKCNI_CHYBA_CTENI);
    }

    return {
      stav: "ok",
      dokument: {
        verzeUloziste: BRANA_REDAKCNI_VERZE_ULOZISTE,
        polozky: polozkyZNactenehoBlobu(parsed),
      },
      etag,
    };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      throw new Error("Blob zmizel mezi HEAD a GET. Nic nebylo uloženo.");
    }
    throw error;
  }
}

async function ulozitDokumentSIfMatch(
  dokument: BranaRedakcniPoradiDokument,
  etag: string | null,
): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error(
      "Nelze uložit redakční pořadí: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await put(
    BRANA_REDAKCNI_PORADI_BLOB_CESTA,
    JSON.stringify(dokument, null, 2),
    {
      ...volby,
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
      ...(etag !== null ? { ifMatch: etag } : {}),
    },
  );
}

/**
 * Aplikuje patch balík na čerstvý dokument (field-level compare-and-set + CAS).
 * Vrací čerstvý sloučený seznam. Prázdný balík → žádný PUT.
 */
export async function ulozitRedakcniPoradiPatche(
  patche: readonly BranaRedakcniPatchZmena[],
): Promise<BranaRedakcniPolozkaStav[]> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit redakční pořadí: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  return zmenitRedakcniPoradiDokumentAtomickySIo(
    {
      nacist: nacistDokumentSEtagProZapis,
      vychoziDokument: vychoziRedakcniPoradiDokument,
      validovat: validovatRedakcniPoradiDokument,
      ulozit: ulozitDokumentSIfMatch,
      jePreconditionChyba: (error) =>
        error instanceof BlobPreconditionFailedError,
    },
    (dokument) => {
      if (patche.length === 0) {
        return { typ: "bezZmeny", vysledek: dokument.polozky };
      }
      const po = aplikovatRedakcniPoradiPatcheNaPolozky(
        dokument.polozky,
        patche,
      );
      const overeny = validovatRedakcniPoradiDokument({
        verzeUloziste: BRANA_REDAKCNI_VERZE_ULOZISTE,
        polozky: po,
      });
      if (!overeny) {
        throw new Error(
          "Výsledný dokument neprošel validací. Nic nebylo uloženo.",
        );
      }
      return {
        typ: "zapsat",
        dokument: overeny,
        vysledek: overeny.polozky,
      };
    },
  );
}
