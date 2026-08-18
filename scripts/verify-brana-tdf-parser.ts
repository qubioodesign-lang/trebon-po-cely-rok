/**
 * Regrese: úzký HTML parser TDF / tdf.cz (`h3.title` + `h4.place` + `data-date`).
 * Spuštění: npx tsx scripts/verify-brana-tdf-parser.ts
 * READ-ONLY předscan: npx tsx scripts/verify-brana-tdf-parser.ts --zivy
 */
import { klasifikovatItrebonJktKartu } from "../src/lib/brana/admin/divadlo-jk-tyla";
import { zaraditOkoloTreboneUdalost } from "../src/lib/brana/admin/okolo-trebone";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  pridatNesparovaneDoNezarazenych,
  vychoziNezarazeneDokument,
} from "../src/lib/brana/admin/nezarazene";
import {
  dnesIsoVPraze,
  jeUdalostCelaMinula,
} from "../src/lib/brana/admin/konkretni-udalost";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";
import { aplikovatScanKandidatyNaUdalosti } from "../src/lib/brana/admin/scan-ceka-zapis";
import {
  BRANA_TDF_REDAKCNI_POLOZKA_ID,
  jeTdfZdrojUrl,
  normalizovatTdfMistoProKde,
  parsovatTdfProgram,
  sestavTdfProgramUrl,
  urcitTdfKotvu,
} from "../src/lib/brana/admin/tdf";
import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  sparovatSRedakcniPolozkou,
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

function tdfBlok(opts: {
  dateIso: string;
  title: string;
  place: string;
  itrebonHref?: string;
  dateLabel?: string;
}): string {
  const dateLabel = opts.dateLabel ?? opts.dateIso.replace("T", " ");
  const ticket = opts.itrebonHref
    ? `<a class="rezervace" href="${opts.itrebonHref}">vstupenky</a>`
    : "";
  return `
<h4 class="date">${dateLabel}</h4>
<h5 class="agency">soubor uvádí:</h5>
<h3 class="title">${opts.title}</h3>
<h4 class="place"><a href="https://www.google.com/maps/search/${opts.place}"></a> ${opts.place}</h4>
<p>Anotace představení.</p>
<section class="container pb-5 CTA" data-date="${opts.dateIso}">
  ${ticket}
</section>`;
}

const FIXTURE = `<!DOCTYPE html>
<html><head>
<title>Třeboňský divadelní festival – Program 2026</title>
<link rel="canonical" href="https://www.tdf.cz/"/>
</head><body>
<nav><a href="https://www.tdf.cz">Program 2026</a></nav>
<h2>Program 2026</h2>
<p>Předprodej vstupenek probíhá v TIC. Změna programu vyhrazena.</p>
${tdfBlok({
  dateIso: "2026-06-10T19:30",
  dateLabel: "středa 10. června 2026 od 19.30 hodin",
  title: "Velká zebra aneb Jakže se to jmenujete?",
  place: "Divadlo J. K. Tyla v Třeboni",
  itrebonHref:
    "https://www.itrebon.cz/kalendar/-tdf-velka-zebra-divadlo-palace_19484.html",
})}
${tdfBlok({
  dateIso: "2026-07-27T20:00",
  title: "Právo první noci",
  place: "Malé nádvoří zámku Třeboň",
  itrebonHref: "https://www.itrebon.cz/kalendar/-tdf-pravo-prvni-noci_19489.html",
})}
${tdfBlok({
  dateIso: "2026-08-10T17:00",
  title: "Dlouhý, Široký a Bystrozraký",
  place: "Malé nádvoří zámku Třeboň (v případě deště Schwarzenberský sál)",
  itrebonHref:
    "https://www.itrebon.cz/kalendar/-tdf-dlouhy-siroky-a-bystrozraky_19490.html",
})}
${tdfBlok({
  dateIso: "2026-08-24T19:00",
  title: "Sirény na cestách 2026",
  place: "Malé nádvoří zámku Třeboň (v případě deště Divadlo J. K. Tyla)",
  itrebonHref: "https://www.itrebon.cz/kalendar/-tdf-sireny-na-cestach_19491.html",
})}
${tdfBlok({
  dateIso: "2026-08-24T19:00",
  title: "Sirény na cestách 2026",
  place: "Malé nádvoří zámku Třeboň (v případě deště Divadlo J. K. Tyla)",
  itrebonHref: "https://www.itrebon.cz/kalendar/-tdf-sireny-na-cestach_19491.html",
})}
${tdfBlok({
  dateIso: "2026-09-03T19:30",
  title: "Za dveřmi kanceláří",
  place: "Divadlo J. K. Tyla v Třeboni",
  itrebonHref:
    "https://www.itrebon.cz/kalendar/-tdf-za-dvermi-kancelari-divadlo-kalich_19485.html",
})}
${tdfBlok({
  dateIso: "2026-09-12T19:00",
  title: "Hostující soubor v Budějovicích",
  place: "Jihočeské divadlo, České Budějovice",
  itrebonHref: "https://www.itrebon.cz/kalendar/-tdf-budejovice_19999.html",
})}
<h3 class="title">Připravujeme další představení</h3>
<p>Termín upřesníme.</p>
${tdfBlok({
  dateIso: "2026-09-20T18:00",
  title: "Komorní čtení",
  place: "Kostel sv. Jiljí",
})}
</body></html>`;

