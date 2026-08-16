/**
 * MINT Market → rodina Trhů (jen Třeboň).
 * Spuštění: npx tsx scripts/verify-brana-mint-trhy-parser.ts
 * READ-ONLY HTTP fetch; žádný Blob / produkční scan / zdroj.
 */

import https from "node:https";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  dnesIsoVPraze,
  formatujDatumVyhled,
  jeUdalostCelaMinula,
} from "../src/lib/brana/admin/konkretni-udalost";
import {
  BRANA_TRHY_REDAKCNI_POLOZKA_ID,
  jeCityEventTrhyZdrojUrl,
  jeMintMarketListingZdrojUrl,
  jeMintMarketTrebonDetailZdrojUrl,
  jeMintTrhyZdrojUrl,
  jeTrebonskoRemeslneTrhyZdrojUrl,
  parsovatUdalostiZeZdroje,
  type BranaScanKandidat,
} from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  sparovatSHlidanymiKotvami,
  sparovatVlastnictvimHlidaneKotvy,
} from "../src/lib/brana/admin/zdroj-scan-sparovani";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";

const ZIVE_LISTING = "https://www.mintmarket.cz/";
const ZIVE_DETAIL = "https://www.mintmarket.cz/cs/trh/trebon-12";

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

function fixtureListing(): string {
  return `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.mintmarket.cz/"/>
<title>MINT Market</title>
</head><body>
<div class="past-event-wrapper">
  <a href="./cs/trh/trebon-12;jsessionid=abc">
    <img src="trebon_12_2026_v1_web_profil.png"/>
  </a>
  <h2><a href="./cs/trh/trebon-12;jsessionid=abc"><span>MINT Market Třeboň no. 12</span></a></h2>
  <h2><small>27.06.26 - 28.06.26 </small></h2>
</div>
<div>
  <a href="./cs/trh/brno-91;jsessionid=abc"><span>MINT Market Brno no. 91</span></a>
  <small>02.09.26</small>
</div>
<div>
  <a href="./cs/trh/trebon-11;jsessionid=abc"><span>MINT Market Třeboň no. 11</span></a>
  <small>23.08.25</small>
</div>
<div>
  <a href="./cs/trh/trebon-99;jsessionid=abc"><span>MINT Market Třeboň no. 99</span></a>
  <small>22.08.26 – ZRUŠENO</small>
</div>
<div>
  <a href="./cs/trh/praha-1;jsessionid=abc"><span>Design market Praha</span></a>
  <small>01.09.26</small>
</div>
</body></html>`;
}

function fixtureDetail(): string {
  return `<!DOCTYPE html><html><head>
<title>MINT Market - trh - MINT Market Třeboň no. 12</title>
</head><body class="section-market trebon-12">
<link rel="canonical" href="https://www.mintmarket.cz/cs/trh/trebon-12"/>
<h1>MINT Market Třeboň no. 12</h1>
<p>Masarykovo náměstí</p>
<p>už o víkendu 27. a 28. června dorazí na Masarykovo náměstí MINT Market!</p>
<img src="trebon_12_2026_v1_web_banner.png"/>
<p>SO 9.00 - 18.00</p>
<p>NE 9.00 - 17.00</p>
</body></html>`;
}

function verejnyZap(rozliseni: string): string {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const trhy = polozky.find((p) => p.id === "trhy");
  assert(trhy, "kotva trhy");
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: trhy.polozka,
    kandidatMisto: rozliseni,
    zdrojNazev: "MINT Market",
    jazykVerejny: trhy.jazykVerejny,
  });
  const r = rozlozAkci({
    mistoNeboTyp: jazyk.mistoNeboTyp,
    nazev: rozliseni,
    cas: "",
    ...(jazyk.verejneCo !== undefined
      ? {
          verejneCo: jazyk.verejneCo,
          verejneRozliseni: jazyk.verejneRozliseni ?? null,
        }
      : {}),
  });
  return r.misto ? `${r.typ}${r.oddelovacPredMistem}${r.misto}` : r.typ;
}

