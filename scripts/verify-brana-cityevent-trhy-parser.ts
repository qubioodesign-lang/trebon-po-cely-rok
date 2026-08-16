/**
 * City Event → rodina Trhů (Street Food / Beer & Food Fest).
 * Spuštění: npx tsx scripts/verify-brana-cityevent-trhy-parser.ts
 * READ-ONLY HTTP fetch; žádný Blob / produkční scan / zdroj.
 */

import https from "node:https";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  dnesIsoVPraze,
  jeUdalostCelaMinula,
} from "../src/lib/brana/admin/konkretni-udalost";
import {
  BRANA_TRHY_REDAKCNI_POLOZKA_ID,
  jeCityEventFestivalTrebonZdrojUrl,
  jeCityEventProUcastnikyZdrojUrl,
  jeCityEventTrhyZdrojUrl,
  jeTrebonskoRemeslneTrhyZdrojUrl,
  parsovatUdalostiZeZdroje,
  type BranaScanKandidat,
} from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  sparovatSHlidanymiKotvami,
  sparovatVlastnictvimHlidaneKotvy,
} from "../src/lib/brana/admin/zdroj-scan-sparovani";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";

const ZIVE_LISTING = "https://www.cityevent.cz/pro-ucastniky/";
const ZIVE_BEER =
  "https://www.cityevent.cz/festival/beer-food-fest-trebon-4-7-2026/";
const ZIVE_STREET_LETO =
  "https://www.cityevent.cz/festival/letni-street-food-festival-trebon-15-8-2026/";

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

function fixtureListing2026(): string {
  return `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.cityevent.cz/pro-ucastniky/"/>
<title>Pro účastníky – City Event</title>
</head><body>
<h3>Přehled festivalů 2026</h3>
<input type="checkbox" name="festivaly[]" value="Street Food Festival Třebíč 25.4.2026" />
<input type="checkbox" name="festivaly[]" value="Jarní Street Food Festival Třeboň – 9.5.2026" />
<input type="checkbox" name="festivaly[]" value="Street Food Festival Nymburk – 16.5.2026" />
<input type="checkbox" name="festivaly[]" value="BEER &amp; FOOD FEST Třeboň – 4.7.2026" />
<input type="checkbox" name="festivaly[]" value="Street Food Festival Český Krumlov – 11-12.7.2026" />
<input type="checkbox" name="festivaly[]" value="Letní Street Food Festival Třeboň – 15.8.2026" />
<input type="checkbox" name="festivaly[]" value="BEER &amp; FOOD FEST Kralupy – 29.8.2026" />
<input type="checkbox" name="festivaly[]" value="Street Food Festival Třeboň – ZRUŠENO – 1.9.2026" />
<input type="checkbox" name="festivaly[]" value="Obecný festival Třeboň – 10.9.2026" />
</body></html>`;
}

function fixtureBeerDetail(): string {
  return `<!DOCTYPE html><html><head>
<meta property="og:url" content="https://www.cityevent.cz/festival/beer-food-fest-trebon-4-7-2026/"/>
<meta property="og:title" content="BEER &#038; FOOD FEST Třeboň &#8211; 4.7.2026"/>
<title>BEER &#038; FOOD FEST Třeboň &#8211; 4.7.2026 &#8211; City Event</title>
<script type="application/ld+json">
[{"@context":"http://schema.org","@type":"Event","name":"BEER & FOOD FEST Třeboň","startDate":"2026-07-04T10:00:00+02:00","endDate":"2026-07-04T20:00:00+02:00","location":{"@type":"Place","address":{"addressLocality":"Třeboň"}}}]
</script>
</head><body>
<p>akce již proběhla.</p>
<h1>BEER &#038; FOOD FEST Třeboň &#8211; 4.7.2026</h1>
<p>Místo konání Třeboň Masarykovo náměstí</p>
</body></html>`;
}

function fixtureZrusenyDetail(): string {
  return `<!DOCTYPE html><html><head>
<meta property="og:title" content="Street Food Festival Třeboň – 1.9.2026"/>
<script type="application/ld+json">
[{"@type":"Event","eventStatus":"https://schema.org/EventCancelled","startDate":"2026-09-01T10:00:00+02:00","endDate":"2026-09-01T19:00:00+02:00","location":{"address":{"addressLocality":"Třeboň"}}}]
</script>
</head><body>
<h1>Street Food Festival Třeboň – 1.9.2026</h1>
<p>Akce je zrušena.</p>
<p>Místo konání Třeboň</p>
</body></html>`;
}

