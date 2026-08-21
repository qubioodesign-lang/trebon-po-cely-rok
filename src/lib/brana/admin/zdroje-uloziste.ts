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
import {
  zmenitZdrojeDokumentAtomickySIo,
  type BranaZdrojeDokumentMutace,
} from "./zdroje-cas";
import {
  doplnVychoziPoleZdroje,
  jeBranaZdrojRezimScanu,
  jeBranaZdrojTyp,
  jePlatnaZdrojUrl,
  normalizovatHlidaneRedakcniPolozkaIds,
  validovatZdrojVstup,
  type BranaZdroj,
  type ValidaceZdrojeVolby,
} from "./zdroj";

/**
 * Objekt v PRIVATE Blob store administrace BRÁNY.
 * Odděleně od nastavení rytmu, redakčního pořadí i konkrétních událostí.
 */
export const BRANA_ZDROJE_BLOB_CESTA = "data/brana-zdroje.json";

/** Bezpečná zpráva pro klienta – bez tokenů a interních podrobností */
export const BRANA_ZDROJE_CHYBA_CTENI =
  "Seznam zdrojů se nepodařilo načíst. Žádná data nebyla změněna.";

export type BranaZdrojeDokument = {
  zdroje: BranaZdroj[];
};

export type NacistZdrojeVysledek =
  | { ok: true; zdroje: BranaZdroj[] }
  | { ok: false };

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

type BlobCteniProZapis =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: BranaZdrojeDokument; etag: string };

function vychoziDokument(): BranaZdrojeDokument {
  return { zdroje: [] };
}

