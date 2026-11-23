/**
 * Regrese: admin Výhled — série × jednotlivé z Redakčního pořadí (Blob model).
 * Spuštění: npx tsx scripts/verify-brana-admin-vyhled-serie.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import type { BranaKonkretniUdalost } from "../src/lib/brana/admin/konkretni-udalost";
import {
  formatujDatumVyhled,
  projektujKalendarDny,
  rokUdalosti,
  seskupVyhledUdalostiRokuNaSouhrny,
  type BranaAdminVyhledRokSkupina,
  type BranaAdminVyhledSouhrn,
} from "../src/lib/brana/admin/konkretni-udalost";
import { maDatumOdPatritDoVyhledu } from "../src/lib/brana/admin/obdobi-7-dni";
import {
  vychoziVyhledSerieProId,
  vytvoritVychoziRedakcniPoradi,
} from "../src/lib/brana/admin/redakcni-kostra";
import { maUkazkovyVyhledAno } from "../src/lib/brana/admin/ukazkove-udalosti";
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
  trh({ id: "t1", rozliseni: "Letní tečka", datumOd: "2026-09-12" }),
  trh({ id: "t2", rozliseni: "Vinobraní", datumOd: "2026-09-19" }),
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
  const souhrny = projektujAdminVyhledKHranici(
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
  const souhrny = projektujAdminVyhledKHranici(
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
  const souhrny = projektujAdminVyhledKHranici(
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
  const souhrny = projektujAdminVyhledKHranici(
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
  const souhrny = projektujAdminVyhledKHranici(
    TRHY_7_CEKA,
    maVyhledAno,
    maVyhledSeriiZMapy(SERIE_NOCTURNA_TRHY_JEDNOTLIVE),
  );
  assert(souhrny.length === 1 && souhrny[0].rok === 2026, "rok 2026");
  assert(souhrny[0].souhrny.length === 7, "7 samostatných řádků");

  const ocekavane = [
    "Trh · Letní tečka — 12.9.",
    "Trh · Vinobraní — 19.9.",
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
  const souhrny = projektujAdminVyhledKHranici(
    TRHY_7_CEKA,
    maVyhledAno,
    () => true,
  );
  assert(souhrny[0].souhrny.length === 1, "bez pole / Série → 1 souhrn");
  assert(
    souhrny[0].souhrny[0].datumOd === "2026-09-12" &&
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
  const souhrny = projektujAdminVyhledKHranici(
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
  const souhrny = projektujAdminVyhledKHranici(
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
  const poHranici = vse.filter(
    (u) =>
      u.redakcniPolozkaId !== null &&
      maVyhledAno(u.redakcniPolozkaId) &&
      maDatumOdPatritDoVyhledu(u.datumOd, VEREJNA_HRANICE),
  );
  assert(
    poHranici.length === 8 + 7,
    `k 31. 8. 2026 patří do Výhledu všech 15, je ${poHranici.length}`,
  );
  console.log("OK kalendář drží jednotlivé události; Výhled k 31. 8. 2026 má 15");
}

/** Stejná datumová hranice jako veřejný Výhled k 31. 8. 2026. */
const VEREJNA_HRANICE = {
  dnesIso: "2026-08-31",
  sedmDniIso: [
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
    "2026-09-06",
    "2026-09-07",
  ],
} as const;
const VEREJNY_AKTUALNI_ROK = 2026;

/**
 * Admin kontroly rozsahu série používají stejný zmrazený den jako veřejný Výhled.
 * Produkční projekce čte skutečné dnešní datum a staré fixture by jinak časem vypadly.
 */
function projektujAdminVyhledKHranici(
  udalosti: readonly BranaKonkretniUdalost[],
  maVyhledAnoFn: (redakcniPolozkaId: string) => boolean,
  maVyhledSerii: (redakcniPolozkaId: string) => boolean = () => true,
): BranaAdminVyhledRokSkupina[] {
  const vybrane = udalosti.filter(
    (u) =>
      u.stavSchvaleni !== "VYRAZENO" &&
      u.redakcniPolozkaId !== null &&
      maVyhledAnoFn(u.redakcniPolozkaId) &&
      maDatumOdPatritDoVyhledu(u.datumOd, VEREJNA_HRANICE),
  );
  const podleRoku = new Map<number, BranaKonkretniUdalost[]>();
  for (const udalost of vybrane) {
    const rok = rokUdalosti(udalost);
    const seznam = podleRoku.get(rok) ?? [];
    seznam.push(udalost);
    podleRoku.set(rok, seznam);
  }
  return [...podleRoku.keys()]
    .sort((a, b) => a - b)
    .map((rok) => ({
      rok,
      souhrny: seskupVyhledUdalostiRokuNaSouhrny(
        rok,
        podleRoku.get(rok) ?? [],
        maVyhledSerii,
      ),
    }));
}

