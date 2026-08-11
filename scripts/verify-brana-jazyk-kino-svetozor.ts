/**
 * Ověření strukturovaného jazyka BRÁNY – vzorek Kino Světozor.
 * Spuštění: npx tsx scripts/verify-brana-jazyk-kino-svetozor.ts
 */

import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  maStrukturovanyJazykPravidla,
  vychoziJazykVerejnyProId,
  vytvoritVychoziStavPolozky,
  BRANA_REDAKCNI_VSECHNY_VYCHOZI,
} from "../src/lib/brana/admin/redakcni-kostra";
import { validovatRucniUdalostVstup } from "../src/lib/brana/admin/rucni-udalost-validace";
import {
  sloucitUlozeneSKostrou,
  validovatRedakcniPoradiVstup,
} from "../src/lib/brana/admin/redakcni-poradi-validace";

let selhalo = 0;

function assert(podminka: boolean, popis: string) {
  if (!podminka) {
    selhalo += 1;
    console.error(`FAIL: ${popis}`);
    return;
  }
  console.log(`OK: ${popis}`);
}

// 1) Výchozí jazyk kino-svetozor vs ostatní
const jazykSvetozor = vychoziJazykVerejnyProId("kino-svetozor");
assert(jazykSvetozor !== null, "kino-svetozor má strukturovaný jazyk");
assert(jazykSvetozor?.co === "Kino", "kino-svetozor co = Kino");
assert(jazykSvetozor?.rozliseni === "Světozor", "kino-svetozor rozliseni = Světozor");
assert(
  maStrukturovanyJazykPravidla({ jazykVerejny: jazykSvetozor }),
  "kino-svetozor maStrukturovany = true",
);

const jiny = vychoziJazykVerejnyProId("divadlo-jk-tyla");
assert(jiny === null, "ostatní položky: jazykVerejny null (legacy)");
assert(
  !maStrukturovanyJazykPravidla({ jazykVerejny: null }),
  "null ≠ strukturovaný jazyk",
);

// Explicitní CO=NIC ≠ nenastavený jazyk
assert(
  maStrukturovanyJazykPravidla({
    jazykVerejny: { co: null, rozliseni: "Světozor" },
  }),
  "strukturovaný s CO=NIC je stále strukturovaný",
);

// 2) Po matchi → verejne*
const poMatchi = sestavJazykBranyPoSparovani({
  polozka: "Kino Světozor",
  kandidatMisto: "Kino Světozor",
  zdrojNazev: "Kino Třeboň",
  jazykVerejny: { co: "Kino", rozliseni: "Světozor" },
});
assert(poMatchi.mistoNeboTyp === "Kino Světozor", "legacy mistoNeboTyp zachován");
assert(poMatchi.verejneCo === "Kino", "po matchi verejneCo = Kino");
assert(
  poMatchi.verejneRozliseni === "Světozor",
  "po matchi verejneRozliseni = Světozor",
);

const legacyMatch = sestavJazykBranyPoSparovani({
  polozka: "Divadlo J. K. Tyla",
  kandidatMisto: "",
  zdrojNazev: "iTřeboň",
  jazykVerejny: null,
});
assert(
  legacyMatch.verejneCo === undefined,
  "legacy match: verejneCo undefined",
);
assert(
  legacyMatch.mistoNeboTyp === "Divadlo J. K. Tyla",
  "legacy match: mistoNeboTyp z polozky",
);

// 3) Veřejný rozklad strukturovaný
const struktura = rozlozAkci({
  mistoNeboTyp: "Kino Světozor",
  nazev: "Ďábel nosí Pradu",
  cas: "18:00",
  verejneCo: "Kino",
  verejneRozliseni: "Světozor",
});
assert(struktura.typ === "Kino", "renderer typ = Kino");
assert(struktura.misto === "Světozor", "renderer misto = Světozor");
assert(struktura.nazev === "Ďábel nosí Pradu", "renderer nazev = film");
assert(struktura.cas === "18:00", "renderer cas");

// 4) Legacy bez verejneCo
const legacy = rozlozAkci({
  mistoNeboTyp: "Kino Světozor",
  nazev: "Starý film",
  cas: "20:00",
});
assert(legacy.typ === "Kino", "legacy typ z mistoNeboTyp");
assert(legacy.misto === "Světozor", "legacy misto z mistoNeboTyp");
assert(legacy.nazev === "Starý film", "legacy nazev");

