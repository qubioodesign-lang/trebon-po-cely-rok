/**
 * Úzký parser Domu přírody Třeboňska.
 * Spuštění: npx tsx scripts/verify-brana-dum-prirody-parser.ts
 * READ-ONLY: fixture HTML, žádný Blob / ostrý scan / admin zdroj.
 */

import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  BRANA_DPT_CO,
  BRANA_DPT_REDAKCNI_POLOZKA_ID,
  jeDumPrirodyTrebonskaZdrojUrl,
  sestavDumPrirodyHubUrl,
  vytahnoutDumPrirodyDetailUrlky,
} from "../src/lib/brana/admin/dum-prirody";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  vychoziJazykVerejnyProId,
  vytvoritVychoziRedakcniPoradi,
} from "../src/lib/brana/admin/redakcni-kostra";
import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import { sparovatVlastnictvimHlidaneKotvy } from "../src/lib/brana/admin/zdroj-scan-sparovani";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function dptShell(vnitr: string): string {
  return `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://www.dumprirody.cz/dum-prirody-trebonska/akce/"/>
<title>Akce | Dům přírody Třeboňska</title>
</head><body>
<span>dumprirody.cz</span>
<div class="articleList event">
${vnitr}
</div>
</body></html>`;
}

function listingKarta(opts: {
  href: string;
  title: string;
  info: string;
  perex: string;
}): string {
  return `<a href="${opts.href}" title="${opts.title}" class="article">
  <h2>${opts.title}</h2>
  <div class="cf">
    <p class="info">${opts.info}</p>
    <p>${opts.perex}</p>
  </div>
</a>`;
}

function detailStranka(opts: {
  canonical: string;
  h1: string;
  info: string;
  perex: string;
}): string {
  return `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="${opts.canonical}"/>
</head><body>
<span>dumprirody.cz dum-prirody-trebonska</span>
<article>
  <h1>${opts.h1}</h1>
  <div class="detail-perex">
    <p class="info">${opts.info}</p>
    <p>${opts.perex}</p>
  </div>
</article>
</body></html>`;
}

const HREF_ROZMBERK =
  "/dum-prirody-trebonska/akce/pesi-vylet-okolo-rybnika-rozmberk/";
const HREF_TISY =
  "/dum-prirody-trebonska/akce/ornitologicka-vychazka-do-npr-velky-a-maly-tisy/";
const HREF_BOTANICKA =
  "/dum-prirody-trebonska/akce/botanicka-vychazka-za-mokradnimi-rostlinami-mokrych-luk/";
const HREF_PRED_DSN =
  "/dum-prirody-trebonska/akce/prednaska-jak-probiha-revitalizace-mist-po-tezbe-raseliny-na-trebonsku/";
const HREF_PRED_DSN_KRATKE =
  "/dum-prirody-trebonska/akce/ptaci-tah/";
const HREF_PRED_DPT =
  "/dum-prirody-trebonska/akce/prednaska-v-dome-prirody/";
const HREF_DILNA = "/dum-prirody-trebonska/akce/tvorive-dilny/";
const HREF_ROK = "/dum-prirody-trebonska/akce/prehled-akci-v-roce-2026/";
const HREF_NEZNAMY = "/dum-prirody-trebonska/akce/den-s-lesnikem/";

/* --- URL lock --- */
{
  assert(
    jeDumPrirodyTrebonskaZdrojUrl(
      "https://www.dumprirody.cz/dum-prirody-trebonska/akce/",
    ),
    "listing URL",
  );
  assert(
    jeDumPrirodyTrebonskaZdrojUrl(
      "https://dumprirody.cz/dum-prirody-trebonska/akce/pesi-vylet-okolo-rybnika-rozmberk/",
    ),
    "detail URL",
  );
  assert(
    !jeDumPrirodyTrebonskaZdrojUrl(
      "https://www.dumprirody.cz/dum-prirody-trebonska/",
    ),
    "homepage není /akce/",
  );
  assert(
    !jeDumPrirodyTrebonskaZdrojUrl(
      "https://www.dumprirody.cz/dum-prirody-palavy/akce/",
    ),
    "jiný Dům přírody",
  );
  const hub = sestavDumPrirodyHubUrl(
    "https://www.dumprirody.cz/dum-prirody-trebonska/akce",
  );
  assert(
    hub === "https://www.dumprirody.cz/dum-prirody-trebonska/akce/",
    `hub ${hub}`,
  );
  console.log("OK URL lock");
}

