import path from "path";
import fs from "fs";
import { put, del } from "@vercel/blob";
import { pouzivaBlobUloziste, ziskatVolbyBlobAsync } from "./env-blob";

const UPLOADS_ADRESAR = path.join(process.cwd(), "public", "uploads");

/** Povolené MIME typy pro nahrávání */
const POVOLENE_TYPY: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

/** Uloží nahraný soubor do Blob nebo lokálně */
export async function ulozitSoubor(
  soubor: File,
  oidcZHeaderu?: string | null
): Promise<{ cestaSouboru: string; typ: "fotografie" | "video" }> {
  const mimeTyp = soubor.type;
  const pripona = POVOLENE_TYPY[mimeTyp];

  if (!pripona) {
    throw new Error(`Nepodporovaný typ souboru: ${mimeTyp}`);
  }

  const nazevSouboru = `${crypto.randomUUID()}${pripona}`;
  const jeVideo = mimeTyp.startsWith("video/");

  if (pouzivaBlobUloziste()) {
    const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);

    if (!volby.token && !volby.oidcToken) {
      throw new Error(
        "Nelze nahrát soubor: chybí autentizace k Blob. Nastavte BLOB_READ_WRITE_TOKEN ve Vercel → Storage → Blob → Tokens."
      );
    }

    const blob = await put(`uploads/${nazevSouboru}`, soubor, {
      ...volby,
      access: "public",
      addRandomSuffix: false,
      contentType: mimeTyp,
    });

    return {
      cestaSouboru: blob.url,
      typ: jeVideo ? "video" : "fotografie",
    };
  }

  if (!fs.existsSync(UPLOADS_ADRESAR)) {
    fs.mkdirSync(UPLOADS_ADRESAR, { recursive: true });
  }

  const cesta = path.join(UPLOADS_ADRESAR, nazevSouboru);
  const buffer = Buffer.from(await soubor.arrayBuffer());
  fs.writeFileSync(cesta, buffer);

  return {
    cestaSouboru: nazevSouboru,
    typ: jeVideo ? "video" : "fotografie",
  };
}

const MAX_POKUSY_VEREJNEHO_SOUBORU = 12;

function cekatNaVerejnySoubor(pokus: number): Promise<void> {
  const ms = Math.min(80 * 2 ** pokus, 1500);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ověří, že nahraný soubor je veřejně čitelný (stejná cesta jako galerie) */
export async function overitSouborVerejne(cestaSouboru: string): Promise<void> {
  if (!cestaSouboru.startsWith("http://") && !cestaSouboru.startsWith("https://")) {
    const cesta = path.join(UPLOADS_ADRESAR, cestaSouboru);
    if (!fs.existsSync(cesta)) {
      throw new Error("Nahraný soubor nebyl nalezen v lokálním úložišti");
    }
    return;
  }

  for (let pokus = 0; pokus < MAX_POKUSY_VEREJNEHO_SOUBORU; pokus++) {
    const fetchUrl = `${cestaSouboru}${
      cestaSouboru.includes("?") ? "&" : "?"
    }_=${Date.now()}-${pokus}`;

    try {
      const odpoved = await fetch(fetchUrl, {
        method: "GET",
        cache: "no-store",
        headers: {
          Range: "bytes=0-0",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });

      if (odpoved.ok || odpoved.status === 206) {
        return;
      }
    } catch {
      // CDN může krátce vracet chybu – zkusíme znovu
    }

    await cekatNaVerejnySoubor(pokus);
  }

  throw new Error(
    "Nahraný soubor zatím není veřejně dostupný. Zkuste nahrání znovu."
  );
}

/** Smaže více souborů – chybějící soubory neblokují dokončení */
export async function smazatSoubory(
  cesty: string[],
  oidcZHeaderu?: string | null
): Promise<void> {
  for (const cesta of cesty) {
    try {
      await smazatSoubor(cesta, oidcZHeaderu);
    } catch {
      // pokračovat se zbývajícími soubory
    }
  }
}

/** Smaže soubor z Blob nebo lokálního úložiště */
export async function smazatSoubor(
  cestaSouboru: string,
  oidcZHeaderu?: string | null
): Promise<void> {
  if (cestaSouboru.startsWith("http://") || cestaSouboru.startsWith("https://")) {
    const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);
    await del(cestaSouboru, volby);
    return;
  }

  const cesta = path.join(UPLOADS_ADRESAR, cestaSouboru);
  if (fs.existsSync(cesta)) {
    fs.unlinkSync(cesta);
  }
}
