/**
 * Regrese: admin Výhled — série × jednotlivé z Redakčního pořadí (Blob model).
 * Spuštění: npx tsx scripts/verify-brana-admin-vyhled-serie.ts
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import type { BranaKonkretniUdalost } from "../src/lib/brana/admin/konkretni-udalost";
import {
  formatujDatumVyhled,
  projektujAdminVyhledSouhrnyPodleRoku,
  projektujKalendarDny,
  projektujVyhledPodleRoku,
} from "../src/lib/brana/admin/konkretni-udalost";
import {
  vychoziVyhledSerieProId,
  vytvoritVychoziRedakcniPoradi,
} from "../src/lib/brana/admin/redakcni-kostra";
import {
  sloucitUlozeneSKostrou,
  validovatRedakcniPoradiVstup,
} from "../src/lib/brana/admin/redakcni-poradi-validace";

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
const TRHY_ID = "trhy";
const VYLOV_ROZMBERK_ID = "vylov-rozmberka";

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

function trh(args: {
  id: string;
  rozliseni: string;
  datumOd: string;
  datumDo?: string;
}): BranaKonkretniUdalost {
  return udalost({
    id: args.id,
    redakcniPolozkaId: TRHY_ID,
    datumOd: args.datumOd,
    datumDo: args.datumDo ?? args.datumOd,
    cas: "",
    nazev: args.rozliseni,
    mistoNeboTyp: `Trh ${args.rozliseni}`,
    verejneCo: "Trh",
    verejneRozliseni: args.rozliseni,
    stavSchvaleni: "CEKA_NA_SCHVALENI",
  });
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

/** Současných 7 produkčních CEKA Trhů (projekční fixture, ne Blob). */
const TRHY_7_CEKA: BranaKonkretniUdalost[] = [
  trh({ id: "t1", rozliseni: "Letní tečka", datumOd: "2026-08-29" }),
  trh({ id: "t2", rozliseni: "Vinobraní", datumOd: "2026-09-05" }),
  trh({
    id: "t3",
    rozliseni: "Svatováclavské slavnosti",
    datumOd: "2026-09-26",
  }),
  trh({
    id: "t4",
    rozliseni: "Svatomartinské slavnosti",
    datumOd: "2026-11-07",
  }),
  trh({ id: "t5", rozliseni: "Třeboň plná andělů", datumOd: "2026-11-28" }),
  trh({ id: "t6", rozliseni: "Adventní", datumOd: "2026-12-12" }),
  trh({ id: "t7", rozliseni: "Adventní", datumOd: "2026-12-19" }),
];

function maVyhledAno(id: string): boolean {
  return (
    id === NOCTURNA_ID ||
    id === JINA_ID ||
    id === TRHY_ID ||
    id === VYLOV_ROZMBERK_ID
  );
}

/** Simulace uloženého Redakčního pořadí (projekční mapa, ne Blob PUT). */
function maVyhledSeriiZMapy(
  mapa: ReadonlyMap<string, boolean>,
): (id: string) => boolean {
  return (id) => mapa.get(id) !== false;
}

const SERIE_NOCTURNA_TRHY_JEDNOTLIVE = new Map<string, boolean>([
  [NOCTURNA_ID, true],
  [TRHY_ID, false],
  [JINA_ID, true],
  [VYLOV_ROZMBERK_ID, true],
]);

function radekVyhledu(souhrn: {
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
  mistoNeboTyp: string;
  nazev: string;
  datumOd: string;
  datumDo: string;
}): string {
  const r = rozlozAkci({
    mistoNeboTyp: souhrn.mistoNeboTyp,
    nazev: souhrn.nazev,
    cas: "",
    ...(souhrn.verejneCo !== undefined
      ? {
          verejneCo: souhrn.verejneCo,
          verejneRozliseni: souhrn.verejneRozliseni ?? null,
        }
      : {}),
  });
  const text = r.misto
    ? `${r.typ}${r.oddelovacPredMistem}${r.misto}`
    : r.typ;
  return `${text} — ${formatujDatumVyhled(souhrn)}`;
}