function nocturnaVerejna(
  partial: Pick<BranaKonkretniUdalost, "id" | "datumOd" | "nazev"> &
    Partial<Pick<BranaKonkretniUdalost, "stavSchvaleni" | "datumDo">>,
): BranaKonkretniUdalost {
  return udalost({
    ...partial,
    redakcniPolozkaId: NOCTURNA_ID,
    datumDo: partial.datumDo ?? partial.datumOd,
    mistoNeboTyp: "Divadlo J. K. Tyla",
    verejneCo: "Třeboňská nocturna",
    verejneRozliseni: "Divadlo J. K. Tyla",
  });
}

/**
 * Veřejný Výhled: SCHVALENO + Používat + Výhled=ANO + datumová hranice,
 * pak stejné seskupení jako Admin (`seskupVyhledUdalostiRokuNaSouhrny`).
 */
function projektujVerejnyVyhledSouhrny(
  udalosti: readonly BranaKonkretniUdalost[],
): { letosni: BranaAdminVyhledSouhrn[]; pozdejsi: BranaAdminVyhledSouhrn[] } {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const polozkyPodleId = new Map(polozky.map((p) => [p.id, p] as const));
  const maPouzivatAno = (redakcniPolozkaId: string | null): boolean => {
    if (redakcniPolozkaId === null) {
      return true;
    }
    return polozkyPodleId.get(redakcniPolozkaId)?.pouzivat === "ANO";
  };
  const maVyhledAno = (redakcniPolozkaId: string): boolean =>
    maUkazkovyVyhledAno(
      redakcniPolozkaId,
      polozkyPodleId.get(redakcniPolozkaId)?.vyhled,
    );
  const maVyhledSerii = (redakcniPolozkaId: string): boolean =>
    polozkyPodleId.get(redakcniPolozkaId)?.vyhledSerie !== false;

  const kandidati = udalosti.filter(
    (u) =>
      u.stavSchvaleni === "SCHVALENO" &&
      !u.id.startsWith("ukazka-") &&
      maPouzivatAno(u.redakcniPolozkaId),
  );
  const vyhledUdalosti = kandidati.filter((u) => {
    if (u.redakcniPolozkaId === null) {
      return false;
    }
    if (!maDatumOdPatritDoVyhledu(u.datumOd, VEREJNA_HRANICE)) {
      return false;
    }
    return maVyhledAno(u.redakcniPolozkaId);
  });

  const podleRoku = new Map<number, BranaKonkretniUdalost[]>();
  for (const udalostRoku of vyhledUdalosti) {
    const rok = rokUdalosti(udalostRoku);
    const seznam = podleRoku.get(rok) ?? [];
    seznam.push(udalostRoku);
    podleRoku.set(rok, seznam);
  }

  const souhrnyRoku = (rok: number): BranaAdminVyhledSouhrn[] =>
    seskupVyhledUdalostiRokuNaSouhrny(
      rok,
      podleRoku.get(rok) ?? [],
      maVyhledSerii,
    );

  return {
    letosni: souhrnyRoku(VEREJNY_AKTUALNI_ROK),
    pozdejsi: [...podleRoku.keys()]
      .filter((rok) => rok > VEREJNY_AKTUALNI_ROK)
      .sort((a, b) => a - b)
      .flatMap((rok) => souhrnyRoku(rok)),
  };
}

function overVerejnyVyhledSdiliSerii(): void {
  const zdroj = readFileSync(
    resolve(process.cwd(), "src/lib/brana/verejne-schvalene-pohledy.ts"),
    "utf8",
  );
  assert(
    zdroj.includes("seskupVyhledUdalostiRokuNaSouhrny") &&
      zdroj.includes("vyhledSerie !== false") &&
      zdroj.includes('u.stavSchvaleni === "SCHVALENO"') &&
      zdroj.includes("doVerejneAkceZeSouhrnu"),
    "veřejný Výhled musí sdílet seskupení série a zůstat u SCHVALENO",
  );
  console.log("OK veřejný zdroj sdílí seskupVyhledUdalostiRokuNaSouhrny");
}

