/**
 * Třeboňsko řemeslné trhy — fail-closed parser + ownership trhy.
 * Spuštění: npx tsx scripts/verify-brana-trebonsko-trhy-parser.ts
 * READ-ONLY HTTP fetch; žádný Blob / produkční scan.
 */

import https from "node:https";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  formatujDatumVyhled,
  formatujDenKalendare,
} from "../src/lib/brana/admin/konkretni-udalost";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  BRANA_TRHY_REDAKCNI_POLOZKA_ID,
  jeTrebonskoRemeslneTrhyZdrojUrl,
  parsovatUdalostiZeZdroje,
  type BranaScanKandidat,
} from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  sparovatSHlidanymiKotvami,
  sparovatVlastnictvimHlidaneKotvy,
} from "../src/lib/brana/admin/zdroj-scan-sparovani";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";

const ZIVE_URL = "https://www.trebonsko.cz/remeslne-trhy-trebon";

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

function fixtureHtml2026(): string {
  return `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.trebonsko.cz/remeslne-trhy-trebon"/>
<title>Kalendář tradičních trhů | Třeboňsko.cz</title>
</head><body>
<span>Řemeslné trhy v Třeboni v roce 2026</span>
<h1 class="mainTitle">Řemeslné trhy v Třeboni v roce 2026</h1>
<h2><span>Kalendář trhů Třeboň 2026</span></h2>
<ul>
<li>28. 3. Začínáme sezónu trhem</li>
<li>4. 4. Velikonoční trh</li>
<li>23. 5. Květinový jarmark</li>
<li>6. 6. Košt vín s trhem</li>
<li>(27. 6. Mint Market)</li>
<li>(4. 7. Street Food Festival)</li>
<li>(11. 7. Třeboňský festival)</li>
<li>18. 7. Historické slavnosti Jakuba Krčína + trh</li>
<li>(25. 7. Třeboňský festival vína)</li>
<li>1. 8. Lázeňská Třeboň&nbsp;+ trh</li>
<li>8. 8. Myslivecká Třeboň&nbsp;+ trh</li>
<li>(15. 8. Street Food Festival)</li>
<li>29. 8. Letní tečka s trhem</li>
<li>5. 9. Vinobraní s trhem</li>
<li>26. 9.&nbsp; Svatováclavské slavnosti&nbsp;+ trh</li>
<li>(3. 10. Třeboňský maraton)</li>
<li>7. 11. Svatomartinský trh</li>
<li>28. 11. Třeboň plná andělů s rozsvícením stromu + adventní trh&nbsp;</li>
<li>12. 12. Adventní trh</li>
<li>19. 12. Adventní trh<em>&nbsp;</em></li>
<li>1. 5. Neznámý trh na náměstí</li>
<li>Trhy se zpravidla konají v sobotu od 9 do 17 hodin</li>
</ul>
</body></html>`;
}

function overUrlAFixture(): BranaScanKandidat[] {
  assert(
    jeTrebonskoRemeslneTrhyZdrojUrl(ZIVE_URL),
    "živá URL musí být rozpoznána",
  );
  assert(
    !jeTrebonskoRemeslneTrhyZdrojUrl("https://www.trebonsko.cz/jina"),
    "jiná cesta ≠ remeslne-trhy",
  );
  assert(
    !jeTrebonskoRemeslneTrhyZdrojUrl("https://www.cityevent.cz/"),
    "cizí host",
  );

  const kandidati = parsovatUdalostiZeZdroje(fixtureHtml2026(), "text/html");
  assert(kandidati.length === 14, `fixture očekává 14, je ${kandidati.length}`);
  assert(
    kandidati.every((k) => k.cas === ""),
    "cas musí být prázdný",
  );
  assert(
    kandidati.every((k) => k.datumOd === k.datumDo),
    "jednodenní datumOd=datumDo",
  );
  assert(
    !kandidati.some((k) => /mint|street|beer|maraton|neznamy/i.test(k.nazev)),
    "cizí/neznámé se nesmí emitovat",
  );

  const advent = kandidati.filter((k) => k.nazev === "Adventní");
  assert(advent.length === 2, "dva Adventní termíny");
  assert(
    advent.some((k) => k.datumOd === "2026-12-12") &&
      advent.some((k) => k.datumOd === "2026-12-19"),
    "Adventní 12. a 19. 12.",
  );
  assert(
    kandidati.some(
      (k) =>
        k.nazev === "Třeboň plná andělů" && k.datumOd === "2026-11-28",
    ),
    "andělé 28. 11.",
  );
  assert(
    !kandidati.some(
      (k) => k.nazev === "Adventní" && k.datumOd === "2026-11-28",
    ),
    "28. 11. není Adventní",
  );

  const unknown = parsovatUdalostiZeZdroje(
    `<html><body>trebonsko.cz kalendář trhů
    <h1>Řemeslné trhy 2026</h1>
    <ul><li>1. 5. Úplně cizí akce</li></ul></body></html>`,
    "text/html",
  );
  assert(unknown.length === 0, "unknown → 0");

  return kandidati;
}

