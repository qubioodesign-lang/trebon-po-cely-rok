/**
 * Třeboňsko Otevírání lázeňské sezóny — fail-closed max. 2 CEKA / ročník.
 * Spuštění: npx tsx scripts/verify-brana-ols-parser.ts
 * READ-ONLY HTTP předscan; žádný Blob / produkční scan / admin zdroj.
 */

import https from "node:https";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  formatujDatumVyhled,
  formatujDenKalendare,
  jeUdalostCelaMinula,
  projektujAdminVyhledSouhrnyPodleRoku,
  vytvoritScanKlicAutomatickeUdalosti,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";
import {
  BRANA_TRHY_REDAKCNI_POLOZKA_ID,
  BRANA_ZAHAJENI_LAZENSKE_SEZONY_POLOZKA_ID,
  jeTrebonskoOteviraniLazenskeSezonyZdrojUrl,
  jeTrebonskoRemeslneTrhyZdrojUrl,
  parsovatUdalostiZeZdroje,
  type BranaScanKandidat,
} from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  sparovatSHlidanymiKotvami,
  sparovatVlastnictvimHlidaneKotvy,
} from "../src/lib/brana/admin/zdroj-scan-sparovani";
import {
  vytvoritVychoziRedakcniPoradi,
  BRANA_REDAKCNI_VSECHNY_VYCHOZI,
} from "../src/lib/brana/admin/redakcni-kostra";

const ZIVE_URL =
  "https://www.trebonsko.cz/otevirani-lazenske-sezony-v-treboni";
const OLS_ID = BRANA_ZAHAJENI_LAZENSKE_SEZONY_POLOZKA_ID;

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg);
}

function get(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 BRANA-verify" } }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

/** Referenční 2026 (Aurora) + šum (koncerty, Otevíráme, Lázeňská). */
function fixtureHtml2026(): string {
  return `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.trebonsko.cz/otevirani-lazenske-sezony-v-treboni"/>
<title>Otevírání lázeňské sezony | Třeboňsko.cz</title>
</head><body>
<span>trebonsko.cz</span>
<h1>Otevírání lázeňské sezony v Třeboni - PROGRAM</h1>
<h2>Otevírání lázeňské sezony 30. května 2026 - program</h2>
<strong>Lázeňský park LD Aurora</strong>
<ul>
<li>9.00 Trhy</li>
<li>10.00 Rozhlasový swingový orchestr ČB</li>
<li>11.30 Slavnostní zahájení, žehnání slatině</li>
<li>12.00 Honza Nedvěd ml. a Příbuzní</li>
<li>15.00 UDG</li>
<li>21.00 Tomáš Klus</li>
</ul>
<p>Doprovodný program — program pro děti</p>
<ul>
<li>28. 3. Otevíráme Třeboň</li>
<li>1. 8. Lázeňská Třeboň + trh</li>
</ul>
</body></html>`;
}

/** Historický pattern: Masarykovo + Aurora → místo trhu „Náměstí, Lázně Aurora“. */
function fixtureHtmlDveMistni(): string {
  return `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.trebonsko.cz/otevirani-lazenske-sezony-v-treboni"/>
</head><body>
<span>trebonsko.cz</span>
<h2>Otevírání lázeňské sezony 25. května 2024 - program</h2>
<p>Masarykovo náměstí a kolonáda Lázní Aurora</p>
<ul>
<li>9.00 Trhy</li>
<li>10.00 Koncert dechovky</li>
<li>11.00 Slavnostní zahájení, žehnání slatině</li>
</ul>
</body></html>`;
}

function verejnyRadek(k: BranaScanKandidat): string {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const kotva = polozky.find((p) => p.id === OLS_ID);
  assert(kotva, "kotva OLS");
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: kotva.polozka,
    kandidatMisto: k.mistoNeboTyp,
    zdrojNazev: "Třeboňsko — Otevírání lázeňské sezóny",
    jazykVerejny: kotva.jazykVerejny,
  });
  const r = rozlozAkci({
    mistoNeboTyp: jazyk.mistoNeboTyp,
    nazev: k.nazev,
    cas: k.cas,
    verejneCo: jazyk.verejneCo,
    verejneRozliseni: jazyk.verejneRozliseni,
  });
  const primarni = r.misto
    ? `${r.typ}${r.oddelovacPredMistem}${r.misto}`.trim()
    : r.typ;
  return primarni;
}