function verejnyZap(rozliseni: string): string {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const trhy = polozky.find((p) => p.id === "trhy");
  assert(trhy, "kotva trhy pro render");
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: trhy.polozka,
    kandidatMisto: rozliseni,
    zdrojNazev: "City Event",
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

function overUrlAFixture(): void {
  assert(jeCityEventProUcastnikyZdrojUrl(ZIVE_LISTING), "listing URL");
  assert(jeCityEventTrhyZdrojUrl(ZIVE_LISTING), "ownership listing");
  assert(jeCityEventFestivalTrebonZdrojUrl(ZIVE_BEER), "beer detail URL");
  assert(jeCityEventTrhyZdrojUrl(ZIVE_STREET_LETO), "street detail URL");
  assert(
    !jeCityEventTrhyZdrojUrl("https://www.cityevent.cz/"),
    "homepage ≠ trhy zdroj",
  );
  assert(
    !jeCityEventFestivalTrebonZdrojUrl(
      "https://www.cityevent.cz/festival/beer-food-fest-kralupy-29-8-2026/",
    ),
    "cizí město v path",
  );
  assert(
    !jeTrebonskoRemeslneTrhyZdrojUrl(ZIVE_LISTING),
    "City Event ≠ Třeboňsko URL",
  );

  const kandidati = parsovatUdalostiZeZdroje(fixtureListing2026(), "text/html");
  assert(kandidati.length === 3, `fixture listing → 3, je ${kandidati.length}`);
  assert(
    kandidati.every((k) => k.cas === ""),
    "cas vždy prázdný",
  );
  assert(
    kandidati.every((k) => !k.nazev.includes("·")),
    "nazev bez ·",
  );

  const ocekavane = [
    {
      nazev: "Street Food Festival",
      datumOd: "2026-05-09",
      datumDo: "2026-05-09",
    },
    {
      nazev: "Beer & Food Fest",
      datumOd: "2026-07-04",
      datumDo: "2026-07-04",
    },
    {
      nazev: "Street Food Festival",
      datumOd: "2026-08-15",
      datumDo: "2026-08-15",
    },
  ];
  for (const o of ocekavane) {
    assert(
      kandidati.some(
        (k) =>
          k.nazev === o.nazev &&
          k.datumOd === o.datumOd &&
          k.datumDo === o.datumDo,
      ),
      `chybí ${o.nazev} ${o.datumOd}`,
    );
  }
  assert(
    !kandidati.some((k) => /třebíč|nymburk|kralupy|obecný|zruš/i.test(k.nazev)),
    "cizí/neznámé/zrušené se nesmí emitovat",
  );

  const beer = parsovatUdalostiZeZdroje(fixtureBeerDetail(), "text/html");
  assert(beer.length === 1, "beer detail = 1");
  assert(beer[0].nazev === "Beer & Food Fest", "beer rozlišení");
  assert(beer[0].cas === "", "beer cas");
  assert(beer[0].datumOd === "2026-07-04", "beer datum");

  const zrus = parsovatUdalostiZeZdroje(fixtureZrusenyDetail(), "text/html");
  assert(zrus.length === 0, "zrušený detail neemitovat");

  console.log("OK URL + fixture listing/detail/zrušeno");
}

function overOwnershipARender(kandidati: BranaScanKandidat[]): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  for (const k of kandidati) {
    const vlastnictvi = sparovatVlastnictvimHlidaneKotvy(
      polozky,
      [BRANA_TRHY_REDAKCNI_POLOZKA_ID],
      BRANA_TRHY_REDAKCNI_POLOZKA_ID,
    );
    assert(vlastnictvi.ok, "ownership → trhy");
    assert(
      vlastnictvi.ok &&
        vlastnictvi.redakcniPolozkaId === BRANA_TRHY_REDAKCNI_POLOZKA_ID,
      "kotva trhy",
    );
    const exact = sparovatSHlidanymiKotvami(k, polozky, [
      BRANA_TRHY_REDAKCNI_POLOZKA_ID,
    ]);
    assert(!exact.ok, "exact name HLIDANE by selhal (důvod ownership)");
    const zap = verejnyZap(k.nazev);
    assert(zap === `Trh · ${k.nazev}`, `render ${zap}`);
  }
  console.log("OK ownership trhy + render Trh · X");
}