/* --- Seed CO / Výhled --- */
{
  const jazyk = vychoziJazykVerejnyProId(BRANA_DPT_REDAKCNI_POLOZKA_ID);
  assert(jazyk?.co.rezim === "PEVNE", "seed CO PEVNE");
  assert(
    jazyk?.co.rezim === "PEVNE" && jazyk.co.text === BRANA_DPT_CO,
    `seed CO: ${jazyk?.co.rezim === "PEVNE" ? jazyk.co.text : ""}`,
  );
  assert(
    jazyk?.rozliseni.rezim === "Z_UDALOSTI",
    "seed KDE Z_UDALOSTI",
  );
  const polozka = vytvoritVychoziRedakcniPoradi().find(
    (p) => p.id === BRANA_DPT_REDAKCNI_POLOZKA_ID,
  );
  assert(polozka?.vyhled === "NE", `Výhled ${polozka?.vyhled}`);
  assert(polozka?.id === "dum-prirody-trebonska", "stabilní ID");
  console.log("OK seed CO Dům přírody, Výhled NE");
}

function jazykDpt(misto: string) {
  return sestavJazykBranyPoSparovani({
    polozka: "Dům přírody Třeboňska",
    kandidatMisto: misto,
    zdrojNazev: "Dům přírody Třeboňska – akce",
    jazykVerejny: vychoziJazykVerejnyProId(BRANA_DPT_REDAKCNI_POLOZKA_ID),
  });
}

function overCoKde(
  misto: string,
  nazev: string,
  cas: string,
  ocekavaneKde: string,
  stitulek: string,
): void {
  const jazyk = jazykDpt(misto);
  const rozloz = rozlozAkci({
    mistoNeboTyp: jazyk.mistoNeboTyp,
    nazev,
    cas,
    verejneCo: jazyk.verejneCo,
    verejneRozliseni: jazyk.verejneRozliseni,
  });
  assert(rozloz.typ === BRANA_DPT_CO, `${stitulek} CO ${rozloz.typ}`);
  assert(rozloz.misto === ocekavaneKde, `${stitulek} KDE ${rozloz.misto}`);
}

/* A. ornitologická vycházka / pěší výlet */
{
  const html = dptShell(
    listingKarta({
      href: HREF_TISY,
      title: "Ornitologická vycházka do NPR Velký a Malý Tisý",
      info: "Termín: 22. srpna 2026 od&nbsp;07:20 do&nbsp;12:00<br>Místo: Sraz Lužnice žel. zastávka",
      perex:
        "Pěší výlet vás zavede do jedné z nejvýznamnějších ornitologických rezervací v ČR.",
    }),
  );
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `A tisy ${k.length}`);
  assert(k[0].datumOd === "2026-08-22", `A datum ${k[0].datumOd}`);
  assert(k[0].cas === "07:20", `A čas ${k[0].cas}`);
  assert(
    k[0].mistoNeboTyp === "Sraz Lužnice žel. zastávka",
    `A KDE ${k[0].mistoNeboTyp}`,
  );
  assert(
    k[0].nazev === "Ornitologická vycházka do NPR Velký a Malý Tisý",
    `A název ${k[0].nazev}`,
  );
  overCoKde(
    k[0].mistoNeboTyp,
    k[0].nazev,
    k[0].cas,
    "Sraz Lužnice žel. zastávka",
    "A",
  );
  console.log("OK A ornitologická vycházka / pěší výlet → 1");
}

/* B. pěší výlet Okolo Rožmberka */
{
  const html = dptShell(
    listingKarta({
      href: HREF_ROZMBERK,
      title: "Pěší výlet: Okolo rybníka Rožmberk",
      info: "Termín: 5. září 2026 od&nbsp;09:00 do&nbsp;15:00<br>Místo: Sraz před&nbsp;železniční stanicí Třeboň",
      perex:
        "Zveme vás na pěší výlet kolem Rožmberka, největšího rybníka v České republice.",
    }),
  );
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `B výlet ${k.length}`);
  assert(k[0].datumOd === "2026-09-05", `B datum ${k[0].datumOd}`);
  assert(k[0].cas === "09:00", `B čas ${k[0].cas}`);
  assert(
    k[0].mistoNeboTyp === "Sraz před železniční stanicí Třeboň",
    `B KDE ${k[0].mistoNeboTyp}`,
  );
  assert(
    k[0].nazev === "Pěší výlet: Okolo rybníka Rožmberk",
    `B název ${k[0].nazev}`,
  );
  overCoKde(
    k[0].mistoNeboTyp,
    k[0].nazev,
    k[0].cas,
    "Sraz před železniční stanicí Třeboň",
    "B",
  );
  console.log("OK B pěší výlet Okolo Rožmberka → 1");
}

/* botanická vycházka (síto ANO, mimo A–L písmena) */
{
  const html = detailStranka({
    canonical: `https://www.dumprirody.cz${HREF_BOTANICKA}`,
    h1: "Botanická vycházka: Za mokřadními rostlinami Mokrých luk",
    info: "Termín: 21. června 2026 od 10:00 do 13:00<br>Místo: Sraz železniční zastávka TŘEBOŇ-LÁZNĚ",
    perex:
      "Vydejte se s námi na botanickou vycházku s Mgr. Andreou Kučerovou, Ph.D.",
  });
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `botanická ${k.length}`);
  console.log("OK botanická vycházka → 1");
}

