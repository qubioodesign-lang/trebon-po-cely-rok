/**
 * Úzký parser Rožmberské noci (zamek-trebon.cz, 1 karta / den).
 * Spuštění: npx tsx scripts/verify-brana-rozmberska-noc-parser.ts
 * READ-ONLY předscan: npx tsx scripts/verify-brana-rozmberska-noc-parser.ts --zivy
 */

import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  BRANA_ROZMBERSKA_NOC_NAZEV,
  BRANA_ROZMBERSKA_NOC_POLOZKA,
  BRANA_ROZMBERSKA_NOC_REDAKCNI_POLOZKA_ID,
  jePresnyNazevRozmberskaNocAkce,
  jeRozmberskaNocListingUrl,
  jeRozmberskaNocZdrojUrl,
  najitRozmberskaNocKotvuId,
  parsovatRozmberskaNocProgram,
  sestavRozmberskaNocListingUrl,
  sestavRozmberskaNocMesicPostTelo,
  sestavRozmberskaNocVerejneCo,
  sestavRozmberskaNocZapisPoSparovani,
  sestavRozmberskaNocZdrojIdentitu,
  vytahnoutRozmberskaNocDetailUrlZListingu,
  vytahnoutRozmberskaNocMesiceZListingu,
  vybratJednoznacnyRozmberskaNocDetailUrl,
  type RozmberskaNocScanKandidat,
} from "../src/lib/brana/admin/rozmberska-noc";
import { sparovatVlastnictvimHlidaneKotvy } from "../src/lib/brana/admin/zdroj-scan-sparovani";
import {
  vytvoritVychoziRedakcniPoradi,
  type BranaRedakcniPolozkaStav,
} from "../src/lib/brana/admin/redakcni-kostra";
import { aplikovatScanKandidatyNaUdalosti } from "../src/lib/brana/admin/scan-ceka-zapis";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  pridatNesparovaneDoNezarazenych,
  vychoziNezarazeneDokument,
} from "../src/lib/brana/admin/nezarazene";
import {
  dnesIsoVPraze,
  jeUdalostCelaMinula,
} from "../src/lib/brana/admin/konkretni-udalost";
import type { BranaScanAutomatickaUdalostVstup } from "../src/lib/brana/admin/scan-ceka-zapis";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

const LISTING_URL = "https://www.zamek-trebon.cz/cs/akce";
const DETAIL_URL_2026 =
  "https://www.zamek-trebon.cz/cs/cs/akce/102057-trebon-rozmberska-noc";
const OCEKAVANE_CO =
  "Rožmberská noc · Zámek · 18:00 / 19:15 / 20:30";
const ZAKAZANE_KOTVY = [
  "statni-zamek-trebon",
  "kultura-pod-hvezdami",
  "divadlo-jk-tyla",
  "trebonsky-divadelni-festival",
  "kino-svetozor",
  "kino-aurora",
  "trhy",
  "hradozamecka-noc",
] as const;

function eventHtml(args: {
  h1: string;
  datum: string;
  casy: string;
  post?: string;
  prefixH1?: string;
}): string {
  const prefix = args.prefixH1
    ? `<h1 class="section__headline--center">${args.prefixH1}</h1>`
    : "";
  return `<!DOCTYPE html>
<html><head><title>${args.h1}</title></head>
<body>
${prefix}
<div class="event">
  <h1>${args.h1}</h1>
  <p>${args.datum}</p>
  <p>${args.casy}</p>
  <div class="post-text">${args.post ?? ""}</div>
</div>
</body></html>`;
}

const FIXTURE_2026 = eventHtml({
  prefixH1: "Třeboň",
  h1: "TŘEBOŇ: Rožmberská noc – VYPRODÁNO",
  datum: "10. 9. 2026 – 12. 9. 2026",
  casy: "18.00 – 19.00, 19.15 – 20.15, 20.30 – 21.30",
  post: "10.–12. září vždy od 18.00, 19.15 a 20.30",
});

