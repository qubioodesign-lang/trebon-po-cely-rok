/**
 * DSN varianta B: scanKlic ze surového titulku, uložený nazev čistý.
 * Spuštění: npx tsx scripts/verify-brana-dsn-redakcni-zapis.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  BRANA_DSN_KDE,
  BRANA_DSN_REDAKCNI_POLOZKA_ID,
  rozdelDsnTitulek,
  sestavDsnZapisPoSparovani,
} from "../src/lib/brana/admin/dsn-titulek";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  jeUdalostCelaMinula,
  vytvoritScanKlicAutomatickeUdalosti,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";
import { aplikovatUpravuAutomatickeUdalosti } from "../src/lib/brana/admin/redakcni-override";
import { vychoziJazykVerejnyProId } from "../src/lib/brana/admin/redakcni-kostra";
import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import { sparovatSRedakcniPolozkou } from "../src/lib/brana/admin/zdroj-scan-sparovani";
import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";
import type { BranaRedakcniPolozkaStav } from "../src/lib/brana/admin/redakcni-kostra";

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
const DSN_ID = BRANA_DSN_REDAKCNI_POLOZKA_ID;

function jazykDsn() {
  return sestavJazykBranyPoSparovani({
    polozka: "Dům Štěpánka Netolického",
    kandidatMisto: "",
    zdrojNazev: "Dům Štěpánka Netolického",
    jazykVerejny: vychoziJazykVerejnyProId(DSN_ID),
  });
}

function dsnVstup(surovyNazev: string, datumOd: string, cas: string) {
  const zapis = sestavDsnZapisPoSparovani({
    surovyNazev,
    jazyk: jazykDsn(),
  });
  const vstup: BranaScanAutomatickaUdalostVstup = {
    redakcniPolozkaId: DSN_ID,
    datumOd,
    datumDo: datumOd,
    cas,
    mistoNeboTyp: zapis.mistoNeboTyp,
    nazev: zapis.nazev,
    ...(zapis.nazevProScanKlic
      ? { nazevProScanKlic: zapis.nazevProScanKlic }
      : {}),
    ...(zapis.verejneCo !== undefined
      ? {
          verejneCo: zapis.verejneCo,
          verejneRozliseni: zapis.verejneRozliseni ?? null,
        }
      : {}),
  };
  return { zapis, vstup };
}

function scan(
  pred: readonly BranaKonkretniUdalost[],
  k: BranaScanAutomatickaUdalostVstup,
) {
  return aplikovatScanKandidatyNaUdalosti(pred, [k], DNES, jeUdalostCelaMinula);
}

function klicZeSuroveho(surovy: string, datumOd: string, cas: string): string {
  return vytvoritScanKlicAutomatickeUdalosti({
    redakcniPolozkaId: DSN_ID,
    datumOd,
    cas,
    nazev: surovy,
  });
}

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

/* Povinná brána: starý klic === klic z nazevProScanKlic */
{
  const surovy = "Přednáška Krkavcovití – nejchytřejší ptáci";
  const stary = klicZeSuroveho(surovy, "2026-10-15", "18:00");
  const { vstup } = dsnVstup(surovy, "2026-10-15", "18:00");
  const novy = vytvoritScanKlicAutomatickeUdalosti({
    redakcniPolozkaId: vstup.redakcniPolozkaId,
    datumOd: vstup.datumOd,
    cas: vstup.cas,
    nazev: vstup.nazevProScanKlic ?? vstup.nazev,
  });
  assert(stary === novy, "brána: starý scanKlic = klic ze surového titulku");
  assert(
    vstup.nazev === "Krkavcovití – nejchytřejší ptáci",
    "brána: uložený nazev je čistý",
  );
  assert(vstup.nazevProScanKlic === surovy, "brána: nazevProScanKlic = surový");
}