function overUrlAFixture(): BranaScanKandidat[] {
  assert(jeMintMarketListingZdrojUrl(ZIVE_LISTING), "listing URL");
  assert(jeMintTrhyZdrojUrl(ZIVE_LISTING), "ownership listing");
  assert(jeMintMarketTrebonDetailZdrojUrl(ZIVE_DETAIL), "detail URL");
  assert(jeMintTrhyZdrojUrl(ZIVE_DETAIL), "ownership detail");
  assert(
    !jeMintTrhyZdrojUrl("https://www.mintmarket.cz/cs/trh/brno-91"),
    "cizí město detail ≠ ownership",
  );
  assert(!jeTrebonskoRemeslneTrhyZdrojUrl(ZIVE_LISTING), "≠ Třeboňsko");
  assert(!jeCityEventTrhyZdrojUrl(ZIVE_LISTING), "≠ City Event");

  const listing = parsovatUdalostiZeZdroje(fixtureListing(), "text/html");
  assert(listing.length === 1, `fixture listing → 1, je ${listing.length}`);
  assert(listing[0].nazev === "MINT Market", "rozlišení");
  assert(listing[0].cas === "", "cas");
  assert(!listing[0].nazev.includes("·"), "bez ·");
  assert(
    listing[0].datumOd === "2026-06-27" &&
      listing[0].datumDo === "2026-06-28",
    "27.–28. 6.",
  );
  assert(
    formatujDatumVyhled(listing[0]) === "27.6.–28.6.",
    `výhled datum ${formatujDatumVyhled(listing[0])}`,
  );

  const detail = parsovatUdalostiZeZdroje(fixtureDetail(), "text/html");
  assert(detail.length === 1, "detail → 1");
  assert(
    detail[0].datumOd === "2026-06-27" &&
      detail[0].datumDo === "2026-06-28",
    "detail próza 27.–28. 6.",
  );
  assert(detail[0].cas === "", "detail cas");

  console.log("OK URL + fixture listing/detail");
  return listing;
}

function overOwnershipARender(kandidati: BranaScanKandidat[]): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  for (const k of kandidati) {
    const v = sparovatVlastnictvimHlidaneKotvy(
      polozky,
      [BRANA_TRHY_REDAKCNI_POLOZKA_ID],
      BRANA_TRHY_REDAKCNI_POLOZKA_ID,
    );
    assert(v.ok && v.redakcniPolozkaId === "trhy", "ownership trhy");
    assert(
      !sparovatSHlidanymiKotvami(k, polozky, ["trhy"]).ok,
      "exact name nestačí",
    );
    assert(verejnyZap(k.nazev) === "Trh · MINT Market", "render");
  }
  console.log("OK ownership + render Trh · MINT Market");
}

function overRegreseCizi(): void {
  const treb = parsovatUdalostiZeZdroje(
    `<html><body>trebonsko.cz kalendář trhů
    <h1>Řemeslné trhy 2026</h1>
    <ul>
    <li>(27. 6. Mint Market)</li>
    <li>29. 8. Letní tečka s trhem</li>
    </ul></body></html>`,
    "text/html",
  );
  assert(!treb.some((k) => /mint/i.test(k.nazev)), "Třeboňsko neemitne MINT");
  assert(
    treb.some((k) => k.nazev === "Letní tečka"),
    "Třeboňsko městské OK",
  );

  const city = parsovatUdalostiZeZdroje(
    `<html><head><link rel="canonical" href="https://www.cityevent.cz/pro-ucastniky/"/></head>
    <body><h3>Přehled festivalů 2026</h3>
    <input type="checkbox" name="festivaly[]" value="MINT Market Třeboň – 27.6.2026" />
    <input type="checkbox" name="festivaly[]" value="Jarní Street Food Festival Třeboň – 9.5.2026" />
    </body></html>`,
    "text/html",
  );
  assert(!city.some((k) => /mint/i.test(k.nazev)), "City Event neemitne MINT");
  assert(
    city.some((k) => k.nazev === "Street Food Festival"),
    "City Event Street Food OK",
  );
  console.log("OK Třeboňsko/City Event neemitnou MINT");
}