function overVerejnaNocturnaJednaPolozka(): void {
  const karty = [
    nocturnaVerejna({
      id: "n1",
      datumOd: "2026-10-15",
      nazev: "Koncert A",
    }),
    nocturnaVerejna({
      id: "n2",
      datumOd: "2026-10-29",
      nazev: "Koncert B",
    }),
    nocturnaVerejna({
      id: "n3",
      datumOd: "2026-11-12",
      nazev: "Koncert C",
    }),
    nocturnaVerejna({
      id: "n4",
      datumOd: "2026-11-26",
      nazev: "Koncert D",
    }),
    nocturnaVerejna({
      id: "n5",
      datumOd: "2026-12-03",
      nazev: "Koncert E",
    }),
    nocturnaVerejna({
      id: "n6",
      datumOd: "2026-12-17",
      nazev: "Koncert F",
    }),
  ];
  const { letosni, pozdejsi } = projektujVerejnyVyhledSouhrny(karty);
  assert(pozdejsi.length === 0, "2026: žádný pozdější rok");
  assert(letosni.length === 1, `6× SCHVALENO → 1 položka, je ${letosni.length}`);
  const s = letosni[0];
  assert(s.nazev === "", "souhrn bez názvu koncertu");
  assert(
    formatujDatumVyhled(s) === "15.10.–17.12.",
    `rozsah, je ${formatujDatumVyhled(s)}`,
  );
  assert(s.verejneCo === "Třeboňská nocturna", "CO série");
  assert(s.verejneRozliseni === "Divadlo J. K. Tyla", "KDE série");
  const radek = radekVyhledu(s);
  assert(!radek.includes("Koncert"), `názvy koncertů unikly: ${radek}`);
  console.log("OK veřejný Výhled: 6× nocturna 2026 → 15.10.–17.12.");
}

function overVerejnaRokyNeslucuj(): void {
  const karty = [
    nocturnaVerejna({
      id: "n1",
      datumOd: "2026-10-15",
      nazev: "Koncert A",
    }),
    nocturnaVerejna({
      id: "n6",
      datumOd: "2026-12-17",
      nazev: "Koncert F",
    }),
    nocturnaVerejna({
      id: "n7",
      datumOd: "2027-01-21",
      nazev: "Koncert G",
    }),
    nocturnaVerejna({
      id: "n8",
      datumOd: "2027-03-18",
      nazev: "Koncert H",
    }),
  ];
  const { letosni, pozdejsi } = projektujVerejnyVyhledSouhrny(karty);
  assert(letosni.length === 2, `2026: mezera 63 dní = 2 série, je ${letosni.length}`);
  assert(pozdejsi.length === 1, "2027: 1 souhrn, nesloučeno");
  assert(formatujDatumVyhled(letosni[0]) === "15.10.", "první koncert 2026");
  assert(letosni[0].nazev === "Koncert A", "jeden koncert drží název");
  assert(formatujDatumVyhled(letosni[1]) === "17.12.", "druhý koncert 2026");
  assert(letosni[1].nazev === "Koncert F", "druhý koncert drží název");
  assert(formatujDatumVyhled(pozdejsi[0]) === "21.1.–18.3.", "2027 rozsah");
  console.log("OK veřejný Výhled: 2026 a 2027 zvlášť");
}