/* A — writer bez nazevProScanKlic 1:1 */
{
  const kino: BranaScanAutomatickaUdalostVstup = {
    redakcniPolozkaId: "kino-aurora",
    datumOd: "2026-10-05",
    datumDo: "2026-10-05",
    cas: "19:30",
    mistoNeboTyp: "Kino Aurora",
    nazev: "Třetí člověk",
    verejneCo: "Kino",
    verejneRozliseni: "Aurora",
  };
  const klic = vytvoritScanKlicAutomatickeUdalosti({
    redakcniPolozkaId: kino.redakcniPolozkaId,
    datumOd: kino.datumOd,
    cas: kino.cas,
    nazev: kino.nazev,
  });
  const { udalosti, vysledek } = scan([], kino);
  assert(vysledek.pridano === 1, "A: kino přidáno");
  assert(udalosti[0].nazev === "Třetí člověk", "A: nazev ze zdroje");
  assert(udalosti[0].scanKlic === klic, "A: scanKlic z nazev");
  const znovu = scan(udalosti, kino);
  assert(znovu.vysledek.pridano === 0, "A: druhý scan kina bez duplicity");
}

/* B + D — pět schválených převodů */
const prevody: readonly {
  zdroj: string;
  co: string;
  nazev: string;
  popisek: string;
}[] = [
  {
    zdroj: "Přednáška Krkavcovití – nejchytřejší ptáci",
    co: "Přednáška",
    nazev: "Krkavcovití – nejchytřejší ptáci",
    popisek: "D/A Přednáška",
  },
  {
    zdroj: "Vernisáž výstavy Intimita kůže/Intimita mysli",
    co: "Vernisáž",
    nazev: "Intimita kůže/Intimita mysli",
    popisek: "D/B Vernisáž Intimita",
  },
  {
    zdroj: "Vernisáž výstavy AMARCORD v Galerii města Třeboň",
    co: "Vernisáž",
    nazev: "AMARCORD v Galerii města Třeboň",
    popisek: "D/C Vernisáž AMARCORD",
  },
  {
    zdroj: "KOMENTOVANÁ PROHLÍDKA VÝSTAVY 35 let Okolo Třeboně",
    co: "Komentovaná prohlídka",
    nazev: "35 let Okolo Třeboně",
    popisek: "D/D komentovaná prohlídka",
  },
  {
    zdroj: "Dny otevřených ateliérů – akce ve spolupráci",
    co: "Dny otevřených ateliérů",
    nazev: "akce ve spolupráci",
    popisek: "D/E ateliéry",
  },
];

for (const p of prevody) {
  const { zapis } = dsnVstup(p.zdroj, "2026-10-15", "18:00");
  assert(zapis.verejneCo === p.co, `${p.popisek}: CO`);
  assert(zapis.verejneRozliseni === BRANA_DSN_KDE, `${p.popisek}: KDE`);
  assert(zapis.nazev === p.nazev, `${p.popisek}: nazev (${zapis.nazev})`);
  assert(zapis.nazevProScanKlic === p.zdroj, `${p.popisek}: nazevProScanKlic`);
  assert(
    zapis.mistoNeboTyp === `${p.co} ${BRANA_DSN_KDE}`,
    `${p.popisek}: mistoNeboTyp`,
  );
}

/* C + H — nová DSN + opakovaný scan */
{
  const surovy = "Přednáška Krkavcovití – nejchytřejší ptáci";
  const { vstup } = dsnVstup(surovy, "2026-10-15", "18:00");
  const prvni = scan([], vstup);
  assert(prvni.vysledek.pridano === 1, "H: nová DSN přidána");
  assert(
    prvni.udalosti[0].nazev === "Krkavcovití – nejchytřejší ptáci",
    "H: uložený čistý nazev",
  );
  assert(
    prvni.udalosti[0].scanKlic === klicZeSuroveho(surovy, "2026-10-15", "18:00"),
    "H: scanKlic ze surového",
  );
  const druhy = scan(prvni.udalosti, vstup);
  assert(druhy.vysledek.pridano === 0, "C/H: opakovaný scan pridano=0");
  assert(druhy.udalosti.length === 1, "C/H: stále 1 karta");
  assert(druhy.udalosti[0].id === prvni.udalosti[0].id, "C/H: stejné id");
  assert(
    druhy.udalosti[0].nazev === prvni.udalosti[0].nazev,
    "C/H: nazev beze změny",
  );
}

