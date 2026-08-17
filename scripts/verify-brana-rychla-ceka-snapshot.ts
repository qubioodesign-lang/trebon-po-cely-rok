/**
 * Ověření snapshotu typZdroje RYCHLY: zápis, přežití, žádné zpětné značení.
 * Spuštění: npx tsx scripts/verify-brana-rychla-ceka-snapshot.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  aplikovatUpravuAutomatickeUdalosti,
} from "../src/lib/brana/admin/redakcni-override";
import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";
import {
  jeUdalostCelaMinula,
  maRychleCekaPodlozeni,
  vytvoritScanKlicAutomatickeUdalosti,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";

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
const KOTVA = "galerie-buddhistickeho-umeni";
const IDENTITA = "itrebon|19895";

function kandidat(
  partial: Partial<BranaScanAutomatickaUdalostVstup> & {
    nazev: string;
    datumOd: string;
  },
): BranaScanAutomatickaUdalostVstup {
  return {
    redakcniPolozkaId: KOTVA,
    datumOd: partial.datumOd,
    datumDo: partial.datumDo ?? partial.datumOd,
    cas: partial.cas ?? "18:00",
    mistoNeboTyp: partial.mistoNeboTyp ?? "Galerie buddhistického um.",
    nazev: partial.nazev,
    ...(partial.zdrojIdentita !== undefined
      ? { zdrojIdentita: partial.zdrojIdentita }
      : { zdrojIdentita: IDENTITA }),
    ...(partial.typZdroje === "RYCHLY" ? { typZdroje: "RYCHLY" } : {}),
    ...(partial.verejneCo !== undefined
      ? {
          verejneCo: partial.verejneCo,
          verejneRozliseni: partial.verejneRozliseni ?? null,
        }
      : {}),
  };
}

function scan(
  pred: readonly BranaKonkretniUdalost[],
  vstup: readonly BranaScanAutomatickaUdalostVstup[],
) {
  return aplikovatScanKandidatyNaUdalosti(
    pred,
    vstup,
    DNES,
    jeUdalostCelaMinula,
  );
}

// A: nový RYCHLY kandidát → snapshot na nové kartě
{
  const { udalosti, vysledek } = scan(
    [],
    [
      kandidat({
        nazev: "Harmonizační koncert",
        datumOd: "2026-08-23",
        typZdroje: "RYCHLY",
      }),
    ],
  );
  assert(vysledek.pridano === 1, "A: přidána 1 karta");
  assert(udalosti.length === 1, "A: právě 1 karta");
  assert(udalosti[0].typZdroje === "RYCHLY", "A: nová karta má snapshot RYCHLY");
  assert(
    udalosti[0].zdrojIdentita === IDENTITA,
    "A: zdrojIdentita beze změny významu",
  );
  assert(
    udalosti[0].stavSchvaleni === "CEKA_NA_SCHVALENI",
    "A: stav CEKA",
  );
}

// B: DLOUHODOBY kandidát → bez snapshotu
{
  const { udalosti, vysledek } = scan(
    [],
    [
      kandidat({
        nazev: "Dlouhodobá akce",
        datumOd: "2026-09-01",
        zdrojIdentita: "itrebon|1",
      }),
    ],
  );
  assert(vysledek.pridano === 1, "B: přidána 1 karta");
  assert(udalosti[0].typZdroje === undefined, "B: DLOUHODOBÁ karta bez snapshotu");
}

// C: druhý scan stejné RYCHLÉ CEKA → žádná duplicita, snapshot zůstane
{
  const prvni = scan(
    [],
    [
      kandidat({
        nazev: "Harmonizační koncert",
        datumOd: "2026-08-23",
        typZdroje: "RYCHLY",
      }),
    ],
  );
  const druhy = scan(prvni.udalosti, [
    kandidat({
      nazev: "Harmonizační koncert — úprava názvu",
      datumOd: "2026-08-23",
      typZdroje: "RYCHLY",
    }),
  ]);
  assert(druhy.vysledek.pridano === 0, "C: druhý scan nepřidá kartu");
  assert(druhy.vysledek.aktualizovano === 1, "C: in-place update CEKA");
  assert(druhy.udalosti.length === 1, "C: žádná duplicita");
  assert(druhy.udalosti[0].id === prvni.udalosti[0].id, "C: stejné id");
  assert(druhy.udalosti[0].typZdroje === "RYCHLY", "C: snapshot zůstane");
  assert(
    druhy.udalosti[0].nazev === "Harmonizační koncert — úprava názvu",
    "C: obsah se aktualizoval",
  );
}

// D: Upravit RYCHLÉ CEKA → snapshot zůstane
{
  const { udalosti } = scan(
    [],
    [
      kandidat({
        nazev: "Harmonizační koncert",
        datumOd: "2026-08-23",
        typZdroje: "RYCHLY",
        verejneCo: "Zvuková lázeň",
        verejneRozliseni: "Galerie buddhistického um.",
      }),
    ],
  );
  const upravena = aplikovatUpravuAutomatickeUdalosti(udalosti[0], {
    datumOd: "2026-08-23",
    datumDo: "2026-08-23",
    cas: "19:00",
    mistoNeboTyp: "Zvuková lázeň Galerie buddhistického um.",
    nazev: "Upravený název",
    verejneCo: "Zvuková lázeň",
    verejneRozliseni: "Galerie buddhistického um.",
  });
  assert(upravena.typZdroje === "RYCHLY", "D: Upravit snapshot nesmaže");
  assert(upravena.nazev === "Upravený název", "D: název se změnil");
  assert(upravena.stavSchvaleni === "CEKA_NA_SCHVALENI", "D: stav beze změny");
}

// E: SCHVALENO / VYRAZENO další scan nepřepíše
{
  const { udalosti } = scan(
    [],
    [
      kandidat({
        nazev: "Harmonizační koncert",
        datumOd: "2026-08-23",
        typZdroje: "RYCHLY",
      }),
    ],
  );
  const schvalena: BranaKonkretniUdalost = {
    ...udalosti[0],
    stavSchvaleni: "SCHVALENO",
  };
  const poSch = scan([schvalena], [
    kandidat({
      nazev: "Jiný název ze zdroje",
      datumOd: "2026-08-23",
      typZdroje: "RYCHLY",
    }),
  ]);
  assert(poSch.vysledek.pridano === 0, "E: SCHVALENO se nepřidá znovu");
  assert(poSch.udalosti.length === 1, "E: stále 1 karta");
  assert(poSch.udalosti[0].stavSchvaleni === "SCHVALENO", "E: SCHVALENO drží");
  assert(poSch.udalosti[0].nazev === "Harmonizační koncert", "E: obsah SCHVALENO beze změny");

  const vyrazena: BranaKonkretniUdalost = {
    ...udalosti[0],
    stavSchvaleni: "VYRAZENO",
  };
  const poVyr = scan([vyrazena], [
    kandidat({
      nazev: "Jiný název ze zdroje",
      datumOd: "2026-08-23",
      typZdroje: "RYCHLY",
    }),
  ]);
  assert(poVyr.vysledek.pridano === 0, "E: VYRAZENO se nepřidá znovu");
  assert(poVyr.udalosti[0].stavSchvaleni === "VYRAZENO", "E: VYRAZENO drží");
}

// F: stará karta bez snapshotu se zpětně neoznačí
{
  const stara: BranaKonkretniUdalost = {
    id: "auto-stara",
    redakcniPolozkaId: KOTVA,
    datumOd: "2026-08-23",
    datumDo: "2026-08-23",
    cas: "18:00",
    mistoNeboTyp: "Galerie buddhistického um.",
    nazev: "Harmonizační koncert",
    rucniPoziceVDni: null,
    stavSchvaleni: "CEKA_NA_SCHVALENI",
    scanKlic: vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: KOTVA,
      datumOd: "2026-08-23",
      cas: "18:00",
      nazev: "Harmonizační koncert",
    }),
    zdrojIdentita: IDENTITA,
  };
  const po = scan([stara], [
    kandidat({
      nazev: "Harmonizační koncert — nový text",
      datumOd: "2026-08-23",
      typZdroje: "RYCHLY",
    }),
  ]);
  assert(po.vysledek.pridano === 0, "F: stará karta se neduplikuje");
  assert(po.udalosti.length === 1, "F: stále 1 karta");
  assert(po.udalosti[0].id === "auto-stara", "F: stejné id");
  assert(
    po.udalosti[0].typZdroje === undefined,
    "F: stará karta se zpětně neoznačí jako RYCHLÁ",
  );
}

// Vizuál: jen CEKA + RYCHLY
{
  const rychlaCeka: BranaKonkretniUdalost = {
    id: "v1",
    redakcniPolozkaId: KOTVA,
    datumOd: "2026-08-23",
    datumDo: "2026-08-23",
    cas: "18:00",
    mistoNeboTyp: "t",
    nazev: "t",
    rucniPoziceVDni: null,
    stavSchvaleni: "CEKA_NA_SCHVALENI",
    typZdroje: "RYCHLY",
  };
  const staraCeka: BranaKonkretniUdalost = {
    ...rychlaCeka,
    id: "v2",
    typZdroje: undefined,
  };
  delete (staraCeka as { typZdroje?: "RYCHLY" }).typZdroje;
  const schvalena: BranaKonkretniUdalost = {
    ...rychlaCeka,
    id: "v3",
    stavSchvaleni: "SCHVALENO",
  };
  assert(maRychleCekaPodlozeni(rychlaCeka) === true, "V1: CEKA + RYCHLY má podložení");
  assert(maRychleCekaPodlozeni(staraCeka) === false, "V2: CEKA bez RYCHLY původní");
  assert(maRychleCekaPodlozeni(schvalena) === false, "V3: SCHVALENO rychlé podložení nemá");
}

const root = process.cwd();
const ui = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminKalendarRucniZapis.tsx"),
  "utf8",
);
const css = readFileSync(
  join(root, "src/app/brana/admin/brana-admin-kalendar.css"),
  "utf8",
);
const verejne = readFileSync(
  join(root, "src/lib/brana/verejne-schvalene-pohledy.ts"),
  "utf8",
);
const uloziste = readFileSync(
  join(root, "src/lib/brana/admin/konkretni-udalosti-uloziste.ts"),
  "utf8",
);
const skenovat = readFileSync(
  join(root, "src/lib/brana/admin/skenovat-zdroj.ts"),
  "utf8",
);

assert(
  ui.includes("maRychleCekaPodlozeni") &&
    ui.includes("brana-admin-akce-ceka-rychla"),
  "V4: Kalendář váže rychlé podložení na helper",
);
assert(
  css.includes("brana-admin-akce-ceka-rychla"),
  "V5: CSS má jemné rychlé podložení",
);
assert(
  !verejne.includes("typZdroje") &&
    verejne.includes("function doVerejneAkce"),
  "G: veřejná projekce typZdroje nepřebírá",
);
assert(
  uloziste.includes("duvodZamitnutiUdalostiProSchvalitKontrolu") &&
    uloziste.includes("const VERZE_ULOZISTE = 1"),
  "S: serverová dávka používá stejnou ochranu; verze Blobu 1",
);
assert(
  skenovat.includes('zdroj.typ === "RYCHLY"') &&
    skenovat.includes('typZdroje: "RYCHLY"'),
  "Z: snapshot se předává z zdroj.typ v jádru scanu",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}

console.log("\nVšechny kontroly prošly.");
