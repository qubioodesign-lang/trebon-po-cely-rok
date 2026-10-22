/**
 * Duplicity při vytvoření prolnutí. Jen umělá data v paměti.
 * Nesahej na Blob, soubory ani env.
 * Spuštění: npm run test:prolnuti-vytvoreni
 */

import type { Polozka } from "../src/types";
import {
  ObsazenaOperaceProlnutiError,
  souboryBezpecneKeSmazani,
  stabilniIdOperaceProlnuti,
  vysledekVytvoreniProlnuti,
  type ZadostVytvoreniProlnuti,
} from "../src/lib/prolnuti-vytvoreni";

const OPERACE_A = "e8ef6016-4d56-4f8c-82b6-5f1f4d8e0a3b";
const OPERACE_B = "6da6d6d1-5c8e-4f33-8be3-e4e38d5c637f";
const FOTO_A = ["snimek-a.jpg", "snimek-b.jpg", "snimek-c.jpg"];
const FOTO_B = ["jine-a.jpg", "jine-b.jpg"];
const NYNI = Date.parse("2026-10-22T05:05:15.487Z");

interface Stav {
  polozky: Polozka[];
  rotaceOd?: string;
}

let selhani = 0;

function overit(podminka: boolean, popis: string): void {
  if (podminka) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhani += 1;
  console.error(`FAIL  ${popis}`);
}

function zadost(
  id: string,
  soubory: string[],
  popis = "Po rušném létě"
): ZadostVytvoreniProlnuti {
  return {
    id,
    soubory,
    popis,
    datumPorizeni: "2026-10-22",
    datumPublikace: "2026-10-22T05:05:15.487Z",
  };
}

function prazdny(): Stav {
  return { polozky: [] };
}

/** Stejný krok jako mutátor zápisu: vloží, nebo nechá existující záznam. */
function ulozitOperaci(stav: Stav, pozadavek: ZadostVytvoreniProlnuti): Stav {
  const vysledek = vysledekVytvoreniProlnuti(
    stav.polozky,
    stav.rotaceOd,
    pozadavek,
    NYNI
  );
  if (vysledek.stav === "uz-existuje") return stav;
  return {
    polozky: vysledek.uloziste.polozky,
    rotaceOd: vysledek.uloziste.rotaceOd,
  };
}

function pocetId(stav: Stav, id: string): number {
  return stav.polozky.filter((polozka) => polozka.id === id).length;
}

const idZOperace = stabilniIdOperaceProlnuti(OPERACE_A, () => {
  throw new Error("nové ID se pro platnou operaci nemá vyrábět");
});
overit(idZOperace === OPERACE_A, "platné operaceId je stabilní identifikátor");

let vyrobeno = 0;
const nahradni = stabilniIdOperaceProlnuti("neni-uuid", () => {
  vyrobeno += 1;
  return "server-jednou";
});
overit(
  nahradni === "server-jednou" && vyrobeno === 1,
  "neplatné operaceId vyrobí jedno náhradní ID"
);

const vychozi = prazdny();
const poPrvnimZapisu = ulozitOperaci(vychozi, zadost(OPERACE_A, FOTO_A));
const overeniVidiStaryStav = vychozi.polozky.some(
  (polozka) => polozka.id === OPERACE_A
);
overit(!overeniVidiStaryStav, "ověření po prvním zápisu může vidět starý stav");
overit(pocetId(poPrvnimZapisu, OPERACE_A) === 1, "první zápis uloží jedno prolnutí");

const poOpakovani = ulozitOperaci(poPrvnimZapisu, zadost(OPERACE_A, FOTO_A));
const poTreti = ulozitOperaci(poOpakovani, zadost(OPERACE_A, FOTO_A));
overit(
  poTreti.polozky.length === 1 && pocetId(poTreti, OPERACE_A) === 1,
  "další pokus po starém ověření nevytvoří druhé prolnutí"
);
overit(
  poTreti.polozky[0]?.soubory?.join("|") === FOTO_A.join("|"),
  "opakovaný pokus dál ukazuje na stejné fotografie"
);

const znovuDorucene = ulozitOperaci(poTreti, zadost(OPERACE_A, FOTO_A));
overit(
  znovuDorucene.polozky.length === 1 &&
    znovuDorucene.polozky[0]?.id === OPERACE_A &&
    znovuDorucene.polozky[0]?.datumPublikace === "2026-10-22T05:05:15.487Z",
  "opakované doručení téže operace nevytvoří další záznam"
);

const dveOperace = ulozitOperaci(
  znovuDorucene,
  zadost(OPERACE_B, FOTO_B, "jiné místo")
);
overit(
  dveOperace.polozky.length === 2 &&
    pocetId(dveOperace, OPERACE_A) === 1 &&
    pocetId(dveOperace, OPERACE_B) === 1,
  "dvě různé operace uloží dvě prolnutí"
);

const poSelhaniOvereni = poPrvnimZapisu;
const smazatPoChybeOvereni = souboryBezpecneKeSmazani(
  poSelhaniOvereni,
  FOTO_A
);
overit(
  smazatPoChybeOvereni.length === 0,
  "chyba ověření nesmaže fotografie uloženého záznamu"
);
overit(
  souboryBezpecneKeSmazani(null, FOTO_A).length === 0,
  "bez načtených metadat se fotografie nesmažou"
);

const sdilene = ["spolecne-a.jpg", "spolecne-b.jpg"];
const jenDruhe = "jen-druhe.jpg";
const prvni = ulozitOperaci(prazdny(), zadost(OPERACE_A, sdilene));
const obe = ulozitOperaci(
  prvni,
  zadost(OPERACE_B, [...sdilene, jenDruhe], "druhé")
);
const poSmazaniDruheho: Stav = {
  polozky: obe.polozky.filter((polozka) => polozka.id !== OPERACE_B),
};
const zbytky = souboryBezpecneKeSmazani(poSmazaniDruheho, [
  ...sdilene,
  jenDruhe,
]);
overit(
  zbytky.length === 1 && zbytky[0] === jenDruhe,
  "smazání jedné položky ponechá fotografie druhé"
);

const predChybou = poPrvnimZapisu.polozky.map((polozka) => polozka.id);
let dosloKVyjimce = false;
try {
  vysledekVytvoreniProlnuti(
    poPrvnimZapisu.polozky,
    poPrvnimZapisu.rotaceOd,
    zadost(OPERACE_A, FOTO_B),
    NYNI
  );
} catch (error) {
  dosloKVyjimce =
    error instanceof ObsazenaOperaceProlnutiError && error.bezOpakovani === true;
}
overit(
  dosloKVyjimce &&
    poPrvnimZapisu.polozky.map((polozka) => polozka.id).join("|") ===
      predChybou.join("|"),
  "cizí operace se stejným ID úložiště nezmění"
);

let prazdnePoChybe = prazdny();
let odmitnuto = false;
try {
  vysledekVytvoreniProlnuti(
    prazdnePoChybe.polozky,
    prazdnePoChybe.rotaceOd,
    zadost(OPERACE_A, ["jen-jeden.jpg"]),
    NYNI
  );
} catch (error) {
  odmitnuto =
    error instanceof Error &&
    "bezOpakovani" in error &&
    Boolean((error as { bezOpakovani?: boolean }).bezOpakovani);
}
overit(
  odmitnuto && prazdnePoChybe.polozky.length === 0,
  "neplatný počet snímků nezanechá záznam"
);

if (selhani > 0) {
  console.error(`Selhalo ${selhani} kontrol.`);
  process.exit(1);
}

console.log("Všechny kontroly vytvoření prolnutí prošly.");