async function zivyPredscan(): Promise<void> {
  const html = await get(ZIVE_LISTING);
  const kandidati = parsovatUdalostiZeZdroje(html, "text/html");
  const dnes = dnesIsoVPraze();

  console.log("");
  console.log("=== ŽIVÝ PŘEDSCAN MINT Market ===");
  console.log(`URL: ${ZIVE_LISTING}`);
  console.log(`Dnes (Europe/Prague): ${dnes}`);
  console.log(`Parser emitoval: ${kandidati.length}`);
  console.log("");

  for (const k of kandidati) {
    const minulost = jeUdalostCelaMinula(k, dnes);
    console.log(
      [
        `- ${verejnyZap(k.nazev)}`,
        `  lokalita: Třeboň (slug/listing)`,
        `  rozlišení: ${k.nazev}`,
        `  datumOd/Do: ${k.datumOd} / ${k.datumDo}`,
        `  cas: ${k.cas === "" ? '""' : k.cas}`,
        `  stav: aktivní (na autoritativním listingu)`,
        `  FULL-PATH: ${minulost ? "odmítnout-minulost" : "přijmout"}`,
        `  důvod: ${
          minulost
            ? "celá událost před dneškem (produkční filtr)"
            : "fail-closed MINT Třeboň → CEKA při produkčním scanu"
        }`,
      ].join("\n"),
    );
  }

  assert(
    kandidati.some(
      (k) =>
        k.nazev === "MINT Market" &&
        k.datumOd === "2026-06-27" &&
        k.datumDo === "2026-06-28",
    ),
    "živě musí být 27.–28. 6. 2026",
  );
  assert(
    !kandidati.some(
      (k) => k.datumOd === "2026-08-22" || k.datumDo === "2026-08-22",
    ),
    "22. 8. 2026 NESMÍ být emitován",
  );
  assert(
    !/22\.0?8\.26|22\.\s*8\.\s*2026/i.test(html),
    "autoritativní listing neobsahuje 22.8",
  );

  const detailHtml = await get(ZIVE_DETAIL);
  const detail = parsovatUdalostiZeZdroje(detailHtml, "text/html");
  assert(detail.length === 1, "živý detail → 1");
  assert(
    detail[0].datumOd === "2026-06-27" &&
      detail[0].datumDo === "2026-06-28",
    "živý detail vícedenní",
  );

  const budouci = kandidati.filter((k) => !jeUdalostCelaMinula(k, dnes));
  console.log("");
  console.log(`Budoucí po filtru minulosti: ${budouci.length}`);
  if (budouci.length === 0) {
    console.log("  (žádný budoucí Třeboň MINT na autoritativním listingu)");
  } else {
    for (const k of budouci) {
      console.log(`  BUDoucí: ${verejnyZap(k.nazev)} ${k.datumOd}–${k.datumDo}`);
    }
  }

  const nalezeno = kandidati.length;
  const poFiltru = kandidati.filter((k) => !jeUdalostCelaMinula(k, dnes));
  console.log("");
  console.log("=== SIMULACE 1. PRODUKČNÍ SCAN (bez zápisu) ===");
  console.log("Zdroj = MINT Market | Typ = DLOUHODOBY | HLIDANE_KOTVY | kotva trhy");
  console.log(`Nalezeno = ${nalezeno}  (počítá i minulost PŘED filtrem)`);
  console.log(`Přidáno = ${poFiltru.length}`);
  console.log("Již existuje = 0");
  console.log("Nezařazeno = 0");
  console.log(
    "Pozn.: nalezeno = kandidati.length po parseru; minulé se v cyklu jen přeskočí.",
  );

  overOwnershipARender(kandidati);
  console.log("OK živý předscan");
}

async function main(): Promise<void> {
  const fixture = overUrlAFixture();
  overOwnershipARender(fixture);
  overRegreseCizi();
  await zivyPredscan();
  console.log("VŠE OK — MINT Market Trhy parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
