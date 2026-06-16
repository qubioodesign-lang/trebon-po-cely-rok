import path from "path";
import fs from "fs";

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
 * Uloží nahraný soubor do /public/uploads.
 * Vrací název souboru (bez cesty).
 */
export async function ulozitSoubor(
  soubor: File
): Promise<{ nazevSouboru: string; typ: "fotografie" | "video" }> {
  const mimeTyp = soubor.type;
  const pripona = POVOLENE_TYPY[mimeTyp];

  if (!pripona) {
    throw new Error(`Nepodporovaný typ souboru: ${mimeTyp}`);
  }

  if (!fs.existsSync(UPLOADS_ADRESAR)) {
    fs.mkdirSync(UPLOADS_ADRESAR, { recursive: true });
  }

  const nazevSouboru = `${crypto.randomUUID()}${pripona}`;
  const cesta = path.join(UPLOADS_ADRESAR, nazevSouboru);

  const buffer = Buffer.from(await soubor.arrayBuffer());
  fs.writeFileSync(cesta, buffer);

  const jeVideo = mimeTyp.startsWith("video/");
  return {
    nazevSouboru,
    typ: jeVideo ? "video" : "fotografie",
  };
}

/** Smaže soubor z uploads adresáře */
export function smazatSoubor(nazevSouboru: string): void {
  const cesta = path.join(UPLOADS_ADRESAR, nazevSouboru);
  if (fs.existsSync(cesta)) {
    fs.unlinkSync(cesta);
  }
}
