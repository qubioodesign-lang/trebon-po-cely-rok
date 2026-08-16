/**
 * Třeboňsko měsíční kino — LONG-ONLY (bez závislosti na kinotrebon.cz).
 * Spuštění: npx tsx scripts/verify-brana-trebonsko-kino-parser.ts
 * READ-ONLY HTTP předscan; žádný Blob / produkční scan / admin zdroj.
 */

import https from "node:https";
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
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";
import {
  deduplikovatScanKandidaty,
  jeTrebonskoKinoKategorieZdrojUrl,
  jeTrebonskoOteviraniLazenskeSezonyZdrojUrl,
  jeTrebonskoRemeslneTrhyZdrojUrl,
  parsovatUdalostiZeZdroje,
  sestavTrebonskoKinoKategorieHubUrl,
  sestavZdrojIdentituKinoProjekce,
  vytahnoutTrebonskoKinoMesicUrlky,
  type BranaScanKandidat,
} from "../src/lib/brana/admin/zdroj-scan-parser";
import { sparovatSRedakcniPolozkou } from "../src/lib/brana/admin/zdroj-scan-sparovani";
import { okamzikZPrahy } from "../src/lib/brana/cas/cas";

const HUB_URL = "https://www.trebonsko.cz/kategorie/kina/";

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
        r.on("end", () => {
          if ((r.statusCode ?? 0) >= 400) {
            reject(new Error(`HTTP ${r.statusCode} ${url}`));
            return;
          }
          resolve(d);
        });
      })
      .on("error", reject);
  });
}

function fixtureMesicHtml(): string {
  return `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.trebonsko.cz/kino-trebon-program-srpen-2026"/>
<title>Kino Třeboň - program srpen 2026 | Třeboňsko.cz</title>
<span>trebonsko.cz</span>
</head><body>
<h3>Pozvánka do třeboňského kina Světozor -&nbsp; SRPEN 2026&nbsp;</h3>
<table border="0"><tbody>
<tr><td>so</td><td>1</td><td>10:30</td><td>Zootropolis</td><td>ani</td><td>USA</td></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td><td>16:30</td><td>Tom a Jerry:Kouzelný prsten</td><td>ani</td><td>USA</td></tr>
<tr><td>ne</td><td>2</td><td>17:00</td><td>Dívka Momo a zloděj času</td><td>rodinný</td><td>Ně</td></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td><td>20:00</td><td>Tl. patrola: Dinosauří film</td><td>ani</td><td>USA</td></tr>
<tr><td>út</td><td>25</td><td>17:00</td><td>Film A</td><td>drama</td><td>ČR</td></tr>
<tr><td>po</td><td>31</td><td>20:00</td><td>Film Konec</td><td>drama</td><td>ČR</td></tr>
</tbody></table>
<h3>Kino Aurora - SRPEN 2026</h3>
<table border="0"><tbody>
<tr><td>pá</td><td>7</td><td>19:30</td><td>Aurora Film</td><td>komedie</td><td>ČR</td></tr>
</tbody></table>
<h3>Příloha k článku</h3>
<p>Nemá se parsovat koncert 15. 8. 2026</p>
</body></html>`;
}

