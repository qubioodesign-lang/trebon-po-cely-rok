/**
 * Regrese: kanonizace místa Divadlo J. K. Tyla až po spárování.
 * Parser a matching musí zůstat u surového `…, Třeboň`.
 * Spuštění: npx tsx scripts/verify-brana-kanonizace-divadlo-jk-tyla.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  jeUdalostCelaMinula,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";
import {
  aplikovatUpravuAutomatickeUdalosti,
  maRedakcniOverride,
} from "../src/lib/brana/admin/redakcni-override";
import {
  vychoziJazykVerejnyProId,
  type BranaRedakcniPolozkaStav,
} from "../src/lib/brana/admin/redakcni-kostra";
import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import { sparovatSRedakcniPolozkou } from "../src/lib/brana/admin/zdroj-scan-sparovani";
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
const NOCTURNA_IDENTITA = "nocturna|/koncert/1-abonentni-koncert-2";
const SUROVE_MISTO = "Divadlo J. K. Tyla, Třeboň";
const KANONICKE_MISTO = "Divadlo J. K. Tyla";
const NOCTURNA_MISTO = "Třeboňská nocturna Divadlo J. K. Tyla";

const NOCTURNA_HTML = `<!DOCTYPE html>
<html><head><title>Úvod | Třeboňská nocturna</title></head><body>
<div class="oxy-dynamic-list">
  <div class="ct-div-block">
    <div><span>15. 10. 2026 19:00</span></div>
    <div><span><a href="https://www.trebonskanocturna.cz/koncert/1-abonentni-koncert-2/">Matyáš Novák - Smetana Reborn</a></span></div>
    <div><span>Divadlo J. K. Tyla, Třeboň</span></div>
  </div>
</div>
</body></html>`;

function polozka(
  partial: Pick<BranaRedakcniPolozkaStav, "id" | "polozka"> &
    Partial<BranaRedakcniPolozkaStav>,
): BranaRedakcniPolozkaStav {
  return {
    id: partial.id,
    polozka: partial.polozka,
    pouzivat: partial.pouzivat ?? "ANO",
    priorita: partial.priorita ?? null,
    subpriorita: partial.subpriorita ?? null,
    vyhled: partial.vyhled ?? "NE",
    vyhledSerie: partial.vyhledSerie ?? true,
    poznamka: partial.poznamka ?? "",
    mimoKostru: partial.mimoKostru ?? false,
    jazykVerejny: partial.jazykVerejny ?? null,
  };
}

const POLOZKY: BranaRedakcniPolozkaStav[] = [
  polozka({
    id: "divadlo-jk-tyla",
    polozka: "Divadlo J. K. Tyla",
    priorita: 5,
  }),
  polozka({
    id: "trebonska-nocturna",
    polozka: "Třeboňská nocturna",
    priorita: 15,
  }),
];

function jazykNocturny() {
  return sestavJazykBranyPoSparovani({
    polozka: "Třeboňská nocturna",
    kandidatMisto: SUROVE_MISTO,
    zdrojNazev: "Třeboňská nocturna",
    jazykVerejny: vychoziJazykVerejnyProId("trebonska-nocturna"),
  });
}

function ceka(
  partial: Partial<BranaKonkretniUdalost> & Pick<BranaKonkretniUdalost, "id">,
): BranaKonkretniUdalost {
  return {
    redakcniPolozkaId: "trebonska-nocturna",
    datumOd: "2026-10-15",
    datumDo: "2026-10-15",
    cas: "19:00",
    mistoNeboTyp: NOCTURNA_MISTO,
    nazev: "Matyáš Novák - Smetana Reborn",
    rucniPoziceVDni: null,
    stavSchvaleni: "CEKA_NA_SCHVALENI",
    scanKlic: "klic",
    zdrojIdentita: NOCTURNA_IDENTITA,
    verejneCo: "Třeboňská nocturna",
    verejneRozliseni: KANONICKE_MISTO,
    ...partial,
  };
}

function kandidatScan(
  partial: Partial<BranaScanAutomatickaUdalostVstup> = {},
): BranaScanAutomatickaUdalostVstup {
  const jazyk = jazykNocturny();
  return {
    redakcniPolozkaId: "trebonska-nocturna",
    datumOd: "2026-10-15",
    datumDo: "2026-10-15",
    cas: "19:00",
    mistoNeboTyp: jazyk.mistoNeboTyp,
    nazev: "Matyáš Novák - Smetana Reborn",
    zdrojIdentita: NOCTURNA_IDENTITA,
    verejneCo: jazyk.verejneCo,
    verejneRozliseni: jazyk.verejneRozliseni ?? null,
    ...partial,
  };
}

function scan(
  pred: readonly BranaKonkretniUdalost[],
  k: BranaScanAutomatickaUdalostVstup,
) {
  return aplikovatScanKandidatyNaUdalosti(pred, [k], DNES, jeUdalostCelaMinula);
}

/* A — parser dál emituje surové místo */
{
  const kandidati = parsovatUdalostiZeZdroje(NOCTURNA_HTML, "text/html");
  assert(kandidati.length === 1, "A: 1 kandidát Nocturny");
  assert(
    kandidati[0].mistoNeboTyp === SUROVE_MISTO,
    `A: parser místo = surové (${kandidati[0]?.mistoNeboTyp})`,
  );
  assert(
    kandidati[0].nazev === "Matyáš Novák - Smetana Reborn",
    "A: název ze zdroje",
  );
  assert(kandidati[0].datumOd === "2026-10-15", "A: datum ze zdroje");
  assert(kandidati[0].cas === "19:00", "A: čas ze zdroje");
}