function overVerejneJednotliveNeslucuj(): void {
  const trhySchvaleno = TRHY_7_CEKA.map((t) => ({
    ...t,
    stavSchvaleni: "SCHVALENO" as const,
  }));
  const zahajeniA = udalost({
    id: "z1",
    redakcniPolozkaId: "zahajeni-lazenske-sezony",
    datumOd: "2026-10-01",
    datumDo: "2026-10-01",
    nazev: "Zahájení A",
    mistoNeboTyp: "Trh Zahájení lázeňské sezóny",
    verejneCo: "Trh",
    verejneRozliseni: "Zahájení lázeňské sezóny",
  });
  const zahajeniB = udalost({
    id: "z2",
    redakcniPolozkaId: "zahajeni-lazenske-sezony",
    datumOd: "2026-10-08",
    datumDo: "2026-10-08",
    nazev: "Zahájení B",
    mistoNeboTyp: "Trh Zahájení lázeňské sezóny",
    verejneCo: "Trh",
    verejneRozliseni: "Zahájení lázeňské sezóny",
  });
  const mint = trh({
    id: "mint-bud",
    rozliseni: "MINT Market",
    datumOd: "2026-09-27",
    datumDo: "2026-09-28",
  });
  mint.stavSchvaleni = "SCHVALENO";

  const { letosni } = projektujVerejnyVyhledSouhrny([
    ...trhySchvaleno,
    zahajeniA,
    zahajeniB,
    mint,
  ]);

  const trhyLetos = letosni.filter((s) => s.redakcniPolozkaId === TRHY_ID);
  assert(trhyLetos.length === 8, `7 trhů + MINT jednotlivě, je ${trhyLetos.length}`);
  const adventni = trhyLetos.filter((s) => s.verejneRozliseni === "Adventní");
  assert(
    adventni.length === 2,
    `Adventní zůstanou 2, je ${adventni.length}`,
  );
  assert(
    adventni[0].datumOd === "2026-12-12" &&
      adventni[1].datumOd === "2026-12-19",
    "Adventní nesloučeny",
  );
  const mintRadek = letosni.find((s) => s.verejneRozliseni === "MINT Market");
  assert(mintRadek !== undefined, "MINT ve Výhledu");
  assert(
    formatujDatumVyhled(mintRadek) === "27.9.–28.9.",
    `vícedenní jedna položka, je ${formatujDatumVyhled(mintRadek)}`,
  );
  assert(
    trhyLetos.filter((s) => s.verejneRozliseni === "Letní tečka").length === 1,
    "Letní tečka (12.9.) ve Výhledu jednotlivě",
  );
  assert(
    trhyLetos.filter((s) => s.verejneRozliseni === "Vinobraní").length === 1,
    "Vinobraní (19.9.) ve Výhledu jednotlivě",
  );
  const svatovaclavske = trhyLetos.filter(
    (s) => s.verejneRozliseni === "Svatováclavské slavnosti",
  );
  assert(svatovaclavske.length === 1, "Svatováclavské = 1 řádek");
  const zahajeniLetos = letosni.filter(
    (s) => s.redakcniPolozkaId === "zahajeni-lazenske-sezony",
  );
  assert(zahajeniLetos.length === 2, "zahájení = 2 jednotlivé, nesloučeny");
  assert(
    zahajeniLetos[0].datumOd === "2026-10-01" &&
      zahajeniLetos[1].datumOd === "2026-10-08",
    "zahájení pořadí datumů",
  );
  assert(zahajeniLetos[0].nazev === "Zahájení A", "jednotlivé drží název");
  console.log("OK veřejný Výhled: trhy/adventní/MINT/zahájení jednotlivě");
}

function overVerejneCekaAVyrazenoMimo(): void {
  const schvalene = [
    nocturnaVerejna({
      id: "n1",
      datumOd: "2026-10-15",
      nazev: "Koncert A",
    }),
    nocturnaVerejna({
      id: "n6",
      datumOd: "2026-12-17",
      nazev: "Koncert F",
    }),
  ];
  const ceka = nocturnaVerejna({
    id: "n-ceka",
    datumOd: "2026-12-20",
    nazev: "Koncert CEKA",
    stavSchvaleni: "CEKA_NA_SCHVALENI",
  });
  const vyrazeno = nocturnaVerejna({
    id: "n-vyraz",
    datumOd: "2026-12-24",
    nazev: "Koncert VYRAZENO",
    stavSchvaleni: "VYRAZENO",
  });
  const trhCeka = trh({
    id: "t-ceka",
    rozliseni: "Tajný trh",
    datumOd: "2026-10-10",
  });

  const { letosni, pozdejsi } = projektujVerejnyVyhledSouhrny([
    ...schvalene,
    ceka,
    vyrazeno,
    trhCeka,
  ]);
  assert(pozdejsi.length === 0, "jen 2026");
  assert(letosni.length === 2, "CEKA/VYRAZENO nenačtou další řádek");
  assert(
    formatujDatumVyhled(letosni[0]) === "15.10." &&
      formatujDatumVyhled(letosni[1]) === "17.12.",
    `CEKA/VYRAZENO nesmí prodloužit rozsah, je ${letosni.map(formatujDatumVyhled).join(", ")}`,
  );
  assert(
    !letosni.some((s) => s.verejneRozliseni === "Tajný trh"),
    "CEKA trh veřejně není",
  );
  const text = letosni.map(radekVyhledu).join(" | ");
  assert(!text.includes("CEKA") && !text.includes("VYRAZENO"), text);
  console.log("OK veřejný Výhled: CEKA i VYRAZENO mimo");
}