function ceka(partial: {
  id: string;
  datumOd: string;
  nazev: string;
  cas?: string;
  mistoNeboTyp?: string;
  zdrojIdentita: string;
  stavSchvaleni?: BranaKonkretniUdalost["stavSchvaleni"];
}): BranaKonkretniUdalost {
  const cas = partial.cas ?? "";
  return {
    id: partial.id,
    redakcniPolozkaId: OLS_ID,
    datumOd: partial.datumOd,
    datumDo: partial.datumOd,
    cas,
    mistoNeboTyp: partial.mistoNeboTyp ?? partial.nazev,
    nazev: partial.nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: partial.stavSchvaleni ?? "CEKA_NA_SCHVALENI",
    scanKlic: vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: OLS_ID,
      datumOd: partial.datumOd,
      cas,
      nazev: partial.nazev,
    }),
    zdrojIdentita: partial.zdrojIdentita,
  };
}

function kandidat(
  partial: Partial<BranaScanAutomatickaUdalostVstup> & {
    nazev: string;
    datumOd: string;
    zdrojIdentita: string;
  },
): BranaScanAutomatickaUdalostVstup {
  return {
    redakcniPolozkaId: OLS_ID,
    datumOd: partial.datumOd,
    datumDo: partial.datumDo ?? partial.datumOd,
    cas: partial.cas ?? "",
    mistoNeboTyp: partial.mistoNeboTyp ?? partial.nazev,
    nazev: partial.nazev,
    zdrojIdentita: partial.zdrojIdentita,
  };
}

function overSeed(): void {
  assert(
    BRANA_REDAKCNI_VSECHNY_VYCHOZI.length === 55,
    `katalog 55, je ${BRANA_REDAKCNI_VSECHNY_VYCHOZI.length}`,
  );
  const polozky = vytvoritVychoziRedakcniPoradi();
  const ols = polozky.find((p) => p.id === OLS_ID);
  assert(ols, "seed OLS");
  assert(ols.pouzivat === "ANO", "Používat ANO");
  assert(ols.vyhled === "ANO", "Výhled ANO");
  assert(ols.vyhledSerie === false, "vyhledSerie false");
  assert(ols.priorita === 9, "priorita 9");
  assert(ols.polozka === "Zahájení lázeňské sezóny", "název");
  assert(ols.jazykVerejny?.co.rezim === "Z_UDALOSTI", "CO Z_UDALOSTI");
  assert(
    ols.jazykVerejny?.rozliseni.rezim === "PEVNE" &&
      ols.jazykVerejny.rozliseni.text === "Zahájení lázeňské sezóny",
    "rozlišení pevné",
  );
}

function overUrlAFixture(): BranaScanKandidat[] {
  assert(
    jeTrebonskoOteviraniLazenskeSezonyZdrojUrl(ZIVE_URL),
    "živá URL OLS",
  );
  assert(
    !jeTrebonskoOteviraniLazenskeSezonyZdrojUrl(
      "https://www.trebonsko.cz/remeslne-trhy-trebon",
    ),
    "remeslne ≠ OLS URL",
  );
  assert(
    jeTrebonskoRemeslneTrhyZdrojUrl(
      "https://www.trebonsko.cz/remeslne-trhy-trebon",
    ),
    "remeslne URL drží",
  );

  const kandidati = parsovatUdalostiZeZdroje(fixtureHtml2026(), "text/html");
  assert(kandidati.length === 2, `max 2: je ${kandidati.length}`);
  assert(
    !kandidati.some((k) =>
      /nedvěd|udg|klus|orchestr|otevíráme|lázeňská třeboň|koncert/i.test(
        k.nazev,
      ),
    ),
    "koncerty / Otevíráme / Lázeňská se neemitují",
  );

  const trh = kandidati.find((k) => k.zdrojIdentita?.endsWith("|trh"));
  const hlavni = kandidati.find((k) => k.zdrojIdentita?.endsWith("|hlavni"));
  assert(trh && hlavni, "oba typy");
  assert(
    trh!.zdrojIdentita ===
      "trebonsko|zahajeni-lazenske-sezony|2026|trh",
    `trh id ${trh!.zdrojIdentita}`,
  );
  assert(
    hlavni!.zdrojIdentita ===
      "trebonsko|zahajeni-lazenske-sezony|2026|hlavni",
    `hlavni id ${hlavni!.zdrojIdentita}`,
  );
  assert(trh!.datumOd === "2026-05-30" && hlavni!.datumOd === "2026-05-30", "datum");
  assert(trh!.cas === "", "trh cas prázdný");
  assert(hlavni!.cas === "11:30", "hlavní čas z programu");
  assert(trh!.mistoNeboTyp === "Trh", "trh CO signal");
  assert(hlavni!.mistoNeboTyp === "", "hlavní bez Trh");
  assert(trh!.nazev === "Lázně Aurora", "trh místo Aurora");
  assert(hlavni!.nazev === "Lázně Aurora", "hlavní místo Aurora");

  assert(
    verejnyRadek(trh!) === "Trh · Zahájení lázeňské sezóny",
    `veřejný trh: ${verejnyRadek(trh!)}`,
  );
  assert(
    verejnyRadek(hlavni!) === "Zahájení lázeňské sezóny",
    `veřejný hlavní: ${verejnyRadek(hlavni!)}`,
  );

  // Nový ročník → nové identity
  const html2027 = fixtureHtml2026().replace(/2026/g, "2027").replace(
    /30\. května/,
    "29. května",
  );
  const k2027 = parsovatUdalostiZeZdroje(html2027, "text/html");
  assert(k2027.length === 2, "2027: 2");
  assert(
    k2027.every((k) => k.zdrojIdentita?.includes("|2027|")),
    "2027 identity",
  );
  assert(
    !k2027.some((k) => k.zdrojIdentita?.includes("|2026|")),
    "2027 ≠ 2026",
  );

  // Dual venue
  const kDual = parsovatUdalostiZeZdroje(fixtureHtmlDveMistni(), "text/html");
  const trhDual = kDual.find((k) => k.zdrojIdentita?.endsWith("|trh"));
  assert(trhDual?.nazev === "Náměstí, Lázně Aurora", "dual místo trhu");
  assert(
    kDual.find((k) => k.zdrojIdentita?.endsWith("|hlavni"))?.cas === "11:00",
    "čas z 2024 programu (ne hardcode 11:30)",
  );

  return kandidati;
}

