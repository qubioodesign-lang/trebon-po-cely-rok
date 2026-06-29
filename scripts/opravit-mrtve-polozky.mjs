/**
 * Opraví položky s mrtvou Blob URL – nahraje soubor a aktualizuje metadata.
 *
 * Použití:
 *   node scripts/opravit-mrtve-polozky.mjs --soubor cesta/k/foto.jpg --id <uuid>
 *   node scripts/opravit-mrtve-polozky.mjs --soubor cesta/k/foto.jpg --popis "pozor klouže"
 *
 * Vyžaduje BLOB_READ_WRITE_TOKEN (.env.local nebo proměnná prostředí).
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { get, put, list } from "@vercel/blob";

const __dirname = dirname(fileURLToPath(import.meta.url));
const koren = join(__dirname, "..");
const BLOB_CESTA_METADATA = "data/uloziste.json";

const POLOZKY_K_OPRAVE = [
  { id: "a8e79827-d0a6-4609-8467-d05a6421c71c", popis: "pozor klouže" },
  { id: "01bdcd17-c4db-4bde-b69f-550ff93bec04", popis: "lázně" },
];

function nacistEnv() {
  for (const soubor of [".env.local", ".env"]) {
    const cesta = join(koren, soubor);
    if (!existsSync(cesta)) continue;
    for (const line of readFileSync(cesta, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const klic = trimmed.slice(0, eq).trim();
    let hodnota = trimmed.slice(eq + 1).trim();
    if (
      (hodnota.startsWith('"') && hodnota.endsWith('"')) ||
      (hodnota.startsWith("'") && hodnota.endsWith("'"))
    ) {
      hodnota = hodnota.slice(1, -1);
    }
    if (!process.env[klic]) process.env[klic] = hodnota;
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const volby = { soubor: null, id: null, popis: null, vypsatSirotci: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--soubor") volby.soubor = args[++i];
    else if (args[i] === "--id") volby.id = args[++i];
    else if (args[i] === "--popis") volby.popis = args[++i];
    else if (args[i] === "--sirotci") volby.vypsatSirotci = true;
  }
  return volby;
}

async function head(url) {
  const res = await fetch(url, { method: "HEAD" });
  return res.status;
}

async function nacistMetadata(token) {
  const vysledek = await get(BLOB_CESTA_METADATA, { token, access: "public" });
  if (!vysledek?.stream) throw new Error("Metadata nejsou k dispozici");
  const text = await new Response(vysledek.stream).text();
  return JSON.parse(text);
}

async function ulozitMetadata(data, token) {
  await put(BLOB_CESTA_METADATA, JSON.stringify(data, null, 2), {
    token,
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function vypsatSirotci(token, data) {
  const pouzite = new Set(data.polozky.map((p) => p.soubor));
  const { blobs } = await list({ prefix: "uploads/", token });
  const sirotci = blobs.filter((b) => !pouzite.has(b.url));
  console.log(`Sirotčí bloby (${sirotci.length}):`);
  for (const b of sirotci) {
    console.log(`  ${b.url}  (${b.uploadedAt})`);
  }
}

async function nahratSoubor(cestaSouboru, token) {
  const buffer = readFileSync(cestaSouboru);
  const pripona = cestaSouboru.toLowerCase().endsWith(".png")
    ? ".png"
    : cestaSouboru.toLowerCase().endsWith(".webp")
      ? ".webp"
      : ".jpg";
  const mimeTyp =
    pripona === ".png"
      ? "image/png"
      : pripona === ".webp"
        ? "image/webp"
        : "image/jpeg";
  const nazev = `${randomUUID()}${pripona}`;
  const blob = await put(`uploads/${nazev}`, buffer, {
    token,
    access: "public",
    addRandomSuffix: false,
    contentType: mimeTyp,
  });
  return blob.url;
}

async function opravitPolozku(data, polozka, novaUrl, token) {
  const index = data.polozky.findIndex((p) => p.id === polozka.id);
  if (index === -1) throw new Error(`Položka ${polozka.id} nenalezena`);
  data.polozky[index].soubor = novaUrl;
  data.verzeUloziste = (data.verzeUloziste ?? 0) + 1;
  await ulozitMetadata(data, token);

  const kontrola = await nacistMetadata(token);
  const overena = kontrola.polozky.find((p) => p.id === polozka.id);
  if (overena?.soubor !== novaUrl) {
    throw new Error(`Verifikace selhala pro ${polozka.popis}`);
  }

  const status = await head(novaUrl);
  console.log(`✓ ${polozka.popis}: ${novaUrl} (HTTP ${status})`);
  return status;
}

async function main() {
  nacistEnv();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("Chybí BLOB_READ_WRITE_TOKEN (.env.local nebo env).");
    process.exit(1);
  }

  const volby = parseArgs();
  const data = await nacistMetadata(token);

  if (volby.vypsatSirotci) {
    await vypsatSirotci(token, data);
    return;
  }

  let cilove = POLOZKY_K_OPRAVE;
  if (volby.id) {
    cilove = cilove.filter((p) => p.id === volby.id);
  } else if (volby.popis) {
    cilove = cilove.filter((p) => p.popis === volby.popis);
  }

  const mrtve = [];
  for (const polozka of cilove) {
    const vMeta = data.polozky.find((p) => p.id === polozka.id);
    if (!vMeta) {
      console.warn(`Přeskočeno – ${polozka.popis} není v metadatech`);
      continue;
    }
    const status = await head(vMeta.soubor);
    if (status === 200) {
      console.log(`OK ${polozka.popis}: ${vMeta.soubor}`);
      continue;
    }
    mrtve.push({ ...polozka, staraUrl: vMeta.soubor });
  }

  if (mrtve.length === 0) {
    console.log("Žádné mrtvé položky k opravě.");
    return;
  }

  if (!volby.soubor) {
    console.error(
      "Mrtvé položky nalezeny. Zadejte --soubor s JPEG/PNG pro opravu, nebo --sirotci pro výpis sirotčích blobů."
    );
    for (const p of mrtve) {
      console.error(`  ${p.popis} (${p.id}): ${p.staraUrl} → 404`);
    }
    process.exit(1);
  }

  if (!existsSync(volby.soubor)) {
    console.error(`Soubor neexistuje: ${volby.soubor}`);
    process.exit(1);
  }

  for (const polozka of mrtve) {
    const novaUrl = await nahratSoubor(volby.soubor, token);
    await opravitPolozku(data, polozka, novaUrl, token);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
