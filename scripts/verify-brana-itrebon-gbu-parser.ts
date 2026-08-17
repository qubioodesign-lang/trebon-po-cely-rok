/**
 * Úzký parser iTřeboň → Galerie buddhistického umění.
 * Spuštění: npx tsx scripts/verify-brana-itrebon-gbu-parser.ts
 * READ-ONLY: fixture HTML, žádný Blob / ostrý scan / admin zdroj.
 */

import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  BRANA_GBU_KDE,
  BRANA_GBU_REDAKCNI_POLOZKA_ID,
  rozdelGbuTitulek,
  sestavGbuZapisPoSparovani,
} from "../src/lib/brana/admin/gbu-titulek";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  jeUdalostCelaMinula,
  vytvoritScanKlicAutomatickeUdalosti,
} from "../src/lib/brana/admin/konkretni-udalost";
import {
  vychoziJazykVerejnyProId,
  vytvoritVychoziRedakcniPoradi,
} from "../src/lib/brana/admin/redakcni-kostra";
import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";
import {
  deduplikovatScanKandidaty,
  jeItrebonGalerieBuddhistickehoUmeniZdrojUrl,
  parsovatUdalostiZeZdroje,
  sestavItrebonKalendarUrlky,
} from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  sparovatSHlidanymiKotvami,
  sparovatVlastnictvimHlidaneKotvy,
} from "../src/lib/brana/admin/zdroj-scan-sparovani";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function karta(opts: {
  datum: string;
  cas: string;
  misto: string;
  href: string;
  nazev?: string;
  anotace: string;
}): string {
  return `
<div class="kalendarAkceBox">
  <div class="kalendar_levy">
    <div class="kalTerminDatum">${opts.datum}</div>
    <div class="kalTerminCas">${opts.cas}</div>
    <div class="kalTerminMisto">${opts.misto}</div>
  </div>
  <div class="kalendar_info">
    <h2 class="kal-nazev"><a href="${opts.href}">${opts.nazev ?? ""}</a></h2>
    <div class="kalanotace">${opts.anotace}</div>
  </div>
</div>`;
}

const ANOTACE_HATHA =
  "Dopřejte si prostor pro zpomalení. Tato 90minutová lekce hathajógy je pozvánkou k rovnováze.";
const ANOTACE_ZVUKOVA =
  "Galerie buddhistického umění v Třeboni vás srdečně zve na jedinečný večer, během kterého se ponoříte do hlubokého klidu a harmonie prostřednictvím Zvukové lázně.";
const ANOTACE_EHD =
  "Jaký příběh může vyprávět historická vodárenská věž? V rámci Dnů evropského dědictví vás zveme na setkání věnované příběhu jedinečné vodárenské věže v Třeboni.";
const ANOTACE_KAKAO =
  "Jedinečné večerní setkání, kde zpomalíme a usedneme do kruhu nad šálkem rituálního kakaa – medicíny, kterou Mayové uctívali jako „pokrm bohů“.";
const ANOTACE_NEZNAMA =
  "Srdečně zveme na večerní setkání v galerii. Program upřesníme na místě.";
const ANOTACE_ZENSKY_KRUH =
  "Zveme vás na podvečerní setkání v bezpečné a podporující atmosféře ženského kruhu, které nabízí prostor pro zklidnění, vnímání vlastního těla a návrat k sobě samé.";
const ITREBON_GBU_MISTO_JURTA_CMS = "Galerie buddhistického umění/jurta";
const ITREBON_GBU_MISTO_JURTA_KATALOG =
  "Galerie buddhistického umění / jurta";

