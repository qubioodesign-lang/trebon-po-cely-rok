/**
 * Ověření: ruční karta — světle modré podbarvení + UI Skrýt = fyzické smazání.
 * Spuštění: npx tsx scripts/verify-rucni-karta-podbarveni-skryt.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { maRychleCekaPodlozeni } from "../src/lib/brana/admin/konkretni-udalost";
import type { BranaKonkretniUdalost } from "../src/lib/brana/admin/konkretni-udalost";

let selhalo = 0;
function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function karta(
  partial: Pick<BranaKonkretniUdalost, "id" | "redakcniPolozkaId" | "stavSchvaleni"> &
    Partial<Pick<BranaKonkretniUdalost, "typZdroje" | "scanKlic">>,
): BranaKonkretniUdalost {
  return {
    id: partial.id,
    redakcniPolozkaId: partial.redakcniPolozkaId,
    datumOd: "2026-08-23",
    datumDo: "2026-08-23",
    cas: "18:00",
    mistoNeboTyp: "misto",
    nazev: partial.id,
    rucniPoziceVDni: partial.redakcniPolozkaId === null ? 0 : null,
    stavSchvaleni: partial.stavSchvaleni,
    ...(partial.scanKlic ? { scanKlic: partial.scanKlic } : {}),
    ...(partial.typZdroje === "RYCHLY" ? { typZdroje: "RYCHLY" as const } : {}),
  };
}

/** Zrcadlo className v SeznamDnu. */
function tridaKarty(udalost: BranaKonkretniUdalost): string | undefined {
  const jeRucni = udalost.redakcniPolozkaId === null;
  const cekaNaSchvaleni = udalost.stavSchvaleni === "CEKA_NA_SCHVALENI";
  if (jeRucni) {
    return "brana-admin-akce-rucni";
  }
  if (!cekaNaSchvaleni) {
    return undefined;
  }
  return maRychleCekaPodlozeni(udalost)
    ? "brana-admin-akce-ceka-na-schvaleni brana-admin-akce-ceka-rychla"
    : "brana-admin-akce-ceka-na-schvaleni";
}

const persistovane = new Set(["rucni-1", "auto-ceka", "auto-rychla", "auto-schvaleno"]);
const rucniZapisPovolen = true;
const posledniScanDokoncen = true;
const rucniAkce = rucniZapisPovolen && posledniScanDokoncen;

function muzeSchvalitAutomatickou(udalost: BranaKonkretniUdalost): boolean {
  return (
    rucniZapisPovolen &&
    udalost.redakcniPolozkaId !== null &&
    udalost.stavSchvaleni === "CEKA_NA_SCHVALENI" &&
    persistovane.has(udalost.id)
  );
}

function muzeUpravitAutomatickou(udalost: BranaKonkretniUdalost): boolean {
  return (
    rucniZapisPovolen &&
    udalost.redakcniPolozkaId !== null &&
    (udalost.stavSchvaleni === "CEKA_NA_SCHVALENI" ||
      udalost.stavSchvaleni === "SCHVALENO") &&
    typeof udalost.scanKlic === "string" &&
    udalost.scanKlic.trim().length > 0 &&
    persistovane.has(udalost.id)
  );
}

function muzeVyrazitAutomatickou(udalost: BranaKonkretniUdalost): boolean {
  return (
    rucniZapisPovolen &&
    udalost.redakcniPolozkaId !== null &&
    (udalost.stavSchvaleni === "CEKA_NA_SCHVALENI" ||
      udalost.stavSchvaleni === "SCHVALENO") &&
    persistovane.has(udalost.id)
  );
}

function muzeSkrytAutomatickou(udalost: BranaKonkretniUdalost): boolean {
  return muzeVyrazitAutomatickou(udalost);
}

function akceKarty(udalost: BranaKonkretniUdalost): {
  schvalit: boolean;
  autoUpravit: boolean;
  autoSkryt: boolean;
  vyrazit: boolean;
  rucniUpravit: boolean;
  rucniSkryt: boolean;
} {
  const jeRucni = udalost.redakcniPolozkaId === null;
  return {
    schvalit: muzeSchvalitAutomatickou(udalost),
    autoUpravit: muzeUpravitAutomatickou(udalost),
    autoSkryt: muzeSkrytAutomatickou(udalost),
    vyrazit: muzeVyrazitAutomatickou(udalost),
    rucniUpravit: rucniAkce && jeRucni,
    rucniSkryt: rucniAkce && jeRucni,
  };
}

