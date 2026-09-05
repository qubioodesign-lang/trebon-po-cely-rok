import "server-only";

import { BlobNotFoundError, get } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "@/lib/brana/admin/env-blob-brana-admin";
import {
  BRANA_ATMOSFERA_BLOB_CESTA,
  parsovatAtmosferaDokument,
  verejnaVetaAtmosfery,
} from "@/lib/brana/atmosfera";

/**
 * Fail-soft veřejná věta Atmosféry pro DNES.
 * Při chybě / NIC / neplatném dokumentu vrací null — nic nerenderovat.
 * Nikdy nespouští motor ani nezapisuje do Blob.
 */
export async function nactiVerejnouVetuAtmosfery(): Promise<string | null> {
  noStore();

  if (!maBranaAdminBlobKonfiguraci()) {
    return null;
  }

  try {
    const volby = ziskatVolbyBranaAdminBlob();
    const vysledek = await get(BRANA_ATMOSFERA_BLOB_CESTA, {
      access: "private",
      useCache: false,
      ...volby,
    });

    if (vysledek === null || !vysledek.stream) {
      return null;
    }

    const text = await new Response(vysledek.stream).text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return null;
    }

    const dokument = parsovatAtmosferaDokument(parsed);
    if (!dokument) {
      return null;
    }

    return verejnaVetaAtmosfery(dokument.stav);
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return null;
    }
    console.error("[brana-atmosfera] veřejné načtení selhalo", error);
    return null;
  }
}