const FIXTURE = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://www.itrebon.cz/kalendar.html"/>
<title>Kalendář akcí | Informační servis města Třeboně</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Event","name":"Cizí divadlo JSON-LD","startDate":"2026-09-01T19:00","location":{"@type":"Place","name":"Divadlo J. K. Tyla"}}</script>
</head><body>
<span>itrebon.cz</span>
${karta({
  datum: "21.8.2026",
  cas: "18:00-19:30",
  misto: "Galerie buddhistického umění",
  href: "/kalendar/-_20480.html",
  anotace: ANOTACE_HATHA,
})}
${karta({
  datum: "23.8.2026",
  cas: "18:00-20:00",
  misto: "Galerie buddhistického umění",
  href: "/kalendar/-zvukova-lazen-harmonizacni-koncert-tibetskych-mis_19895.html",
  anotace: ANOTACE_ZVUKOVA,
})}
${karta({
  datum: "12.9.2026",
  cas: "18:00-19:00",
  misto: "GBU (Galerie budd.umění)",
  href: "/kalendar/-_21001.html",
  anotace: ANOTACE_EHD,
})}
${karta({
  datum: "26.9.2026",
  cas: "18:00-19:30",
  misto: "GBU (Galerie budd.umění)",
  href: "/kalendar/-_21002.html",
  anotace: ANOTACE_KAKAO,
})}
${karta({
  datum: "3.10.2026",
  cas: "17:00-18:00",
  misto: "Galerie buddhistického umění",
  href: "/kalendar/-_21003.html",
  anotace: ANOTACE_NEZNAMA,
})}
${karta({
  datum: "12.9.2026 - 1.11.2026",
  cas: "",
  misto: "Galerie 105, Masarykovo nám.105",
  href: "/kalendar/-vystava_19900.html",
  anotace: "Třeboňská Stopětka opět přináší nevšední výstavu.",
})}
${karta({
  datum: "20.8.2026",
  cas: "19:00-20:00",
  misto: "Masarykovo náměstí",
  href: "/kalendar/-prohlidka_18800.html",
  anotace: "Večerní prohlídka s místním průvodcem.",
})}
${karta({
  datum: "27.6.2026",
  cas: "18:00-20:00",
  misto: ITREBON_GBU_MISTO_JURTA_CMS,
  href: "/kalendar/-_21005.html",
  anotace: ANOTACE_ZENSKY_KRUH,
})}
${karta({
  datum: "15.9.2026",
  cas: "18:00-19:00",
  misto: ITREBON_GBU_MISTO_JURTA_KATALOG,
  href: "/kalendar/-_21004.html",
  anotace: "Setkání v jurtě u galerie.",
})}
${karta({
  datum: "19.8.2026",
  cas: "17:00-19:00",
  misto: "Galerie města Třeboň",
  href: "/kalendar/-vernisaz_18700.html",
  anotace: "Vernisáž výstavy prof. Vladimíra Franze",
})}
</body></html>`;

const KINOTREBON_FIXTURE = `<!DOCTYPE html>
<html><body>
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
</body></html>`;

const GALERIE105_MINI = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://trebon105.cz/program/prostor:galerie"/>
</head><body>
<section class="event-list">
<a href="https://trebon105.cz/program/example">
  <article class="event">
    <div class="event__meta">
      <div class="event__date">Sobota<br> 4. 9. 18:00</div>
      <div class="event__venue">Galerie</div>
    </div>
    <header class="event__header">
      <h4 class="event__title">Literárně-hudební představení</h4>
    </header>
  </article>
</a>
</section>
</body></html>`;

function jazykGbu(kandidatMisto = "Galerie buddhistického umění") {
  return sestavJazykBranyPoSparovani({
    polozka: "Galerie buddhistického umění",
    kandidatMisto,
    zdrojNazev: "iTřeboň – Galerie buddhistického umění",
    jazykVerejny: vychoziJazykVerejnyProId(BRANA_GBU_REDAKCNI_POLOZKA_ID),
  });
}