function overOwnershipAIzolace(kandidati: BranaScanKandidat[]): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const vlast = sparovatVlastnictvimHlidaneKotvy(
    polozky,
    [OLS_ID],
    OLS_ID,
  );
  assert(vlast.ok && vlast.redakcniPolozkaId === OLS_ID, "ownership OLS");

  const omylemTrhy = sparovatVlastnictvimHlidaneKotvy(
    polozky,
    [BRANA_TRHY_REDAKCNI_POLOZKA_ID],
    OLS_ID,
  );
  assert(!omylemTrhy.ok, "OLS ownership bez hlídané OLS kotvy → fail");

  const exact = sparovatSHlidanymiKotvami(kandidati[0]!, polozky, [OLS_ID]);
  assert(!exact.ok, "exact nestačí — potřeba ownership");

  // OLS trh nesmí jít pod trhy identity / rodinu
  assert(
    kandidati.every(
      (k) =>
        k.zdrojIdentita?.startsWith("trebonsko|zahajeni-lazenske-sezony|") &&
        !k.zdrojIdentita.includes("|trhy|") &&
        !k.zdrojIdentita.startsWith("trebonsko-trhy|"),
    ),
    "izolace od trhy identities",
  );
}

function overCekaLifecycle(kandidati: BranaScanKandidat[]): void {
  const trh = kandidati.find((k) => k.zdrojIdentita?.endsWith("|trh"))!;
  const hlavni = kandidati.find((k) => k.zdrojIdentita?.endsWith("|hlavni"))!;
  const idTrh = trh.zdrojIdentita!;
  const idHlavni = hlavni.zdrojIdentita!;

  const prvni = aplikovatScanKandidatyNaUdalosti(
    [],
    [
      kandidat({
        nazev: trh.nazev,
        datumOd: trh.datumOd,
        cas: trh.cas,
        mistoNeboTyp: trh.mistoNeboTyp,
        zdrojIdentita: idTrh,
      }),
      kandidat({
        nazev: hlavni.nazev,
        datumOd: hlavni.datumOd,
        cas: hlavni.cas,
        mistoNeboTyp: hlavni.mistoNeboTyp,
        zdrojIdentita: idHlavni,
      }),
    ],
    "2026-05-01",
    jeUdalostCelaMinula,
  );
  assert(prvni.vysledek.pridano === 2, "první scan: 2 CEKA");
  assert(prvni.udalosti.length === 2, "2 události");

  const identicky = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    [
      kandidat({
        nazev: trh.nazev,
        datumOd: trh.datumOd,
        cas: trh.cas,
        mistoNeboTyp: trh.mistoNeboTyp,
        zdrojIdentita: idTrh,
      }),
      kandidat({
        nazev: hlavni.nazev,
        datumOd: hlavni.datumOd,
        cas: hlavni.cas,
        mistoNeboTyp: hlavni.mistoNeboTyp,
        zdrojIdentita: idHlavni,
      }),
    ],
    "2026-05-01",
    jeUdalostCelaMinula,
  );
  assert(identicky.vysledek.jizExistuje === 2, "identický → Již existuje");
  assert(identicky.vysledek.pridano === 0, "bez duplikátu");

  // Změna hlavního času → jen |hlavni
  const casUpdate = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    [
      kandidat({
        nazev: trh.nazev,
        datumOd: trh.datumOd,
        cas: "",
        mistoNeboTyp: "Trh",
        zdrojIdentita: idTrh,
      }),
      kandidat({
        nazev: hlavni.nazev,
        datumOd: hlavni.datumOd,
        cas: "12:00",
        mistoNeboTyp: "",
        zdrojIdentita: idHlavni,
      }),
    ],
    "2026-05-01",
    jeUdalostCelaMinula,
  );
  assert(casUpdate.vysledek.aktualizovano === 1, "čas: 1 update");
  assert(casUpdate.vysledek.pridano === 0, "čas: 0 nových");
  assert(
    casUpdate.udalosti.find((u) => u.zdrojIdentita === idHlavni)?.cas ===
      "12:00",
    "hlavní čas updated",
  );
  assert(
    casUpdate.udalosti.find((u) => u.zdrojIdentita === idTrh)?.cas === "",
    "trh čas nedotčen",
  );

  // Změna trhu (místo) → jen |trh
  const trhUpdate = aplikovatScanKandidatyNaUdalosti(
    casUpdate.udalosti,
    [
      kandidat({
        nazev: "Náměstí, Lázně Aurora",
        datumOd: trh.datumOd,
        cas: "",
        mistoNeboTyp: "Trh",
        zdrojIdentita: idTrh,
      }),
      kandidat({
        nazev: hlavni.nazev,
        datumOd: hlavni.datumOd,
        cas: "12:00",
        mistoNeboTyp: "",
        zdrojIdentita: idHlavni,
      }),
    ],
    "2026-05-01",
    jeUdalostCelaMinula,
  );
  assert(trhUpdate.vysledek.aktualizovano === 1, "trh: 1 update");
  assert(
    trhUpdate.udalosti.find((u) => u.zdrojIdentita === idTrh)?.nazev ===
      "Náměstí, Lázně Aurora",
    "trh nazev updated",
  );
  assert(
    trhUpdate.udalosti.find((u) => u.zdrojIdentita === idHlavni)?.nazev ===
      hlavni.nazev,
    "hlavní nazev nedotčen",
  );

  // SCHVALENO → žádný silent overwrite
  const schvaleno = aplikovatScanKandidatyNaUdalosti(
    [
      ceka({
        id: "s1",
        datumOd: "2026-05-30",
        nazev: "Lázně Aurora",
        cas: "11:30",
        zdrojIdentita: idHlavni,
        stavSchvaleni: "SCHVALENO",
      }),
    ],
    [
      kandidat({
        nazev: "Lázně Aurora",
        datumOd: "2026-05-30",
        cas: "12:00",
        zdrojIdentita: idHlavni,
      }),
    ],
    "2026-05-01",
    jeUdalostCelaMinula,
  );
  assert(schvaleno.vysledek.aktualizovano === 0, "SCHVALENO bez overwrite");
  assert(schvaleno.udalosti[0]!.cas === "11:30", "SCHVALENO čas drží");

  // VYRAZENO → neobnovovat
  const vyrazeno = aplikovatScanKandidatyNaUdalosti(
    [
      ceka({
        id: "v1",
        datumOd: "2026-05-30",
        nazev: "Lázně Aurora",
        cas: "",
        zdrojIdentita: idTrh,
        stavSchvaleni: "VYRAZENO",
      }),
    ],
    [
      kandidat({
        nazev: "Lázně Aurora",
        datumOd: "2026-05-30",
        cas: "",
        mistoNeboTyp: "Trh",
        zdrojIdentita: idTrh,
      }),
    ],
    "2026-05-01",
    jeUdalostCelaMinula,
  );
  assert(vyrazeno.vysledek.pridano === 0, "VYRAZENO neobnovit");
}

