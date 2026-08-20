/**
 * Ověření: jednotlivé „Schválit“ u automatické CEKA + krok 1 beze změny.
 * Spuštění: npx tsx scripts/verify-jednotlive-schvaleni-ceka.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  isoDnyBlizkehoOknaVPraze,
  sestavIdProSchvalitKontrolu,
  sestavPevnyKontrolniBlok,
} from "../src/lib/brana/admin/kontrolni-blok";
import type {
  BranaKonkretniUdalost,
  BranaStavSchvaleni,
} from "../src/lib/brana/admin/konkretni-udalost";

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

const blok = sestavPevnyKontrolniBlok({
  posledniDokoncenaDlouhodobaKontrola: "2026-08-31",
  pristiDlouhodobaKontrola: "2026-09-14",
});
assert(blok !== null, "7a: fixture checkpoint 31. 8. má pevný blok");
if (!blok) {
  process.exit(1);
}
const denZaBlokem = "2026-09-28";
const davka = new Set(
  sestavIdProSchvalitKontrolu(
    [
      udalost("dnes", "CEKA_NA_SCHVALENI", "bez-vyhledu", "2026-09-03"),
      udalost(
        "rezerva",
        "CEKA_NA_SCHVALENI",
        "bez-vyhledu",
        "2026-09-07",
      ),
      udalost("blok", "CEKA_NA_SCHVALENI", "bez-vyhledu", blok.blokOdIso),
      udalost("vyhled", "CEKA_NA_SCHVALENI", "s-vyhledem", denZaBlokem),
    ],
    (id) => id === "s-vyhledem",
    blok,
  ),
);
assert(!davka.has("dnes"), "8b: den mimo blok mimo Schválit kontrolu");
assert(!davka.has("rezerva"), "8c: den mimo blok mimo Schválit kontrolu");
assert(davka.has("blok"), "7b: pevný 14denní blok ve Schválit kontrolu");
assert(davka.has("vyhled"), "7c: Výhled ve Schválit kontrolu");
assert(
  isoDnyBlizkehoOknaVPraze().length === 8,
  "8d: blízké okno helper stále dnes+7",
);

assert(
  !ui.includes("skenovatRychleZdrojeAutomaticky") &&
    !ui.includes("casovy-plan") &&
    !ui.includes("projektujSchvaleneDoVerejnehoPohledu") &&
    ui.includes("schvalitKontroluAkce") &&
    ui.includes("onClick={schvalitKontrolu}") &&
    ui.includes("textTlacitkaSchvalitKontrolu"),
  "9: UI změna nezasahuje scan/cron/projekci; stejná akce, jen popisek",
);
assert(
  ui.includes("den.isoDen === isoDenZacatkuKontrolnihoBloku") &&
    ui.includes("den.isoDen === isoDenPoslednihoDneKontrolnihoBloku") &&
    ui.includes("textHraniceZacatkuKontrolnihoBloku") &&
    ui.includes("textHraniceKonceKontrolnihoBloku") &&
    !ui.includes("KONEC KONTROLY 21 DNÍ"),
  "10: hranice bloku v Kalendáři podle stejného OD/DO, bez hardcode 21",
);
assert(
  kontrolni.includes("sestavPevnyKontrolniBlok") &&
    kontrolni.includes(
      "ZAČÁTEK KONTROLNÍHO BLOKU · ${formatujDenMesicCesky(blok.blokOdIso",
    ) &&
    kontrolni.includes(
      "KONEC KONTROLNÍHO BLOKU · ${formatujDenMesicCesky(blok.blokDoIso",
    ),
  "10b: dávka i texty hranic ze stejného blokOdIso/blokDoIso",
);

const akce = readFileSync(join(root, "src/app/brana/admin/actions.ts"), "utf8");
const css = readFileSync(
  join(root, "src/app/brana/admin/brana-admin-kalendar.css"),
  "utf8",
);
assert(
  !ui.includes("ZÍTRA SE PUBLIKUJE") &&
    !ui.includes("SCHVÁLENO K PUBLIKACI") &&
    ui.includes('vyznam="schvaleno-do"') &&
    css.includes("brana-admin-kalendar-orientace-schvaleno-do"),
  "J: staré čáry pryč; červená SCHVÁLENO DO v Kalendáři",
);
assert(
  akce.includes("await schvalitKontroluKonkretnichUdalosti") &&
    akce.includes(
      "await ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku(blok.blokDoIso)",
    ) &&
    akce.indexOf("await schvalitKontroluKonkretnichUdalosti") <
      akce.indexOf(
        "await ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku(blok.blokDoIso)",
      ) &&
    !akce
      .slice(
        akce.indexOf("export async function schvalitKonkretniUdalostAkce"),
        akce.indexOf("export async function schvalitKontroluAkce"),
      )
      .includes("ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku"),
  "F/G/H: schvalenoDoIso až po úspěšném hromadném schválení; jednotlivé Schválit ho nemění",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly prošly.");