function gbuVstup(
  surovyNazev: string,
  datumOd: string,
  cas: string,
  zdrojIdentita: string,
): BranaScanAutomatickaUdalostVstup {
  const zapis = sestavGbuZapisPoSparovani({
    surovyNazev,
    jazyk: jazykGbu(),
  });
  return {
    redakcniPolozkaId: BRANA_GBU_REDAKCNI_POLOZKA_ID,
    datumOd,
    datumDo: datumOd,
    cas,
    mistoNeboTyp: zapis.mistoNeboTyp,
    nazev: zapis.nazev,
    zdrojIdentita,
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
}

/* --- URL lock + stránkování --- */
{
  assert(
    jeItrebonGalerieBuddhistickehoUmeniZdrojUrl(
      "https://www.itrebon.cz/kalendar.html",
    ),
    "URL lock kalendar.html",
  );
  assert(
    jeItrebonGalerieBuddhistickehoUmeniZdrojUrl(
      "https://itrebon.cz/kalendar.html?page=3",
    ),
    "URL lock se stránkou",
  );
  assert(
    !jeItrebonGalerieBuddhistickehoUmeniZdrojUrl(
      "https://www.itrebon.cz/galerie-buddhistickeho-umeni_283.html",
    ),
    "detail galerie není výpis",
  );
  assert(
    !jeItrebonGalerieBuddhistickehoUmeniZdrojUrl(
      "https://www.visittrebon.cz/cz/kalendar-akci-trebon/2/",
    ),
    "Visit není iTřeboň",
  );
  const urlky = sestavItrebonKalendarUrlky(
    "https://www.itrebon.cz/kalendar.html",
  );
  assert(urlky.length === 12, `stránek ${urlky.length}`);
  assert(urlky[0] === "https://www.itrebon.cz/kalendar.html", "strana 1");
  assert(
    urlky[11] === "https://www.itrebon.cz/kalendar.html?page=12",
    "strana 12",
  );
  assert(
    sestavItrebonKalendarUrlky("https://www.kinotrebon.cz/").length === 0,
    "cizí URL bez stránek",
  );
  console.log("OK URL lock + 12 stránek");
}

/* --- Seed KDE --- */
{
  const jazyk = vychoziJazykVerejnyProId(BRANA_GBU_REDAKCNI_POLOZKA_ID);
  assert(jazyk?.rozliseni.rezim === "PEVNE", "seed KDE PEVNE");
  assert(
    jazyk?.rozliseni.rezim === "PEVNE" &&
      jazyk.rozliseni.text === BRANA_GBU_KDE,
    `seed KDE text: ${jazyk?.rozliseni.rezim === "PEVNE" ? jazyk.rozliseni.text : ""}`,
  );
  console.log("OK seed KDE Galerie buddhistického um.");
}

const kandidati = parsovatUdalostiZeZdroje(FIXTURE, "text/html");

/* 1. Hathajóga → 0 */
{
  assert(
    !kandidati.some((k) => k.zdrojIdentita === "itrebon|20480"),
    "hatha není kandidát",
  );
  assert(
    !kandidati.some((k) => /hathajóg/i.test(k.nazev)),
    "žádný hatha název",
  );
  console.log("OK 1 hatha → 0");
}

/* 2. Zvuková lázeň */
{
  const k = kandidati.filter((x) => x.zdrojIdentita === "itrebon|19895");
  assert(k.length === 1, `zvuková ${k.length}`);
  assert(k[0].datumOd === "2026-08-23", `datum ${k[0].datumOd}`);
  assert(k[0].cas === "18:00", `čas ${k[0].cas}`);
  assert(k[0].nazev === ANOTACE_ZVUKOVA, "název = anotace");
  console.log("OK 2 Zvuková lázeň → 1");
}

/* 3. EHD / GBU místo */
{
  const k = kandidati.filter((x) => x.zdrojIdentita === "itrebon|21001");
  assert(k.length === 1, `EHD ${k.length}`);
  assert(k[0].mistoNeboTyp === "GBU (Galerie budd.umění)", "místo GBU");
  assert(k[0].nazev === ANOTACE_EHD, "surový název = anotace");
  console.log("OK 3 EHD → 1");
}

/* 4. Kakao */
{
  const k = kandidati.filter((x) => x.zdrojIdentita === "itrebon|21002");
  assert(k.length === 1, `kakao ${k.length}`);
  assert(k[0].cas === "18:00", `kakao čas ${k[0].cas}`);
  console.log("OK 4 kakao → 1");
}

/* 5. Galerie 105 */
{
  assert(
    !kandidati.some((k) => /105/.test(k.mistoNeboTyp) || /105/.test(k.nazev)),
    "Galerie 105 → 0",
  );
  console.log("OK 5 Galerie 105 → 0");
}

/* 6. Jiné místo */
{
  assert(
    !kandidati.some((k) => k.zdrojIdentita === "itrebon|18800"),
    "náměstí → 0",
  );
  assert(
    !kandidati.some((k) => k.zdrojIdentita === "itrebon|18700"),
    "Galerie města → 0",
  );
  assert(
    !kandidati.some((k) => k.zdrojIdentita === "itrebon|21004"),
    "katalogová jurta s mezerami → 0",
  );
  console.log("OK 6 jiné místo / katalogová jurta s mezerami → 0");
}

/* A/B/C/G. CMS jurta přijata, ownership hlavní kotva, KDE jednotné, fallback */
{
  const k = kandidati.filter((x) => x.zdrojIdentita === "itrebon|21005");
  assert(k.length === 1, `CMS jurta ${k.length}`);
  assert(
    k[0].mistoNeboTyp === ITREBON_GBU_MISTO_JURTA_CMS,
    `CMS místo ${k[0].mistoNeboTyp}`,
  );
  assert(k[0].nazev === ANOTACE_ZENSKY_KRUH, "jurta surový název = anotace");
  const jazyk = jazykGbu(k[0].mistoNeboTyp);
  const zapis = sestavGbuZapisPoSparovani({
    surovyNazev: k[0].nazev,
    jazyk,
  });
  assert(zapis.verejneRozliseni === BRANA_GBU_KDE, "jurta KDE seed");
  assert(
    zapis.mistoNeboTyp === BRANA_GBU_KDE ||
      zapis.mistoNeboTyp.endsWith(` ${BRANA_GBU_KDE}`),
    `jurta mistoNeboTyp bez slova jurta: ${zapis.mistoNeboTyp}`,
  );
  assert(!/jurta/i.test(zapis.mistoNeboTyp), "veřejné KDE bez jurty");
  assert(zapis.nazev === ANOTACE_ZENSKY_KRUH, "jurta fallback surový název");
  assert(
    zapis.verejneCo === null ||
      zapis.verejneCo === undefined ||
      zapis.verejneCo === "",
    `jurta CO prázdné: ${JSON.stringify(zapis.verejneCo)}`,
  );
  const vstup = gbuVstup(
    ANOTACE_ZENSKY_KRUH,
    "2026-09-27",
    "18:00",
    "itrebon|21005",
  );
  assert(
    vstup.redakcniPolozkaId === BRANA_GBU_REDAKCNI_POLOZKA_ID,
    "jurta ownership hlavní kotva",
  );
  const ceka = aplikovatScanKandidatyNaUdalosti(
    [],
    [vstup],
    "2026-08-17",
    jeUdalostCelaMinula,
  );
  assert(ceka.vysledek.pridano === 1, "jurta → CEKA");
  assert(ceka.udalosti[0]?.stavSchvaleni === "CEKA_NA_SCHVALENI", "stav CEKA");
  console.log("OK CMS /jurta → 1, KDE seed, ownership hlavní, CEKA fallback");
}

/* 7. Neznámá relevantní akce zůstane */
{
  const k = kandidati.filter((x) => x.zdrojIdentita === "itrebon|21003");
  assert(k.length === 1, `neznámá ${k.length}`);
  const zapis = sestavGbuZapisPoSparovani({
    surovyNazev: k[0].nazev,
    jazyk: jazykGbu(),
  });
  assert(zapis.nazev === ANOTACE_NEZNAMA, "fallback surový název");
  assert(
    zapis.verejneCo === null || zapis.verejneCo === undefined || zapis.verejneCo === "",
    `fallback CO prázdné: ${JSON.stringify(zapis.verejneCo)}`,
  );
  assert(zapis.verejneRozliseni === BRANA_GBU_KDE, "fallback KDE seed");
  assert(zapis.nazevProScanKlic === undefined, "bez rozdělení bez nazevProScanKlic");
  const render = rozlozAkci({
    mistoNeboTyp: zapis.mistoNeboTyp,
    nazev: zapis.nazev,
    cas: "17:00",
    verejneCo: zapis.verejneCo ?? null,
    verejneRozliseni: zapis.verejneRozliseni ?? null,
  });
  assert(render.nazev === ANOTACE_NEZNAMA, "render drží surový název");
  console.log("OK 7 neznámá galerie → kandidát + fallback");
}

/* 8. EHD post-match */
{
  const rozdel = rozdelGbuTitulek(ANOTACE_EHD);
  assert(rozdel !== null, "EHD konstrukce rozpoznána");
  assert(rozdel.co === "Dny evropského dědictví", `CO ${rozdel.co}`);
  assert(
    rozdel.nazev === "Jaký příběh může vyprávět historická vodárenská věž?",
    `Název ${rozdel.nazev}`,
  );
  const zapis = sestavGbuZapisPoSparovani({
    surovyNazev: ANOTACE_EHD,
    jazyk: jazykGbu(),
  });
  assert(zapis.verejneCo === "Dny evropského dědictví", "zápis CO");
  assert(zapis.verejneRozliseni === BRANA_GBU_KDE, "zápis KDE");
  assert(zapis.nazevProScanKlic === ANOTACE_EHD, "scanKlic ze surového");
  const klic = vytvoritScanKlicAutomatickeUdalosti({
    redakcniPolozkaId: BRANA_GBU_REDAKCNI_POLOZKA_ID,
    datumOd: "2026-09-12",
    cas: "18:00",
    nazev: zapis.nazevProScanKlic ?? zapis.nazev,
  });
  const klicSurovy = vytvoritScanKlicAutomatickeUdalosti({
    redakcniPolozkaId: BRANA_GBU_REDAKCNI_POLOZKA_ID,
    datumOd: "2026-09-12",
    cas: "18:00",
    nazev: ANOTACE_EHD,
  });
  assert(klic === klicSurovy, "scanKlic = surový titulek");
  console.log("OK 8 EHD CO/Název post-match");
}

/* Prefix Přednáška: */
{
  const rozdel = rozdelGbuTitulek("Přednáška: Buddhismus v Himálaji");
  assert(rozdel?.co === "Přednáška", "prefix CO");
  assert(rozdel?.nazev === "Buddhismus v Himálaji", "prefix název");
  console.log("OK prefix Přednáška:");
}

/* 9. Dedup stejné itrebon|{id} */
{
  const sloucene = deduplikovatScanKandidaty([...kandidati, ...kandidati]);
  const id19895 = sloucene.filter((k) => k.zdrojIdentita === "itrebon|19895");
  assert(id19895.length === 1, `dedup parser ${id19895.length}`);

  const vstup = gbuVstup(ANOTACE_ZVUKOVA, "2026-08-23", "18:00", "itrebon|19895");
  const prvni = aplikovatScanKandidatyNaUdalosti(
    [],
    [vstup],
    "2026-08-17",
    jeUdalostCelaMinula,
  );
  assert(prvni.vysledek.pridano === 1, "první zápis");
  const druhy = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    [vstup],
    "2026-08-17",
    jeUdalostCelaMinula,
  );
  assert(druhy.vysledek.pridano === 0, "druhý scan 0 nových");
  assert(druhy.vysledek.jizExistuje === 1, "jizExistuje");
  assert(druhy.udalosti.length === 1, "stále 1 událost");
  console.log("OK 9 dedup itrebon|{id}");
}

