/**
 * VisitTřeboň → jen MINT Market Třeboň (HLIDANE_KOTVY / trhy).
 * Spuštění: npx tsx scripts/verify-brana-visittrebon-mint-parser.ts
 * READ-ONLY HTTP předscan; žádný Blob / produkční scan / admin zdroj.
 */

import https from "node:https";
import { okamzikZPrahy } from "../src/lib/brana/cas";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";
import {
  dnesIsoVPraze,
  jeUdalostCelaMinula,
  vytvoritScanKlicAutomatickeUdalosti,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  BRANA_TRHY_REDAKCNI_POLOZKA_ID,
  jeCityEventTrhyZdrojUrl,
  jeMintTrhyZdrojUrl,
  jeTrebonskoRemeslneTrhyZdrojUrl,
  jeVisitTrebonHlidaneAkceZdrojUrl,
  parsovatUdalostiZeZdroje,
  sestavVisitTrebonKalendarUrl,
} from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  sparovatSHlidanymiKotvami,
  sparovatVlastnictvimHlidaneKotvy,
} from "../src/lib/brana/admin/zdroj-scan-sparovani";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";

const KORENOVÁ_URL = "https://www.visittrebon.cz/cz/kalendar-akci-trebon/2/";

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

function fixtureVisit(minty: { nazev: string; datum: string }[]): string {
  const radky = minty
    .map(
      (m) => `
			<div class="row event-row clickable-blank" data-target-blank-url="https://www.mintmarket.cz/">
					<div class="col event-info">
					  <h2>${m.nazev}</h2>
					  <p><strong>Datum:</strong> ${m.datum}&nbsp;&nbsp;&nbsp;<strong>Čas:</strong> &nbsp;&nbsp;&nbsp;<strong>Místo:</strong> Masarykovo náměstí, Třeboň</p>
					</div>
				</div>`,
    )
    .join("\n");
  return `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.visittrebon.cz/cz/kalendar-akci-trebon/2/"/>
<title>Kalendář akcí Třeboň</title>
</head><body>
<div class="row event-row clickable-blank" data-target-blank-url="https://example.com/kino">
  <div class="col event-info">
    <h2>Filmový večer, Třeboň</h2>
    <p><strong>Datum:</strong> 20.8.2026&nbsp;&nbsp;&nbsp;<strong>Čas:</strong> 20:00&nbsp;&nbsp;&nbsp;<strong>Místo:</strong> Kino</p>
  </div>
</div>
<div class="row event-row clickable-blank" data-target-blank-url="https://example.com/sf">
  <div class="col event-info">
    <h2>Street Food Festival Třeboň</h2>
    <p><strong>Datum:</strong> 15.8.2026&nbsp;&nbsp;&nbsp;<strong>Čas:</strong> 10:00&nbsp;&nbsp;&nbsp;<strong>Místo:</strong> Masarykovo náměstí</p>
  </div>
</div>
<div class="row event-row clickable-blank" data-target-blank-url="http://www.trebonsko.cz/remeslne-trhy-trebon">
  <div class="col event-info">
    <h2>Letní tečka s trhem, Třeboň</h2>
    <p><strong>Datum:</strong> 29.8.2026&nbsp;&nbsp;&nbsp;<strong>Čas:</strong> 09:00&nbsp;&nbsp;&nbsp;<strong>Místo:</strong> Masarykovo náměstí</p>
  </div>
</div>
${radky}
</body></html>`;
}

