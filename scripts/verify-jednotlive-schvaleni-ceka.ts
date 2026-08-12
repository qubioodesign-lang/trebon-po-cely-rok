/**
 * Ověření: jednotlivé „Schválit“ u automatické CEKA + krok 1 beze změny.
 * Spuštění: npx tsx scripts/verify-jednotlive-schvaleni-ceka.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { dnesVPraze, pridatDny } from "../src/lib/brana/cas";
import {
  isoDnyBlizkehoOknaVPraze,
  kontrolniBlokVPraze,
  sestavIdProSchvalitKontrolu,
} from "../src/lib/brana/admin/kontrolni-blok";
import type {
  BranaKonkretniUdalost,
  BranaStavSchvaleni,
} from "../src/lib/brana/admin/konkretni-udalost";

function isoZ(d: { rok: number; mesic: number; den: number }): string {
  return `${d.rok}-${String(d.mesic).padStart(2, "0")}-${String(d.den).padStart(2, "0")}`;
}

function isoNa(iso: string) {
  return {
    rok: Number(iso.slice(0, 4)),
    mesic: Number(iso.slice(5, 7)),
    den: Number(iso.slice(8, 10)),
  };
}

/** Zrcadlo UI predikátu muzeSchvalitAutomatickou. */
function muzeSchvalitAutomatickou(
  udalost: Pick<
    BranaKonkretniUdalost,
    "id" | "redakcniPolozkaId" | "stavSchvaleni"
  >,
  rucniZapisPovolen: boolean,
  persistovaneId: ReadonlySet<string>,
): boolean {
  return (
    rucniZapisPovolen &&
    udalost.redakcniPolozkaId !== null &&
    udalost.stavSchvaleni === "CEKA_NA_SCHVALENI" &&
    persistovaneId.has(udalost.id)
  );
}

/** Simulace optimistic/storage efektu: jen zvolené ID CEKA → SCHVALENO. */
function aplikujJednotliveSchvaleni(
  udalosti: readonly BranaKonkretniUdalost[],
  id: string,
): BranaKonkretniUdalost[] {
  return udalosti.map((u) =>
    u.id === id && u.stavSchvaleni === "CEKA_NA_SCHVALENI"
      ? { ...u, stavSchvaleni: "SCHVALENO" as const }
      : u,
  );
}

