/**
 * Přidá ladící prolnutí (adventní → Vánoční náměstí) do lokálního úložiště.
 * Spuštění: npm run seed:prolnuti
 *
 * Položka je ve výchozím stavu skrytá (aktivni: false) – zobrazte v adminu až po ladění.
 */
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const koren = join(__dirname, "..");
const cestaDat = join(koren, "data", "uloziste.json");

/** Ladící pár – stejné jako src/lib/prolnuti-ladici-par.ts */
const LADICI_PAR = {
  popis: "náměstí",
  souborA:
    "https://8l4cdejsxuet11aj.public.blob.vercel-storage.com/uploads/4ee1ce2d-58ac-4e77-8ca7-a85115d0627a.jpg",
  souborB:
    "https://8l4cdejsxuet11aj.public.blob.vercel-storage.com/uploads/bf48d6a7-a836-4334-8116-31c5a04dabf2.jpg",
};

const prazdnaData = { polozky: [], metriky: [], pushOdbery: [] };

if (!existsSync(join(koren, "data"))) {
  mkdirSync(join(koren, "data"), { recursive: true });
}

let data = prazdnaData;
if (existsSync(cestaDat)) {
  data = JSON.parse(readFileSync(cestaDat, "utf-8"));
}

const existuje = data.polozky.some(
  (p) =>
    p.typ === "prolnuti" &&
    p.soubory?.[0] === LADICI_PAR.souborA &&
    p.soubory?.[1] === LADICI_PAR.souborB
);

if (existuje) {
  console.log("Ladící prolnutí už v úložišti je, seed přeskočen.");
  process.exit(0);
}

const minPoradi = data.polozky.reduce(
  (min, p) => Math.min(min, p.poradi ?? 0),
  Infinity
);
const now = new Date().toISOString();

data.polozky.push({
  id: randomUUID(),
  typ: "prolnuti",
  soubory: [LADICI_PAR.souborA, LADICI_PAR.souborB],
  popis: LADICI_PAR.popis,
  datumPorizeni: null,
  datumPublikace: now,
  poradi: minPoradi === Infinity ? 0 : minPoradi - 1,
  aktivni: false,
});

writeFileSync(cestaDat, JSON.stringify(data, null, 2), "utf-8");
console.log("Ladící prolnutí přidáno (skryté). Zobrazte v administraci po kontrole.");