/* JSON-LD cizí event na iTřeboň stránce se neemituje */
{
  assert(
    !kandidati.some((k) => /divadlo/i.test(k.nazev)),
    "JSON-LD divadlo není kandidát",
  );
  assert(kandidati.length === 5, `jen 5 GBU karet, je ${kandidati.length}`);
  console.log("OK early return bez JSON-LD mixu");
}

/* Hathajóga ve slugu, anotace bez tokenu */
{
  const html = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.itrebon.cz/kalendar.html"/>
</head><body>itrebon.cz
${karta({
  datum: "4.9.2026",
  cas: "18:00-19:00",
  misto: "Galerie buddhistického umění",
  href: "/kalendar/-hathajoga-klidna-sila-a-vedome-telo_20196.html",
  anotace: "Pozvánka k vědomé péči o tělo i mysl.",
})}
</body></html>`;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 0, "hatha ve slugu → 0");
  console.log("OK hatha slug → 0");
}

/* Hathajóga v CMS jurtě se stále zahodí */
{
  const html = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.itrebon.cz/kalendar.html"/>
</head><body>itrebon.cz
${karta({
  datum: "21.8.2026",
  cas: "18:00-19:30",
  misto: ITREBON_GBU_MISTO_JURTA_CMS,
  href: "/kalendar/-_22100.html",
  anotace: ANOTACE_HATHA,
})}
</body></html>`;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 0, "hatha v /jurta → 0");
  console.log("OK hatha v CMS jurtě → 0");
}