function nocturnaKoncert(args: {
  id: string;
  datum: string;
  nazev: string;
  misto: string;
}): BranaKonkretniUdalost {
  return udalost({
    id: args.id,
    redakcniPolozkaId: NOCTURNA_ID,
    datumOd: args.datum,
    datumDo: args.datum,
    nazev: args.nazev,
    mistoNeboTyp: args.misto,
    verejneCo: "Třeboňská nocturna",
    verejneRozliseni: args.misto,
  });
}

function overNocturnaCasoveSerie(): void {
  const prosinec = nocturnaKoncert({
    id: "n-2026",
    datum: "2026-12-17",
    nazev: "Dětský pěvecký sbor Českého rozhlasu",
    misto: "Divadlo J. K. Tyla",
  });
  const zima = (
    [
      ["2027-01-21", "Dvořákovo klavírní kvarteto"],
      ["2027-02-18", "Smetanovo trio"],
      ["2027-03-18", "Irvin Venyš"],
    ] as const
  ).map(([datum, nazev], i) =>
    nocturnaKoncert({
      id: `z${i}`,
      datum,
      nazev,
      misto: "Divadlo J. K. Tyla",
    }),
  );
  const leto = (
    [
      ["2027-07-06", "Konírna, Zámek Třeboň"],
      ["2027-07-07", "Malé nádvoří zámku Třeboň"],
      ["2027-07-08", "Kostel sv. Jiljí"],
      ["2027-07-09", "Nádvoří Městského úřadu Třeboň"],
      ["2027-07-10", "Nádvoří Městského úřadu Třeboň"],
    ] as const
  ).map(([datum, misto], i) =>
    nocturnaKoncert({
      id: `l${i}`,
      datum,
      nazev: `Léto ${i + 1}`,
      misto,
    }),
  );
  const cizi = [
    udalost({
      id: "c1",
      redakcniPolozkaId: JINA_ID,
      datumOd: "2027-01-10",
      datumDo: "2027-01-10",
      nazev: "Film leden",
      mistoNeboTyp: "Kino Světozor",
      verejneCo: "Film",
      verejneRozliseni: "Světozor",
    }),
    udalost({
      id: "c2",
      redakcniPolozkaId: JINA_ID,
      datumOd: "2027-08-20",
      datumDo: "2027-08-20",
      nazev: "Film srpen",
      mistoNeboTyp: "Kino Světozor",
      verejneCo: "Film",
      verejneRozliseni: "Světozor",
    }),
  ];

  const souhrny = projektujAdminVyhledKHranici(
    [prosinec, ...zima, ...leto, ...cizi],
    maVyhledAno,
    maVyhledSeriiZMapy(SERIE_NOCTURNA_TRHY_JEDNOTLIVE),
  );
  const r2026 = souhrny.find((s) => s.rok === 2026);
  const r2027 = souhrny.find((s) => s.rok === 2027);
  assert(r2026?.souhrny.length === 1, "2026: jeden řádek");
  const jeden = r2026?.souhrny[0];
  assert(jeden !== undefined, "2026 souhrn");
  if (!jeden) {
    return;
  }
  assert(
    jeden.nazev === "Dětský pěvecký sbor Českého rozhlasu",
    `2026 název ${jeden.nazev}`,
  );
  assert(
    formatujDatumVyhled(jeden) === "17.12.",
    `2026 datum ${formatujDatumVyhled(jeden)}`,
  );
  assert(
    jeden.klic === "2026:trebonska-nocturna:2026-12-17",
    `2026 klíč ${jeden.klic}`,
  );

  const noc = (r2027?.souhrny ?? []).filter(
    (s) => s.redakcniPolozkaId === NOCTURNA_ID,
  );
  const ciziRadky = (r2027?.souhrny ?? []).filter(
    (s) => s.redakcniPolozkaId === JINA_ID,
  );
  assert(noc.length === 2, `2027 nocturna řádků ${noc.length}`);
  assert(ciziRadky.length === 1, `cizí řádků ${ciziRadky.length}`);
  const zimaR = noc[0];
  const letoR = noc[1];
  const ciziR = ciziRadky[0];
  assert(zimaR.nazev === "", "zima bez názvu koncertu");
  assert(
    zimaR.datumOd === "2027-01-21" && zimaR.datumDo === "2027-03-18",
    "zima rozsah",
  );
  assert(
    formatujDatumVyhled(zimaR) === "21.1.–18.3.",
    formatujDatumVyhled(zimaR),
  );
  assert(zimaR.verejneCo === "Třeboňská nocturna", "zima CO");
  assert(zimaR.verejneRozliseni === "Divadlo J. K. Tyla", "zima KDE");
  assert(zimaR.klic === "2027:trebonska-nocturna:2027-01-21", zimaR.klic);
  assert(letoR.nazev === "", "léto bez názvu koncertu");
  assert(
    letoR.datumOd === "2027-07-06" && letoR.datumDo === "2027-07-10",
    "léto rozsah",
  );
  assert(formatujDatumVyhled(letoR) === "6.7.–10.7.", formatujDatumVyhled(letoR));
  assert(letoR.verejneCo === "Třeboňská nocturna", "léto CO");
  assert(letoR.verejneRozliseni == null, `léto bez KDE ${letoR.verejneRozliseni}`);
  assert(letoR.klic === "2027:trebonska-nocturna:2027-07-06", letoR.klic);
  assert(ciziR.klic === "2027:kino-svetozor", `cizí klíč ${ciziR.klic}`);
  assert(ciziR.nazev === "", "cizí série bez názvu");
  assert(
    ciziR.datumOd === "2027-01-10" && ciziR.datumDo === "2027-08-20",
    "cizí série zůstala jedna přes mezeru delší než 60 dní",
  );

  const hranice = (druhyDen: string) =>
    seskupVyhledUdalostiRokuNaSouhrny(
      2028,
      [
        nocturnaKoncert({
          id: "h1",
          datum: "2028-01-01",
          nazev: "A",
          misto: "Divadlo J. K. Tyla",
        }),
        nocturnaKoncert({
          id: "h2",
          datum: druhyDen,
          nazev: "B",
          misto: "Divadlo J. K. Tyla",
        }),
      ],
      () => true,
    );
  const po59 = hranice("2028-02-29");
  const po60 = hranice("2028-03-01");
  assert(po59.length === 1, `59 dní má být 1 série, je ${po59.length}`);
  assert(po60.length === 2, `60 dní má být 2 série, je ${po60.length}`);

  const sest = seskupVyhledUdalostiRokuNaSouhrny(
    2026,
    NOCTURNA_2026,
    () => true,
  );
  assert(sest.length === 1, "šest koncertů po 14 dnech = 1 série");
  assert(
    sest[0].datumOd === "2026-10-15" && sest[0].datumDo === "2026-12-17",
    "šestice 15.10.–17.12.",
  );
  assert(
    sest[0].klic === "2026:trebonska-nocturna:2026-10-15",
    sest[0].klic,
  );
  const ledenBrezen = seskupVyhledUdalostiRokuNaSouhrny(
    2027,
    NOCTURNA_2027,
    () => true,
  );
  assert(ledenBrezen.length === 1, "mezera 56 dní = 1 série");
  assert(
    formatujDatumVyhled(ledenBrezen[0]) === "21.1.–18.3.",
    formatujDatumVyhled(ledenBrezen[0]),
  );

  const trhyJednotlive = seskupVyhledUdalostiRokuNaSouhrny(
    2026,
    TRHY_7_CEKA,
    (id) => id !== TRHY_ID,
  );
  assert(trhyJednotlive.length === 7, "trhy bez série = 7 řádků");
  assert(
    trhyJednotlive.every((s) => s.klic.startsWith("2026:trhy:")),
    "trhy mají klíč jednotlivé události",
  );
  const trhySerie = seskupVyhledUdalostiRokuNaSouhrny(
    2026,
    TRHY_7_CEKA,
    () => true,
  );
  assert(trhySerie.length === 1, "trhy jako série = 1 řádek i přes mezeru 60+ dní");
  assert(trhySerie[0].klic === "2026:trhy", `klíč trhů ${trhySerie[0].klic}`);
  assert(
    trhySerie[0].datumOd === "2026-09-12" &&
      trhySerie[0].datumDo === "2026-12-19",
    "rozsah trhů beze změny",
  );
  console.log("OK nocturna: mezera 60 dní dělí série, cizí série ne");
}