/* B — matching dál na trebonska-nocturna */
{
  const r = sparovatSRedakcniPolozkou(
    {
      nazev: "Matyáš Novák - Smetana Reborn",
      datumOd: "2026-10-15",
      datumDo: "2026-10-15",
      cas: "19:00",
      mistoNeboTyp: SUROVE_MISTO,
    },
    POLOZKY,
    { zdrojNazev: "Třeboňská nocturna" },
  );
  assert(r.ok, "B: matching MATCH");
  assert(
    r.ok && r.redakcniPolozkaId === "trebonska-nocturna",
    `B: trebonska-nocturna (je ${r.ok ? r.redakcniPolozkaId : "?"})`,
  );
}

{
  const r = sparovatSRedakcniPolozkou(
    {
      nazev: "Matyáš Novák - Smetana Reborn",
      datumOd: "2026-10-15",
      datumDo: "2026-10-15",
      cas: "19:00",
      mistoNeboTyp: SUROVE_MISTO,
    },
    POLOZKY,
    { zdrojNazev: "iTřeboň – kalendář akcí" },
  );
  assert(
    r.ok && r.redakcniPolozkaId === "divadlo-jk-tyla",
    "B: agregátor dál → divadlo-jk-tyla",
  );
}

/* C + D — redakční jazyk Nocturny */
{
  const jazyk = jazykNocturny();
  assert(jazyk.verejneCo === "Třeboňská nocturna", "C/D: verejneCo");
  assert(
    jazyk.verejneRozliseni === KANONICKE_MISTO,
    `C: verejneRozliseni kanonické (${jazyk.verejneRozliseni})`,
  );
  assert(
    jazyk.mistoNeboTyp === NOCTURNA_MISTO,
    `D: mistoNeboTyp (${jazyk.mistoNeboTyp})`,
  );
}

{
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: "Třeboňská nocturna",
    kandidatMisto: "Divadlo J.K. Tyla,  Třeboň",
    zdrojNazev: "Třeboňská nocturna",
    jazykVerejny: vychoziJazykVerejnyProId("trebonska-nocturna"),
  });
  assert(
    jazyk.verejneRozliseni === KANONICKE_MISTO,
    "C: tečky/mezery aliasu → stejná kanonizace",
  );
}