function overSeedAStaryBlob(): void {
  assert(vychoziVyhledSerieProId(TRHY_ID) === false, "seed trhy: false");
  assert(vychoziVyhledSerieProId(NOCTURNA_ID) === true, "seed nocturna: true");
  assert(vychoziVyhledSerieProId("neznama-polozka") === true, "neznámé → true");

  const seed = vytvoritVychoziRedakcniPoradi();
  const trhySeed = seed.find((p) => p.id === TRHY_ID);
  const nocturnaSeed = seed.find((p) => p.id === NOCTURNA_ID);
  assert(trhySeed?.vyhledSerie === false, "nový seed trhy = jednotlivé");
  assert(nocturnaSeed?.vyhledSerie === true, "nový seed nocturna = série");

  const bezPole = seed.map(({ vyhledSerie: _v, ...rest }) => rest);
  const legacy = validovatRedakcniPoradiVstup(bezPole, { legacyVyhled: true });
  assert(legacy.ok, `legacy validace: ${legacy.ok ? "" : legacy.chyba}`);
  if (!legacy.ok) {
    return;
  }
  const trhyLegacy = legacy.polozky.find((p) => p.id === TRHY_ID);
  const nocturnaLegacy = legacy.polozky.find((p) => p.id === NOCTURNA_ID);
  assert(
    trhyLegacy?.vyhledSerie === true,
    "starý Blob bez pole → trhy = Série",
  );
  assert(
    nocturnaLegacy?.vyhledSerie === true,
    "starý Blob bez pole → nocturna = Série",
  );

  const slouceni = sloucitUlozeneSKostrou({ polozky: bezPole });
  assert(
    slouceni.find((p) => p.id === TRHY_ID)?.vyhledSerie === true,
    "sloučit starý Blob → trhy Série",
  );
  console.log("OK seed + starý Blob bez vyhledSerie → Série");
}

function overUlozeniVyhledSerie(): void {
  const base = vytvoritVychoziRedakcniPoradi().map((p) =>
    p.id === TRHY_ID ? { ...p, vyhledSerie: false } : p,
  );
  const save = validovatRedakcniPoradiVstup(base);
  assert(save.ok, `save validace: ${save.ok ? "" : save.chyba}`);
  if (!save.ok) {
    return;
  }
  assert(
    save.polozky.find((p) => p.id === TRHY_ID)?.vyhledSerie === false,
    "uložení zachová jednotlivé u trhů",
  );
  assert(
    save.polozky.find((p) => p.id === NOCTURNA_ID)?.vyhledSerie === true,
    "uložení zachová sérii u nocturny",
  );

  const znovu = validovatRedakcniPoradiVstup(save.polozky, {
    legacyVyhled: true,
  });
  assert(znovu.ok, "reload validace");
  if (!znovu.ok) {
    return;
  }
  assert(
    znovu.polozky.find((p) => p.id === TRHY_ID)?.vyhledSerie === false,
    "po obnovení drží jednotlivé",
  );
  console.log("OK model/save round-trip vyhledSerie");
}