/* E — neznámý typ */
{
  const surovy = "Beseda s pravnučkou sochaře J. Václava Myslbeka";
  assert(rozdelDsnTitulek(surovy) === null, "E: žádný prefix");
  const { zapis, vstup } = dsnVstup(surovy, "2026-09-26", "14:00");
  assert(zapis.nazev === surovy, "E: nazev celý titulek");
  assert(zapis.nazevProScanKlic === undefined, "E: bez nazevProScanKlic");
  assert(zapis.verejneCo == null, "E: CO nevytvořeno");
  assert(zapis.verejneRozliseni === BRANA_DSN_KDE, "E: KDE PEVNE");
  const r = rozlozAkci({
    mistoNeboTyp: zapis.mistoNeboTyp,
    nazev: zapis.nazev,
    cas: "14:00",
    verejneCo: zapis.verejneCo,
    verejneRozliseni: zapis.verejneRozliseni,
  });
  assert(r.typ === "" || r.typ.length === 0, "E: bez vymyšleného CO typu");
  assert(r.misto === BRANA_DSN_KDE, "E: KDE na 1. řádku");
  assert(r.nazev === surovy, "E: 2. řádek celý název");
  const { vysledek } = scan([], vstup);
  assert(vysledek.pridano === 1, "E: neznámý typ se uloží");
}

/* F — matching DSN beze změny */
{
  const r = sparovatSRedakcniPolozkou(
    {
      nazev: "Přednáška Krkavcovití – nejchytřejší ptáci",
      datumOd: "2026-10-15",
      datumDo: "2026-10-15",
      cas: "18:00",
      mistoNeboTyp: "",
    },
    [
      polozka({
        id: DSN_ID,
        polozka: "Dům Štěpánka Netolického",
        priorita: 6,
      }),
      polozka({
        id: "divadlo-jk-tyla",
        polozka: "Divadlo J. K. Tyla",
        priorita: 5,
      }),
    ],
    { zdrojNazev: "Dům Štěpánka Netolického" },
  );
  assert(r.ok && r.redakcniPolozkaId === DSN_ID, "F: matching → DSN");
}