function overTrebonskoNemitneCityEvent(): void {
  const html = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.trebonsko.cz/remeslne-trhy-trebon"/>
<title>Kalendář tradičních trhů</title></head><body>
<span>Řemeslné trhy v Třeboni v roce 2026</span>
<h2>Kalendář trhů Třeboň 2026</h2>
<ul>
<li>(4. 7. Street Food Festival)</li>
<li>(15. 8. Street Food Festival)</li>
<li>29. 8. Letní tečka s trhem</li>
</ul></body></html>`;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(
    !k.some((x) => /street|beer/i.test(x.nazev)),
    "Třeboňsko neemitne City Event",
  );
  assert(
    k.some((x) => x.nazev === "Letní tečka"),
    "Třeboňsko stále emitne městské",
  );
  console.log("OK Třeboňsko regrese (závorky City Event)");
}

async function zivyPredscan(): Promise<void> {
  const html = await get(ZIVE_LISTING);
  const kandidati = parsovatUdalostiZeZdroje(html, "text/html");
  const dnes = dnesIsoVPraze();

  console.log("");
  console.log("=== ŽIVÝ PŘEDSCAN City Event ===");
  console.log(`URL: ${ZIVE_LISTING}`);
  console.log(`Dnes (Europe/Prague): ${dnes}`);
  console.log(`Parser emitoval: ${kandidati.length}`);
  console.log("");

  const radky: {
    puvodni: string;
    rozliseni: string;
    verejny: string;
    datumOd: string;
    datumDo: string;
    cas: string;
    zruseno: "NE";
    rozhodnuti: "přijmout" | "odmítnout-minulost";
    duvod: string;
  }[] = [];

  for (const k of kandidati) {
    const minulost = jeUdalostCelaMinula(k, dnes);
    radky.push({
      puvodni: k.nazev,
      rozliseni: k.nazev,
      verejny: verejnyZap(k.nazev),
      datumOd: k.datumOd,
      datumDo: k.datumDo,
      cas: k.cas === "" ? '""' : k.cas,
      zruseno: "NE",
      rozhodnuti: minulost ? "odmítnout-minulost" : "přijmout",
      duvod: minulost
        ? "celá událost před dneškem (produkční filtr)"
        : "fail-closed Třeboň + whitelist → CEKA při produkčním scanu",
    });
  }

  for (const r of radky) {
    console.log(
      [
        `- ${r.verejny}`,
        `  rozlišení: ${r.rozliseni}`,
        `  datumOd/Do: ${r.datumOd} / ${r.datumDo}`,
        `  cas: ${r.cas}`,
        `  zrušeno: ${r.zruseno}`,
        `  FULL-PATH: ${r.rozhodnuti}`,
        `  důvod: ${r.duvod}`,
      ].join("\n"),
    );
  }

  const ocekavaneTerminy = [
    { d: "2026-05-09", nazev: "Street Food Festival" },
    { d: "2026-07-04", nazev: "Beer & Food Fest" },
    { d: "2026-08-15", nazev: "Street Food Festival" },
  ];
  for (const o of ocekavaneTerminy) {
    assert(
      kandidati.some((k) => k.datumOd === o.d && k.nazev === o.nazev),
      `živý chybí ${o.nazev} ${o.d}`,
    );
    assert(
      jeUdalostCelaMinula(
        { datumOd: o.d, datumDo: o.d },
        dnes,
      ),
      `${o.d} musí být minulost k ${dnes}`,
    );
  }

  const budouci = kandidati.filter((k) => !jeUdalostCelaMinula(k, dnes));
  console.log("");
  console.log(
    `Budoucí po filtru minulosti: ${budouci.length}`,
  );
  if (budouci.length > 0) {
    for (const k of budouci) {
      console.log(`  BUDoucí: ${verejnyZap(k.nazev)} ${k.datumOd}–${k.datumDo}`);
    }
  } else {
    console.log("  (žádný budoucí Třeboň termín v listingu)");
  }

  // Simulace prvního produkčního scanu
  const nalezeno = kandidati.length;
  const poFiltru = kandidati.filter((k) => !jeUdalostCelaMinula(k, dnes));
  console.log("");
  console.log("=== SIMULACE 1. PRODUKČNÍ SCAN (bez zápisu) ===");
  console.log("Zdroj = City Event | Typ = DLOUHODOBY | HLIDANE_KOTVY | kotva trhy");
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
  overUrlAFixture();
  overTrebonskoNemitneCityEvent();
  await zivyPredscan();
  console.log("VŠE OK — City Event Trhy parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