function zalogovatChybuCteni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-zdroje] ${duvod}`);
    return;
  }
  console.error(`[brana-zdroje] ${duvod}`, error);
}

function jePlatnyZdrojZBlobu(hodnota: unknown): boolean {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const z = hodnota as Record<string, unknown>;
  if (
    typeof z.id !== "string" ||
    z.id.trim().length === 0 ||
    typeof z.nazev !== "string" ||
    z.nazev.trim().length === 0 ||
    !jeBranaZdrojTyp(z.typ) ||
    typeof z.url !== "string" ||
    z.url.trim().length === 0 ||
    !jePlatnaZdrojUrl(z.url.trim())
  ) {
    return false;
  }
  // Nová pole: chybí = OK (doplní se default). Pokud jsou přítomná, musí být platná.
  if (
    z.rezimScanu !== undefined &&
    z.rezimScanu !== null &&
    !jeBranaZdrojRezimScanu(z.rezimScanu)
  ) {
    return false;
  }
  if (
    z.hlidaneRedakcniPolozkaIds !== undefined &&
    z.hlidaneRedakcniPolozkaIds !== null &&
    !Array.isArray(z.hlidaneRedakcniPolozkaIds)
  ) {
    return false;
  }
  if (Array.isArray(z.hlidaneRedakcniPolozkaIds)) {
    for (const id of z.hlidaneRedakcniPolozkaIds) {
      if (typeof id !== "string") {
        return false;
      }
    }
  }
  return true;
}

function normalizovatZdrojZBlobu(hodnota: unknown): BranaZdroj {
  const z = hodnota as {
    id: string;
    nazev: string;
    typ: BranaZdroj["typ"];
    url: string;
    rezimScanu?: unknown;
    hlidaneRedakcniPolozkaIds?: unknown;
  };
  return doplnVychoziPoleZdroje({
    id: z.id.trim(),
    nazev: z.nazev.trim(),
    typ: z.typ,
    url: z.url.trim(),
    rezimScanu: z.rezimScanu,
    hlidaneRedakcniPolozkaIds: z.hlidaneRedakcniPolozkaIds,
  });
}

function parsovatDokument(parsed: unknown): BranaZdrojeDokument | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const zdroje = (parsed as { zdroje?: unknown }).zdroje;
  if (!Array.isArray(zdroje)) {
    return null;
  }
  if (!zdroje.every(jePlatnyZdrojZBlobu)) {
    return null;
  }
  return {
    zdroje: zdroje.map(normalizovatZdrojZBlobu),
  };
}

function validovatDokument(
  dokument: BranaZdrojeDokument,
): BranaZdrojeDokument | null {
  if (!Array.isArray(dokument.zdroje)) {
    return null;
  }
  if (!dokument.zdroje.every(jePlatnyZdrojZBlobu)) {
    return null;
  }
  const idSet = new Set<string>();
  for (const zdroj of dokument.zdroje) {
    if (idSet.has(zdroj.id)) {
      return null;
    }
    idSet.add(zdroj.id);
  }
  return {
    zdroje: dokument.zdroje.map((z) =>
      doplnVychoziPoleZdroje({
        id: z.id.trim(),
        nazev: z.nazev.trim(),
        typ: z.typ,
        url: z.url.trim(),
        rezimScanu: z.rezimScanu,
        hlidaneRedakcniPolozkaIds: normalizovatHlidaneRedakcniPolozkaIds(
          z.hlidaneRedakcniPolozkaIds,
        ),
      }),
    ),
  };
}

async function nacistTextZPrivateBlob(): Promise<BlobCteniTextu> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(BRANA_ZDROJE_BLOB_CESTA, {
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

async function nacistDokumentSEtagProZapis(): Promise<BlobCteniProZapis> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  let etag: string;
  try {
    const meta = await head(BRANA_ZDROJE_BLOB_CESTA, volby);
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
    const vysledek = await get(BRANA_ZDROJE_BLOB_CESTA, {
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
      throw new Error(BRANA_ZDROJE_CHYBA_CTENI);
    }

    const dokument = parsovatDokument(parsed);
    if (!dokument) {
      throw new Error(BRANA_ZDROJE_CHYBA_CTENI);
    }

    return { stav: "ok", dokument, etag };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      throw new Error("Blob zmizel mezi HEAD a GET. Nic nebylo uloženo.");
    }
    throw error;
  }
}

async function ulozitDokumentSIfMatch(
  dokument: BranaZdrojeDokument,
  etag: string | null,
): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error(
      "Nelze uložit zdroje: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await put(BRANA_ZDROJE_BLOB_CESTA, JSON.stringify(dokument, null, 2), {
    ...volby,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ...(etag !== null ? { ifMatch: etag } : {}),
  });
}

async function zmenitZdrojeDokumentAtomicky<T>(
  mutator: (
    dokument: BranaZdrojeDokument,
  ) => BranaZdrojeDokumentMutace<BranaZdrojeDokument, T>,
): Promise<T> {
  return zmenitZdrojeDokumentAtomickySIo(
    {
      nacist: nacistDokumentSEtagProZapis,
      vychoziDokument,
      validovat: (dokument) => validovatDokument(dokument),
      ulozit: ulozitDokumentSIfMatch,
      jePreconditionChyba: (error) =>
        error instanceof BlobPreconditionFailedError,
    },
    mutator,
  );
}

/**
 * Načte známé zdroje z PRIVATE Blobu (bez admin kontroly).
 * - Objekt neexistuje → prázdný seznam (Blob se nevytváří).
 * - Jiná chyba / neplatný dokument → ok: false.
 */
async function nacistZdrojeDokument(): Promise<NacistZdrojeVysledek> {
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
      return { ok: true, zdroje: [] };
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

    return { ok: true, zdroje: dokument.zdroje };
  } catch (error) {
    zalogovatChybuCteni("selhání čtení PRIVATE Blobu", error);
    return { ok: false };
  }
}

/**
 * Načte známé zdroje.
 * - Objekt neexistuje → prázdný seznam (Blob se nevytváří).
 * - Jiná chyba / neplatný dokument → ok: false.
 */
export async function nacistZdroje(): Promise<NacistZdrojeVysledek> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  return nacistZdrojeDokument();
}

/**
 * Read-only načtení pro důvěryhodný scheduler (po ověření CRON_SECRET).
 * Bez admin session. Žádný put.
 */
export async function nacistZdrojeProScheduler(): Promise<NacistZdrojeVysledek> {
  return nacistZdrojeDokument();
}

/** Přidá jeden známý zdroj. Ukázková data se nezapisují. */
export async function pridatZdroj(
  vstup: unknown,
  validaceVolby?: ValidaceZdrojeVolby,
): Promise<BranaZdroj> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit zdroj: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const validace = validovatZdrojVstup(vstup, validaceVolby);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  return zmenitZdrojeDokumentAtomicky((dokument) => {
    const novy: BranaZdroj = {
      id: `zdroj-${crypto.randomUUID()}`,
      nazev: validace.nazev,
      typ: validace.typ,
      url: validace.url,
      rezimScanu: validace.rezimScanu,
      hlidaneRedakcniPolozkaIds: validace.hlidaneRedakcniPolozkaIds,
    };

    dokument.zdroje = [...dokument.zdroje, novy];
    return { typ: "zapsat", dokument, vysledek: novy };
  });
}

/** Aktualizuje existující zdroj podle id – id zůstává. */
export async function upravitZdroj(
  id: string,
  vstup: unknown,
  validaceVolby?: ValidaceZdrojeVolby,
): Promise<BranaZdroj> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit zdroj: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const idTrim = typeof id === "string" ? id.trim() : "";
  if (!idTrim) {
    throw new Error("Chybí id zdroje.");
  }

  const validace = validovatZdrojVstup(vstup, validaceVolby);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  return zmenitZdrojeDokumentAtomicky((dokument) => {
    const index = dokument.zdroje.findIndex((z) => z.id === idTrim);
    if (index < 0) {
      throw new Error("Zdroj nebyl nalezen.");
    }

    const upraveny: BranaZdroj = {
      id: idTrim,
      nazev: validace.nazev,
      typ: validace.typ,
      url: validace.url,
      rezimScanu: validace.rezimScanu,
      hlidaneRedakcniPolozkaIds: validace.hlidaneRedakcniPolozkaIds,
    };

    const zdroje = dokument.zdroje.slice();
    zdroje[index] = upraveny;
    dokument.zdroje = zdroje;

    return { typ: "zapsat", dokument, vysledek: upraveny };
  });
}

/** Smaže jeden známý zdroj podle přesného id. */
export async function smazatZdroj(id: string): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze smazat zdroj: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const idTrim = typeof id === "string" ? id.trim() : "";
  if (!idTrim) {
    throw new Error("Chybí id zdroje.");
  }

  await zmenitZdrojeDokumentAtomicky((dokument) => {
    const pred = dokument.zdroje.length;
    const zdroje = dokument.zdroje.filter((z) => z.id !== idTrim);
    if (zdroje.length === pred) {
      throw new Error("Zdroj nebyl nalezen.");
    }

    dokument.zdroje = zdroje;
    return { typ: "zapsat", dokument, vysledek: undefined };
  });
}