/* C. přednáška mimo DSN */
{
  const html = detailStranka({
    canonical: `https://www.dumprirody.cz${HREF_PRED_DPT}`,
    h1: "Přednáška: Ptáci Třeboňska v zimě",
    info: "Termín: 12. listopadu 2026 od 18:00 do 19:30<br>Místo: Dům přírody Třeboňska",
    perex: "Přednášku pořádá Dům přírody Třeboňska. Vstupné zdarma.",
  });
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `C přednáška DPT ${k.length}`);
  overCoKde(
    k[0].mistoNeboTyp,
    k[0].nazev,
    k[0].cas,
    "Dům přírody Třeboňska",
    "C",
  );
  console.log("OK C přednáška mimo DSN → 1");
}

/* D. přednáška s Místo: Dům Štěpánka Netolického */
{
  const html = detailStranka({
    canonical: `https://www.dumprirody.cz${HREF_PRED_DSN_KRATKE}`,
    h1: "Ptačí tah",
    info: "Termín: 17. října 2024 od 18:00 do 19:30<br>Místo: Dům Štěpánka Netolického",
    perex:
      "Dům přírody Třeboňska zve na přednášku RNDr. Petra Veselého, Ph.D.",
  });
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 0, `D parser ${k.length}`);
  console.log("OK D Místo Dům Štěpánka Netolického → 0");
}

/* E. přednáška s Místo: Dům Štěpánka Netolického v Třeboni */
{
  const html = detailStranka({
    canonical: `https://www.dumprirody.cz${HREF_PRED_DSN}`,
    h1: "Přednáška: Jak probíhá revitalizace míst po těžbě rašeliny na Třeboňsku",
    info: "Termín: 18. června 2026 od 18:00 do 19:30<br>Místo: Dům Štěpánka Netolického v Třeboni",
    perex:
      "Přednášku pořádá Dům přírody Třeboňska, přednáší Mgr. Andrea Kučerová, Ph.D.",
  });
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 0, `E parser ${k.length}`);
  console.log("OK E Místo Dům Štěpánka Netolického v Třeboni → 0");
}

/* F. DSN jen v anotaci, jiné strukturované Místo → nesmí spadnout */
{
  const html = detailStranka({
    canonical: `https://www.dumprirody.cz${HREF_PRED_DPT}`,
    h1: "Přednáška: Ptáci Třeboňska v zimě",
    info: "Termín: 12. listopadu 2026 od 18:00 do 19:30<br>Místo: Dům přírody Třeboňska",
    perex:
      "Přednáška se tentokrát nekoná v Domě Štěpánka Netolického, ale v Domě přírody.",
  });
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `F anotace ${k.length}`);
  assert(
    k[0].mistoNeboTyp === "Dům přírody Třeboňska",
    `F KDE ${k[0].mistoNeboTyp}`,
  );
  console.log("OK F DSN jen v anotaci → 1");
}

/* G. dílna */
{
  const html = dptShell(
    listingKarta({
      href: HREF_DILNA,
      title: "Podzimní kreativní dílny – akce pro děti i dospělé",
      info: "Termín: 26. září 2026 od 10:00 do 14:00<br>Místo: Dům přírody Třeboňska",
      perex: "Zveme vás na tvořivé dílny pro děti i dospělé.",
    }),
  );
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 0, `G dílna ${k.length}`);
  console.log("OK G dílna → 0");
}

/* H. pravidelná prohlídka */
{
  const html = dptShell(
    listingKarta({
      href: "/dum-prirody-trebonska/akce/komentovana-prohlidka-expozice/",
      title: "Komentovaná prohlídka stálé expozice",
      info: "Termín: 19. srpna 2026 od 13:30 do 14:30<br>Místo: Dům přírody Třeboňska",
      perex: "Komentovaná prohlídka probíhá každou středu od 13:30.",
    }),
  );
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 0, `H prohlídka ${k.length}`);
  const stredy = detailStranka({
    canonical:
      "https://www.dumprirody.cz/dum-prirody-trebonska/akce/stredy-v-dome-prirody/",
    h1: "Středy v Domě přírody",
    info: "Termín: 26. srpna 2026 od 13:30 do 14:30<br>Místo: Dům přírody Třeboňska",
    perex: "Komentovaná prohlídka každou středu. Opakující se program pro návštěvníky.",
  });
  const kStredy = parsovatUdalostiZeZdroje(stredy, "text/html");
  assert(kStredy.length === 0, `H středy ${kStredy.length}`);
  console.log("OK H pravidelná prohlídka → 0");
}