const FIXTURE_JINY_ROK = eventHtml({
  h1: "Rožmberská noc",
  datum: "1. 8. 2027 – 2. 8. 2027",
  casy: "17:00 / 18:30",
});

const FIXTURE_HRADOZAMECKA = eventHtml({
  h1: "Hradozámecká noc",
  datum: "22. 8. 2026",
  casy: "19.00 – 22.00",
});

const FIXTURE_JINA_AKCE = eventHtml({
  h1: "Koncert v zámecké zahradě",
  datum: "1. 9. 2026",
  casy: "18.00",
});

function doScanVstupu(
  k: RozmberskaNocScanKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
): BranaScanAutomatickaUdalostVstup | null {
  const kotva = najitRozmberskaNocKotvuId(polozky);
  if (!kotva) {
    return null;
  }
  const sparovani = sparovatVlastnictvimHlidaneKotvy(polozky, [kotva], kotva);
  if (!sparovani.ok) {
    return null;
  }
  const zapis = sestavRozmberskaNocZapisPoSparovani({
    verejneCo: k.mistoNeboTyp,
  });
  return {
    redakcniPolozkaId: sparovani.redakcniPolozkaId,
    datumOd: k.datumOd,
    datumDo: k.datumDo,
    cas: k.cas,
    mistoNeboTyp: zapis.mistoNeboTyp,
    nazev: zapis.nazev,
    verejneCo: zapis.verejneCo,
    verejneRozliseni: zapis.verejneRozliseni,
    zdrojIdentita: k.zdrojIdentita,
  };
}

function overUrl(): void {
  assert(jeRozmberskaNocListingUrl(LISTING_URL), "listing URL");
  assert(jeRozmberskaNocZdrojUrl(LISTING_URL), "listing je zdroj");
  assert(
    sestavRozmberskaNocListingUrl(LISTING_URL) === LISTING_URL,
    "kanonický listing",
  );
  assert(jeRozmberskaNocZdrojUrl(DETAIL_URL_2026), "detail 2026 stále prochází");
  assert(
    jeRozmberskaNocZdrojUrl(
      "https://www.zamek-trebon.cz/cs/akce/102057-trebon-rozmberska-noc-vyprodano",
    ),
    "canonical slug",
  );
  assert(
    !jeRozmberskaNocZdrojUrl(
      "https://www.zamek-trebon.cz/cs/akce/123-hradozamecka-noc",
    ),
    "Hradozámecká noc URL není RN",
  );
  assert(
    !jeRozmberskaNocZdrojUrl(
      "https://www.jihoceskedivadlo.cz/porad/2772-rozmberska-noc",
    ),
    "JD není zdroj",
  );
  console.log("OK URL gate");
}

function listingHtml(karty: { href: string; title: string }[]): string {
  const polozky = karty
    .map(
      (k) =>
        `<a href="${k.href}" class="events__item-title">${k.title}</a>`,
    )
    .join("\n");
  return `<!DOCTYPE html><html><body>
<ul>
  <li class="panel active"><a class="events-filter-month-selector" href="javascript:void(0);" data-year="2026" data-month="8">srpen 2026</a></li>
  <li class="panel"><a class="events-filter-month-selector" href="javascript:void(0);" data-year="2026" data-month="9">září 2026</a></li>
</ul>
${polozky}
</body></html>`;
}