/* E — jiná Z_UDALOSTI kotva ve stejné budově */
{
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: "Třeboňská lázeňská matiné",
    kandidatMisto: SUROVE_MISTO,
    zdrojNazev: "Třeboňská lázeňská matiné",
    jazykVerejny: vychoziJazykVerejnyProId("trebonska-lazenska-matine"),
  });
  assert(jazyk.verejneCo === "Lázeňské matiné", "E: CO matiné beze změny");
  assert(
    jazyk.verejneRozliseni === KANONICKE_MISTO,
    "E: stejná kanonizace místa",
  );
  assert(
    jazyk.mistoNeboTyp === "Lázeňské matiné Divadlo J. K. Tyla",
    `E: mistoNeboTyp matiné (${jazyk.mistoNeboTyp})`,
  );
}

/* F — samostatná kotva Divadlo: PEVNE beze změny */
{
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: "Divadlo J. K. Tyla",
    kandidatMisto: SUROVE_MISTO,
    zdrojNazev: "iTřeboň – kalendář akcí",
    jazykVerejny: vychoziJazykVerejnyProId("divadlo-jk-tyla"),
  });
  assert(jazyk.verejneCo === "Divadlo", "F: PEVNE CO");
  assert(jazyk.verejneRozliseni === "J. K. Tyla", "F: PEVNE rozlišení");
  assert(jazyk.mistoNeboTyp === "Divadlo J. K. Tyla", "F: mistoNeboTyp PEVNE");
}

/* G — jiná místa s Třeboň / čárkou beze změny */
{
  const vzorky: readonly { misto: string; id: string }[] = [
    { misto: "Státní zámek Třeboň", id: "okolo-trebone" },
    { misto: "Lázeňská Třeboň", id: "trhy" },
    { misto: "Okolo Třeboně", id: "okolo-trebone" },
    { misto: "MINT Market Třeboň", id: "trhy" },
    { misto: "Nádvoří zámku, Třeboň", id: "trebonska-nocturna" },
    { misto: "Třeboň plná andělů", id: "trhy" },
  ];
  for (const v of vzorky) {
    const jazyk = sestavJazykBranyPoSparovani({
      polozka: "x",
      kandidatMisto: v.misto,
      zdrojNazev: "x",
      jazykVerejny: vychoziJazykVerejnyProId(v.id),
    });
    assert(
      jazyk.verejneRozliseni === v.misto,
      `G: „${v.misto}“ beze změny`,
    );
  }
}

/* H — stejná zdrojIdentita → žádná druhá CEKA */
{
  const pred = ceka({ id: "auto-h" });
  const { udalosti, vysledek } = scan([pred], kandidatScan());
  assert(vysledek.pridano === 0, "H: pridano = 0");
  assert(udalosti.length === 1, "H: stále 1 událost");
  assert(udalosti[0].id === "auto-h", "H: stejné id");
  assert(
    udalosti[0].zdrojIdentita === NOCTURNA_IDENTITA,
    "H: zdrojIdentita beze změny",
  );
  assert(udalosti[0].scanKlic === "klic", "H: scanKlic beze změny");
}

{
  const pred = ceka({
    id: "auto-h2",
    mistoNeboTyp: "Třeboňská nocturna Divadlo J. K. Tyla, Třeboň",
    verejneRozliseni: SUROVE_MISTO,
  });
  const { udalosti, vysledek } = scan([pred], kandidatScan());
  assert(vysledek.pridano === 0, "H2: odemčená CEKA bez druhé karty");
  assert(udalosti.length === 1 && udalosti[0].id === "auto-h2", "H2: stejné id");
  assert(
    udalosti[0].mistoNeboTyp === NOCTURNA_MISTO,
    "H2: in-place kanonický zápis",
  );
  assert(
    udalosti[0].verejneRozliseni === KANONICKE_MISTO,
    "H2: verejneRozliseni kanonické",
  );
  assert(
    udalosti[0].stavSchvaleni === "CEKA_NA_SCHVALENI",
    "H2: stav CEKA",
  );
}

