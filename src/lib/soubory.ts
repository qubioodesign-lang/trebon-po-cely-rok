import "server-only";

import path from "path";
import fs from "fs";
import { put, del } from "@vercel/blob";
import { pouzivaBlobUloziste } from "./env-blob";

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

/**
 * Uloží nahraný soubor.
 * Na Vercelu do Blob úložiště, lokálně do /public/uploads.
 */
export async function ulozitSoubor(
  soubor: File
): Promise<{ cestaSouboru: string; typ: "fotografie" | "video" }> {
  const mimeTyp = soubor.type;
  const pripona = POVOLENE_TYPY[mimeTyp];

  if (!pripona) {
    throw new Error(`Nepodporovaný typ souboru: ${mimeTyp}`);
  }

  const nazevSouboru = `${crypto.randomUUID()}${pripona}`;
  const jeVideo = mimeTyp.startsWith("video/");

  if (pouzivaBlobUloziste()) {
    const blob = await put(`uploads/${nazevSouboru}`, soubor, {
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

/** Smaže soubor z Blob nebo lokálního úložiště */
export async function smazatSoubor(cestaSouboru: string): Promise<void> {
  if (cestaSouboru.startsWith("http://") || cestaSouboru.startsWith("https://")) {
    await del(cestaSouboru);
    return;
  }

  const cesta = path.join(UPLOADS_ADRESAR, cestaSouboru);
  if (fs.existsSync(cesta)) {
    fs.unlinkSync(cesta);
  }
}
