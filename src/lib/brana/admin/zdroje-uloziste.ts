import "server-only";

import { BlobNotFoundError, get, put } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";
import {
  jeBranaZdrojTyp,
  jePlatnaZdrojUrl,
  validovatZdrojVstup,
  type BranaZdroj,
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

function zalogovatChybuCteni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-zdroje] ${duvod}`);
    return;
  }
  console.error(`[brana-zdroje] ${duvod}`, error);
}

function jePlatnyZdrojZBlobu(hodnota: unknown): hodnota is BranaZdroj {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const z = hodnota as Record<string, unknown>;
  return (
    typeof z.id === "string" &&
    z.id.trim().length > 0 &&
    typeof z.nazev === "string" &&
    z.nazev.trim().length > 0 &&
    jeBranaZdrojTyp(z.typ) &&
    typeof z.url === "string" &&
    z.url.trim().length > 0 &&
    jePlatnaZdrojUrl(z.url.trim())
  );
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
    zdroje: zdroje.map((z) => ({
      id: z.id.trim(),
      nazev: z.nazev.trim(),
      typ: z.typ,
      url: z.url.trim(),
    })),
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
    zdroje: dokument.zdroje.map((z) => ({
      id: z.id.trim(),
      nazev: z.nazev.trim(),
      typ: z.typ,
      url: z.url.trim(),
    })),
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

async function ulozitDokument(dokument: BranaZdrojeDokument): Promise<void> {
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
  });
}

async function nacistDokumentProZapis(): Promise<BranaZdrojeDokument> {
  const cteni = await nacistTextZPrivateBlob();

  if (cteni.stav === "neexistuje") {
    return { zdroje: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cteni.text) as unknown;
  } catch {
    throw new Error(BRANA_ZDROJE_CHYBA_CTENI);
  }

  const dokument = parsovatDokument(parsed);
  if (!dokument) {
    throw new Error(BRANA_ZDROJE_CHYBA_CTENI);
  }

  return dokument;
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
export async function pridatZdroj(vstup: unknown): Promise<BranaZdroj> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit zdroj: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const validace = validovatZdrojVstup(vstup);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  const dokument = await nacistDokumentProZapis();
  const novy: BranaZdroj = {
    id: `zdroj-${crypto.randomUUID()}`,
    nazev: validace.nazev,
    typ: validace.typ,
    url: validace.url,
  };

  const vysledny = validovatDokument({
    zdroje: [...dokument.zdroje, novy],
  });
  if (!vysledny) {
    throw new Error("Výsledný seznam zdrojů není platný.");
  }

  await ulozitDokument(vysledny);
  return novy;
}

/** Aktualizuje existující zdroj podle id – id zůstává. */
export async function upravitZdroj(
  id: string,
  vstup: unknown,
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

  const validace = validovatZdrojVstup(vstup);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  const dokument = await nacistDokumentProZapis();
  const index = dokument.zdroje.findIndex((z) => z.id === idTrim);
  if (index < 0) {
    throw new Error("Zdroj nebyl nalezen.");
  }

  const upraveny: BranaZdroj = {
    id: idTrim,
    nazev: validace.nazev,
    typ: validace.typ,
    url: validace.url,
  };

  const zdroje = dokument.zdroje.slice();
  zdroje[index] = upraveny;

  const vysledny = validovatDokument({ zdroje });
  if (!vysledny) {
    throw new Error("Výsledný seznam zdrojů není platný.");
  }

  await ulozitDokument(vysledny);
  return upraveny;
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

  const dokument = await nacistDokumentProZapis();
  const pred = dokument.zdroje.length;
  const zdroje = dokument.zdroje.filter((z) => z.id !== idTrim);
  if (zdroje.length === pred) {
    throw new Error("Zdroj nebyl nalezen.");
  }

  const vysledny = validovatDokument({ zdroje });
  if (!vysledny) {
    throw new Error("Výsledný seznam zdrojů není platný.");
  }

  await ulozitDokument(vysledny);
}
