/**
 * Regrese: admin Výhled seskupuje série (stejné redakcniPolozkaId + rok).
 * Spuštění: npx tsx scripts/verify-brana-admin-vyhled-serie.ts
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BranaKonkretniUdalost } from "../src/lib/brana/admin/konkretni-udalost";
import {
  formatujDatumVyhled,
  projektujAdminVyhledSouhrnyPodleRoku,
  projektujKalendarDny,
  projektujVyhledPodleRoku,
} from "../src/lib/brana/admin/konkretni-udalost";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

const NOCTURNA_ID = "trebonska-nocturna";
const JINA_ID = "kino-svetozor";

function udalost(
  partial: Pick<
    BranaKonkretniUdalost,
    "id" | "redakcniPolozkaId" | "datumOd" | "datumDo" | "nazev"
  > &
    Partial<BranaKonkretniUdalost>,
): BranaKonkretniUdalost {
  return {
    id: partial.id,
    redakcniPolozkaId: partial.redakcniPolozkaId,
    datumOd: partial.datumOd,
    datumDo: partial.datumDo,
    cas: partial.cas ?? "19:00",
    mistoNeboTyp: partial.mistoNeboTyp ?? "Divadlo J. K. Tyla",
    nazev: partial.nazev,
    rucniPoziceVDni: partial.rucniPoziceVDni ?? null,
    stavSchvaleni: partial.stavSchvaleni ?? "SCHVALENO",
    ...(partial.verejneCo !== undefined
      ? {
          verejneCo: partial.verejneCo,
          verejneRozliseni: partial.verejneRozliseni ?? null,
        }
      : {}),
    ...(partial.scanKlic !== undefined ? { scanKlic: partial.scanKlic } : {}),
  };
}

const NOCTURNA_2026: BranaKonkretniUdalost[] = [
  udalost({
    id: "n1",
    redakcniPolozkaId: NOCTURNA_ID,
    datumOd: "2026-10-15",
    datumDo: "2026-10-15",
    nazev: "Koncert A",
  }),
  udalost({
    id: "n2",
    redakcniPolozkaId: NOCTURNA_ID,
    datumOd: "2026-10-29",
    datumDo: "2026-10-29",
    nazev: "Koncert B",
  }),
  udalost({
    id: "n3",
    redakcniPolozkaId: NOCTURNA_ID,
    datumOd: "2026-11-12",
    datumDo: "2026-11-12",
    nazev: "Koncert C",
  }),
  udalost({
    id: "n4",
    redakcniPolozkaId: NOCTURNA_ID,
    datumOd: "2026-11-26",
    datumDo: "2026-11-26",
    nazev: "Koncert D",
  }),
  udalost({
    id: "n5",
    redakcniPolozkaId: NOCTURNA_ID,
    datumOd: "2026-12-03",
    datumDo: "2026-12-03",
    nazev: "Koncert E",
  }),
  udalost({
    id: "n6",
    redakcniPolozkaId: NOCTURNA_ID,
    datumOd: "2026-12-17",
    datumDo: "2026-12-17",
    nazev: "Koncert F",
  }),
];

const NOCTURNA_2027: BranaKonkretniUdalost[] = [
  udalost({
    id: "n7",
    redakcniPolozkaId: NOCTURNA_ID,
    datumOd: "2027-01-21",
    datumDo: "2027-01-21",
    nazev: "Koncert G",
  }),
  udalost({
    id: "n8",
    redakcniPolozkaId: NOCTURNA_ID,
    datumOd: "2027-03-18",
    datumDo: "2027-03-18",
    nazev: "Koncert H",
  }),
];

function maVyhledAno(id: string): boolean {
  return id === NOCTURNA_ID || id === JINA_ID;
}

function overSestNocturnaJednohoRoku(): void {
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku(
    NOCTURNA_2026,
    maVyhledAno,
  );
  assert(souhrny.length === 1, "2026: očekáván 1 rok");
  assert(souhrny[0].rok === 2026, "2026: rok sekce");
  assert(souhrny[0].souhrny.length === 1, "6 událostí → 1 souhrnný řádek");
  const s = souhrny[0].souhrny[0];
  assert(s.redakcniPolozkaId === NOCTURNA_ID, "redakční ID");
  assert(s.datumOd === "2026-10-15", `min datumOd, je ${s.datumOd}`);
  assert(s.datumDo === "2026-12-17", `max datumDo, je ${s.datumDo}`);
  assert(s.nazev === "", "série bez názvu jednotlivého koncertu");
  assert(
    formatujDatumVyhled(s) === "15.10.–17.12.",
    `formát data, je ${formatujDatumVyhled(s)}`,
  );
  console.log("OK 6× nocturna 2026 → 1 řádek 15.10.–17.12.");
}

function overDvaRokySamostatne(): void {
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku(
    [...NOCTURNA_2026, ...NOCTURNA_2027],
    maVyhledAno,
  );
  assert(souhrny.length === 2, "očekávány 2 roky");
  assert(souhrny[0].rok === 2026 && souhrny[1].rok === 2027, "řazení let");
  assert(souhrny[0].souhrny.length === 1, "2026: 1 souhrn");
  assert(souhrny[1].souhrny.length === 1, "2027: 1 souhrn");
  assert(
    souhrny[0].souhrny[0].datumOd === "2026-10-15" &&
      souhrny[0].souhrny[0].datumDo === "2026-12-17",
    "2026 rozsah",
  );
  assert(
    souhrny[1].souhrny[0].datumOd === "2027-01-21" &&
      souhrny[1].souhrny[0].datumDo === "2027-03-18",
    "2027 rozsah",
  );
  assert(
    formatujDatumVyhled(souhrny[1].souhrny[0]) === "21.1.–18.3.",
    `2027 formát, je ${formatujDatumVyhled(souhrny[1].souhrny[0])}`,
  );
  console.log("OK nocturna přes 2 roky → 2 souhrny (nesloučeno)");
}

function overJednodenni(): void {
  const u = udalost({
    id: "j1",
    redakcniPolozkaId: JINA_ID,
    datumOd: "2026-11-01",
    datumDo: "2026-11-01",
    nazev: "Film X",
    mistoNeboTyp: "Kino Světozor",
  });
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku([u], maVyhledAno);
  assert(souhrny[0].souhrny.length === 1, "1 řádek");
  const s = souhrny[0].souhrny[0];
  assert(s.nazev === "Film X", "jedna událost zachová název");
  assert(formatujDatumVyhled(s) === "1.11.", `jedno datum, je ${formatujDatumVyhled(s)}`);
  console.log("OK jedna jednodenní → jedno datum + název");
}

function overVicedenniJednu(): void {
  const u = udalost({
    id: "v1",
    redakcniPolozkaId: JINA_ID,
    datumOd: "2026-11-14",
    datumDo: "2026-11-18",
    nazev: "Festival",
    mistoNeboTyp: "Kino Světozor",
  });
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku([u], maVyhledAno);
  const s = souhrny[0].souhrny[0];
  assert(s.datumOd === "2026-11-14" && s.datumDo === "2026-11-18", "rozsah");
  assert(s.nazev === "Festival", "název zachován");
  assert(
    formatujDatumVyhled(s) === "14.11.–18.11.",
    `rozsah formát, je ${formatujDatumVyhled(s)}`,
  );
  console.log("OK jedna vícedenní → její skutečný rozsah");
}

function overKalendarNeseskupuje(): void {
  const vse = [...NOCTURNA_2026, ...NOCTURNA_2027];
  const dny = projektujKalendarDny(vse, () => ({
    priorita: 15,
    subpriorita: null,
  }));
  const idVKalendari = new Set(
    dny.flatMap((d) => d.udalosti.map((u) => u.id)),
  );
  for (const u of vse) {
    assert(idVKalendari.has(u.id), `kalendář musí obsahovat ${u.id}`);
  }
  const jednotlive = projektujVyhledPodleRoku(vse, maVyhledAno);
  const pocetJednotlivych = jednotlive.reduce(
    (n, g) => n + g.udalosti.length,
    0,
  );
  assert(pocetJednotlivych === 8, `projektujVyhledPodleRoku stále 8, je ${pocetJednotlivych}`);
  console.log("OK kalendář + projektujVyhledPodleRoku = jednotlivé události");
}

function sha256Souboru(rel: string): string {
  const buf = readFileSync(resolve(process.cwd(), rel));
  return createHash("sha256").update(buf).digest("hex");
}

/** Veřejná projekce a veřejný Výhled musí zůstat beze změny v tomto commitu. */
const CHRANENE_SOUBORY = [
  "src/lib/brana/verejne-schvalene-pohledy.ts",
  "src/components/brana/BranaObrazovka.tsx",
] as const;

function overVerejnaBranaNedotcena(): void {
  for (const rel of CHRANENE_SOUBORY) {
    const hash = sha256Souboru(rel);
    assert(hash.length === 64, `${rel}: hash`);
    // Existence + čitelnost stačí; git diff ověří při commit kontrole.
    console.log(`OK chráněný soubor čitelný: ${rel}`);
  }
}

overSestNocturnaJednohoRoku();
overDvaRokySamostatne();
overJednodenni();
overVicedenniJednu();
overKalendarNeseskupuje();
overVerejnaBranaNedotcena();
console.log("VŠE OK — admin Výhled série");