function verejnyZap(rozliseni: string): string {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const trhy = polozky.find((p) => p.id === "trhy");
  assert(trhy, "kotva trhy");
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: trhy.polozka,
    kandidatMisto: rozliseni,
    zdrojNazev: "VisitTřeboň – hlídané akce",
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

function ceka(partial: {
  id: string;
  datumOd: string;
  datumDo?: string;
  nazev: string;
  zdrojIdentita?: string;
  stavSchvaleni?: BranaKonkretniUdalost["stavSchvaleni"];
}): BranaKonkretniUdalost {
  const datumDo = partial.datumDo ?? partial.datumOd;
  const cas = "";
  return {
    id: partial.id,
    redakcniPolozkaId: "trhy",
    datumOd: partial.datumOd,
    datumDo,
    cas,
    mistoNeboTyp: partial.nazev,
    nazev: partial.nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: partial.stavSchvaleni ?? "CEKA_NA_SCHVALENI",
    scanKlic: vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: "trhy",
      datumOd: partial.datumOd,
      cas,
      nazev: partial.nazev,
    }),
    ...(partial.zdrojIdentita
      ? { zdrojIdentita: partial.zdrojIdentita }
      : {}),
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
    redakcniPolozkaId: "trhy",
    datumOd: partial.datumOd,
    datumDo: partial.datumDo ?? partial.datumOd,
    cas: "",
    mistoNeboTyp: partial.mistoNeboTyp ?? partial.nazev,
    nazev: partial.nazev,
    zdrojIdentita: partial.zdrojIdentita,
  };
}

function pocetEventRow(html: string): number {
  return (html.match(/\bevent-row\b/g) ?? []).length;
}