function overDiscovery(): void {
  assert(
    jePresnyNazevRozmberskaNocAkce("TŘEBOŇ: Rožmberská noc – VYPRODÁNO"),
    "živý název 2026",
  );
  assert(jePresnyNazevRozmberskaNocAkce("Rožmberská noc"), "holý název");
  assert(
    !jePresnyNazevRozmberskaNocAkce(
      "TŘEBOŇ:  Hradozámecká noc – kostýmovaná prohlídka Soirée princezny Terezie – VYPRODÁNO",
    ),
    "Hradozámecká noc",
  );
  assert(
    !jePresnyNazevRozmberskaNocAkce("Trasa A – Rožmberské renesanční interiéry"),
    "prohlídka",
  );
  assert(
    !jePresnyNazevRozmberskaNocAkce("Kultura pod hvězdami"),
    "Kultura pod hvězdami",
  );

  const jeden = vytahnoutRozmberskaNocDetailUrlZListingu(
    listingHtml([
      {
        href: "/cs/akce/102057-trebon-rozmberska-noc-vyprodano",
        title: "TŘEBOŇ: Rožmberská noc – VYPRODÁNO",
      },
      {
        href: "/cs/akce/105130-trebon-hradozamecka-noc-kostymovana-prohlidka",
        title: "TŘEBOŇ: Hradozámecká noc – kostýmovaná prohlídka",
      },
    ]),
    LISTING_URL,
  );
  assert(jeden.length === 1, `1 RN odkaz, bylo ${jeden.length}`);
  assert(
    vybratJednoznacnyRozmberskaNocDetailUrl(jeden) ===
      "https://www.zamek-trebon.cz/cs/akce/102057-trebon-rozmberska-noc-vyprodano",
    "jednoznačný detail",
  );

  const duplicitniStejna = vytahnoutRozmberskaNocDetailUrlZListingu(
    listingHtml([
      {
        href: "/cs/akce/102057-trebon-rozmberska-noc-vyprodano",
        title: "TŘEBOŇ: Rožmberská noc – VYPRODÁNO",
      },
      {
        href: "/cs/akce/102057-trebon-rozmberska-noc-vyprodano",
        title: "TŘEBOŇ: Rožmberská noc – VYPRODÁNO",
      },
    ]),
    LISTING_URL,
  );
  assert(
    vybratJednoznacnyRozmberskaNocDetailUrl(duplicitniStejna) !== null,
    "stejná URL 2× = 1",
  );

  const dve = vytahnoutRozmberskaNocDetailUrlZListingu(
    listingHtml([
      {
        href: "/cs/akce/102057-trebon-rozmberska-noc-vyprodano",
        title: "TŘEBOŇ: Rožmberská noc – VYPRODÁNO",
      },
      {
        href: "/cs/akce/999999-trebon-rozmberska-noc",
        title: "Rožmberská noc",
      },
    ]),
    LISTING_URL,
  );
  assert(vybratJednoznacnyRozmberskaNocDetailUrl(dve) === null, "2 URL → 0");

  const prazdny = vytahnoutRozmberskaNocDetailUrlZListingu(
    listingHtml([
      {
        href: "/cs/akce/105130-trebon-hradozamecka-noc",
        title: "TŘEBOŇ: Hradozámecká noc",
      },
    ]),
    LISTING_URL,
  );
  assert(prazdny.length === 0, "jen Hradozámecká = 0");
  assert(vybratJednoznacnyRozmberskaNocDetailUrl(prazdny) === null, "0 shod");

  const mesice = vytahnoutRozmberskaNocMesiceZListingu(
    listingHtml([]),
  );
  assert(mesice.length === 2, `2 měsíce z panelů, bylo ${mesice.length}`);
  assert(mesice[0]?.rok === 2026 && mesice[0]?.mesic === 8, "srpen z listingu");
  assert(mesice[1]?.rok === 2026 && mesice[1]?.mesic === 9, "září z listingu");
  console.log("OK discovery fail-closed");
}