function overOwnershipAJazyk(kandidati: BranaScanKandidat[]): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const trhy = polozky.find((p) => p.id === "trhy");
  assert(trhy, "kotva trhy");
  assert(trhy.jazykVerejny?.co.rezim === "PEVNE", "CO PEVNE");
  if (trhy.jazykVerejny?.co.rezim === "PEVNE") {
    assert(trhy.jazykVerejny.co.text === "Trh", "CO = Trh");
  }
  assert(
    trhy.jazykVerejny?.rozliseni.rezim === "Z_UDALOSTI",
    "rozlišení Z_UDALOSTI",
  );

  const vlastnictvi = sparovatVlastnictvimHlidaneKotvy(
    polozky,
    [BRANA_TRHY_REDAKCNI_POLOZKA_ID],
    BRANA_TRHY_REDAKCNI_POLOZKA_ID,
  );
  assert(vlastnictvi.ok, "ownership trhy");
  if (vlastnictvi.ok) {
    assert(vlastnictvi.redakcniPolozkaId === "trhy", "id trhy");
  }

  const bezKotvy = sparovatVlastnictvimHlidaneKotvy(
    polozky,
    ["kino-aurora"],
    BRANA_TRHY_REDAKCNI_POLOZKA_ID,
  );
  assert(!bezKotvy.ok, "ownership bez trhy v hlídaných → fail");

  const exactHlidane = sparovatSHlidanymiKotvami(
    kandidati[0]!,
    polozky,
    ["trhy"],
  );
  assert(
    !exactHlidane.ok,
    "exact nazev↔polozka nestačí (proto ownership)",
  );

  for (const k of kandidati) {
    const jazyk = sestavJazykBranyPoSparovani({
      polozka: trhy.polozka,
      kandidatMisto: k.mistoNeboTyp,
      zdrojNazev: "Třeboňsko trhy",
      jazykVerejny: trhy.jazykVerejny,
    });
    assert(jazyk.verejneCo === "Trh", `CO Trh pro ${k.nazev}`);
    assert(
      jazyk.verejneRozliseni === k.nazev,
      `rozlišení ${k.nazev}`,
    );
    assert(
      !/náměstí/i.test(jazyk.verejneCo ?? "") &&
        !/náměstí/i.test(jazyk.verejneRozliseni ?? ""),
      "Náměstí nesmí ve verejne*",
    );

    const r = rozlozAkci({
      mistoNeboTyp: jazyk.mistoNeboTyp,
      nazev: k.nazev,
      cas: k.cas,
      verejneCo: jazyk.verejneCo,
      verejneRozliseni: jazyk.verejneRozliseni,
    });
    assert(r.typ === "Trh", "render typ Trh");
    assert(r.misto === k.nazev, "render misto = rozlišení");
    assert(r.nazev === "", `redundantní nazev skryt: ${k.nazev}`);
    assert(r.oddelovacPredMistem === " · ", "oddělovač ·");
    const verejny = `${r.typ}${r.oddelovacPredMistem}${r.misto}`;
    assert(verejny === `Trh · ${k.nazev}`, `veřejný zápis ${verejny}`);
  }
}

