/**
 * Ověření: dočasný read-only filtr skutečného stavu 21.–28. 8.
 * Spuštění: npx tsx scripts/verify-skutecny-stav-obdobi.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  sestavSkutecnyStavObdobi,
  udalostZasahujeDoObdobi,
} from "../src/lib/brana/admin/skutecny-stav-obdobi";
import type {
  BranaKonkretniUdalost,
  BranaStavSchvaleni,
} from "../src/lib/brana/admin/konkretni-udalost";

function udalost(vstup: {
  id: string;
  stav: BranaStavSchvaleni;
  datumOd: string;
  datumDo?: string;
  nazev?: string;
  cas?: string;
}): BranaKonkretniUdalost {
  return {
    id: vstup.id,
    redakcniPolozkaId: "pol-1",
    datumOd: vstup.datumOd,
    datumDo: vstup.datumDo ?? vstup.datumOd,
    cas: vstup.cas ?? "17:00",
    mistoNeboTyp: "Kino",
    nazev: vstup.nazev ?? vstup.id,
    rucniPoziceVDni: null,
    stavSchvaleni: vstup.stav,
  };
}

let selhalo = 0;
function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

const pred = udalost({
  id: "pred",
  stav: "CEKA_NA_SCHVALENI",
  datumOd: "2026-08-20",
});
const presahZleva = udalost({
  id: "presah-zleva",
  stav: "SCHVALENO",
  datumOd: "2026-08-20",
  datumDo: "2026-08-21",
});
const prvni = udalost({
  id: "prvni",
  stav: "CEKA_NA_SCHVALENI",
  datumOd: "2026-08-21",
  nazev: "Začátek okna",
});
const stred = udalost({
  id: "stred",
  stav: "SCHVALENO",
  datumOd: "2026-08-25",
  nazev: "Uprostřed",
});
const posledni = udalost({
  id: "posledni",
  stav: "VYRAZENO",
  datumOd: "2026-08-28",
});
const presahZprava = udalost({
  id: "presah-zprava",
  stav: "CEKA_NA_SCHVALENI",
  datumOd: "2026-08-28",
  datumDo: "2026-08-29",
});
const po = udalost({
  id: "po",
  stav: "SCHVALENO",
  datumOd: "2026-08-29",
});
const presahCele = udalost({
  id: "presah-cele",
  stav: "CEKA_NA_SCHVALENI",
  datumOd: "2026-08-15",
  datumDo: "2026-08-30",
});

assert(
  !udalostZasahujeDoObdobi(pred) &&
    udalostZasahujeDoObdobi(presahZleva) &&
    udalostZasahujeDoObdobi(prvni) &&
    udalostZasahujeDoObdobi(stred) &&
    udalostZasahujeDoObdobi(posledni) &&
    udalostZasahujeDoObdobi(presahZprava) &&
    !udalostZasahujeDoObdobi(po) &&
    udalostZasahujeDoObdobi(presahCele),
  "A: filtruje jen události zasahující do 21.–28. 8.",
);

const vstup = [
  pred,
  presahZleva,
  prvni,
  stred,
  posledni,
  presahZprava,
  po,
  presahCele,
];
const stavPred = vstup.map((u) => u.stavSchvaleni).join(",");
const vysledek = sestavSkutecnyStavObdobi(vstup);
const ids = vysledek.polozky.map((p) => p.id).sort().join(",");

assert(
  ids ===
    ["presah-cele", "presah-zleva", "presah-zprava", "posledni", "prvni", "stred"]
      .sort()
      .join(",") &&
    !vysledek.polozky.some((p) => p.id === "pred" || p.id === "po"),
  "A2: 20. 8. a 29. 8. nejsou ve výpisu",
);
assert(
  vysledek.polozky.find((p) => p.id === "prvni")?.stavSchvaleni ===
    "CEKA_NA_SCHVALENI" &&
    vysledek.polozky.find((p) => p.id === "stred")?.stavSchvaleni ===
      "SCHVALENO" &&
    vysledek.polozky.find((p) => p.id === "posledni")?.stavSchvaleni ===
      "VYRAZENO" &&
    vstup.map((u) => u.stavSchvaleni).join(",") === stavPred,
  "B: vrací skutečný stavSchvaleni beze změny vstupu",
);
assert(
  vysledek.souhrn.SCHVALENO === 2 &&
    vysledek.souhrn.CEKA === 3 &&
    vysledek.souhrn.VYRAZENO === 1 &&
    vysledek.souhrn.JINE === 0 &&
    vysledek.ceka.every((p) => p.stavSchvaleni === "CEKA_NA_SCHVALENI") &&
    vysledek.ceka.length === 3,
  "B2: souhrn a seznam CEKA odpovídají filtrovaným stavům",
);

const root = join(__dirname, "..");
const filtr = readFileSync(
  join(root, "src/lib/brana/admin/skutecny-stav-obdobi.ts"),
  "utf8",
);
const akce = readFileSync(join(root, "src/app/brana/admin/actions.ts"), "utf8");
const ui = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminKalendarRucniZapis.tsx"),
  "utf8",
);
const idxRead = akce.indexOf(
  "export async function nacistSkutecnyStavObdobiAkce",
);
const idxDalsi = akce.indexOf(
  "export async function schvalitKonkretniUdalostAkce",
);
const readFn = akce.slice(idxRead, idxDalsi);

assert(
  !filtr.includes("put(") &&
    !filtr.includes("ulozitDokument") &&
    !filtr.includes("revalidatePath") &&
    !filtr.includes("schvalitKonkretniUdalost("),
  "C: filtr nic nezapisuje",
);
assert(
  idxRead > 0 &&
    readFn.includes("nacistKonkretniUdalosti") &&
    readFn.includes("sestavSkutecnyStavObdobi") &&
    !readFn.includes("revalidatePath") &&
    !readFn.includes("put(") &&
    !readFn.includes("ulozitDokument") &&
    !readFn.includes("schvalitKonkretniUdalost(") &&
    !readFn.includes("skrytAutomatickou") &&
    !readFn.includes("vyrazitAutomatickou"),
  "D: action je read-only a neobsahuje writer/put",
);
assert(
  ui.includes("Zobrazit skutečný stav 21.–28. 8.") &&
    ui.includes("nacistSkutecnyStavObdobiAkce") &&
    ui.includes("zobrazitSkutecnyStavObdobi") &&
    !ui
      .slice(
        ui.indexOf("function zobrazitSkutecnyStavObdobi"),
        ui.indexOf("function oznacitScan"),
      )
      .includes("router.refresh()"),
  "D2: UI tlačítko jen čte, bez refresh/write",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly prošly.");
