/**
 * Regrese: DSN HTML parser + 4měsíční URL + merge (bez síťového fetch).
 * Spuštění: npx tsx scripts/verify-brana-dsn-parser.ts
 */

import {
  deduplikovatScanKandidaty,
  jeDumStepankaNetolickehoZdrojUrl,
  parsovatUdalostiZeZdroje,
  sestavDumStepankaKalendarUrlkyCtyriMesice,
} from "../src/lib/brana/admin/zdroj-scan-parser";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function eventItem(
  title: string,
  smallInner: string,
): string {
  return `
<div class="col-sm-6 text-center">
  <div class="middle-padding home-block-wrapper event-item">
    <div class="home-block">
      <div class="home-block-header">
        <h2 class="h5">
          <a href="https://www.dumstepankanetolickeho.cz/akce/x/" title="${title}">
            ${title}
          </a>
        </h2>
        <div class="small-padding">
          <small>${smallInner}</small>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

function dsnPage(...items: string[]): string {
  return `<!DOCTYPE html>
<html><head><title>Kalendář | Dům Štěpánka Netolického</title>
<link rel="canonical" href="https://www.dumstepankanetolickeho.cz/kalendar-akci/"/>
</head><body>
<nav><a href="https://www.dumstepankanetolickeho.cz/kalendar-akci/">Kalendář</a></nav>
${items.join("\n")}
</body></html>`;
}

const SRPEN = dsnPage(
  eventItem(
    "Vernisáž výstavy AMARCORD v&nbsp;Galerii města Třeboň",
    "19.08.2026 17:00",
  ),
  eventItem(
    "Varhanní koncert prof. Vladimíra Franze",
    "19.08.2026 19:30",
  ),
  eventItem(
    "KOMENTOVANÁ PROHLÍDKA VÝSTAVY 35 let Okolo Třeboně",
    "22.08.2026 14",
  ),
);

const ZARI = dsnPage(
  eventItem(
    "Beseda s&nbsp;pravnučkou sochaře J. Václava Myslbeka",
    "26.09.2026 14:00",
  ),
  eventItem(
    "Vernisáž výstavy Intimita kůže/Intimita mysli",
    "10.09.2026 18 hod",
  ),
);

const RIJEN = dsnPage(
  eventItem("Přednáška Studánky na Třeboňsku", "08.10.2026 18 hod"),
  eventItem(
    "Přednáška Krkavcovití &#8211; nejchytřejší ptáci",
    "15.10.2026 18",
  ),
  eventItem(
    "Dny otevřených ateliérů &#8211; akce ve spolupráci",
    "10.10.2026 15 hod",
  ),
);

const LISTOPAD_PRAZDNY = dsnPage();

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

const NOCTURNA_MINI = `<!DOCTYPE html>
<html><head><title>Úvod | Třeboňská nocturna</title></head><body>
<div class="oxy-dynamic-list">
  <div class="ct-div-block">
    <div><span>15. 10. 2026 19:00</span></div>
    <div><span><a href="https://www.trebonskanocturna.cz/koncert/1/">Koncert A</a></span></div>
    <div><span>Divadlo J. K. Tyla, Třeboň</span></div>
  </div>
</div>
</body></html>`;

function overParserCasyANazvy(): void {
  const k = parsovatUdalostiZeZdroje(SRPEN, "text/html");
  assert(k.length === 3, `srpen: očekávány 3, je ${k.length}`);
  assert(k[0].nazev.includes("AMARCORD"), `název 0: ${k[0].nazev}`);
  assert(k[0].datumOd === "2026-08-19", `datum 0: ${k[0].datumOd}`);
  assert(k[0].cas === "17:00", `čas 17:00 → ${k[0].cas}`);
  assert(k[1].cas === "19:30", `čas 19:30 → ${k[1].cas}`);
  assert(k[2].cas === "14:00", `čas 14 → ${k[2].cas}`);
  assert(k[2].datumOd === "2026-08-22", `datum prohlídky: ${k[2].datumOd}`);
  console.log("OK DSN parser: název/datum + časy 17:00 / 19:30 / 14");
}

function overCasHod(): void {
  const k = parsovatUdalostiZeZdroje(ZARI, "text/html");
  assert(k.length === 2, `září: 2, je ${k.length}`);
  const intimita = k.find((x) => x.nazev.includes("Intimita"));
  assert(intimita, "Intimita nenalezena");
  assert(intimita.cas === "18:00", `18 hod → ${intimita.cas}`);
  assert(intimita.datumOd === "2026-09-10", `datum: ${intimita.datumOd}`);
  console.log("OK DSN čas „18 hod“ → 18:00");
}

function overMergeOsm(): void {
  const sloucene = [
    ...parsovatUdalostiZeZdroje(SRPEN, "text/html"),
    ...parsovatUdalostiZeZdroje(ZARI, "text/html"),
    ...parsovatUdalostiZeZdroje(RIJEN, "text/html"),
    ...parsovatUdalostiZeZdroje(LISTOPAD_PRAZDNY, "text/html"),
  ];
  const uniq = deduplikovatScanKandidaty(sloucene);
  assert(uniq.length === 8, `merge 8 unikátních, je ${uniq.length}`);
  console.log("OK multi-month merge → 8 unikátních");
}

function overPrazdnyMesic(): void {
  const k = parsovatUdalostiZeZdroje(LISTOPAD_PRAZDNY, "text/html");
  assert(k.length === 0, `prázdný měsíc → 0, je ${k.length}`);
  console.log("OK prázdný měsíc → 0 bez chyby");
}

function overUrlCtyriMesiceARok(): void {
  assert(
    jeDumStepankaNetolickehoZdrojUrl(
      "https://www.dumstepankanetolickeho.cz/",
    ),
    "hostname DSN",
  );
  assert(
    !jeDumStepankaNetolickehoZdrojUrl("https://www.trebonskanocturna.cz/"),
    "nocturna není DSN",
  );

  const srp = sestavDumStepankaKalendarUrlkyCtyriMesice(
    "https://www.dumstepankanetolickeho.cz/",
    new Date("2026-08-12T12:00:00+02:00"),
  );
  assert(srp.length === 4, `4 URL, je ${srp.length}`);
  assert(
    srp[0] ===
      "https://www.dumstepankanetolickeho.cz/kalendar-akci/?mesic=8&rok=2026",
    `srpen URL: ${srp[0]}`,
  );
  assert(
    srp[3] ===
      "https://www.dumstepankanetolickeho.cz/kalendar-akci/?mesic=11&rok=2026",
    `+3 URL: ${srp[3]}`,
  );

  const pros = sestavDumStepankaKalendarUrlkyCtyriMesice(
    "https://www.dumstepankanetolickeho.cz/kalendar-akci/",
    new Date("2026-12-05T10:00:00+01:00"),
  );
  assert(
    pros[0].endsWith("mesic=12&rok=2026"),
    `prosinec: ${pros[0]}`,
  );
  assert(pros[1].endsWith("mesic=1&rok=2027"), `leden 2027: ${pros[1]}`);
  assert(pros[2].endsWith("mesic=2&rok=2027"), `únor: ${pros[2]}`);
  assert(pros[3].endsWith("mesic=3&rok=2027"), `březen: ${pros[3]}`);
  console.log("OK 4měsíční URL + přechod roku");
}

function overOstatniZdrojeJedenFetchModel(): void {
  assert(
    sestavDumStepankaKalendarUrlkyCtyriMesice(
      "https://www.kinotrebon.cz/",
    ).length === 0,
    "kino nesmí dostat DSN URL ky",
  );
  const kino = parsovatUdalostiZeZdroje(KINOTREBON_FIXTURE, "text/html");
  assert(kino.length >= 1, "kino parser stále funguje");
  const noc = parsovatUdalostiZeZdroje(NOCTURNA_MINI, "text/html");
  assert(noc.length === 1, `nocturna mini 1, je ${noc.length}`);
  assert(noc[0].nazev === "Koncert A", `nocturna název: ${noc[0].nazev}`);
  console.log("OK ostatní zdroje / kino / nocturna regrese");
}

overParserCasyANazvy();
overCasHod();
overMergeOsm();
overPrazdnyMesic();
overUrlCtyriMesiceARok();
overOstatniZdrojeJedenFetchModel();
console.log("VŠE OK — DSN 4měsíční scan");