const legacyBezWhitelistu = rozlozAkci({
  mistoNeboTyp: "Státní zámek Třeboň",
  nazev: "Noční prohlídka",
  cas: "21:00",
});
assert(
  legacyBezWhitelistu.typ === "Státní zámek Třeboň",
  "legacy bez whitelistu: celé v typ",
);
assert(
  legacyBezWhitelistu.misto === "Noční prohlídka",
  "legacy bez whitelistu: nazev → misto",
);
assert(legacyBezWhitelistu.nazev === "", "legacy bez whitelistu: nazev prázdný");

// 5) Ruční událost – beze změny
const rucni = validovatRucniUdalostVstup({
  datumOd: "2026-08-11",
  datumDo: "2026-08-11",
  cas: "19:30",
  mistoNeboTyp: "Koncert",
  nazev: "Mimořádný večerní koncert",
  rucniPoziceVDni: 0,
});
assert(rucni.ok === true, "ruční validace ok");
if (rucni.ok) {
  assert(rucni.udalost.redakcniPolozkaId === null, "ruční: redakcniPolozkaId null");
  assert(rucni.udalost.stavSchvaleni === "SCHVALENO", "ruční: SCHVALENO");
  assert(
    rucni.udalost.verejneCo === undefined,
    "ruční: verejneCo undefined (legacy)",
  );
  assert(rucni.udalost.mistoNeboTyp === "Koncert", "ruční: mistoNeboTyp");
}

const rucniRozklad = rozlozAkci({
  mistoNeboTyp: "Koncert",
  nazev: "Mimořádný večerní koncert",
  cas: "19:30",
});
assert(rucniRozklad.typ === "Koncert", "ruční renderer: Koncert");
assert(rucniRozklad.nazev === "Mimořádný večerní koncert", "ruční renderer: název");

// 6) Merge starého Blobu bez jazykVerejny → seed jen kino-svetozor
const sloucen = sloucitUlozeneSKostrou({
  polozky: BRANA_REDAKCNI_VSECHNY_VYCHOZI.map((v) => ({
    id: v.id,
    polozka: v.polozka,
    pouzivat: v.pouzivat,
    priorita: null,
    subpriorita: null,
    vyhled: "NE",
    poznamka: "",
  })),
});
const svetozor = sloucen.find((p) => p.id === "kino-svetozor");
assert(!!svetozor, "sloučení obsahuje kino-svetozor");
assert(svetozor?.jazykVerejny?.co === "Kino", "sloučení: kino-svetozor co");
assert(
  svetozor?.jazykVerejny?.rozliseni === "Světozor",
  "sloučení: kino-svetozor rozlišení",
);
const ostatniLegacy = sloucen.filter((p) => p.id !== "kino-svetozor");
assert(
  ostatniLegacy.every((p) => p.jazykVerejny === null),
  "ostatních 51: jazykVerejny null",
);

// 7) Validace kompletní sady
const vychozi = BRANA_REDAKCNI_VSECHNY_VYCHOZI.map(vytvoritVychoziStavPolozky);
const validace = validovatRedakcniPoradiVstup(vychozi);
assert(validace.ok === true, "validace výchozího Redakčního pořadí");
if (validace.ok) {
  const ks = validace.polozky.find((p) => p.id === "kino-svetozor");
  assert(ks?.jazykVerejny?.co === "Kino", "validace: kino-svetozor co");
  assert(
    validace.polozky.filter((p) => p.id !== "kino-svetozor").every(
      (p) => p.jazykVerejny === null,
    ),
    "validace: 51× legacy",
  );
}

// Žádný Z_UDALOSTI v modelu
const modelText = JSON.stringify(vychozi.find((p) => p.id === "kino-svetozor"));
assert(!modelText.includes("Z_UDALOSTI"), "model neobsahuje Z_UDALOSTI");

console.log(selhalo === 0 ? "\nVŠE OK" : `\nSELHÁNÍ: ${selhalo}`);
process.exit(selhalo === 0 ? 0 : 1);