const KINOTREBON_MINI = `<!DOCTYPE html>
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

function sparujTdf(kandidat: {
  nazev: string;
  mistoNeboTyp: string;
}): string | null {
  const kotva = urcitTdfKotvu(kandidat);
  if (!kotva) {
    return null;
  }
  const s = sparovatVlastnictvimHlidaneKotvy(
    vytvoritVychoziRedakcniPoradi(),
    [BRANA_TDF_REDAKCNI_POLOZKA_ID],
    kotva,
  );
  return s.ok ? s.redakcniPolozkaId : null;
}

function jazykTdf(kandidat: { mistoNeboTyp: string }): {
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
} {
  const pravidlo = vytvoritVychoziRedakcniPoradi().find(
    (p) => p.id === BRANA_TDF_REDAKCNI_POLOZKA_ID,
  );
  assert(pravidlo, "chybí pravidlo TDF");
  return sestavJazykBranyPoSparovani({
    polozka: pravidlo.polozka,
    kandidatMisto: kandidat.mistoNeboTyp,
    zdrojNazev: "Třeboňský divadelní festival",
    jazykVerejny: pravidlo.jazykVerejny,
  });
}

function overKdeNormalizaci(): void {
  assert(
    normalizovatTdfMistoProKde("Divadlo J. K. Tyla v Třeboni") ===
      "Divadlo J. K. Tyla",
    "A JKT v Třeboni",
  );
  assert(
    normalizovatTdfMistoProKde("Malé nádvoří zámku Třeboň") ===
      "Malé nádvoří zámku",
    "B nádvoří Třeboň",
  );
  assert(
    normalizovatTdfMistoProKde(
      "Malé nádvoří zámku Třeboň (v případě deště Divadlo J. K. Tyla)",
    ) === "Malé nádvoří zámku (v případě deště Divadlo J. K. Tyla)",
    "C nádvoří + závorka JKT",
  );
  assert(
    normalizovatTdfMistoProKde(
      "Malé nádvoří zámku Třeboň (v případě deště Divadlo J. K. Tyla v Třeboni)",
    ) === "Malé nádvoří zámku (v případě deště Divadlo J. K. Tyla)",
    "C2 JKT v Třeboni i v závorce",
  );
  console.log("OK KDE normalizace A/B/C");
}

function overUrl(): void {
  assert(jeTdfZdrojUrl("https://www.tdf.cz/"), "homepage URL");
  assert(jeTdfZdrojUrl("https://tdf.cz/predstaveni-festivalu/"), "podstránka");
  assert(
    sestavTdfProgramUrl("https://www.tdf.cz/predstaveni-festivalu/") ===
      "https://www.tdf.cz/",
    "scan vždy homepage",
  );
  assert(!jeTdfZdrojUrl("https://www.itrebon.cz/kalendar.html"), "ne iTřeboň");
  console.log("OK URL tdf.cz → homepage");
}

function overFixture(): void {
  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  const primo = parsovatTdfProgram(FIXTURE);
  assert(k.length === primo.length, "dispatcher = tdf parser");

  const mimo = k.filter((x) => /Budějovic/i.test(x.nazev));
  assert(mimo.length === 0, "mimo Třeboň → 0");
  assert(!k.some((x) => /Připravujeme/i.test(x.nazev)), "neúplné → 0");
  assert(!k.some((x) => /Předprodej|Změna programu/i.test(x.nazev)), "organizační → 0");

  const tdf = k.filter((x) => urcitTdfKotvu(x) === BRANA_TDF_REDAKCNI_POLOZKA_ID);
  const nezarazene = k.filter((x) => urcitTdfKotvu(x) === null);
  assert(tdf.length === 5, `5 TDF, je ${tdf.length}`);
  assert(nezarazene.length === 1, `1 Nezařazené, je ${nezarazene.length}`);
  assert(nezarazene[0]?.nazev === "Komorní čtení", "Nezařazené = Kostel");

  const ocekavane = [
    [
      "Velká zebra aneb Jakže se to jmenujete?",
      "2026-06-10",
      "19:30",
      "tdf|itrebon|19484",
      "Divadlo J. K. Tyla",
    ],
    [
      "Právo první noci",
      "2026-07-27",
      "20:00",
      "tdf|itrebon|19489",
      "Malé nádvoří zámku",
    ],
    [
      "Dlouhý, Široký a Bystrozraký",
      "2026-08-10",
      "17:00",
      "tdf|itrebon|19490",
      "Malé nádvoří zámku (v případě deště Schwarzenberský sál)",
    ],
    [
      "Sirény na cestách 2026",
      "2026-08-24",
      "19:00",
      "tdf|itrebon|19491",
      "Malé nádvoří zámku (v případě deště Divadlo J. K. Tyla)",
    ],
    [
      "Za dveřmi kanceláří",
      "2026-09-03",
      "19:30",
      "tdf|itrebon|19485",
      "Divadlo J. K. Tyla",
    ],
  ] as const;
  for (const [nazev, den, cas, identita, kde] of ocekavane) {
    const polozka = tdf.find((x) => x.nazev === nazev);
    assert(polozka, nazev);
    assert(polozka.datumOd === den, `${nazev} den ${polozka.datumOd}`);
    assert(polozka.cas === cas, `${nazev} čas ${polozka.cas}`);
    assert(polozka.zdrojIdentita === identita, `${nazev} ${polozka.zdrojIdentita}`);
    assert(sparujTdf(polozka) === BRANA_TDF_REDAKCNI_POLOZKA_ID, `${nazev} kotva`);
    assert(polozka.mistoNeboTyp === kde, `${nazev} místo ${polozka.mistoNeboTyp}`);
    const jazyk = jazykTdf(polozka);
    assert(jazyk.verejneCo === "Divadelní festival", `${nazev} CO`);
    assert(jazyk.verejneRozliseni === kde, `${nazev} KDE ${jazyk.verejneRozliseni}`);
  }
  assert(
    tdf.filter((x) => x.nazev.includes("Sirény")).length === 1,
    "Sirény dedup podle tdf|itrebon|19491",
  );
  assert(
    tdf.filter((x) =>
      /^Divadlo J\. K\. Tyla/i.test(x.mistoNeboTyp),
    ).length === 2,
    "2 TDF primárně v JKT přijaty",
  );
  for (const polozka of tdf) {
    assert(
      sparujTdf(polozka) !== "divadlo-jk-tyla",
      `${polozka.nazev} nesmí na JKT`,
    );
  }
  const beznyJkt = sparovatSRedakcniPolozkou(
    {
      nazev: "Za dveřmi kanceláří",
      datumOd: "2026-09-03",
      datumDo: "2026-09-03",
      cas: "19:30",
      mistoNeboTyp: "Divadlo J. K. Tyla",
    },
    vytvoritVychoziRedakcniPoradi(),
    { zdrojNazev: "Třeboňský divadelní festival" },
  );
  assert(
    !beznyJkt.ok || beznyJkt.redakcniPolozkaId === "divadlo-jk-tyla",
    "důkaz: obecný matching přesného JKT místa by trefil JKT",
  );
  assert(
    sparujTdf({
      nazev: "Za dveřmi kanceláří",
      mistoNeboTyp: "Divadlo J. K. Tyla",
    }) === BRANA_TDF_REDAKCNI_POLOZKA_ID,
    "ownership TDF i při přesném JKT místě",
  );

  let n = 0;
  const inbox = pridatNesparovaneDoNezarazenych(vychoziNezarazeneDokument(), {
    zdrojId: "tdf-test",
    zdrojNazev: "Třeboňský divadelní festival",
    nesparovane: nezarazene,
    noveId: () => `n-${++n}`,
  });
  assert(inbox.otevrene.length === 1, "inbox 1");
  assert(inbox.otevrene[0]?.nazev === "Komorní čtení", "inbox Kostel");
  assert(
    !inbox.otevrene.some((x) =>
      /zebra|Právo|Dlouhý|Sirény|dveřmi/i.test(x.nazev),
    ),
    "TDF program nesmí do Nezařazených",
  );
  console.log("OK fixture: 5 TDF → trebonsky-divadelni-festival, 1 Nezařazené, mimo/org = 0");
}

function overJktAOkoloDrop(): void {
  assert(
    klasifikovatItrebonJktKartu(
      "Divadlo J. K. Tyla - TDF_zadní lóže",
      "TDF: Za dveřmi kanceláří - Divadlo Kalich",
      "3. 9. 2026",
    ) === "tdf",
    "JKT dál dropuje TDF",
  );
  assert(
    zaraditOkoloTreboneUdalost(
      "TDF: Sirény na cestách",
      "Malé nádvoří zámku Třeboň",
    ).druh === "tdf",
    "Okolo dál dropuje TDF",
  );
  console.log("OK JKT i Okolo TDF dál dropují");
}

function overIdentitaDedupZapis(): void {
  const k = parsovatTdfProgram(FIXTURE).filter(
    (x) => urcitTdfKotvu(x) === BRANA_TDF_REDAKCNI_POLOZKA_ID,
  );
  const vstup = k.map((x) => ({
    redakcniPolozkaId: BRANA_TDF_REDAKCNI_POLOZKA_ID,
    datumOd: x.datumOd,
    datumDo: x.datumDo,
    cas: x.cas,
    mistoNeboTyp: x.mistoNeboTyp,
    nazev: x.nazev,
    zdrojIdentita: x.zdrojIdentita,
  }));
  const prvni = aplikovatScanKandidatyNaUdalosti(
    [],
    vstup,
    "2026-05-01",
    jeUdalostCelaMinula,
  );
  assert(prvni.vysledek.pridano === 5, `1. scan +5, je ${prvni.vysledek.pridano}`);
  const druhy = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    vstup,
    "2026-05-01",
    jeUdalostCelaMinula,
  );
  assert(druhy.vysledek.pridano === 0, "2. scan 0 nových");
  assert(druhy.vysledek.jizExistuje === 5, `2. scan 5 již, je ${druhy.vysledek.jizExistuje}`);
  console.log("OK identita: 5 + 0, žádná duplicita");
}

function overRegreseOstatni(): void {
  const kino = parsovatUdalostiZeZdroje(KINOTREBON_MINI, "text/html");
  assert(kino.length >= 1, "kino regrese");
  console.log("OK kino HTML větev beze změny");
}

async function zivyPredscan(): Promise<void> {
  const url = sestavTdfProgramUrl("https://www.tdf.cz/");
  const res = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  if (!res.ok) {
    fail(`živý GET TDF ${res.status}`);
  }
  const html = await res.text();
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  const polozky = vytvoritVychoziRedakcniPoradi();
  const dnesIso = dnesIsoVPraze();
  console.log("\nREAD-ONLY předscan", url);
  console.log("Kandidátů celkem:", k.length);
  const budouci = k.filter((x) => !jeUdalostCelaMinula(x, dnesIso));
  console.log("Budoucích:", budouci.length);
  for (const kandidat of budouci) {
    const kotva = urcitTdfKotvu(kandidat);
    const sparovani = kotva
      ? sparovatVlastnictvimHlidaneKotvy(
          polozky,
          [BRANA_TDF_REDAKCNI_POLOZKA_ID],
          kotva,
        )
      : { ok: false as const };
    const kotvaId = sparovani.ok
      ? sparovani.redakcniPolozkaId
      : kotva
        ? "(nesparováno)"
        : "NEZAŘAZENÉ";
    const jazyk = sparovani.ok
      ? jazykTdf(kandidat)
      : { verejneCo: null, verejneRozliseni: null };
    console.log(
      `- ${kandidat.nazev} | ${kandidat.datumOd} | ${kandidat.cas} | ${kandidat.mistoNeboTyp} | ${kandidat.zdrojIdentita} | ${kotvaId} | CO=${jazyk.verejneCo} | KDE=${jazyk.verejneRozliseni}`,
    );
  }
}

async function main(): Promise<void> {
  overUrl();
  overKdeNormalizaci();
  overFixture();
  overJktAOkoloDrop();
  overIdentitaDedupZapis();
  overRegreseOstatni();
  console.log("ALL OK verify-brana-tdf-parser");
  if (process.argv.includes("--zivy")) {
    await zivyPredscan();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
