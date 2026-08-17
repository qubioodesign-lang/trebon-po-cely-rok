/**
 * Upravit: samostatné CO + KDE u strukturovaných událostí.
 * Spuštění: npx tsx scripts/verify-upravit-strukturovane-co-kde.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import type { BranaKonkretniUdalost } from "../src/lib/brana/admin/konkretni-udalost";
import {
  aplikovatUpravuAutomatickeUdalosti,
  jeStrukturovanyVerejnyZapis,
  maRedakcniOverride,
} from "../src/lib/brana/admin/redakcni-override";
import { validovatAutomatickouCekaUpravuVstup } from "../src/lib/brana/admin/rucni-udalost-validace";

let selhalo = 0;
function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function udalost(
  partial: Partial<BranaKonkretniUdalost> & Pick<BranaKonkretniUdalost, "id">,
): BranaKonkretniUdalost {
  return {
    redakcniPolozkaId: "dum-stepanka-netolickeho",
    datumOd: "2026-09-12",
    datumDo: "2026-09-12",
    cas: "17:00",
    mistoNeboTyp: "Dům Štěpánka Netolického",
    nazev: "Vernisáž výstavy AMARCORD v Galerii města Třeboň",
    rucniPoziceVDni: null,
    stavSchvaleni: "CEKA_NA_SCHVALENI",
    scanKlic: "dsn-klic",
    verejneCo: null,
    verejneRozliseni: "Dům Štěpánka Netolického",
    ...partial,
  };
}

function strukturovanaUprava(
  u: BranaKonkretniUdalost,
  patch: Partial<{
    datumOd: string;
    datumDo: string;
    cas: string;
    nazev: string;
    verejneCo: string | null;
    verejneRozliseni: string | null;
  }> = {},
) {
  return {
    datumOd: patch.datumOd ?? u.datumOd,
    datumDo: patch.datumDo ?? u.datumDo,
    cas: patch.cas ?? u.cas,
    nazev: patch.nazev ?? u.nazev,
    mistoNeboTyp: u.mistoNeboTyp,
    verejneCo:
      patch.verejneCo !== undefined ? patch.verejneCo : (u.verejneCo ?? null),
    verejneRozliseni:
      patch.verejneRozliseni !== undefined
        ? patch.verejneRozliseni
        : (u.verejneRozliseni ?? null),
  };
}

function render(u: BranaKonkretniUdalost) {
  return rozlozAkci({
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
}

const pred = udalost({ id: "auto-dsn-amarcord" });
assert(jeStrukturovanyVerejnyZapis(pred), "A: klíč verejneCo = strukturovaná");
assert(pred.verejneCo === null, "A: CO prázdné (null)");
assert(
  pred.verejneRozliseni === "Dům Štěpánka Netolického",
  "A: KDE stávající",
);
assert(render(pred).typ === "", "A: render bez akcentního CO");
assert(
  render(pred).misto === "Dům Štěpánka Netolického",
  "A: render KDE",
);

const poAmarcord = aplikovatUpravuAutomatickeUdalosti(
  pred,
  strukturovanaUprava(pred, {
    verejneCo: "Vernisáž",
    verejneRozliseni: "Dům Š. Netolického",
    nazev: "AMARCORD v Galerii města Třeboň",
  }),
);
assert(poAmarcord.verejneCo === "Vernisáž", "B: verejneCo = Vernisáž");
assert(
  poAmarcord.verejneRozliseni === "Dům Š. Netolického",
  "B: verejneRozliseni = Dům Š. Netolického",
);
assert(
  poAmarcord.nazev === "AMARCORD v Galerii města Třeboň",
  "B: nazev",
);
assert(
  poAmarcord.mistoNeboTyp === "Vernisáž Dům Š. Netolického",
  "B: mistoNeboTyp složeno",
);
assert(poAmarcord.scanKlic === pred.scanKlic, "B: scanKlic beze změny");
assert(poAmarcord.id === pred.id, "B: stejné id");

const vypis = render(poAmarcord);
assert(vypis.typ === "Vernisáž", "C: CO = Vernisáž (akcentní slot)");
assert(vypis.misto === "Dům Š. Netolického", "C: KDE běžný slot");
assert(
  vypis.nazev === "AMARCORD v Galerii města Třeboň",
  "C: název druhý řádek",
);
assert(vypis.cas === "17:00", "C: čas beze změny");

{
  const po = aplikovatUpravuAutomatickeUdalosti(pred, strukturovanaUprava(pred));
  assert(po.redakcneUpravenaPole === undefined, "D: bez změny bez override");
  assert(po.verejneCo === null, "D: CO zůstává null");
  assert(
    po.verejneRozliseni === "Dům Štěpánka Netolického",
    "D: KDE beze změny",
  );
}

{
  const jenCo = aplikovatUpravuAutomatickeUdalosti(
    pred,
    strukturovanaUprava(pred, { verejneCo: "Vernisáž" }),
  );
  assert(maRedakcniOverride(jenCo, "mistoNeboTyp"), "E: jen CO → override");
  assert(!maRedakcniOverride(jenCo, "nazev"), "E: název nezamčen");
  const jenKde = aplikovatUpravuAutomatickeUdalosti(
    pred,
    strukturovanaUprava(pred, {
      verejneRozliseni: "Dům Š. Netolického",
    }),
  );
  assert(maRedakcniOverride(jenKde, "mistoNeboTyp"), "E: jen KDE → override");
  assert(!maRedakcniOverride(jenKde, "nazev"), "E: název nezamčen po KDE");
}

{
  const jenNazev = aplikovatUpravuAutomatickeUdalosti(
    pred,
    strukturovanaUprava(pred, {
      nazev: "AMARCORD v Galerii města Třeboň",
    }),
  );
  assert(maRedakcniOverride(jenNazev, "nazev"), "F: jen název → nazev");
  assert(
    !maRedakcniOverride(jenNazev, "mistoNeboTyp"),
    "F: první řádek nezamčen",
  );
  assert(!maRedakcniOverride(jenNazev, "cas"), "F: čas nezamčen");
}

{
  const { verejneCo: _c, verejneRozliseni: _k, ...bezJazyka } = udalost({
    id: "auto-legacy",
    mistoNeboTyp: "Kino Světozor",
    nazev: "Film",
  });
  const legacy: BranaKonkretniUdalost = {
    ...bezJazyka,
    mistoNeboTyp: "Kino Světozor",
  };
  assert(!jeStrukturovanyVerejnyZapis(legacy), "G: legacy bez klíče");
  const po = aplikovatUpravuAutomatickeUdalosti(legacy, {
    datumOd: legacy.datumOd,
    datumDo: legacy.datumDo,
    cas: legacy.cas,
    mistoNeboTyp: "Kino Aurora",
    nazev: legacy.nazev,
  });
  assert(po.verejneCo === undefined, "G: verejneCo se nepřidá");
  assert(po.mistoNeboTyp === "Kino Aurora", "G: mistoNeboTyp uložen");
  assert(maRedakcniOverride(po, "mistoNeboTyp"), "G: override z řetězce");
  const noOp = aplikovatUpravuAutomatickeUdalosti(legacy, {
    datumOd: legacy.datumOd,
    datumDo: legacy.datumDo,
    cas: legacy.cas,
    mistoNeboTyp: legacy.mistoNeboTyp,
    nazev: legacy.nazev,
  });
  assert(noOp.redakcneUpravenaPole === undefined, "G: legacy bez změny");
}

function bezZmeny(u: BranaKonkretniUdalost, popis: string): void {
  const po = aplikovatUpravuAutomatickeUdalosti(u, strukturovanaUprava(u));
  assert(po.redakcneUpravenaPole === undefined, `${popis}: bez override`);
  assert(po.verejneCo === u.verejneCo, `${popis}: CO`);
  assert(
    (po.verejneRozliseni ?? null) === (u.verejneRozliseni ?? null),
    `${popis}: KDE`,
  );
  assert(po.mistoNeboTyp === u.mistoNeboTyp, `${popis}: mistoNeboTyp`);
  const a = render(u);
  const b = render(po);
  assert(a.typ === b.typ && a.misto === b.misto && a.nazev === b.nazev, `${popis}: render`);
}

bezZmeny(
  udalost({
    id: "kino-svetozor",
    redakcniPolozkaId: "kino-svetozor",
    mistoNeboTyp: "Kino Světozor",
    nazev: "Film",
    verejneCo: "Kino",
    verejneRozliseni: "Světozor",
  }),
  "H Kino Světozor",
);
bezZmeny(
  udalost({
    id: "kino-aurora",
    redakcniPolozkaId: "kino-aurora",
    mistoNeboTyp: "Kino Aurora",
    nazev: "Film",
    verejneCo: "Kino",
    verejneRozliseni: "Aurora",
  }),
  "H Kino Aurora",
);
bezZmeny(
  udalost({
    id: "nocturna",
    redakcniPolozkaId: "trebonska-nocturna",
    mistoNeboTyp: "Třeboňská nocturna Divadlo J. K. Tyla",
    nazev: "Matyáš Novák - Smetana Reborn",
    cas: "19:00",
    verejneCo: "Třeboňská nocturna",
    verejneRozliseni: "Divadlo J. K. Tyla",
  }),
  "H Nocturna",
);
bezZmeny(
  udalost({
    id: "tyla",
    redakcniPolozkaId: "divadlo-jk-tyla",
    mistoNeboTyp: "Divadlo J. K. Tyla",
    nazev: "Představení",
    verejneCo: "Divadlo",
    verejneRozliseni: "J. K. Tyla",
  }),
  "H Tyla",
);
bezZmeny(
  udalost({
    id: "galerie-105",
    redakcniPolozkaId: "galerie-105",
    mistoNeboTyp: "Výstava Galerie 105",
    nazev: "Výstava",
    verejneCo: "Výstava",
    verejneRozliseni: "Galerie 105",
  }),
  "H Galerie 105",
);
{
  const trh = udalost({
    id: "trhy",
    redakcniPolozkaId: "trhy",
    mistoNeboTyp: "Trh náměstí",
    nazev: "Trhy",
    verejneCo: "Trh",
    verejneRozliseni: "náměstí",
  });
  bezZmeny(trh, "H Trh");
  const vypisTrh = render(trh);
  assert(vypisTrh.oddelovacPredMistem === " · ", "H Trh: oddělovač beze změny");
}

{
  const verejne = {
    mistoNeboTyp: poAmarcord.mistoNeboTyp,
    nazev: poAmarcord.nazev,
    cas: poAmarcord.cas,
    verejneCo: poAmarcord.verejneCo,
    verejneRozliseni: poAmarcord.verejneRozliseni ?? null,
  };
  const z = rozlozAkci(verejne);
  assert(z.typ === "Vernisáž", "I: veřejný render CO");
  assert(z.misto === "Dům Š. Netolického", "I: veřejný render KDE");
  assert(
    z.nazev === "AMARCORD v Galerii města Třeboň",
    "I: veřejný render název",
  );
}

const root = join(__dirname, "..");
const obrazovka = readFileSync(
  join(root, "src/components/brana/BranaObrazovka.tsx"),
  "utf8",
);
const verejnePohledy = readFileSync(
  join(root, "src/lib/brana/verejne-schvalene-pohledy.ts"),
  "utf8",
);
const rozlozeni = readFileSync(
  join(root, "src/lib/brana/admin/akce-rozlozeni.ts"),
  "utf8",
);
const formular = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminKalendarRucniZapis.tsx"),
  "utf8",
);
assert(obrazovka.includes("rozlozAkci(akce)"), "I: veřejná BRÁNA bere rozlozAkci");
assert(obrazovka.includes("brana-akce-typ"), "I: veřejná BRÁNA akcentní CO");
assert(
  verejnePohledy.includes("verejneCo: udalost.verejneCo"),
  "I: publikace kopíruje verejneCo",
);
assert(
  verejnePohledy.includes("verejneRozliseni: udalost.verejneRozliseni ?? null"),
  "I: publikace kopíruje verejneRozliseni",
);
assert(rozlozeni.includes("JEDNOSLOVNE_TYPY_AKCE"), "I: rozlozAkci beze změny kontraktu");
assert(formular.includes(">CO</span>") || /CO<\/span>/.test(formular), "UI: pole CO");
assert(formular.includes(">KDE</span>") || /KDE<\/span>/.test(formular), "UI: pole KDE");
assert(
  formular.includes("jeStrukturovanyVerejnyZapis"),
  "UI: rozlišení strukturované události",
);

{
  const ok = validovatAutomatickouCekaUpravuVstup({
    datumOd: "2026-09-12",
    datumDo: "2026-09-12",
    cas: "17:00",
    nazev: "AMARCORD v Galerii města Třeboň",
    verejneCo: "Vernisáž",
    verejneRozliseni: "Dům Š. Netolického",
  });
  assert(ok.ok, "validace: strukturovaný vstup");
  if (ok.ok) {
    assert(ok.uprava.verejneCo === "Vernisáž", "validace: CO");
    assert(ok.uprava.verejneRozliseni === "Dům Š. Netolického", "validace: KDE");
    assert(
      ok.uprava.mistoNeboTyp === "Vernisáž Dům Š. Netolického",
      "validace: složeno",
    );
  }
  const prazdne = validovatAutomatickouCekaUpravuVstup({
    datumOd: "2026-09-12",
    datumDo: "2026-09-12",
    cas: "17:00",
    nazev: "Název",
    verejneCo: null,
    verejneRozliseni: null,
  });
  assert(!prazdne.ok, "validace: prázdné CO i KDE");
  const jenKde = validovatAutomatickouCekaUpravuVstup({
    datumOd: "2026-09-12",
    datumDo: "2026-09-12",
    cas: "17:00",
    nazev: "Název",
    verejneCo: null,
    verejneRozliseni: "Dům Š. Netolického",
  });
  assert(jenKde.ok, "validace: prázdné CO + KDE stačí");
}

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly strukturovaného Upravit CO/KDE prošly.");
