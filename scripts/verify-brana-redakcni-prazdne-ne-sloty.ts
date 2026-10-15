/**
 * Prázdný uložený NE slot se při rozšíření katalogu nesmí doplnit seedem.
 * Spuštění: npx tsx scripts/verify-brana-redakcni-prazdne-ne-sloty.ts
 */

import {
  BRANA_REDAKCNI_VSECHNY_VYCHOZI,
  vytvoritVychoziRedakcniPoradi,
  type BranaRedakcniPolozkaStav,
  type BranaRedakcniPolozkaVychozi,
} from "../src/lib/brana/admin/redakcni-kostra";
import { sloucitUlozeneSKostrou } from "../src/lib/brana/admin/redakcni-poradi-validace";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

const PRAZDNY_ID = "hospic-sv-kleofase";
const ANO_ID = "kino-svetozor";
const NE_S_NAZVEM_ID = "ekocentrum-vydra";
const NOVE_ID = "test-nove-katalogove-id";
const NOVE_SEED_NAZEV = "SEED NOVÉ ID";

function radekPodleId(
  polozky: readonly BranaRedakcniPolozkaStav[],
  id: string,
): BranaRedakcniPolozkaStav {
  const radek = polozky.find((p) => p.id === id);
  assert(radek, `chybí ${id}`);
  return radek;
}

function stejnyUlozenyObsah(
  a: BranaRedakcniPolozkaStav,
  b: BranaRedakcniPolozkaStav,
  popis: string,
): void {
  assert(a.id === b.id, `${popis} id`);
  assert(a.polozka === b.polozka, `${popis} položka`);
  assert(a.pouzivat === b.pouzivat, `${popis} používat`);
  assert(a.priorita === b.priorita, `${popis} priorita`);
  assert(a.subpriorita === b.subpriorita, `${popis} subpriorita`);
  assert(a.vyhled === b.vyhled, `${popis} výhled`);
  assert(a.vyhledSerie === b.vyhledSerie, `${popis} výhled série`);
  assert(a.poznamka === b.poznamka, `${popis} poznámka`);
  assert(
    JSON.stringify(a.jazykVerejny) === JSON.stringify(b.jazykVerejny),
    `${popis} jazyk`,
  );
}

const seed = vytvoritVychoziRedakcniPoradi();
assert(seed.length === 55, `katalog 55, je ${seed.length}`);

const ulozenyPrazdny: BranaRedakcniPolozkaStav = {
  ...radekPodleId(seed, PRAZDNY_ID),
  polozka: "",
  pouzivat: "NE",
  priorita: null,
  subpriorita: null,
  poznamka: "",
  jazykVerejny: null,
};

const ulozenyAno = radekPodleId(seed, ANO_ID);
const ulozenyNeSNazvem = radekPodleId(seed, NE_S_NAZVEM_ID);
assert(ulozenyAno.pouzivat === "ANO", "Světozor seed ANO");
assert(ulozenyNeSNazvem.pouzivat === "NE", "Vydra seed NE");
assert(ulozenyNeSNazvem.polozka.length > 0, "Vydra má název");

const ulozenyDokument = seed.map((p) => {
  if (p.id === PRAZDNY_ID) {
    return ulozenyPrazdny;
  }
  return p;
});

const katalog55: readonly BranaRedakcniPolozkaVychozi[] = [
  ...BRANA_REDAKCNI_VSECHNY_VYCHOZI,
  {
    id: NOVE_ID,
    polozka: NOVE_SEED_NAZEV,
    pouzivat: "NE",
    mimoKostru: true,
  },
];

const poMerge = sloucitUlozeneSKostrou(
  { polozky: ulozenyDokument },
  katalog55,
);

assert(poMerge.length === 56, `po merge 56, je ${poMerge.length}`);

const prazdnyPo = radekPodleId(poMerge, PRAZDNY_ID);
assert(prazdnyPo.polozka === "", `prázdný slot zůstal prázdný: „${prazdnyPo.polozka}“`);
assert(prazdnyPo.pouzivat === "NE", "prázdný slot Používat NE");
assert(prazdnyPo.jazykVerejny === null, "prázdný slot jazyk null");
assert(prazdnyPo.priorita === null, "prázdný slot priorita null");
assert(prazdnyPo.subpriorita === null, "prázdný slot subpriorita null");
assert(prazdnyPo.poznamka === "", "prázdný slot poznámka prázdná");
console.log("OK uložený prázdný NE slot zůstal prázdný");

const nove = radekPodleId(poMerge, NOVE_ID);
assert(nove.polozka === NOVE_SEED_NAZEV, `nové ID seed název: ${nove.polozka}`);
assert(nove.pouzivat === "NE", "nové ID Používat NE ze seedu");
console.log("OK nové testovací ID dostalo seed");

stejnyUlozenyObsah(
  radekPodleId(poMerge, ANO_ID),
  ulozenyAno,
  "ANO 1:1",
);
console.log("OK existující ANO zůstalo 1:1");

stejnyUlozenyObsah(
  radekPodleId(poMerge, NE_S_NAZVEM_ID),
  ulozenyNeSNazvem,
  "NE s názvem 1:1",
);
console.log("OK existující NE s názvem zůstalo 1:1");

const jenProdukce = sloucitUlozeneSKostrou({ polozky: ulozenyDokument });
assert(jenProdukce.length === 55, "produkční katalog 55");
assert(radekPodleId(jenProdukce, PRAZDNY_ID).polozka === "", "55: prázdný zůstal");
assert(
  jenProdukce.every((p) => p.id !== NOVE_ID),
  "testovací ID není v produkčním katalogu",
);
console.log("OK produkčních 55 ID beze změny");

console.log("VŠE OK — prázdný NE slot při rozšíření katalogu");
