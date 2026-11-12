import "server-only";

import { BlobNotFoundError, get, put } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";
import {
  jePlatneOknoIsoAkciNaVikend,
  jePlatneSkrytiAkciNaVikend,
  nacteniSkrytiAkciNaVikendZDokumentu,
  type NacteniSkrytiAkciNaVikend,
} from "../sdileni-akci-na-vikend";

/** Vlastní soukromý dokument. Není součást parku ani Atmosféry. Počet akcí neobsahuje. */
export const BRANA_AKCI_NA_VIKEND_BLOB_CESTA = "data/brana-akci-na-vikend.json";

/**
 * Chybějící soubor znamená, že skrytí není.
 * Poškozený soubor vrací stav "chyba" a veřejnou stránku neshodí.
 */
export async function nactiSkrytiAkciNaVikend(): Promise<NacteniSkrytiAkciNaVikend> {
  noStore();
  if (!maBranaAdminBlobKonfiguraci()) {
    return { stav: "neni" };
  }

  try {
    const volby = ziskatVolbyBranaAdminBlob();
    const vysledek = await get(BRANA_AKCI_NA_VIKEND_BLOB_CESTA, {
      access: "private",
      useCache: false,
      ...volby,
    });
    if (vysledek === null || !vysledek.stream) {
      return { stav: "neni" };
    }

    const text = await new Response(vysledek.stream).text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return { stav: "chyba" };
    }
    return nacteniSkrytiAkciNaVikendZDokumentu(parsed);
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neni" };
    }
    console.error("[brana-akci-na-vikend] načtení skrytí selhalo", error);
    return { stav: "chyba" };
  }
}

/** Zapíše jen konec aktuálního okna a jeho den. Při chybě nic nehlásí jako hotové. */
export async function ulozitSkrytiAkciNaVikend(
  skrytoDo: string,
  oknoIso: string,
): Promise<void> {
  if (
    !jePlatneSkrytiAkciNaVikend(skrytoDo) ||
    !jePlatneOknoIsoAkciNaVikend(oknoIso)
  ) {
    throw new Error("Neplatné skrytí akcí na víkend. Nic nebylo uloženo.");
  }

  const volby = ziskatVolbyBranaAdminBlob();
  if (!volby.token) {
    throw new Error(
      "Nelze uložit skrytí akcí na víkend: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const dokument = { verze: 1 as const, skrytoDo, oknoIso };
  await put(BRANA_AKCI_NA_VIKEND_BLOB_CESTA, JSON.stringify(dokument, null, 2), {
    ...volby,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}
