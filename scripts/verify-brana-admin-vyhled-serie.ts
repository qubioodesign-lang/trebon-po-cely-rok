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
  projektujAdminVyhledSouhrnyPodleRoku,
  projektujKalendarDny,
  projektujVyhledPodleRoku,
  rokUdalosti,
  seskupVyhledUdalostiRokuNaSouhrny,
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
  const souhrny = projektujAdminVyhledSouhrnyPodleRoku(
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
  assert(letosni.length === 1, "2026: 1 souhrn");
  assert(pozdejsi.length === 1, "2027: 1 souhrn, nesloučeno");
  assert(formatujDatumVyhled(letosni[0]) === "15.10.–17.12.", "2026 rozsah");
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
  assert(letosni.length === 1, "CEKA/VYRAZENO nenačtou další řádek");
  assert(
    formatujDatumVyhled(letosni[0]) === "15.10.–17.12.",
    `CEKA/VYRAZENO nesmí prodloužit rozsah, je ${formatujDatumVyhled(letosni[0])}`,
  );
  assert(
    !letosni.some((s) => s.verejneRozliseni === "Tajný trh"),
    "CEKA trh veřejně není",
  );
  const text = letosni.map(radekVyhledu).join(" | ");
  assert(!text.includes("CEKA") && !text.includes("VYRAZENO"), text);
  console.log("OK veřejný Výhled: CEKA i VYRAZENO mimo");
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
overVerejnyVyhledSdiliSerii();
overVerejnaNocturnaJednaPolozka();
overVerejnaRokyNeslucuj();
overVerejneJednotliveNeslucuj();
overVerejneCekaAVyrazenoMimo();
console.log("VŠE OK — admin i veřejný Výhled série z Redakčního pořadí");