const rucni = karta({
  id: "rucni-1",
  redakcniPolozkaId: null,
  stavSchvaleni: "SCHVALENO",
});
const autoCeka = karta({
  id: "auto-ceka",
  redakcniPolozkaId: "pol-1",
  stavSchvaleni: "CEKA_NA_SCHVALENI",
  scanKlic: "klic",
});
const autoRychla = karta({
  id: "auto-rychla",
  redakcniPolozkaId: "pol-1",
  stavSchvaleni: "CEKA_NA_SCHVALENI",
  typZdroje: "RYCHLY",
  scanKlic: "klic",
});
const autoSchvaleno = karta({
  id: "auto-schvaleno",
  redakcniPolozkaId: "pol-1",
  stavSchvaleni: "SCHVALENO",
  scanKlic: "klic",
});

assert(
  tridaKarty(rucni) === "brana-admin-akce-rucni",
  "A: ruční karta dostane vlastní CSS třídu",
);
assert(
  tridaKarty(autoCeka) !== "brana-admin-akce-rucni" &&
    tridaKarty(autoSchvaleno) !== "brana-admin-akce-rucni" &&
    !String(tridaKarty(autoCeka)).includes("brana-admin-akce-rucni"),
  "B: automatická karta třídu ruční nedostane",
);
assert(
  tridaKarty(autoRychla) ===
    "brana-admin-akce-ceka-na-schvaleni brana-admin-akce-ceka-rychla" &&
    tridaKarty(autoCeka) === "brana-admin-akce-ceka-na-schvaleni",
  "C: RYCHLÁ karta si zachová současné rozlišení",
);

const akceRucni = akceKarty(rucni);
assert(
  akceRucni.rucniUpravit &&
    akceRucni.rucniSkryt &&
    !akceRucni.autoUpravit &&
    !akceRucni.autoSkryt,
  "D: ruční karta zobrazuje Upravit + Skrýt",
);
assert(
  !akceRucni.schvalit && !akceRucni.vyrazit,
  "E: ruční karta nezobrazuje Schválit ani Vyřadit",
);

const root = join(__dirname, "..");
const ui = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminKalendarRucniZapis.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");
const css = readFileSync(
  join(root, "src/app/brana/admin/brana-admin-kalendar.css"),
  "utf8",
).replace(/\r\n/g, "\n");
const akce = readFileSync(
  join(root, "src/app/brana/admin/actions.ts"),
  "utf8",
).replace(/\r\n/g, "\n");
const uloziste = readFileSync(
  join(root, "src/lib/brana/admin/konkretni-udalosti-uloziste.ts"),
  "utf8",
).replace(/\r\n/g, "\n");
const validace = readFileSync(
  join(root, "src/lib/brana/admin/rucni-udalost-validace.ts"),
  "utf8",
).replace(/\r\n/g, "\n");
const scan = readFileSync(
  join(root, "src/lib/brana/admin/scan-ceka-zapis.ts"),
  "utf8",
).replace(/\r\n/g, "\n");
const skenovat = readFileSync(
  join(root, "src/lib/brana/admin/skenovat-zdroj.ts"),
  "utf8",
).replace(/\r\n/g, "\n");
const verejne = readFileSync(
  join(root, "src/lib/brana/verejne-schvalene-pohledy.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

const idxSmazat = ui.indexOf("function smazat(");
const idxSchvalitKontrolu = ui.indexOf("function schvalitKontrolu(");
const smazatFn = ui.slice(idxSmazat, idxSchvalitKontrolu);

assert(
  smazatFn.includes("smazatRucniKonkretniUdalostAkce") &&
    smazatFn.includes('window.confirm("Skrýt tuto událost?")') &&
    !smazatFn.includes("skrytAutomatickouKonkretniUdalostAkce") &&
    akce.includes("export async function smazatRucniKonkretniUdalostAkce") &&
    uloziste.includes("export async function smazatRucniKonkretniUdalost"),
  "F: Skrýt ruční karty stále používá existující fyzické odstranění",
);

assert(
  css.includes(".brana-admin-seznam-akci > li.brana-admin-akce-rucni") &&
    css.includes("rgb(140 175 210 / 0.10)") &&
    ui.includes('jeRucni') &&
    ui.includes('"brana-admin-akce-rucni"') &&
    css.includes("rgb(207 145 104 / 0.08)") &&
    css.includes("rgb(207 145 104 / 0.18)"),
  "A/C zdroj: ruční CSS třída + zachované CEKA podbarvení",
);

assert(
  validace.includes('stavSchvaleni: "SCHVALENO"') &&
    validace.includes("redakcniPolozkaId: null") &&
    !scan.includes("brana-admin-akce-rucni") &&
    !skenovat.includes("brana-admin-akce-rucni") &&
    !verejne.includes("brana-admin-akce-rucni") &&
    uloziste.includes("export async function skrytAutomatickouKonkretniUdalost") &&
    ui.includes("skrytAutomatickouKonkretniUdalostAkce") &&
    ui.includes(
      "Skrýt tuto událost? Při dalším scanu se může objevit znovu.",
    ),
  "G: datová/scannovací logika a automatické Skrýt beze změny",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly ruční karty prošly.");