/* I — redakční override místa scan nepřepíše */
{
  const pred = aplikovatUpravuAutomatickeUdalosti(
    ceka({
      id: "auto-i",
      mistoNeboTyp: "Třeboňská nocturna Divadlo J. K. Tyla, Třeboň",
      verejneRozliseni: SUROVE_MISTO,
    }),
    {
      datumOd: "2026-10-15",
      datumDo: "2026-10-15",
      cas: "19:00",
      mistoNeboTyp: NOCTURNA_MISTO,
      nazev: "Matyáš Novák - Smetana Reborn",
    },
  );
  assert(maRedakcniOverride(pred, "mistoNeboTyp"), "I: místo je override");
  const { udalosti, vysledek } = scan(
    [pred],
    kandidatScan({
      mistoNeboTyp: "Třeboňská nocturna Jiná scéna",
      verejneRozliseni: "Jiná scéna",
    }),
  );
  assert(vysledek.pridano === 0, "I: bez druhé CEKA");
  assert(udalosti[0].mistoNeboTyp === NOCTURNA_MISTO, "I: ruční místo zůstalo");
  assert(
    udalosti[0].verejneRozliseni === KANONICKE_MISTO,
    "I: verejneRozliseni zůstalo",
  );
}

/* J — SCHVALENO / VYRAZENO beze změny */
{
  const pred = ceka({
    id: "auto-j-s",
    stavSchvaleni: "SCHVALENO",
    cas: "19:00",
    mistoNeboTyp: "Třeboňská nocturna Divadlo J. K. Tyla, Třeboň",
    verejneRozliseni: SUROVE_MISTO,
  });
  const { udalosti, vysledek } = scan(
    [pred],
    kandidatScan({ cas: "21:00" }),
  );
  assert(vysledek.pridano === 0 && vysledek.aktualizovano === 0, "J: SCHVALENO bez zápisu");
  assert(udalosti[0].cas === "19:00", "J: SCHVALENO čas");
  assert(
    udalosti[0].mistoNeboTyp === "Třeboňská nocturna Divadlo J. K. Tyla, Třeboň",
    "J: SCHVALENO místo nedotčeno",
  );
  assert(udalosti[0].stavSchvaleni === "SCHVALENO", "J: stav SCHVALENO");
}

{
  const pred = ceka({
    id: "auto-j-v",
    stavSchvaleni: "VYRAZENO",
  });
  const { udalosti, vysledek } = scan(
    [pred],
    kandidatScan({ cas: "21:00" }),
  );
  assert(vysledek.pridano === 0 && vysledek.aktualizovano === 0, "J: VYRAZENO bez obnovení");
  assert(udalosti[0].stavSchvaleni === "VYRAZENO", "J: zůstává VYRAZENO");
  assert(udalosti[0].cas === "19:00", "J: VYRAZENO obsah");
}

/* Parser / matching soubory nesmí nést kanonizaci */
{
  const root = join(__dirname, "..");
  const parser = readFileSync(
    join(root, "src/lib/brana/admin/zdroj-scan-parser.ts"),
    "utf8",
  );
  const matching = readFileSync(
    join(root, "src/lib/brana/admin/zdroj-scan-sparovani.ts"),
    "utf8",
  );
  const jazyk = readFileSync(
    join(root, "src/lib/brana/admin/jazyk-brany-po-sparovani.ts"),
    "utf8",
  );
  assert(
    !parser.includes("kanonizovatMistoZUdalosti") &&
      !parser.includes("KANONICKE_MISTO_DIVADLO_JK_TYLA"),
    "zdroj: parser bez kanonizace",
  );
  assert(
    !matching.includes("kanonizovatMistoZUdalosti"),
    "zdroj: matching bez kanonizace",
  );
  assert(
    jazyk.includes("kanonizovatMistoZUdalosti") &&
      jazyk.includes("kdeZUdalosti"),
    "zdroj: kanonizace jen v jazykové vrstvě",
  );
}

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly kanonizace Divadlo J. K. Tyla prošly.");
