/**
 * Přidá ukázkovou fotografii do JSON úložiště.
 * Spuštění: npm run seed
 */
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const koren = join(__dirname, "..");
const cestaDat = join(koren, "data", "uloziste.json");

const prazdnaData = { polozky: [], metriky: [], pushOdbery: [] };

if (!existsSync(join(koren, "data"))) {
  mkdirSync(join(koren, "data"), { recursive: true });
}

let data = prazdnaData;
if (existsSync(cestaDat)) {
  data = JSON.parse(readFileSync(cestaDat, "utf-8"));
}

if (data.polozky.length > 0) {
  console.log("Úložiště již obsahuje položky, seed přeskočen.");
  process.exit(0);
}

const now = new Date().toISOString();
data.polozky.push({
  id: randomUUID(),
  typ: "fotografie",
  soubor: "vzorova-fotografie.svg",
  popis: "podvečer na hrázi rybníka Svět",
  datumPorizeni: now,
  datumPublikace: now,
  poradi: 0,
  aktivni: true,
});

writeFileSync(cestaDat, JSON.stringify(data, null, 2), "utf-8");
console.log("Ukázková fotografie přidána.");
