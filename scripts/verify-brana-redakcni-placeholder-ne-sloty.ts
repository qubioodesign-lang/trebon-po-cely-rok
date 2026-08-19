/**
 * Placeholder prázdného NE slotu je jen nápověda, ne hodnota Položky.
 * Spuštění: npx tsx scripts/verify-brana-redakcni-placeholder-ne-sloty.ts
 */

import {
  BRANA_REDAKCNI_VSECHNY_VYCHOZI,
  vytvoritVychoziRedakcniPoradi,
  type BranaRedakcniPolozkaStav,
} from "../src/lib/brana/admin/redakcni-kostra";
import { placeholderPrazdneNePolozky } from "../src/lib/brana/admin/redakcni-poradi-placeholder";
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

function radekPodleId(
  polozky: readonly BranaRedakcniPolozkaStav[],
  id: string,
): BranaRedakcniPolozkaStav {
  const radek = polozky.find((p) => p.id === id);
  assert(radek, `chybí ${id}`);
  return radek;
}

function payloadUlozit(polozky: readonly BranaRedakcniPolozkaStav[]): string {
  return JSON.stringify(polozky);
}

assert(BRANA_REDAKCNI_VSECHNY_VYCHOZI.length === 54, "katalog 54 ID");

const seed = vytvoritVychoziRedakcniPoradi();
assert(seed.length === 54, `seed 54, je ${seed.length}`);

const prazdnyDivadlo: BranaRedakcniPolozkaStav = {
  ...radekPodleId(seed, "divadlo-105"),
  polozka: "",
  pouzivat: "NE",
  priorita: null,
  subpriorita: null,
  poznamka: "",
  jazykVerejny: null,
};
assert(
  placeholderPrazdneNePolozky(prazdnyDivadlo) === "Divadlo 105",
  "A: placeholder Divadlo 105",
);
assert(prazdnyDivadlo.polozka === "", "A: value zůstala prázdná");

const prazdnyHospic: BranaRedakcniPolozkaStav = {
  ...radekPodleId(seed, "hospic-sv-kleofase"),
  polozka: "",
  pouzivat: "NE",
  priorita: null,
  subpriorita: null,
  poznamka: "",
  jazykVerejny: null,
};
assert(
  placeholderPrazdneNePolozky(prazdnyHospic) === "Hospicová péče sv. Kleofáše",
  "B: placeholder Hospic",
);
assert(prazdnyHospic.polozka === "", "B: value zůstala prázdná");

const pojmenovanyNe: BranaRedakcniPolozkaStav = {
  ...prazdnyHospic,
  polozka: "nějaký vlastní text",
};
assert(
  placeholderPrazdneNePolozky(pojmenovanyNe) === "",
  "C: placeholder u vyplněné Položky nic nepřidá",
);
assert(pojmenovanyNe.polozka === "nějaký vlastní text", "C: value beze změny");

const anoRadek = radekPodleId(seed, "galerie-105");
assert(anoRadek.pouzivat === "ANO", "D: Galerie seed ANO");
assert(
  placeholderPrazdneNePolozky(anoRadek) === "",
  "D: ANO řádek placeholder prázdný",
);

const anonymni = {
  id: "neexistujici-rezervni-id",
  polozka: "",
  pouzivat: "NE" as const,
};
assert(
  placeholderPrazdneNePolozky(anonymni) === "",
  "E: bez katalogového názvu placeholder prázdný",
);

const ulozenyDokument = seed.map((p) => {
  if (p.id === "divadlo-105") {
    return prazdnyDivadlo;
  }
  if (p.id === "hospic-sv-kleofase") {
    return prazdnyHospic;
  }
  return p;
});

const payload = payloadUlozit(ulozenyDokument);
assert(!payload.includes("Divadlo 105"), "payload neobsahuje placeholder Divadlo 105");
assert(
  !payload.includes("Hospicová péče sv. Kleofáše"),
  "payload neobsahuje placeholder Hospic",
);
const nacteny = JSON.parse(payload) as BranaRedakcniPolozkaStav[];
assert(radekPodleId(nacteny, "divadlo-105").polozka === "", "payload divadlo-105 prázdný");
assert(radekPodleId(nacteny, "hospic-sv-kleofase").polozka === "", "payload hospic prázdný");

const validace = validovatRedakcniPoradiVstup(ulozenyDokument, {
  legacyVyhled: true,
});
assert(validace.ok, "prázdné NE projdou validací");
if (validace.ok) {
  assert(
    radekPodleId(validace.polozky, "divadlo-105").polozka === "",
    "validace nedoplní Divadlo 105",
  );
  assert(
    radekPodleId(validace.polozky, "hospic-sv-kleofase").polozka === "",
    "validace nedoplní Hospic",
  );
}

const poMerge = sloucitUlozeneSKostrou({ polozky: ulozenyDokument });
assert(poMerge.length === 54, "merge 54 ID");
assert(
  radekPodleId(poMerge, "divadlo-105").polozka === "",
  "merge nedoplní seedový název Divadlo 105",
);
assert(
  radekPodleId(poMerge, "hospic-sv-kleofase").polozka === "",
  "merge nedoplní seedový název Hospic",
);

console.log("OK A placeholder divadlo-105");
console.log("OK B placeholder hospic-sv-kleofase");
console.log("OK C vyplněná Položka beze změny");
console.log("OK D ANO bez placeholderu");
console.log("OK E anonymní slot bez katalogového názvu");
console.log("OK payload Uložit neobsahuje placeholder");
console.log("OK validace i merge nechávají prázdné NE prázdné");
console.log("VŠE OK — placeholder prázdných NE slotů");