function kdeSouhrnu(souhrn: BranaAdminVyhledSouhrn): string {
  return rozlozAkci({
    mistoNeboTyp: souhrn.mistoNeboTyp,
    nazev: souhrn.nazev,
    cas: "",
    ...(souhrn.verejneCo !== undefined
      ? {
          verejneCo: souhrn.verejneCo,
          verejneRozliseni: souhrn.verejneRozliseni ?? null,
        }
      : {}),
  }).misto;
}

function clenSerie(args: {
  id: string;
  polozka: string;
  datum: string;
  nazev: string;
  mistoNeboTyp: string;
  verejneCo?: string;
  verejneRozliseni?: string | null;
}): BranaKonkretniUdalost {
  return udalost({
    id: args.id,
    redakcniPolozkaId: args.polozka,
    datumOd: args.datum,
    datumDo: args.datum,
    nazev: args.nazev,
    mistoNeboTyp: args.mistoNeboTyp,
    ...(args.verejneCo !== undefined
      ? {
          verejneCo: args.verejneCo,
          verejneRozliseni: args.verejneRozliseni ?? null,
        }
      : {}),
  });
}

function jedinaSerie(
  polozka: string,
  clenove: BranaKonkretniUdalost[],
): BranaAdminVyhledSouhrn {
  const souhrny = seskupVyhledUdalostiRokuNaSouhrny(
    2027,
    clenove,
    () => true,
  );
  assert(souhrny.length === 1, `${polozka}: jeden souhrn, je ${souhrny.length}`);
  return souhrny[0];
}