/* G — parser DSN beze změny */
{
  const html = `<!DOCTYPE html>
<html><head><title>Kalendář | Dům Štěpánka Netolického</title>
<link rel="canonical" href="https://www.dumstepankanetolickeho.cz/kalendar-akci/"/>
</head><body>
<div class="col-sm-6 text-center">
  <div class="middle-padding home-block-wrapper event-item">
    <div class="home-block">
      <div class="home-block-header">
        <h2 class="h5">
          <a href="https://www.dumstepankanetolickeho.cz/akce/x/" title="Přednáška Krkavcovití – nejchytřejší ptáci">
            Přednáška Krkavcovití – nejchytřejší ptáci
          </a>
        </h2>
        <div class="small-padding"><small>15.10.2026 18:00</small></div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, "G: parser 1 kandidát");
  assert(
    k[0].nazev === "Přednáška Krkavcovití – nejchytřejší ptáci",
    "G: parser surový titulek",
  );
  assert(k[0].mistoNeboTyp === "", "G: parser misto prázdné");
}

/* H — existující DSN obsah nedotčen */
{
  const surovy = "Přednáška Krkavcovití – nejchytřejší ptáci";
  const staryKlic = klicZeSuroveho(surovy, "2026-10-15", "18:00");
  const existujici: BranaKonkretniUdalost = {
    id: "auto-etalon",
    redakcniPolozkaId: DSN_ID,
    datumOd: "2026-10-15",
    datumDo: "2026-10-15",
    cas: "18:00",
    mistoNeboTyp: "Dům Štěpánka Netolického",
    nazev: surovy,
    rucniPoziceVDni: null,
    stavSchvaleni: "CEKA_NA_SCHVALENI",
    scanKlic: staryKlic,
    verejneCo: null,
    verejneRozliseni: "Dům Štěpánka Netolického",
  };
  const { vstup } = dsnVstup(surovy, "2026-10-15", "18:00");
  const { udalosti, vysledek } = scan([existujici], vstup);
  assert(vysledek.pridano === 0, "povinný dedup: pridano=0");
  assert(udalosti.length === 1, "povinný dedup: 1 karta");
  assert(udalosti[0].id === "auto-etalon", "povinný dedup: stejné id");
  assert(udalosti[0].nazev === surovy, "H: etalonový nazev nedotčen");
  assert(
    udalosti[0].mistoNeboTyp === "Dům Štěpánka Netolického",
    "H: etalonové KDE nedotčeno",
  );
  assert(
    udalosti[0].verejneRozliseni === "Dům Štěpánka Netolického",
    "H: etalonové verejneRozliseni",
  );
  assert(udalosti[0].scanKlic === staryKlic, "H: scanKlic etalonu");
}

/* I — Upravit nové DSN: formulář = Kalendář */
{
  const surovy = "Přednáška Krkavcovití – nejchytřejší ptáci";
  const { vstup } = dsnVstup(surovy, "2026-10-15", "18:00");
  const { udalosti } = scan([], vstup);
  const u = udalosti[0];
  const render = rozlozAkci({
    mistoNeboTyp: u.mistoNeboTyp,
    nazev: u.nazev,
    cas: u.cas,
    verejneCo: u.verejneCo,
    verejneRozliseni: u.verejneRozliseni ?? null,
  });
  assert(render.typ === "Přednáška", "I: CO ve výpisu");
  assert(render.misto === BRANA_DSN_KDE, "I: KDE ve výpisu");
  assert(
    render.nazev === "Krkavcovití – nejchytřejší ptáci",
    "I: nazev ve výpisu",
  );
  assert(u.nazev === render.nazev, "I: formulářový nazev = výpis");
  const po = aplikovatUpravuAutomatickeUdalosti(u, {
    datumOd: u.datumOd,
    datumDo: u.datumDo,
    cas: u.cas,
    mistoNeboTyp: u.mistoNeboTyp,
    nazev: u.nazev,
  });
  assert(po.scanKlic === u.scanKlic, "I: Upravit nemění scanKlic");
  assert(po.nazev === u.nazev, "I: Upravit ponechá čistý nazev");
}

/* K — SCHVALENO / VYRAZENO */
{
  const surovy = "Přednáška Krkavcovití – nejchytřejší ptáci";
  const { vstup } = dsnVstup(surovy, "2026-10-15", "18:00");
  const schvaleno: BranaKonkretniUdalost = {
    id: "auto-s",
    redakcniPolozkaId: DSN_ID,
    datumOd: "2026-10-15",
    datumDo: "2026-10-15",
    cas: "18:00",
    mistoNeboTyp: "Dům Štěpánka Netolického",
    nazev: surovy,
    rucniPoziceVDni: null,
    stavSchvaleni: "SCHVALENO",
    scanKlic: klicZeSuroveho(surovy, "2026-10-15", "18:00"),
  };
  const s = scan([schvaleno], vstup);
  assert(s.vysledek.pridano === 0 && s.vysledek.aktualizovano === 0, "K: SCHVALENO bez zápisu");
  assert(s.udalosti[0].cas === "18:00", "K: SCHVALENO čas");

  const vyrazeno: BranaKonkretniUdalost = {
    ...schvaleno,
    id: "auto-v",
    stavSchvaleni: "VYRAZENO",
  };
  const v = scan([vyrazeno], vstup);
  assert(v.vysledek.pridano === 0, "K: VYRAZENO bez druhé CEKA");
  assert(v.udalosti[0].stavSchvaleni === "VYRAZENO", "K: zůstává VYRAZENO");
}

/* Seed: matching položka plná, KDE zkrácené */
{
  const jazyk = vychoziJazykVerejnyProId(DSN_ID);
  const kde =
    jazyk?.rozliseni.rezim === "PEVNE" ? jazyk.rozliseni.text : "";
  assert(kde === BRANA_DSN_KDE, "seed: PEVNE KDE zkrácené");
}

/* Zdroj: parser / matching / rozlozAkci bez DSN rozdělení */
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
  const rozlozeni = readFileSync(
    join(root, "src/lib/brana/admin/akce-rozlozeni.ts"),
    "utf8",
  );
  const kostra = readFileSync(
    join(root, "src/lib/brana/admin/redakcni-kostra.ts"),
    "utf8",
  );
  assert(!parser.includes("rozdelDsnTitulek"), "zdroj: parser bez DSN rozdělení");
  assert(!matching.includes("rozdelDsnTitulek"), "zdroj: matching bez DSN rozdělení");
  assert(!rozlozeni.includes("rozdelDsnTitulek"), "zdroj: rozlozAkci bez DSN");
  assert(
    kostra.includes('polozka: "Dům Štěpánka Netolického"') &&
      kostra.includes('pevne("Dům Š. Netolického")'),
    "zdroj: matching položka plná, PEVNE KDE zkrácené",
  );
}

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly DSN redakčního zápisu prošly.");
