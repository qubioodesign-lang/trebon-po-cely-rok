/**
 * Ověření redakčního override Upravit (varianta B).
 * Spuštění: npx tsx scripts/verify-upravit-redakcni-override.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  jeUdalostCelaMinula,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";
import {
  aplikovatUpravuAutomatickeUdalosti,
  maRedakcniOverride,
  normalizovatRedakcneUpravenaPoleZBlobu,
} from "../src/lib/brana/admin/redakcni-override";
import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";

let selhalo = 0;
function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

const DNES = "2026-08-17";
const NOCTURNA_ID = "nocturna|/koncert/1-abonentni-koncert-2";

function ceka(
  partial: Partial<BranaKonkretniUdalost> &
    Pick<BranaKonkretniUdalost, "id">,
): BranaKonkretniUdalost {
  return {
    redakcniPolozkaId: "trebonska-nocturna",
    datumOd: "2026-10-15",
    datumDo: "2026-10-15",
    cas: "19:00",
    mistoNeboTyp: "Třeboňská nocturna Divadlo J. K. Tyla, Třeboň",
    nazev: "Matyáš Novák - Smetana Reborn",
    rucniPoziceVDni: null,
    stavSchvaleni: "CEKA_NA_SCHVALENI",
    scanKlic: "klic",
    zdrojIdentita: NOCTURNA_ID,
    verejneCo: "Třeboňská nocturna",
    verejneRozliseni: "Divadlo J. K. Tyla, Třeboň",
    ...partial,
  };
}

function kandidat(
  partial: Partial<BranaScanAutomatickaUdalostVstup> = {},
): BranaScanAutomatickaUdalostVstup {
  return {
    redakcniPolozkaId: "trebonska-nocturna",
    datumOd: "2026-10-15",
    datumDo: "2026-10-15",
    cas: "19:00",
    mistoNeboTyp: "Třeboňská nocturna Divadlo J. K. Tyla, Třeboň",
    nazev: "Matyáš Novák - Smetana Reborn",
    zdrojIdentita: NOCTURNA_ID,
    verejneCo: "Třeboňská nocturna",
    verejneRozliseni: "Divadlo J. K. Tyla, Třeboň",
    ...partial,
  };
}

function verejnyRadek(u: BranaKonkretniUdalost): string {
  const r = rozlozAkci({
    mistoNeboTyp: u.mistoNeboTyp,
    nazev: u.nazev,
    cas: u.cas,
    ...(u.verejneCo !== undefined
      ? {
          verejneCo: u.verejneCo,
          verejneRozliseni: u.verejneRozliseni ?? null,
        }
      : {}),
  });
  return `${r.typ}${r.misto ? `${r.oddelovacPredMistem}${r.misto}` : ""}`;
}

function scan(
  pred: readonly BranaKonkretniUdalost[],
  k: BranaScanAutomatickaUdalostVstup,
) {
  return aplikovatScanKandidatyNaUdalosti(pred, [k], DNES, jeUdalostCelaMinula);
}

const NOVE_MISTO = "Třeboňská nocturna Divadlo J. K. Tyla";

{
  const pred = ceka({ id: "auto-a" });
  const po = aplikovatUpravuAutomatickeUdalosti(pred, {
    datumOd: pred.datumOd,
    datumDo: pred.datumDo,
    cas: pred.cas,
    mistoNeboTyp: NOVE_MISTO,
    nazev: pred.nazev,
  });
  assert(po.mistoNeboTyp === NOVE_MISTO, "A: mistoNeboTyp uložen");
  assert(po.verejneCo === "Třeboňská nocturna", "A: verejneCo zachováno");
  assert(
    po.verejneRozliseni === "Divadlo J. K. Tyla",
    "A: verejneRozliseni ze zbytku",
  );
  assert(verejnyRadek(po) === NOVE_MISTO, "A: render = uložený řádek");
  assert(maRedakcniOverride(po, "mistoNeboTyp"), "A: CO skupina je override");
  assert(!maRedakcniOverride(po, "cas"), "A: čas není override");
  assert(!maRedakcniOverride(po, "nazev"), "A: název není override");
  assert(!maRedakcniOverride(po, "datumOd"), "A: datumOd není override");
}

{
  const pred = aplikovatUpravuAutomatickeUdalosti(ceka({ id: "auto-b" }), {
    datumOd: "2026-10-15",
    datumDo: "2026-10-15",
    cas: "19:00",
    mistoNeboTyp: NOVE_MISTO,
    nazev: "Matyáš Novák - Smetana Reborn",
  });
  const { udalosti, vysledek } = scan( [pred], kandidat({ cas: "20:30" }));
  assert(vysledek.pridano === 0, "B: bez druhé CEKA");
  assert(udalosti.length === 1, "B: stále 1");
  assert(udalosti[0].id === "auto-b", "B: stejné id");
  assert(udalosti[0].cas === "20:30", "B: čas ze scanu");
  assert(udalosti[0].mistoNeboTyp === NOVE_MISTO, "B: redakční CO zůstalo");
  assert(
    udalosti[0].verejneRozliseni === "Divadlo J. K. Tyla",
    "B: verejneRozliseni zůstalo",
  );
  assert(verejnyRadek(udalosti[0]) === NOVE_MISTO, "B: render stále redakční");
}

{
  const pred = aplikovatUpravuAutomatickeUdalosti(ceka({ id: "auto-c" }), {
    datumOd: "2026-10-15",
    datumDo: "2026-10-15",
    cas: "18:00",
    mistoNeboTyp: ceka({ id: "x" }).mistoNeboTyp,
    nazev: "Matyáš Novák - Smetana Reborn",
  });
  assert(maRedakcniOverride(pred, "cas"), "C: čas je override");
  assert(!maRedakcniOverride(pred, "mistoNeboTyp"), "C: CO není override");
  const { udalosti } = scan(
    [pred],
    kandidat({
      cas: "21:00",
      mistoNeboTyp: "Třeboňská nocturna Jiná scéna",
      verejneRozliseni: "Jiná scéna",
    }),
  );
  assert(udalosti[0].cas === "18:00", "C: redakční čas zůstane");
  assert(
    udalosti[0].mistoNeboTyp === "Třeboňská nocturna Jiná scéna",
    "C: místo ze scanu",
  );
}

{
  const pred = aplikovatUpravuAutomatickeUdalosti(ceka({ id: "auto-d" }), {
    datumOd: "2026-10-15",
    datumDo: "2026-10-15",
    cas: "19:00",
    mistoNeboTyp: ceka({ id: "x" }).mistoNeboTyp,
    nazev: "Opravený název",
  });
  assert(maRedakcniOverride(pred, "nazev"), "D: název je override");
  assert(!maRedakcniOverride(pred, "cas"), "D: čas není zmrazen");
  assert(!maRedakcniOverride(pred, "mistoNeboTyp"), "D: CO není zmrazeno");
  const { udalosti } = scan([pred], kandidat({ cas: "20:00" }));
  assert(udalosti[0].nazev === "Opravený název", "D: název chráněn");
  assert(udalosti[0].cas === "20:00", "D: čas ze scanu");
}

{
  const pred = ceka({
    id: "auto-e",
    mistoNeboTyp: NOVE_MISTO,
    verejneRozliseni: "Divadlo J. K. Tyla, Třeboň",
  });
  const po = aplikovatUpravuAutomatickeUdalosti(pred, {
    datumOd: pred.datumOd,
    datumDo: pred.datumDo,
    cas: pred.cas,
    mistoNeboTyp: pred.mistoNeboTyp,
    nazev: pred.nazev,
  });
  assert(!maRedakcniOverride(po, "datumOd"), "E: datumOd nezamčen");
  assert(!maRedakcniOverride(po, "datumDo"), "E: datumDo nezamčen");
  assert(!maRedakcniOverride(po, "cas"), "E: čas nezamčen");
  assert(!maRedakcniOverride(po, "nazev"), "E: název nezamčen");
  assert(!maRedakcniOverride(po, "mistoNeboTyp"), "E: CO nezamčeno bez změny");
  assert(po.redakcneUpravenaPole === undefined, "E: bez override pole");
  assert(
    po.verejneRozliseni === "Divadlo J. K. Tyla",
    "E: verejne* synchronizováno",
  );
  assert(verejnyRadek(po) === NOVE_MISTO, "E: Kalendář ukáže uložený řádek");
}

{
  const pred = ceka({ id: "auto-f" });
  const po = aplikovatUpravuAutomatickeUdalosti(pred, {
    datumOd: pred.datumOd,
    datumDo: pred.datumDo,
    cas: pred.cas,
    mistoNeboTyp: "Koncert na nádvoří",
    nazev: pred.nazev,
  });
  assert(po.verejneCo === "Koncert na nádvoří", "F: celý řádek = verejneCo");
  assert(po.verejneRozliseni === null, "F: verejneRozliseni = null");
  assert(verejnyRadek(po) === "Koncert na nádvoří", "F: render bez hádání");
}

{
  const pred = ceka({
    id: "auto-g",
    stavSchvaleni: "SCHVALENO",
    redakcneUpravenaPole: ["mistoNeboTyp"],
    mistoNeboTyp: NOVE_MISTO,
    verejneRozliseni: "Divadlo J. K. Tyla",
  });
  const { udalosti, vysledek } = scan([pred], kandidat({ cas: "21:00" }));
  assert(vysledek.pridano === 0 && vysledek.aktualizovano === 0, "G: bez zápisu");
  assert(udalosti[0].cas === "19:00", "G: SCHVALENO čas beze změny");
  assert(udalosti[0].stavSchvaleni === "SCHVALENO", "G: stav SCHVALENO");
}

{
  const pred = ceka({
    id: "auto-h",
    stavSchvaleni: "VYRAZENO",
  });
  const { udalosti, vysledek } = scan([pred], kandidat({ cas: "21:00" }));
  assert(vysledek.pridano === 0 && vysledek.aktualizovano === 0, "H: bez obnovení");
  assert(udalosti[0].stavSchvaleni === "VYRAZENO", "H: zůstává VYRAZENO");
  assert(udalosti[0].cas === "19:00", "H: obsah beze změny");
}

{
  const pred = ceka({ id: "auto-i" });
  assert(pred.redakcneUpravenaPole === undefined, "I: starý záznam bez pole");
  const { udalosti, vysledek } = scan([pred], kandidat({ cas: "21:00" }));
  assert(vysledek.aktualizovano === 1, "I: in-place jako dosud");
  assert(udalosti[0].cas === "21:00", "I: čas ze scanu");
  assert(
    udalosti[0].mistoNeboTyp === pred.mistoNeboTyp,
    "I: místo ze scanu (stejné)",
  );
  assert(
    normalizovatRedakcneUpravenaPoleZBlobu(undefined) === undefined,
    "I: chybějící pole = undefined",
  );
  assert(
    normalizovatRedakcneUpravenaPoleZBlobu(["cas", "neznamo"])?.join(",") ===
      "cas",
    "I: neznámé klíče se odfiltrují",
  );
}

{
  const pred = aplikovatUpravuAutomatickeUdalosti(ceka({ id: "auto-union" }), {
    datumOd: "2026-10-15",
    datumDo: "2026-10-15",
    cas: "19:00",
    mistoNeboTyp: NOVE_MISTO,
    nazev: "Matyáš Novák - Smetana Reborn",
  });
  const po = aplikovatUpravuAutomatickeUdalosti(pred, {
    datumOd: "2026-10-16",
    datumDo: "2026-10-16",
    cas: "19:00",
    mistoNeboTyp: NOVE_MISTO,
    nazev: pred.nazev,
  });
  assert(maRedakcniOverride(po, "mistoNeboTyp"), "union: dřívější CO zůstane");
  assert(maRedakcniOverride(po, "datumOd"), "union: nové datumOd");
  assert(maRedakcniOverride(po, "datumDo"), "union: nové datumDo");
}

{
  const pred = ceka({
    id: "auto-legacy",
    verejneCo: undefined,
    verejneRozliseni: undefined,
    mistoNeboTyp: "Kino Světozor",
  });
  const { verejneCo: _dropCo, verejneRozliseni: _dropRoz, ...bezJazyka } = pred;
  const legacy: BranaKonkretniUdalost = {
    ...bezJazyka,
    mistoNeboTyp: "Kino Světozor",
  };
  const po = aplikovatUpravuAutomatickeUdalosti(legacy, {
    datumOd: legacy.datumOd,
    datumDo: legacy.datumDo,
    cas: legacy.cas,
    mistoNeboTyp: "Kino Aurora",
    nazev: legacy.nazev,
  });
  assert(po.verejneCo === undefined, "legacy: verejneCo se nepřidá");
  assert(po.mistoNeboTyp === "Kino Aurora", "legacy: mistoNeboTyp uložen");
  assert(maRedakcniOverride(po, "mistoNeboTyp"), "legacy: CO override");
}

const root = join(__dirname, "..");
const uloziste = readFileSync(
  join(root, "src/lib/brana/admin/konkretni-udalosti-uloziste.ts"),
  "utf8",
);
const scanZapis = readFileSync(
  join(root, "src/lib/brana/admin/scan-ceka-zapis.ts"),
  "utf8",
);
assert(
  uloziste.includes("aplikovatUpravuAutomatickeUdalosti"),
  "storage: Upravit používá čistou úpravu",
);
assert(
  scanZapis.includes("maRedakcniOverride") &&
    scanZapis.includes("SCHVALENO / VYRAZENO"),
  "scan: override + SCHVALENO/VYRAZENO větev",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly redakčního override prošly.");