function overKdeSouhrnuSerie(): void {
  const zima = jedinaSerie(
    NOCTURNA_ID,
    ["2027-01-21", "2027-02-18", "2027-03-18"].map((datum, i) =>
      clenSerie({
        id: `kz${i}`,
        polozka: NOCTURNA_ID,
        datum,
        nazev: `Zima ${i}`,
        mistoNeboTyp: "Třeboňská nocturna Divadlo J. K. Tyla",
        verejneCo: "Třeboňská nocturna",
        verejneRozliseni: "Divadlo J. K. Tyla",
      }),
    ),
  );
  assert(kdeSouhrnu(zima) === "Divadlo J. K. Tyla", `zima KDE ${kdeSouhrnu(zima)}`);

  const leto = jedinaSerie(
    NOCTURNA_ID,
    [
      ["2027-07-06", "Konírna, Zámek Třeboň"],
      ["2027-07-07", "Malé nádvoří zámku Třeboň"],
      ["2027-07-08", "Kostel sv. Jiljí"],
    ].map(([datum, misto], i) =>
      clenSerie({
        id: `kl${i}`,
        polozka: NOCTURNA_ID,
        datum,
        nazev: `Léto ${i}`,
        mistoNeboTyp: `Třeboňská nocturna ${misto}`,
        verejneCo: "Třeboňská nocturna",
        verejneRozliseni: misto,
      }),
    ),
  );
  assert(kdeSouhrnu(leto) === "", "léto bez KDE");
  assert(leto.verejneCo === "Třeboňská nocturna", "léto CO zůstává");

  const jeden = jedinaSerie(NOCTURNA_ID, [
    clenSerie({
      id: "k1",
      polozka: NOCTURNA_ID,
      datum: "2026-12-17",
      nazev: "Dětský pěvecký sbor Českého rozhlasu",
      mistoNeboTyp: "Třeboňská nocturna Divadlo J. K. Tyla",
      verejneCo: "Třeboňská nocturna",
      verejneRozliseni: "Divadlo J. K. Tyla",
    }),
  ]);
  assert(jeden.nazev === "Dětský pěvecký sbor Českého rozhlasu", "jeden název");
  assert(kdeSouhrnu(jeden) === "Divadlo J. K. Tyla", "jeden KDE");

  const stejne = jedinaSerie(JINA_ID, [
    clenSerie({
      id: "c1",
      polozka: JINA_ID,
      datum: "2027-05-01",
      nazev: "Film A",
      mistoNeboTyp: "Kino Světozor",
      verejneCo: "Kino",
      verejneRozliseni: "Světozor",
    }),
    clenSerie({
      id: "c2",
      polozka: JINA_ID,
      datum: "2027-06-01",
      nazev: "Film B",
      mistoNeboTyp: "Kino Světozor",
      verejneCo: "Kino",
      verejneRozliseni: "Světozor",
    }),
  ]);
  assert(kdeSouhrnu(stejne) === "Světozor", "cizí stejné KDE");
  assert(stejne.nazev === "", "cizí série bez názvu");

  const ruzne = jedinaSerie(JINA_ID, [
    clenSerie({
      id: "r1",
      polozka: JINA_ID,
      datum: "2027-05-01",
      nazev: "Film A",
      mistoNeboTyp: "Kino Světozor",
      verejneCo: "Kino",
      verejneRozliseni: "Světozor",
    }),
    clenSerie({
      id: "r2",
      polozka: JINA_ID,
      datum: "2027-06-01",
      nazev: "Film B",
      mistoNeboTyp: "Kino Aurora",
      verejneCo: "Kino",
      verejneRozliseni: "Aurora",
    }),
  ]);
  assert(kdeSouhrnu(ruzne) === "", "cizí různá KDE pryč");
  assert(ruzne.verejneCo === "Kino", "cizí CO zůstává");

  const velikost = jedinaSerie(JINA_ID, [
    clenSerie({
      id: "v1",
      polozka: JINA_ID,
      datum: "2027-05-01",
      nazev: "A",
      mistoNeboTyp: "Kino Světozor",
      verejneCo: "Kino",
      verejneRozliseni: "Světozor",
    }),
    clenSerie({
      id: "v2",
      polozka: JINA_ID,
      datum: "2027-06-01",
      nazev: "B",
      mistoNeboTyp: "Kino SVĚTOZOR",
      verejneCo: "Kino",
      verejneRozliseni: "SVĚTOZOR",
    }),
  ]);
  assert(kdeSouhrnu(velikost) === "Světozor", "velikost písmen je stejné KDE");

  const mezery = jedinaSerie(JINA_ID, [
    clenSerie({
      id: "m1",
      polozka: JINA_ID,
      datum: "2027-05-01",
      nazev: "A",
      mistoNeboTyp: "Kino Světozor",
      verejneCo: "Kino",
      verejneRozliseni: "Velké  nádvoří",
    }),
    clenSerie({
      id: "m2",
      polozka: JINA_ID,
      datum: "2027-06-01",
      nazev: "B",
      mistoNeboTyp: "Kino Světozor",
      verejneCo: "Kino",
      verejneRozliseni: "Velké nádvoří",
    }),
  ]);
  assert(kdeSouhrnu(mezery) === "Velké  nádvoří", "mezery jsou stejné KDE");

  const legacyStejne = jedinaSerie("legacy-stejne", [
    clenSerie({
      id: "ls1",
      polozka: "legacy-stejne",
      datum: "2027-05-01",
      nazev: "A",
      mistoNeboTyp: "Kino Světozor",
    }),
    clenSerie({
      id: "ls2",
      polozka: "legacy-stejne",
      datum: "2027-06-01",
      nazev: "B",
      mistoNeboTyp: "Kino Světozor",
    }),
  ]);
  assert(legacyStejne.mistoNeboTyp === "Kino Světozor", "legacy stejné mistoNeboTyp");
  assert(kdeSouhrnu(legacyStejne) === "Světozor", "legacy stejné KDE");

  const legacyRuzne = jedinaSerie("legacy-ruzne", [
    clenSerie({
      id: "lr1",
      polozka: "legacy-ruzne",
      datum: "2027-05-01",
      nazev: "A",
      mistoNeboTyp: "Kino Světozor",
    }),
    clenSerie({
      id: "lr2",
      polozka: "legacy-ruzne",
      datum: "2027-06-01",
      nazev: "B",
      mistoNeboTyp: "Kino Aurora",
    }),
  ]);
  assert(kdeSouhrnu(legacyRuzne) === "", "legacy různá KDE pryč");
  assert(legacyRuzne.mistoNeboTyp === "Kino", "legacy CO z typu zůstává");

  const prazdne = jedinaSerie(JINA_ID, [
    clenSerie({
      id: "p1",
      polozka: JINA_ID,
      datum: "2027-05-01",
      nazev: "A",
      mistoNeboTyp: "Koncert",
      verejneCo: "Koncert",
      verejneRozliseni: "",
    }),
    clenSerie({
      id: "p2",
      polozka: JINA_ID,
      datum: "2027-06-01",
      nazev: "B",
      mistoNeboTyp: "Koncert Kostel sv. Jiljí",
      verejneCo: "Koncert",
      verejneRozliseni: "Kostel sv. Jiljí",
    }),
  ]);
  assert(kdeSouhrnu(prazdne) === "", "prázdné a vyplněné KDE se neschovají do jednoho místa");
  console.log("OK KDE souhrnu: stejné místo zůstane, různá místa zmizí");
}

overNocturnaCasoveSerie();
overKdeSouhrnuSerie();
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
overVerejnyVyhledSdiliSerii();
overVerejnaNocturnaJednaPolozka();
overVerejnaRokyNeslucuj();
overVerejneJednotliveNeslucuj();
overVerejneCekaAVyrazenoMimo();
console.log("VŠE OK — admin i veřejný Výhled série z Redakčního pořadí");