function overKalendarAVyhled(kandidati: BranaScanKandidat[]): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const ols = polozky.find((p) => p.id === OLS_ID)!;
  assert(ols.vyhledSerie === false, "jednotlivé");

  // Budoucí ročník — 2026 OLS je dnes minulost a 7denní filtr by ji vyřadil.
  const budouciDatum = "2027-05-29";
  const udalosti: BranaKonkretniUdalost[] = kandidati.map((k, i) => {
    const jazyk = sestavJazykBranyPoSparovani({
      polozka: ols.polozka,
      kandidatMisto: k.mistoNeboTyp,
      zdrojNazev: "Třeboňsko",
      jazykVerejny: ols.jazykVerejny,
    });
    return {
      id: `ols-${i}`,
      redakcniPolozkaId: OLS_ID,
      datumOd: budouciDatum,
      datumDo: budouciDatum,
      cas: k.cas,
      mistoNeboTyp: jazyk.mistoNeboTyp,
      nazev: k.nazev,
      rucniPoziceVDni: null,
      stavSchvaleni: "SCHVALENO",
      scanKlic: `ols-${i}`,
      zdrojIdentita: k.zdrojIdentita?.replace("|2026|", "|2027|"),
      verejneCo: jazyk.verejneCo,
      verejneRozliseni: jazyk.verejneRozliseni ?? null,
    };
  });

  assert(udalosti.length === 2, "kalendář: 2 události současně");
  for (const u of udalosti) {
    assert(formatujDenKalendare(u.datumOd).length > 0, "kalendář den");
  }

  const vyhled = projektujAdminVyhledSouhrnyPodleRoku(
    udalosti,
    (id) => polozky.find((x) => x.id === id)?.vyhled === "ANO",
    (id) => {
      const p = polozky.find((x) => x.id === id);
      return p?.vyhledSerie !== false;
    },
  );
  const olsSouhrny =
    vyhled.find((r) => r.rok === 2027)?.souhrny.filter(
      (s) => s.redakcniPolozkaId === OLS_ID,
    ) ?? [];
  assert(
    olsSouhrny.length === 2,
    `Výhled jednotlivé: 2 řádky, je ${olsSouhrny.length}`,
  );
  for (const s of olsSouhrny) {
    assert(formatujDatumVyhled(s).length > 0, "výhled datum");
  }
}

