import "server-only";

import { BlobNotFoundError, get, put } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";
import {
  jePlatneSkrytiZameckehoParku,
  parsovatDokumentSkrytiZameckehoParku,
} from "../zamecky-park";

/** Vlastní soukromý dokument. Není součást Atmosféry. */
export const BRANA_ZAMECKY_PARK_BLOB_CESTA = "data/brana-zamecky-park.json";

export type NacteniSkrytiZameckehoParku =
  | { stav: "neni" }
  | { stav: "ok"; skrytoDo: string | null }
  | { stav: "chyba" };

/**
 * Fail-soft čtení. Chybějící soubor není chyba.
 * Poškozený soubor veřejnou stránku neshodí; volající dostane stav "chyba".
 */
export async function nactiSkrytiZameckehoParku(): Promise<NacteniSkrytiZameckehoParku> {
  noStore();
  if (!maBranaAdminBlobKonfiguraci()) {
    return { stav: "neni" };
  }

  try {
    const volby = ziskatVolbyBranaAdminBlob();
    const vysledek = await get(BRANA_ZAMECKY_PARK_BLOB_CESTA, {
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

    const dokument = parsovatDokumentSkrytiZameckehoParku(parsed);
    if (!dokument.ok) {
      return { stav: "chyba" };
    }
    return { stav: "ok", skrytoDo: dokument.skrytoDo };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neni" };
    }
    console.error("[brana-zamecky-park] načtení skrytí selhalo", error);
    return { stav: "chyba" };
  }
}

/** Zapíše jen okamžik konce skrytí. Při chybě nic nehlásí jako hotové. */
export async function ulozitSkrytiZameckehoParku(skrytoDo: string): Promise<void> {
  if (!jePlatneSkrytiZameckehoParku(skrytoDo)) {
    throw new Error("Neplatný čas skrytí zámeckého parku. Nic nebylo uloženo.");
  }

  const volby = ziskatVolbyBranaAdminBlob();
  if (!volby.token) {
    throw new Error(
      "Nelze uložit skrytí parku: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const dokument = { verze: 1 as const, skrytoDo };
  await put(
    BRANA_ZAMECKY_PARK_BLOB_CESTA,
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