/* Holé jóga se nezahodí */
{
  const html = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.itrebon.cz/kalendar.html"/>
</head><body>itrebon.cz
${karta({
  datum: "5.9.2026",
  cas: "18:00-19:00",
  misto: "Galerie buddhistického umění",
  href: "/kalendar/-_22000.html",
  anotace: "Večer s pránájámou a jemnou jógou v galerii.",
})}
</body></html>`;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1 && k[0].zdrojIdentita === "itrebon|22000", "holé jóga zůstane");
  console.log("OK holé jóga není filtr");
}

/* kal-nazev má přednost před anotací */
{
  const html = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.itrebon.cz/kalendar.html"/>
</head><body>itrebon.cz
${karta({
  datum: "6.9.2026",
  cas: "18:00-19:00",
  misto: "Galerie buddhistického umění",
  href: "/kalendar/-_22001.html",
  nazev: "Přednáška: Buddhismus v Himálaji",
  anotace: "Delší marketingový odstavec, který se nemá stát názvem.",
})}
</body></html>`;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, "kal-nazev karta");
  assert(k[0].nazev === "Přednáška: Buddhismus v Himálaji", "kal-nazev vyhraje");
  console.log("OK kal-nazev před anotací");
}

/* Karta bez ID → 0 */
{
  const html = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.itrebon.cz/kalendar.html"/>
</head><body>itrebon.cz
<div class="kalendarAkceBox">
  <div class="kalTerminDatum">7.9.2026</div>
  <div class="kalTerminCas">18:00</div>
  <div class="kalTerminMisto">Galerie buddhistického umění</div>
  <div class="kalanotace">Bez odkazu s id.</div>
</div>
</body></html>`;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 0, "bez id fail-closed");
  console.log("OK karta bez id → 0");
}

/* Ownership */
{
  const polozky = vytvoritVychoziRedakcniPoradi();
  const vlast = sparovatVlastnictvimHlidaneKotvy(
    polozky,
    [BRANA_GBU_REDAKCNI_POLOZKA_ID],
    BRANA_GBU_REDAKCNI_POLOZKA_ID,
  );
  assert(
    vlast.ok && vlast.redakcniPolozkaId === BRANA_GBU_REDAKCNI_POLOZKA_ID,
    "ownership GBU",
  );
  const jurtaPolozka = polozky.find(
    (p) => p.id === "galerie-buddhistickeho-umeni-jurta",
  );
  assert(jurtaPolozka?.pouzivat === "NE", "položka jurta zůstává Používat NE");
  const vlastJurtaMisto = sparovatVlastnictvimHlidaneKotvy(
    polozky,
    [BRANA_GBU_REDAKCNI_POLOZKA_ID],
    BRANA_GBU_REDAKCNI_POLOZKA_ID,
  );
  assert(
    vlastJurtaMisto.ok &&
      vlastJurtaMisto.redakcniPolozkaId === BRANA_GBU_REDAKCNI_POLOZKA_ID,
    "CMS jurta po parseru vlastní hlavní kotva",
  );
  const bezKotvy = sparovatVlastnictvimHlidaneKotvy(
    polozky,
    ["galerie-105"],
    BRANA_GBU_REDAKCNI_POLOZKA_ID,
  );
  assert(!bezKotvy.ok, "bez kotvy GBU ownership selže");
  const obecne = sparovatSHlidanymiKotvami(
    {
      nazev: ANOTACE_ZVUKOVA,
      datumOd: "2026-08-23",
      datumDo: "2026-08-23",
      cas: "18:00",
      mistoNeboTyp: "Galerie buddhistického umění",
    },
    polozky,
    [BRANA_GBU_REDAKCNI_POLOZKA_ID],
  );
  assert(!obecne.ok, "obecné HLIDANE podle názvu akce nesmí stačit");
  console.log("OK ownership kotvy");
}

/* Regrese: kino / Galerie 105 se iTřeboň větví nedotkne */
{
  const kino = parsovatUdalostiZeZdroje(KINOTREBON_FIXTURE, "text/html");
  assert(kino.length >= 1 && kino[0].nazev === "Test Film", "kino parser");
  const g105 = parsovatUdalostiZeZdroje(GALERIE105_MINI, "text/html");
  assert(g105.length >= 1, "galerie 105 parser");
  assert(
    g105[0].nazev === "Literárně-hudební představení",
    "galerie 105 název",
  );
  console.log("OK regrese kino / Galerie 105 v tomto skriptu");
}

console.log("ALL OK verify-brana-itrebon-gbu-parser");