function overFixture2026(): void {
  const dispatch = parsovatUdalostiZeZdroje(FIXTURE_2026, "text/html");
  const karty = parsovatRozmberskaNocProgram(FIXTURE_2026);
  assert(dispatch.length === 3, `dispatch 3, bylo ${dispatch.length}`);
  assert(karty.length === 3, `parser 3, bylo ${karty.length}`);

  const dny = ["2026-09-10", "2026-09-11", "2026-09-12"];
  for (let i = 0; i < dny.length; i += 1) {
    const k = karty[i];
    assert(k, `karta ${dny[i]}`);
    assert(k.datumOd === dny[i], `datum ${k.datumOd}`);
    assert(k.datumDo === dny[i], `datumDo ${k.datumDo}`);
    assert(k.cas === "", `cas musí být prázdný, je "${k.cas}"`);
    assert(k.mistoNeboTyp === OCEKAVANE_CO, `verejneCo ${k.mistoNeboTyp}`);
    assert(k.nazev === BRANA_ROZMBERSKA_NOC_NAZEV, `nazev ${k.nazev}`);
    assert(
      k.zdrojIdentita === sestavRozmberskaNocZdrojIdentitu(dny[i]),
      `identita ${k.zdrojIdentita}`,
    );
    assert(
      k.zdrojIdentita === `rozmberska-noc|${dny[i]}`,
      "identita bez času",
    );
  }

  const polozky = vytvoritVychoziRedakcniPoradi();
  const kotva = najitRozmberskaNocKotvuId(polozky);
  assert(kotva === BRANA_ROZMBERSKA_NOC_REDAKCNI_POLOZKA_ID, "seed kotva");
  const rn = polozky.find((p) => p.id === kotva);
  assert(rn?.pouzivat === "ANO", "Používat ANO");
  assert(rn?.priorita === 20, `priorita ${rn?.priorita}`);
  assert(rn?.vyhled === "NE", `Výhled ${rn?.vyhled}`);
  assert(rn?.polozka === BRANA_ROZMBERSKA_NOC_POLOZKA, "Položka");

  for (const k of karty) {
    const vstup = doScanVstupu(k, polozky);
    assert(vstup, `zápis ${k.datumOd}`);
    assert(vstup.redakcniPolozkaId === kotva, "ownership RN");
    assert(vstup.verejneCo === OCEKAVANE_CO, "zápis CO");
    assert(vstup.verejneRozliseni === null, "zápis rozlišení prázdné");
    assert(vstup.nazev === "Opera", "zápis nazev Opera");
    assert(vstup.cas === "", "zápis cas prázdný");
    assert(
      !ZAKAZANE_KOTVY.includes(
        vstup.redakcniPolozkaId as (typeof ZAKAZANE_KOTVY)[number],
      ),
      `nesmí spadnout pod ${vstup.redakcniPolozkaId}`,
    );
    const r = rozlozAkci({
      mistoNeboTyp: vstup.mistoNeboTyp,
      nazev: vstup.nazev,
      cas: vstup.cas,
      verejneCo: vstup.verejneCo,
      verejneRozliseni: vstup.verejneRozliseni,
    });
    assert(r.typ === OCEKAVANE_CO, `render CO ${r.typ}`);
    assert(r.misto === "", `render KDE prázdné, je "${r.misto}"`);
    assert(r.nazev === "Opera", `render nazev ${r.nazev}`);
    assert(r.cas === "", "render bez času vpravo");
  }

  console.log("OK A/B/C: 3 karty 10.–12. 9. 2026, jazyk, identita, kotva");
}

function overJinyRok(): void {
  const karty = parsovatRozmberskaNocProgram(FIXTURE_JINY_ROK);
  assert(karty.length === 2, `jiný rok 2, bylo ${karty.length}`);
  assert(karty[0]?.datumOd === "2027-08-01", "2027-08-01");
  assert(karty[1]?.datumOd === "2027-08-02", "2027-08-02");
  assert(
    karty[0]?.mistoNeboTyp ===
      sestavRozmberskaNocVerejneCo(["17:00", "18:30"]),
    `CO jiný rok ${karty[0]?.mistoNeboTyp}`,
  );
  assert(karty[0]?.cas === "", "jiný rok cas prázdný");
  console.log("OK datumy a časy ze zdroje, ne hardcoded 2026");
}

function overCiziAkce(): void {
  assert(
    parsovatRozmberskaNocProgram(FIXTURE_HRADOZAMECKA).length === 0,
    "Hradozámecká noc = 0",
  );
  assert(
    parsovatUdalostiZeZdroje(FIXTURE_HRADOZAMECKA, "text/html").length === 0,
    "Hradozámecká noc dispatch 0",
  );
  assert(
    parsovatRozmberskaNocProgram(FIXTURE_JINA_AKCE).length === 0,
    "jiná akce zámku = 0",
  );
  console.log("OK E: Hradozámecká noc / jiná akce = 0");
}

