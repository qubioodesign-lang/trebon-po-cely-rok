/**
 * Vytvoří prázdné JSON úložiště v data/uloziste.json.
 * Spuštění: npm run db:init
 */
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const koren = join(__dirname, "..");
const cestaDat = join(koren, "data", "uloziste.json");

const prazdnaData = {
  polozky: [],
  metriky: [],
  pushOdbery: [],
};

if (!existsSync(join(koren, "data"))) {
  mkdirSync(join(koren, "data"), { recursive: true });
}

if (existsSync(cestaDat)) {
  console.log("Úložiště již existuje:", cestaDat);
} else {
  writeFileSync(cestaDat, JSON.stringify(prazdnaData, null, 2), "utf-8");
  console.log("Úložiště vytvořeno:", cestaDat);
}