/** Minimální kinotrebon fixture — musí zůstat BEZ zdrojIdentita. */
function fixtureKinotrebonBezeZmeny(): string {
  return `<!DOCTYPE html><html><body>
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
}

function naVstup(
  k: BranaScanKandidat,
  redakcniPolozkaId: string,
): BranaScanAutomatickaUdalostVstup {
  return {
    redakcniPolozkaId,
    datumOd: k.datumOd,
    datumDo: k.datumDo,
    cas: k.cas,
    mistoNeboTyp: k.mistoNeboTyp,
    nazev: k.nazev,
    ...(k.zdrojIdentita ? { zdrojIdentita: k.zdrojIdentita } : {}),
  };
}

function overDiscoveryHelpers(): void {
  assert(jeTrebonskoKinoKategorieZdrojUrl(HUB_URL), "hub URL ok");
  assert(
    !jeTrebonskoKinoKategorieZdrojUrl(
      "https://www.trebonsko.cz/remeslne-trhy-trebon",
    ),
    "trhy URL není kino hub",
  );
  assert(
    sestavTrebonskoKinoKategorieHubUrl(HUB_URL) === HUB_URL,
    "hub sestavení",
  );

  const hubHtml = `
    <a href="/kino-trebon-program-cervenec-2026">Kino Třeboň - program červenec 2026</a>
    <a href="/kino-trebon-program-srpen-2026">Kino Třeboň - program srpen 2026</a>
    <a href="/kino-trebon-program-zari-2026">Kino Třeboň - program září 2026</a>
    <a href="/kino-trebon-program-duben-2026-15444">Kino Třeboň - program květen 2026</a>
  `;
  const ref = okamzikZPrahy(2026, 8, 25, 12, 0);
  const urls = vytahnoutTrebonskoKinoMesicUrlky(hubHtml, HUB_URL, ref);
  assert(urls.length === 2, `očekávány 2 měsíce, je ${urls.length}`);
  assert(urls[0].mesic === 8 && urls[0].rok === 2026, "aktuální = srpen");
  assert(urls[1].mesic === 9 && urls[1].rok === 2026, "následující = září");

  const jenSrpen = vytahnoutTrebonskoKinoMesicUrlky(
    `<a href="/kino-trebon-program-srpen-2026">program srpen 2026</a>`,
    HUB_URL,
    ref,
  );
  assert(jenSrpen.length === 1 && jenSrpen[0].mesic === 8, "jen srpen bez chyby");

  const kveten = vytahnoutTrebonskoKinoMesicUrlky(
    `<a href="/kino-trebon-program-duben-2026-15444">Kino Třeboň - program květen 2026</a>`,
    HUB_URL,
    okamzikZPrahy(2026, 5, 10, 12, 0),
  );
  assert(
    kveten.length === 1 && kveten[0].mesic === 5,
    "slug duben-15444 → květen z popisku",
  );

  console.log("OK discovery helpers (aktuální+následující, květen slug)");
}

function overKinotrebonBezeZmeny(): void {
  const k = parsovatUdalostiZeZdroje(fixtureKinotrebonBezeZmeny(), "text/html");
  assert(k.length === 1, `kinotrebon ${k.length}`);
  assert(k[0].nazev === "Test Film", k[0].nazev);
  assert(k[0].zdrojIdentita === undefined, "kinotrebon bez zdrojIdentita");
  console.log("OK kinotrebon parser beze změny (bez zdrojIdentita)");
}

function overLongOnlyCeka(): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const mesic = parsovatUdalostiZeZdroje(fixtureMesicHtml(), "text/html");
  assert(mesic.length === 7, `fixture měsíc: ${mesic.length}`);

  const sv = mesic.filter((k) => k.mistoNeboTyp === "Kino Světozor");
  const au = mesic.filter((k) => k.mistoNeboTyp === "Kino Aurora");
  assert(sv.length === 6 && au.length === 1, "SV+AU");

  const tom = mesic.find((k) => /Tom a Jerry/i.test(k.nazev))!;
  assert(
    tom.zdrojIdentita === "kino|svetozor|2026-08-01|16:30",
    `id=${tom.zdrojIdentita}`,
  );
  assert(
    sestavZdrojIdentituKinoProjekce("Kino Světozor", "2026-08-01", "16:30") ===
      tom.zdrojIdentita,
    "helper",
  );
  assert(
    mesic.find((k) => /Momo/i.test(k.nazev))?.datumOd === "2026-08-02",
    "film s „čas“",
  );

  const vstupy: BranaScanAutomatickaUdalostVstup[] = [];
  for (const k of mesic) {
    const s = sparovatSRedakcniPolozkou(k, polozky, {
      zdrojNazev: "Třeboňsko – kino měsíční program",
    });
    assert(s.ok, `BEZNY ${k.nazev}`);
    assert(
      (k.mistoNeboTyp === "Kino Světozor" &&
        s.redakcniPolozkaId === "kino-svetozor") ||
        (k.mistoNeboTyp === "Kino Aurora" &&
          s.redakcniPolozkaId === "kino-aurora"),
      "kotva",
    );
    vstupy.push(naVstup(k, s.redakcniPolozkaId));
  }

  // Povinné: LONG-ONLY na prázdném vstupu — bez kinotrebon dat.
  const prvni = aplikovatScanKandidatyNaUdalosti(
    [],
    vstupy,
    "2026-07-01",
    jeUdalostCelaMinula,
  );
  assert(prvni.vysledek.pridano === 7, `první CEKA=${prvni.vysledek.pridano}`);
  assert(prvni.vysledek.jizExistuje === 0, "první: žádné již");
  assert(
    prvni.udalosti.some((u) => u.redakcniPolozkaId === "kino-svetozor"),
    "Světozor CEKA",
  );
  assert(
    prvni.udalosti.some((u) => u.redakcniPolozkaId === "kino-aurora"),
    "Aurora CEKA",
  );
  assert(
    prvni.udalosti.every((u) => u.zdrojIdentita?.startsWith("kino|")),
    "všechny identity kino|",
  );

  // Druhý identický scan
  const druhy = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    vstupy,
    "2026-07-01",
    jeUdalostCelaMinula,
  );
  assert(druhy.vysledek.pridano === 0, "druhý: žádná nová CEKA");
  assert(druhy.vysledek.aktualizovano === 0, "druhý: žádný update");
  assert(druhy.vysledek.jizExistuje === 7, `druhý již=${druhy.vysledek.jizExistuje}`);

  // Změna názvu stejného slotu
  const tomVstup: BranaScanAutomatickaUdalostVstup = {
    ...naVstup(tom, "kino-svetozor"),
    nazev: "Tom a Jerry: Kouzelný prsten",
  };
  const poNazev = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    [tomVstup],
    "2026-07-01",
    jeUdalostCelaMinula,
  );
  assert(
    poNazev.vysledek.pridano === 0 && poNazev.vysledek.aktualizovano === 1,
    "změna názvu → in-place",
  );
  assert(
    poNazev.udalosti.find((u) => u.zdrojIdentita === tom.zdrojIdentita)?.nazev ===
      "Tom a Jerry: Kouzelný prsten",
    "název aktualizován",
  );
  assert(poNazev.udalosti.length === prvni.udalosti.length, "bez druhé CEKA");

  // SCHVALENO
  const schvaleno: BranaKonkretniUdalost = {
    ...poNazev.udalosti.find((u) => u.zdrojIdentita === tom.zdrojIdentita)!,
    stavSchvaleni: "SCHVALENO",
  };
  const poSch = aplikovatScanKandidatyNaUdalosti(
    [schvaleno],
    [{ ...tomVstup, nazev: "Úplně jiný film" }],
    "2026-07-01",
    jeUdalostCelaMinula,
  );
  assert(
    poSch.vysledek.pridano === 0 &&
      poSch.vysledek.aktualizovano === 0 &&
      poSch.vysledek.jizExistuje === 1,
    "SCHVALENO bez overwrite",
  );

  // VYRAZENO
  const vyrazeno: BranaKonkretniUdalost = {
    ...schvaleno,
    id: "auto-vyraz",
    stavSchvaleni: "VYRAZENO",
    nazev: "Vyřazený",
  };
  const poVyr = aplikovatScanKandidatyNaUdalosti(
    [vyrazeno],
    [tomVstup],
    "2026-07-01",
    jeUdalostCelaMinula,
  );
  assert(
    poVyr.vysledek.pridano === 0 && poVyr.vysledek.aktualizovano === 0,
    "VYRAZENO neobnovovat",
  );

  // scanKlic fallback
  const staraBezId: BranaKonkretniUdalost = {
    id: "auto-stara",
    redakcniPolozkaId: "kino-svetozor",
    datumOd: "2026-08-01",
    datumDo: "2026-08-01",
    cas: "16:30",
    mistoNeboTyp: "Kino Světozor",
    nazev: "Tom a Jerry: Kouzelný prsten",
    rucniPoziceVDni: null,
    stavSchvaleni: "CEKA_NA_SCHVALENI",
    scanKlic: vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: "kino-svetozor",
      datumOd: "2026-08-01",
      cas: "16:30",
      nazev: "Tom a Jerry: Kouzelný prsten",
    }),
  };
  const poFb = aplikovatScanKandidatyNaUdalosti(
    [staraBezId],
    [tomVstup],
    "2026-07-01",
    jeUdalostCelaMinula,
  );
  assert(poFb.vysledek.pridano === 0 && poFb.vysledek.jizExistuje === 1, "fallback");
  assert(
    poFb.udalosti[0].zdrojIdentita === tomVstup.zdrojIdentita,
    "doplněna identita",
  );

  console.log("OK LONG-ONLY CEKA (prázdný vstup / opakovaný / název / ochrany)");
}

function overRegreseOstatniTrebonsko(): void {
  assert(
    jeTrebonskoRemeslneTrhyZdrojUrl(
      "https://www.trebonsko.cz/remeslne-trhy-trebon",
    ),
    "trhy URL",
  );
  assert(
    jeTrebonskoOteviraniLazenskeSezonyZdrojUrl(
      "https://www.trebonsko.cz/otevirani-lazenske-sezony-v-treboni",
    ),
    "OLS URL",
  );
  assert(
    !jeTrebonskoKinoKategorieZdrojUrl("https://www.kinotrebon.cz/"),
    "kinotrebon není hub",
  );
  console.log("OK regrese URL gates");
}

async function predscanZivyLongOnly(): Promise<void> {
  const dnes = dnesIsoVPraze();
  const hubHtml = await get(HUB_URL);
  const mesice = vytahnoutTrebonskoKinoMesicUrlky(hubHtml, HUB_URL);
  console.log("\n=== PŘEDSCAN LONG-ONLY (read-only) ===");
  console.log(`dnes (Praha): ${dnes}`);
  console.log(`objeveno měsíčních článků: ${mesice.length}`);
  for (const m of mesice) {
    console.log(`  ${m.rok}-${String(m.mesic).padStart(2, "0")} → ${m.url}`);
  }

  const sloucene: BranaScanKandidat[] = [];
  for (const m of mesice) {
    const html = await get(m.url);
    sloucene.push(...parsovatUdalostiZeZdroje(html, "text/html"));
  }
  const dlouhy = deduplikovatScanKandidaty(sloucene).filter(
    (k) => !jeUdalostCelaMinula(k, dnes),
  );
  const sv = dlouhy.filter((k) => k.mistoNeboTyp === "Kino Světozor");
  const au = dlouhy.filter((k) => k.mistoNeboTyp === "Kino Aurora");
  const maxSv = sv.reduce((a, k) => (k.datumOd > a ? k.datumOd : a), "");
  const maxAu = au.reduce((a, k) => (k.datumOd > a ? k.datumOd : a), "");

  console.log(`Světozor: ${sv.length}, nejzazší ${maxSv || "—"}`);
  console.log(`Aurora: ${au.length}, nejzazší ${maxAu || "—"}`);
  assert(sv.length > 0 && au.length > 0, "obě kina z Třeboňska");
  assert(
    dlouhy.every((k) => k.zdrojIdentita?.startsWith("kino|")),
    "identity jen z dlouhého",
  );

  const polozky = vytvoritVychoziRedakcniPoradi();
  const vstupy = dlouhy
    .map((k) => {
      const s = sparovatSRedakcniPolozkou(k, polozky);
      return s.ok ? naVstup(k, s.redakcniPolozkaId) : null;
    })
    .filter((x): x is BranaScanAutomatickaUdalostVstup => !!x);

  // Samostatný LONG-ONLY na prázdném vstupu (živá data, bez kinotrebon).
  const s1 = aplikovatScanKandidatyNaUdalosti(
    [],
    vstupy,
    dnes,
    jeUdalostCelaMinula,
  );
  console.log(
    `simulace 1. scan (prázdný): přidáno=${s1.vysledek.pridano}, již=${s1.vysledek.jizExistuje}`,
  );
  assert(s1.vysledek.pridano === vstupy.length, "1. scan = všechny nové CEKA");
  assert(
    s1.udalosti.some((u) => u.redakcniPolozkaId === "kino-svetozor"),
    "živě Světozor",
  );
  assert(
    s1.udalosti.some((u) => u.redakcniPolozkaId === "kino-aurora"),
    "živě Aurora",
  );

  const s2 = aplikovatScanKandidatyNaUdalosti(
    s1.udalosti,
    vstupy,
    dnes,
    jeUdalostCelaMinula,
  );
  console.log(
    `simulace 2. scan: přidáno=${s2.vysledek.pridano}, již=${s2.vysledek.jizExistuje}, update=${s2.vysledek.aktualizovano}`,
  );
  assert(s2.vysledek.pridano === 0, "2. scan bez nových");
  assert(s2.vysledek.jizExistuje === vstupy.length, "2. scan Již existuje");

  const hubPrechod = vytahnoutTrebonskoKinoMesicUrlky(
    hubHtml,
    HUB_URL,
    okamzikZPrahy(2026, 8, 25, 12, 0),
  );
  console.log(
    `přechod 25.8. discovery: ${hubPrechod.map((m) => m.mesic).join("+") || "(nic)"}`,
  );
  assert(
    hubPrechod.some((m) => m.mesic === 8),
    "25.8. najde srpen",
  );
}

async function main(): Promise<void> {
  overDiscoveryHelpers();
  overKinotrebonBezeZmeny();
  overLongOnlyCeka();
  overRegreseOstatniTrebonsko();
  await predscanZivyLongOnly();
  console.log("\nALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