async function main(): Promise<void> {
  // --- URL gate + dynamický horizont ---
  assert(
    jeVisitTrebonHlidaneAkceZdrojUrl(KORENOVÁ_URL),
    "kořen Visit URL",
  );
  assert(
    jeVisitTrebonHlidaneAkceZdrojUrl(
      "https://visittrebon.cz/cz/kalendar-akci-trebon/2/?x=1",
    ),
    "Visit URL s query",
  );
  assert(
    !jeVisitTrebonHlidaneAkceZdrojUrl(
      "https://www.visittrebon.cz/cz/kalendar-akci-trebon/",
    ),
    "bez /2/ není gate",
  );
  assert(!jeTrebonskoRemeslneTrhyZdrojUrl(KORENOVÁ_URL), "ne Třeboňsko");
  assert(!jeCityEventTrhyZdrojUrl(KORENOVÁ_URL), "ne City Event");
  assert(!jeMintTrhyZdrojUrl(KORENOVÁ_URL), "ne mintmarket");

  const ref = okamzikZPrahy(2026, 8, 16, 12, 0);
  const dyn = sestavVisitTrebonKalendarUrl(KORENOVÁ_URL, ref);
  assert(
    dyn ===
      "https://www.visittrebon.cz/cz/kalendar-akci-trebon/2/?event_form_start=16.8.2026&event_form_stop=16.8.2027",
    `dynamická URL: ${dyn}`,
  );

  // --- Fail-closed fixture ---
  const htmlJeden = fixtureVisit([
    { nazev: "MINT Market Třeboň", datum: "22.8.2026" },
  ]);
  const kJeden = parsovatUdalostiZeZdroje(htmlJeden, "text/html");
  assert(kJeden.length === 1, `emit 1, got ${kJeden.length}`);
  assert(kJeden[0]!.nazev === "MINT Market", "rozlišení");
  assert(kJeden[0]!.datumOd === "2026-08-22", "datumOd");
  assert(kJeden[0]!.datumDo === "2026-08-22", "datumDo");
  assert(kJeden[0]!.cas === "", "cas prázdný");
  assert(
    kJeden[0]!.zdrojIdentita === "visittrebon|trhy|mint-market|2026|1",
    `identita: ${kJeden[0]!.zdrojIdentita}`,
  );
  assert(verejnyZap("MINT Market").includes("Trh"), "veřejný Trh");
  assert(verejnyZap("MINT Market").includes("MINT Market"), "veřejný MINT");

  // Odmítnuté názvy
  const htmlOdmít = fixtureVisit([
    { nazev: "MINT Market Brno", datum: "1.9.2026" },
    { nazev: "MINT Market Třeboň no. 12", datum: "27.6.2026" },
    { nazev: "Beer & Food Fest Třeboň", datum: "10.9.2026" },
  ]);
  assert(
    parsovatUdalostiZeZdroje(htmlOdmít, "text/html").length === 0,
    "odmítnuté Mint varianty",
  );

  // Vícedenní rozsah
  const htmlRozsah = fixtureVisit([
    { nazev: "MINT Market Třeboň", datum: "27.6.2026 - 28.6.2026" },
  ]);
  const kRozsah = parsovatUdalostiZeZdroje(htmlRozsah, "text/html");
  assert(kRozsah.length === 1, "rozsah emit");
  assert(kRozsah[0]!.datumOd === "2026-06-27", "rozsah od");
  assert(kRozsah[0]!.datumDo === "2026-06-28", "rozsah do");

  // Dva MINT v roce → |1| a |2|
  const htmlDva = fixtureVisit([
    { nazev: "MINT Market Třeboň", datum: "20.6.2026" },
    { nazev: "MINT Market Třeboň", datum: "22.8.2026" },
  ]);
  const kDva = parsovatUdalostiZeZdroje(htmlDva, "text/html");
  assert(kDva.length === 2, `dva MINT: ${kDva.length}`);
  assert(
    kDva[0]!.zdrojIdentita === "visittrebon|trhy|mint-market|2026|1",
    "poradi 1",
  );
  assert(
    kDva[1]!.zdrojIdentita === "visittrebon|trhy|mint-market|2026|2",
    "poradi 2",
  );
  assert(kDva[0]!.datumOd === "2026-06-20", "červen");
  assert(kDva[1]!.datumOd === "2026-08-22", "srpen");

  // Ownership jen Visit gate → trhy; obecné jméno nestačí
  const polozky = vytvoritVychoziRedakcniPoradi();
  const vlast = sparovatVlastnictvimHlidaneKotvy(
    polozky,
    ["trhy"],
    BRANA_TRHY_REDAKCNI_POLOZKA_ID,
  );
  assert(vlast.ok && vlast.redakcniPolozkaId === "trhy", "ownership trhy");
  const obecne = sparovatSHlidanymiKotvami(
    { nazev: "MINT Market", datumOd: "2026-08-22", datumDo: "2026-08-22", cas: "", mistoNeboTyp: "MINT Market" },
    polozky,
    ["kino"],
  );
  assert(!obecne.ok, "bez kotvy trhy neotevírá obecné Visit→trhy");

  // --- Lifecycle: změna data jednoho MINT ---
  const id = "visittrebon|trhy|mint-market|2026|1";
  const stav1 = aplikovatScanKandidatyNaUdalosti(
    [
      ceka({
        id: "u1",
        datumOd: "2026-08-22",
        nazev: "MINT Market",
        zdrojIdentita: id,
      }),
    ],
    [kandidat({ nazev: "MINT Market", datumOd: "2026-08-23", zdrojIdentita: id })],
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(stav1.vysledek.pridano === 0, "změna data: žádné nové");
  assert(stav1.vysledek.jizExistuje === 0, "změna data: ne jizExistuje");
  assert(stav1.vysledek.aktualizovano === 1, "změna data: update");
  assert(stav1.udalosti.length === 1, "jedna CEKA");
  assert(stav1.udalosti[0]!.datumOd === "2026-08-23", "update in-place");
  assert(stav1.udalosti[0]!.zdrojIdentita === id, "identita drží |1");

  const stavIdent = aplikovatScanKandidatyNaUdalosti(
    stav1.udalosti,
    [kandidat({ nazev: "MINT Market", datumOd: "2026-08-23", zdrojIdentita: id })],
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(stavIdent.vysledek.jizExistuje === 1, "identická → Již existuje");
  assert(stavIdent.vysledek.pridano === 0, "identická: 0 přidáno");

  const schvaleno = aplikovatScanKandidatyNaUdalosti(
    [
      ceka({
        id: "uS",
        datumOd: "2026-08-22",
        nazev: "MINT Market",
        zdrojIdentita: id,
        stavSchvaleni: "SCHVALENO",
      }),
    ],
    [kandidat({ nazev: "MINT Market", datumOd: "2026-08-23", zdrojIdentita: id })],
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(schvaleno.vysledek.pridano === 0, "SCHVALENO: žádný overwrite");
  assert(schvaleno.udalosti[0]!.datumOd === "2026-08-22", "SCHVALENO drží datum");

  const vyrazeno = aplikovatScanKandidatyNaUdalosti(
    [
      ceka({
        id: "uV",
        datumOd: "2026-08-22",
        nazev: "MINT Market",
        zdrojIdentita: id,
        stavSchvaleni: "VYRAZENO",
      }),
    ],
    [kandidat({ nazev: "MINT Market", datumOd: "2026-08-22", zdrojIdentita: id })],
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(vyrazeno.vysledek.pridano === 0, "VYRAZENO: neobnovovat");
  assert(
    vyrazeno.udalosti.every((u) => u.stavSchvaleni === "VYRAZENO"),
    "VYRAZENO zůstává",
  );

  // Dva MINT → dvě CEKA
  const dvaCeka = aplikovatScanKandidatyNaUdalosti(
    [],
    [
      kandidat({
        nazev: "MINT Market",
        datumOd: "2026-06-20",
        zdrojIdentita: "visittrebon|trhy|mint-market|2026|1",
      }),
      kandidat({
        nazev: "MINT Market",
        datumOd: "2026-08-22",
        zdrojIdentita: "visittrebon|trhy|mint-market|2026|2",
      }),
    ],
    "2026-06-01",
    jeUdalostCelaMinula,
  );
  assert(dvaCeka.vysledek.pridano === 2, "dvě CEKA");
  assert(
    new Set(dvaCeka.udalosti.map((u) => u.zdrojIdentita)).size === 2,
    "nesloučit",
  );

  // --- Živý předscan ---
  const zivaUrl = sestavVisitTrebonKalendarUrl(KORENOVÁ_URL);
  const ziveHtml = await get(zivaUrl);
  const eventRow = pocetEventRow(ziveHtml);
  const emitovane = parsovatUdalostiZeZdroje(ziveHtml, "text/html");
  const dnes = dnesIsoVPraze();
  const budouci = emitovane.filter((k) => !jeUdalostCelaMinula(k, dnes));
  const odmitnute = Math.max(0, eventRow - emitovane.length);

  console.log("=== PŘEDSCAN VisitTřeboň ===");
  console.log(`URL: ${zivaUrl}`);
  console.log(`event-row: ${eventRow}`);
  console.log(`emitované MINT: ${emitovane.length}`);
  console.log(`odmítnuté (řádky − emit): ${odmitnute}`);
  for (const k of emitovane) {
    console.log("--- MINT ---");
    console.log(`  nazev: ${k.nazev}`);
    console.log(`  datumOd: ${k.datumOd}`);
    console.log(`  datumDo: ${k.datumDo}`);
    console.log(`  cas: "${k.cas}"`);
    console.log(`  mistoNeboTyp: ${k.mistoNeboTyp}`);
    console.log(`  zdrojIdentita: ${k.zdrojIdentita}`);
    console.log(`  redakcniPolozkaId: ${BRANA_TRHY_REDAKCNI_POLOZKA_ID}`);
    console.log(`  verejny: ${verejnyZap(k.nazev)}`);
  }

  // Simulace prvního produkčního scanu (prázdný kalendář, bez Blob zápisu)
  const sim = aplikovatScanKandidatyNaUdalosti(
    [],
    budouci.map((k) =>
      kandidat({
        nazev: k.nazev,
        datumOd: k.datumOd,
        datumDo: k.datumDo,
        zdrojIdentita: k.zdrojIdentita!,
        mistoNeboTyp: k.mistoNeboTyp,
      }),
    ),
    dnes,
    jeUdalostCelaMinula,
  );
  console.log("=== SIMULACE 1. SCANU ===");
  console.log(`Nalezeno = ${budouci.length}`);
  console.log(`Přidáno = ${sim.vysledek.pridano}`);
  console.log(`Již existuje = ${sim.vysledek.jizExistuje}`);
  console.log(`Nezařazeno = 0`);

  assert(eventRow >= 1, "živý kalendář má řádky");
  assert(
    emitovane.every((k) => k.nazev === "MINT Market" && k.cas === ""),
    "jen MINT, cas prázdný",
  );

  console.log("OK verify-brana-visittrebon-mint-parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