function overRenderKalendarVyhled(kandidati: BranaScanKandidat[]): void {
  const mint = kandidati.find((k) => k.nazev === "Košt vín");
  assert(mint, "Košt vín");
  const denni = `Trh · ${mint.nazev}`;
  const kalendarDen = formatujDenKalendare(mint.datumOd);
  assert(/^\S+ \d+\. \d+\.$/.test(kalendarDen), `kalendář den ${kalendarDen}`);
  // Denní pohled: jen název; datum je v hlavičce dne, ne v textu akce.
  assert(!/\d/.test(denni.replace(/·/g, "")), "denní text bez čísel data");

  const vyhled = formatujDatumVyhled({
    datumOd: mint.datumOd,
    datumDo: mint.datumDo,
  });
  assert(vyhled === "6.6.", `výhled datum ${vyhled}`);
}

function klasifikujOdmítnuté(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
    const text = (m[1] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!/^\(?\d{1,2}\.\s*\d{1,2}\./.test(text)) continue;
    const bezZavorky = text.replace(/^\(|\)$/g, "").trim();
    const cast = bezZavorky.replace(/^\d{1,2}\.\s*\d{1,2}\.\s*/, "");
    const emitovane = parsovatUdalostiZeZdroje(html, "text/html");
    const datumMatch = text.match(/^(\(?)(\d{1,2})\.\s*(\d{1,2})\./);
    if (!datumMatch) continue;
    const den = Number(datumMatch[2]);
    const mesic = Number(datumMatch[3]);
    const iso = `2026-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
    const jeEmit = emitovane.some((k) => k.datumOd === iso);
    if (!jeEmit) {
      out.push(text);
    }
    void cast;
  }
  return out;
}

async function zivyPredscan(): Promise<void> {
  const html = await get(ZIVE_URL);
  const kandidati = parsovatUdalostiZeZdroje(html, "text/html");
  const polozky = vytvoritVychoziRedakcniPoradi();
  const trhy = polozky.find((p) => p.id === "trhy")!;

  console.log("\n=== ŽIVÝ PŘEDSCAN Třeboňsko ===");
  console.log(`URL: ${ZIVE_URL}`);
  console.log(`Emitováno: ${kandidati.length}`);
  for (const k of kandidati) {
    const jazyk = sestavJazykBranyPoSparovani({
      polozka: trhy.polozka,
      kandidatMisto: k.mistoNeboTyp,
      zdrojNazev: "Třeboňsko",
      jazykVerejny: trhy.jazykVerejny,
    });
    const r = rozlozAkci({
      mistoNeboTyp: jazyk.mistoNeboTyp,
      nazev: k.nazev,
      cas: k.cas,
      verejneCo: jazyk.verejneCo,
      verejneRozliseni: jazyk.verejneRozliseni,
    });
    console.log(
      [
        `rozlišení=${k.nazev}`,
        `veřejný=${r.typ}${r.oddelovacPredMistem}${r.misto}`,
        `od=${k.datumOd}`,
        `do=${k.datumDo}`,
        `cas="${k.cas}"`,
        `redakcniPolozkaId=${BRANA_TRHY_REDAKCNI_POLOZKA_ID}`,
      ].join(" | "),
    );
  }

  const odmitnute = klasifikujOdmítnuté(html);
  console.log("\n=== Odmítnuté řádky (neemitované datumové li) ===");
  for (const o of odmitnute) {
    console.log(`- ${o}`);
  }

  assert(kandidati.length >= 13, "živě alespoň městská sada");
  assert(
    kandidati.filter((k) => k.nazev === "Adventní").length === 2,
    "živé 2× Adventní",
  );
  assert(
    kandidati.every((k) => k.cas === ""),
    "živé cas=\"\"",
  );
  assert(
    !kandidati.some((k) =>
      /mint|street food|beer/i.test(k.nazev),
    ),
    "živé bez cizích vlastníků",
  );
}

async function main(): Promise<void> {
  const fixture = overUrlAFixture();
  overOwnershipAJazyk(fixture);
  overRenderKalendarVyhled(fixture);
  console.log("OK: fixture + ownership + render");
  await zivyPredscan();
  console.log("\nOK: verify-brana-trebonsko-trhy-parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