/* I. roční mega-karta / provoz */
{
  const rok = dptShell(
    listingKarta({
      href: HREF_ROK,
      title: "Akce na Třeboňsku v roce 2026",
      info: "Termín: 28. března 2026 — 28. listopadu 2026<br>Místo: Dům přírody Třeboňska",
      perex:
        "Seznamte se s naším přehledem plánovaných akcí pro rok 2026. Tvořivé dílny a přednášky.",
    }),
  );
  const kRok = parsovatUdalostiZeZdroje(rok, "text/html");
  assert(kRok.length === 0, `I rok ${kRok.length}`);
  const urlky = vytahnoutDumPrirodyDetailUrlky(
    rok,
    "https://www.dumprirody.cz/dum-prirody-trebonska/akce/",
  );
  assert(urlky.length === 0, "I roční karta není detail");
  const provoz = detailStranka({
    canonical:
      "https://www.dumprirody.cz/dum-prirody-trebonska/akce/stala-expozice/",
    h1: "Stálá expozice Krajina a lidé",
    info: "Termín: 1. července 2026 od 10:00 do 17:00<br>Místo: Dům přírody Třeboňska",
    perex: "Otevírací doba a vstupné do stálé expozice.",
  });
  const kProvoz = parsovatUdalostiZeZdroje(provoz, "text/html");
  assert(kProvoz.length === 0, `I provoz ${kProvoz.length}`);
  console.log("OK I roční mega-karta → 0");
}

/* J. neznámý jednorázový formát */
{
  const html = dptShell(
    listingKarta({
      href: HREF_NEZNAMY,
      title: "Den s lesníkem",
      info: "Termín: 3. října 2026 od 09:00 do 12:00<br>Místo: Zámek Třeboň",
      perex: "Pozvání na setkání u infostánku v parku.",
    }),
  );
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 0, `J neznámý ${k.length}`);
  console.log("OK J neznámý formát → 0");
}

/* K + L. CO / KDE na výletu (A/B už kontroluje; zde explicitně) */
{
  const html = dptShell(
    listingKarta({
      href: HREF_ROZMBERK,
      title: "Pěší výlet: Okolo rybníka Rožmberk",
      info: "Termín: 5. září 2026 od 09:00 do 15:00<br>Místo: Sraz před železniční stanicí Třeboň",
      perex: "Zveme vás na pěší výlet kolem Rožmberka.",
    }),
  );
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `K/L ${k.length}`);
  overCoKde(
    k[0].mistoNeboTyp,
    k[0].nazev,
    k[0].cas,
    "Sraz před železniční stanicí Třeboň",
    "K/L",
  );
  assert(BRANA_DPT_CO === "Dům přírody", "K konstanta CO");
  console.log("OK K CO Dům přírody; L KDE = sraz ze zdroje");
}

/* JSON-LD cizí událost na DPT stránce se nepropíše */
{
  const html = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://www.dumprirody.cz/dum-prirody-trebonska/akce/"/>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Velikonoční tvořivé dílny",
    startDate: "2026-03-28T10:00",
    location: { "@type": "Place", name: "Divadlo J. K. Tyla" },
  })}</script>
</head><body>
<span>dumprirody.cz dum-prirody-trebonska</span>
<div class="articleList event">
${listingKarta({
  href: HREF_ROZMBERK,
  title: "Pěší výlet: Okolo rybníka Rožmberk",
  info: "Termín: 5. září 2026 od 09:00 do 15:00<br>Místo: Sraz před železniční stanicí Třeboň",
  perex: "Zveme vás na pěší výlet kolem Rožmberka.",
})}
</div>
</body></html>`;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `JSON-LD mix ${k.length}`);
  assert(!k.some((x) => /dílny/i.test(x.nazev)), "JSON-LD dílna není kandidát");
  console.log("OK JSON-LD se nepropíše");
}

/* Ownership kotva */
{
  const poradi = vytvoritVychoziRedakcniPoradi();
  const r = sparovatVlastnictvimHlidaneKotvy(
    poradi,
    [BRANA_DPT_REDAKCNI_POLOZKA_ID],
    BRANA_DPT_REDAKCNI_POLOZKA_ID,
  );
  assert(r.ok && r.redakcniPolozkaId === BRANA_DPT_REDAKCNI_POLOZKA_ID, "ownership");
  const prazdne = sparovatVlastnictvimHlidaneKotvy(
    poradi,
    [],
    BRANA_DPT_REDAKCNI_POLOZKA_ID,
  );
  assert(!prazdne.ok, "ownership bez kotvy fail-closed");
  console.log("OK ownership kotva dum-prirody-trebonska");
}

console.log("ALL OK verify-brana-dum-prirody-parser");