function overOwnershipFailClosed(): void {
  const karty = parsovatRozmberskaNocProgram(FIXTURE_2026);
  const seed = vytvoritVychoziRedakcniPoradi();

  const pouzivatNe = seed.map((p) =>
    p.id === BRANA_ROZMBERSKA_NOC_REDAKCNI_POLOZKA_ID
      ? { ...p, pouzivat: "NE" as const }
      : p,
  );
  assert(najitRozmberskaNocKotvuId(pouzivatNe) === null, "Používat NE");

  const dve = [
    ...pouzivatNe,
    {
      ...seed.find((p) => p.id === BRANA_ROZMBERSKA_NOC_REDAKCNI_POLOZKA_ID)!,
      id: "rozmberska-noc-kopie",
      pouzivat: "ANO" as const,
    },
  ];
  assert(najitRozmberskaNocKotvuId(dve) === null, "2 Položky → fail-closed");

  const vstupy = karty
    .map((k) => doScanVstupu(k, pouzivatNe))
    .filter((x): x is BranaScanAutomatickaUdalostVstup => x !== null);
  assert(vstupy.length === 0, "chybějící kotva → 0 CEKA vstupů");

  const ceka = aplikovatScanKandidatyNaUdalosti(
    [],
    vstupy,
    "2026-08-19",
    jeUdalostCelaMinula,
  );
  assert(ceka.vysledek.pridano === 0, "0 CEKA");
  assert(ceka.udalosti.length === 0, "0 karet");

  const inbox = pridatNesparovaneDoNezarazenych(vychoziNezarazeneDokument(), {
    zdrojId: "rn-test",
    zdrojNazev: "Rožmberská noc",
    nesparovane: [],
    noveId: () => "x",
  });
  assert(inbox.otevrene.length === 0, "0 Nezařazených");
  console.log("OK F: chybějící / nejednoznačná kotva = 0 CEKA, 0 Nezařazených");
}

function overDedup(): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const kandidati = parsovatRozmberskaNocProgram(FIXTURE_2026)
    .map((k) => doScanVstupu(k, polozky))
    .filter((x): x is BranaScanAutomatickaUdalostVstup => x !== null);
  assert(kandidati.length === 3, "3 vstupy");

  const prvni = aplikovatScanKandidatyNaUdalosti(
    [],
    kandidati,
    "2026-08-19",
    jeUdalostCelaMinula,
  );
  assert(prvni.vysledek.pridano === 3, `první pridano ${prvni.vysledek.pridano}`);
  assert(prvni.udalosti.length === 3, "první 3 CEKA");

  const druhy = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    kandidati,
    "2026-08-19",
    jeUdalostCelaMinula,
  );
  assert(druhy.vysledek.pridano === 0, "opakovaně 0 nových");
  assert(
    druhy.vysledek.jizExistuje === 3,
    `opakovaně 3× Již existuje, je ${druhy.vysledek.jizExistuje}`,
  );
  assert(druhy.udalosti.length === 3, "stále 3");
  console.log("OK D: opakovaný průchod 0 nových / 3× Již existuje");
}

function overCiziParsery(): void {
  const kino = parsovatUdalostiZeZdroje(
    `<!DOCTYPE html><html><body>
<link rel="canonical" href="https://www.kinotrebon.cz/">
<div class="section-event">
  <div class="section-event-text">
    <h2><a href="/film/x">Test Film</a></h2>
    <div class="program-small">
      <div class="heading-time">po, 10. 8. 2026</div>
      <a class="button-tickets-websale" href="#"><span>20:00</span></a>
    </div>
  </div>
</div>
</body></html>`,
    "text/html",
  );
  assert(kino.length >= 1 && kino[0].nazev === "Test Film", "kino beze změny");
  console.log("OK kino parser beze změny");
}

overUrl();
overDiscovery();
overFixture2026();
overJinyRok();
overCiziAkce();
overOwnershipFailClosed();
overDedup();
overCiziParsery();
console.log("OK verify-brana-rozmberska-noc-parser");