function overSestNocturnaJednohoRoku(): void {
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku(
    NOCTURNA_2026,
    maVyhledAno,
    maVyhledSeriiZMapy(SERIE_NOCTURNA_TRHY_JEDNOTLIVE),
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
    maVyhledSeriiZMapy(SERIE_NOCTURNA_TRHY_JEDNOTLIVE),
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
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku(
    [u],
    maVyhledAno,
    maVyhledSeriiZMapy(SERIE_NOCTURNA_TRHY_JEDNOTLIVE),
  );
  assert(souhrny[0].souhrny.length === 1, "1 řádek");
  const s = souhrny[0].souhrny[0];
  assert(s.nazev === "Film X", "jedna událost zachová název");
  assert(
    formatujDatumVyhled(s) === "1.11.",
    `jedno datum, je ${formatujDatumVyhled(s)}`,
  );
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
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku(
    [u],
    maVyhledAno,
    maVyhledSeriiZMapy(SERIE_NOCTURNA_TRHY_JEDNOTLIVE),
  );
  const s = souhrny[0].souhrny[0];
  assert(s.datumOd === "2026-11-14" && s.datumDo === "2026-11-18", "rozsah");
  assert(s.nazev === "Festival", "název zachován");
  assert(
    formatujDatumVyhled(s) === "14.11.–18.11.",
    `rozsah formát, je ${formatujDatumVyhled(s)}`,
  );
  console.log("OK jedna vícedenní → její skutečný rozsah");
}

function overTrhySedmSamostatnych(): void {
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku(
    TRHY_7_CEKA,
    maVyhledAno,
    maVyhledSeriiZMapy(SERIE_NOCTURNA_TRHY_JEDNOTLIVE),
  );
  assert(souhrny.length === 1 && souhrny[0].rok === 2026, "rok 2026");
  assert(souhrny[0].souhrny.length === 7, "7 samostatných řádků");

  const ocekavane = [
    "Trh · Letní tečka — 29.8.",
    "Trh · Vinobraní — 5.9.",
    "Trh · Svatováclavské slavnosti — 26.9.",
    "Trh · Svatomartinské slavnosti — 7.11.",
    "Trh · Třeboň plná andělů — 28.11.",
    "Trh · Adventní — 12.12.",
    "Trh · Adventní — 19.12.",
  ];
  const skutecne = souhrny[0].souhrny.map(radekVyhledu);
  assert(
    JSON.stringify(skutecne) === JSON.stringify(ocekavane),
    `řádky:\n${skutecne.join("\n")}`,
  );

  const adventni = souhrny[0].souhrny.filter(
    (s) => s.verejneRozliseni === "Adventní",
  );
  assert(adventni.length === 2, "2× Adventní");
  assert(
    adventni[0].datumOd === "2026-12-12" &&
      adventni[1].datumOd === "2026-12-19",
    "Adventní nesloučeny",
  );
  console.log("OK 7 Trhů = 7 řádků; Adventní 2 samostatně");
}

function overTrhyStaryBlobStaleSerie(): void {
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku(
    TRHY_7_CEKA,
    maVyhledAno,
    () => true,
  );
  assert(souhrny[0].souhrny.length === 1, "bez pole / Série → 1 souhrn");
  assert(
    souhrny[0].souhrny[0].datumOd === "2026-08-29" &&
      souhrny[0].souhrny[0].datumDo === "2026-12-19",
    "agregovaný rozsah Trhů",
  );
  console.log("OK starý Blob (Série) → Trhy stále 1 souhrn");
}

function overMintVicedenniJedenZaznam(): void {
  const budouci = trh({
    id: "mint-bud",
    rozliseni: "MINT Market",
    datumOd: "2026-09-27",
    datumDo: "2026-09-28",
  });
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku(
    [budouci],
    maVyhledAno,
    maVyhledSeriiZMapy(SERIE_NOCTURNA_TRHY_JEDNOTLIVE),
  );
  assert(souhrny[0].souhrny.length === 1, "MINT = 1 řádek");
  const s = souhrny[0].souhrny[0];
  assert(s.datumOd === "2026-09-27" && s.datumDo === "2026-09-28", "OD–DO");
  assert(
    radekVyhledu(s) === "Trh · MINT Market — 27.9.–28.9.",
    `MINT řádek: ${radekVyhledu(s)}`,
  );
  console.log("OK MINT jeden vícedenní záznam = 1 řádek s rozsahem");
}

function overVylovRozmberkBezeZmeny(): void {
  const u = udalost({
    id: "vr1",
    redakcniPolozkaId: VYLOV_ROZMBERK_ID,
    datumOd: "2026-10-16",
    datumDo: "2026-10-18",
    cas: "",
    nazev: "Výlov Rožmberk",
    mistoNeboTyp: "Výlov Rožmberk",
    verejneCo: "Výlov",
    verejneRozliseni: "Rožmberk",
  });
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku(
    [u],
    maVyhledAno,
    maVyhledSeriiZMapy(SERIE_NOCTURNA_TRHY_JEDNOTLIVE),
  );
  assert(souhrny[0].souhrny.length === 1, "1 výlov");
  assert(
    formatujDatumVyhled(souhrny[0].souhrny[0]) === "16.10.–18.10.",
    "rozsah výlovu",
  );
  console.log("OK Výlov Rožmberk beze změny");
}

function overKalendarNeseskupuje(): void {
  const vse = [...NOCTURNA_2026, ...NOCTURNA_2027, ...TRHY_7_CEKA];
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
  assert(
    pocetJednotlivych === 8 + 7,
    `projektujVyhledPodleRoku stále jednotlivé, je ${pocetJednotlivych}`,
  );
  console.log("OK kalendář + projektujVyhledPodleRoku = jednotlivé události");
}

function sha256Souboru(rel: string): string {
  const buf = readFileSync(resolve(process.cwd(), rel));
  return createHash("sha256").update(buf).digest("hex");
}

/** Veřejná projekce musí zůstat bez agregace sérií. */
const CHRANENE_SOUBORY = [
  "src/lib/brana/verejne-schvalene-pohledy.ts",
] as const;

function overVerejnaBranaNedotcena(): void {
  for (const rel of CHRANENE_SOUBORY) {
    const hash = sha256Souboru(rel);
    assert(hash.length === 64, `${rel}: hash`);
    console.log(`OK chráněný soubor čitelný: ${rel}`);
  }
}

overSeedAStaryBlob();
overUlozeniVyhledSerie();
overSestNocturnaJednohoRoku();
overDvaRokySamostatne();
overJednodenni();
overVicedenniJednu();
overTrhySedmSamostatnych();
overTrhyStaryBlobStaleSerie();
overMintVicedenniJedenZaznam();
overVylovRozmberkBezeZmeny();
overKalendarNeseskupuje();
overVerejnaBranaNedotcena();
console.log("VŠE OK — admin Výhled série z Redakčního pořadí");