function udalost(
  id: string,
  stav: BranaStavSchvaleni,
  redakcniPolozkaId: string | null,
  datumOd: string,
): BranaKonkretniUdalost {
  return {
    id,
    redakcniPolozkaId,
    datumOd,
    datumDo: datumOd,
    cas: "",
    mistoNeboTyp: "t",
    nazev: id,
    rucniPoziceVDni: redakcniPolozkaId === null ? 0 : null,
    stavSchvaleni: stav,
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

const root = join(__dirname, "..");
const ui = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminKalendarRucniZapis.tsx"),
  "utf8",
);
const uloziste = readFileSync(
  join(root, "src/lib/brana/admin/konkretni-udalosti-uloziste.ts"),
  "utf8",
);
const kontrolni = readFileSync(
  join(root, "src/lib/brana/admin/kontrolni-blok.ts"),
  "utf8",
);

assert(
  ui.includes("schvalitKonkretniUdalostAkce") &&
    ui.includes("muzeSchvalitAutomatickou") &&
    ui.includes("schvalitJednu") &&
    ui.includes("onSchvalit") &&
    /\bSchválit\b/.test(ui),
  "1a: UI napojuje existující akci a zobrazí Schválit",
);

const persistovane = new Set(["auto-ceka", "auto-schvaleno", "auto-vyrazeno", "rucni"]);
const ceka = udalost("auto-ceka", "CEKA_NA_SCHVALENI", "pol-1", "2026-08-20");
const schvaleno = udalost("auto-schvaleno", "SCHVALENO", "pol-1", "2026-08-20");
const vyrazeno = udalost("auto-vyrazeno", "VYRAZENO", "pol-1", "2026-08-20");
const rucni = udalost("rucni", "CEKA_NA_SCHVALENI", null, "2026-08-20");

assert(
  muzeSchvalitAutomatickou(ceka, true, persistovane),
  "1: automatická CEKA má Schválit",
);
assert(
  !muzeSchvalitAutomatickou(schvaleno, true, persistovane),
  "2: SCHVALENO nemá Schválit",
);
assert(
  !muzeSchvalitAutomatickou(vyrazeno, true, persistovane),
  "3: VYRAZENO nemá Schválit",
);
assert(
  !muzeSchvalitAutomatickou(rucni, true, persistovane),
  "4: ruční událost nemá Schválit",
);

const druhaCeka = udalost("auto-ceka-2", "CEKA_NA_SCHVALENI", "pol-1", "2026-08-21");
const pred = [ceka, druhaCeka, schvaleno];
const po = aplikujJednotliveSchvaleni(pred, "auto-ceka");
assert(
  po.find((u) => u.id === "auto-ceka")?.stavSchvaleni === "SCHVALENO",
  "5: zvolené ID CEKA → SCHVALENO",
);
assert(
  po.find((u) => u.id === "auto-ceka-2")?.stavSchvaleni === "CEKA_NA_SCHVALENI",
  "6: ostatní CEKA zůstávají CEKA",
);
assert(
  po.find((u) => u.id === "auto-schvaleno")?.stavSchvaleni === "SCHVALENO",
  "6b: stávající SCHVALENO beze změny",
);

assert(
  /stavSchvaleni:\s*"SCHVALENO"/.test(uloziste) &&
    uloziste.includes("export async function schvalitKonkretniUdalost") &&
    uloziste.includes("noveUdalosti[index] = schvalena"),
  "5b: storage schvaluje jen jeden index",
);

assert(
  !kontrolni.includes("patriUdalostDoBlizkehoOkna(udalost") &&
    kontrolni.includes("patriUdalostDoKontrolnihoBloku(udalost, blok)") &&
    kontrolni.includes("projektujVyhledPodleRoku"),
  "7/8a: sestavId stále blok ∪ Výhled bez blízkého okna",
);

const blok = kontrolniBlokVPraze();
const dnesIso = isoZ(dnesVPraze());
const denZaBlokem = isoZ(pridatDny(isoNa(blok.blokDoIso), 1));
const davka = new Set(
  sestavIdProSchvalitKontrolu(
    [
      udalost("dnes", "CEKA_NA_SCHVALENI", "bez-vyhledu", dnesIso),
      udalost(
        "rezerva",
        "CEKA_NA_SCHVALENI",
        "bez-vyhledu",
        blok.rezervaIsoDny[0],
      ),
      udalost("blok", "CEKA_NA_SCHVALENI", "bez-vyhledu", blok.blokOdIso),
      udalost("vyhled", "CEKA_NA_SCHVALENI", "s-vyhledem", denZaBlokem),
    ],
    (id) => id === "s-vyhledem",
  ),
);
assert(!davka.has("dnes"), "8b: dnešek mimo Schválit kontrolu");
assert(!davka.has("rezerva"), "8c: 7denní rezerva mimo Schválit kontrolu");
assert(davka.has("blok"), "7b: 21denní blok ve Schválit kontrolu");
assert(davka.has("vyhled"), "7c: Výhled ve Schválit kontrolu");
assert(
  isoDnyBlizkehoOknaVPraze().length === 8,
  "8d: blízké okno helper stále dnes+7",
);

assert(
  !ui.includes("skenovatRychleZdrojeAutomaticky") &&
    !ui.includes("casovy-plan") &&
    !ui.includes("projektujSchvaleneDoVerejnehoPohledu"),
  "9: UI změna nezasahuje scan/cron/projekci",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly prošly.");