async function zivyPredscan(): Promise<void> {
  const listingRes = await fetch(LISTING_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  if (!listingRes.ok) {
    fail(`STOP — živý listing GET ${listingRes.status}`);
  }
  const listingHtmlZivy = await listingRes.text();
  const mesice = vytahnoutRozmberskaNocMesiceZListingu(listingHtmlZivy);
  const nalezene = vytahnoutRozmberskaNocDetailUrlZListingu(
    listingHtmlZivy,
    LISTING_URL,
  );
  for (const mesic of mesice) {
    const mesicRes = await fetch(LISTING_URL, {
      method: "POST",
      headers: {
        Accept: "text/html",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "BranaAdminScan/1.0",
      },
      body: sestavRozmberskaNocMesicPostTelo(mesic),
    });
    if (!mesicRes.ok) {
      fail(`STOP — živý měsíc POST ${mesic.rok}-${mesic.mesic} ${mesicRes.status}`);
    }
    nalezene.push(
      ...vytahnoutRozmberskaNocDetailUrlZListingu(
        await mesicRes.text(),
        LISTING_URL,
      ),
    );
  }
  const detailUrl = vybratJednoznacnyRozmberskaNocDetailUrl(nalezene);
  console.log(`\nŽIVÝ LISTING: ${LISTING_URL}`);
  console.log(
    `  měsíce z panelů: ${mesice.map((m) => `${m.rok}-${String(m.mesic).padStart(2, "0")}`).join(", ")}`,
  );
  console.log(`  RN odkazy (unikátní): ${[...new Set(nalezene)].join(" | ") || "(žádné)"}`);
  if (!detailUrl) {
    fail("STOP — listing nenašel právě jeden detail Rožmberské noci");
  }
  console.log(`  zvolený detail: ${detailUrl}`);

  const res = await fetch(detailUrl, {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  if (!res.ok) {
    fail(`STOP — živý detail GET ${res.status}`);
  }
  const html = await res.text();
  const vsichni = parsovatRozmberskaNocProgram(html);
  const dispatch = parsovatUdalostiZeZdroje(html, "text/html");
  const dnesIso = dnesIsoVPraze();
  const budouci = vsichni.filter((k) => !jeUdalostCelaMinula(k, dnesIso));
  const dny = budouci.map((k) => k.datumOd).sort();
  const ocekavane = ["2026-09-10", "2026-09-11", "2026-09-12"];

  console.log(`  dnes: ${dnesIso}`);
  console.log(`  parser celkem: ${vsichni.length}, dispatch: ${dispatch.length}`);
  console.log(`  budoucí kandidáty: ${budouci.length}`);

  for (const k of budouci) {
    console.log(
      [
        `  datum: ${k.datumOd}`,
        `cas: "${k.cas}"`,
        `verejneCo: ${k.mistoNeboTyp}`,
        `nazev: ${k.nazev}`,
        `identita: ${k.zdrojIdentita ?? ""}`,
      ].join(" | "),
    );
  }

  if (dny.join(",") !== ocekavane.join(",") || budouci.length !== 3) {
    fail(
      `STOP — živý zdroj nedal přesně 10./11./12. 9. 2026 (3 karty). Bylo: ${dny.join(", ") || "(nic)"}`,
    );
  }
  for (const k of budouci) {
    assert(k.cas === "", `živě cas prázdný ${k.datumOd}`);
    assert(k.mistoNeboTyp === OCEKAVANE_CO, `živě CO ${k.mistoNeboTyp}`);
    assert(k.nazev === "Opera", `živě nazev ${k.nazev}`);
    assert(
      k.zdrojIdentita === `rozmberska-noc|${k.datumOd}`,
      `živě identita ${k.zdrojIdentita}`,
    );
  }
  console.log("OK živý předscan: listing → detail 2026 → 3 karty");
}

if (process.argv.includes("--zivy")) {
  zivyPredscan().catch((e) => {
    fail(e instanceof Error ? e.message : String(e));
  });
}