async function zivyPredscan(): Promise<void> {
  const html = await get(ZIVE_URL);
  const kandidati = parsovatUdalostiZeZdroje(html, "text/html");
  console.log("\n=== ŽIVÝ PŘEDSCAN OLS 2026 ===");
  console.log(`URL: ${ZIVE_URL}`);
  console.log(`Emitováno celkem: ${kandidati.length}`);
  for (const k of kandidati) {
    console.log(
      [
        `id=${k.zdrojIdentita}`,
        `veřejný=${verejnyRadek(k)}`,
        `od=${k.datumOd}`,
        `cas="${k.cas}"`,
        `nazev=${k.nazev}`,
        `mistoNeboTyp="${k.mistoNeboTyp}"`,
      ].join(" | "),
    );
  }

  const k2026 = kandidati.filter((k) =>
    k.zdrojIdentita?.includes("|2026|"),
  );
  assert(k2026.length <= 2, `2026 max 2, je ${k2026.length}`);
  assert(k2026.length === 2, `2026 očekává 2, je ${k2026.length}`);
  const trh = k2026.find((k) => k.zdrojIdentita?.endsWith("|trh"));
  const hlavni = k2026.find((k) => k.zdrojIdentita?.endsWith("|hlavni"));
  assert(trh && hlavni, "živé 2026: trh + hlavní");
  assert(trh!.datumOd === "2026-05-30", "živé datum trh");
  assert(hlavni!.datumOd === "2026-05-30", "živé datum hlavní");
  assert(trh!.cas === "", "živé trh cas");
  assert(hlavni!.cas === "11:30", "živé hlavní 11:30");
  assert(trh!.nazev === "Lázně Aurora", "živé trh Aurora");
  assert(hlavni!.nazev === "Lázně Aurora", "živé hlavní Aurora");
  assert(
    !kandidati.some((k) =>
      /klus|nedvěd|udg|otevíráme|lázeňská třeboň/i.test(k.nazev),
    ),
    "živé bez koncertů / cizích akcí",
  );

  // Minulost k 16.8.2026 → produkční scan by nepřidal
  assert(
    jeUdalostCelaMinula(trh!, "2026-08-16"),
    "30.5. je minulost → scan by nepřidal",
  );
}

async function main(): Promise<void> {
  overSeed();
  const fixture = overUrlAFixture();
  overOwnershipAIzolace(fixture);
  overCekaLifecycle(fixture);
  overKalendarAVyhled(fixture);
  console.log("OK: fixture + ownership + CEKA + kalendář/výhled");
  await zivyPredscan();
  console.log("\nOK: verify-brana-ols-parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
