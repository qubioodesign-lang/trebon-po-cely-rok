/**
 * Úzký parser Music Club Beseda (besedaclub.cz/program.html).
 * Spuštění: npx tsx scripts/verify-brana-beseda-parser.ts
 * READ-ONLY předscan: npx tsx scripts/verify-brana-beseda-parser.ts --zivy
 */

import { readFileSync } from "node:fs";
import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  BRANA_BESEDA_KDE,
  BRANA_BESEDA_POLOZKA,
  jeBesedaZdrojUrl,
  najitBesedaKotvuId,
  parsovatBesedaProgram,
  sestavBesedaHomeUrl,
  sestavBesedaProgramUrl,
  sestavBesedaZapisPoSparovani,
  sestavBesedaZdrojIdentitu,
  vytahnoutBesedaProgramUrl,
  vytahnoutJednoznacnyCasZacatkuBesedy,
  type BesedaScanKandidat,
} from "../src/lib/brana/admin/beseda";
import { sparovatVlastnictvimHlidaneKotvy } from "../src/lib/brana/admin/zdroj-scan-sparovani";
import {
  vytvoritVychoziRedakcniPoradi,
  type BranaRedakcniPolozkaStav,
} from "../src/lib/brana/admin/redakcni-kostra";
import { aplikovatScanKandidatyNaUdalosti } from "../src/lib/brana/admin/scan-ceka-zapis";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  dnesIsoVPraze,
  jeUdalostCelaMinula,
  type BranaKonkretniUdalost,
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

const HOME_URL = "https://www.besedaclub.cz/";
const PROGRAM_URL = "https://www.besedaclub.cz/program.html";
const VERIFY_BESEDA_ID = "verify-music-club-beseda";

function pevne(text: string): { rezim: "PEVNE"; text: string } {
  return { rezim: "PEVNE", text };
}

function testovaciPolozka(
  id: string,
  polozka: string,
  pouzivat: "ANO" | "NE" = "ANO",
): BranaRedakcniPolozkaStav {
  return {
    id,
    polozka,
    pouzivat,
    priorita: 9,
    subpriorita: 1,
    vyhled: "NE",
    vyhledSerie: true,
    poznamka: "",
    mimoKostru: true,
    jazykVerejny: {
      co: { rezim: "Z_UDALOSTI" },
      rozliseni: pevne(BRANA_BESEDA_KDE),
    },
  };
}

function redakceProBesedu(
  extra: BranaRedakcniPolozkaStav[] = [testovaciPolozka(VERIFY_BESEDA_ID, BRANA_BESEDA_POLOZKA)],
): BranaRedakcniPolozkaStav[] {
  return [...vytvoritVychoziRedakcniPoradi(), ...extra];
}

const FIXTURE_PROGRAM = `<!DOCTYPE html>
<html><head>
<title>Program | Music Club Beseda Třeboň</title>
</head><body>
<h2>Program</h2>
<div class="col-sm-8">
  <h3 style="margin-top:0">Dorian&Lboy Show</h3>
  <p><strong>Pátek 21.8.2026</strong></p>
  <p>
    Tak jak jsme slíbili tak konáme!<br /><br />
    WELCOME DRINK HNED U VSTUPU!<br /><br />
    Přednostní vstup už ve 20:30!<br /><br />
    VIP zónu hned u podia
  </p>
</div>
<hr>
<div class="col-sm-8">
  <h3 style="margin-top:0">Fousatej Hat</h3>
  <p><strong>Sobota 12.9.2026</strong></p>
  <p>
    FOUSATEJ HAT – 12. 9. 2026<br />
    Než se rozjede hlavní program, postará se kapela WIDLE.<br />
    12. září 2026<br />
    21:00<br />
    Beseda Music Club Třeboň<br />
    Vezměte partnera.
  </p>
</div>
<hr>
<div class="col-sm-8">
  <h3 style="margin-top:0">Alkehol</h3>
  <p><strong>Pátek 16.10.2026</strong></p>
  <p>
    ALKEHOL MÍŘÍ DO TŘEBONĚ!<br />
    16. 10. 2026<br />
    21:00<br />
    Beseda Music Club Třeboň<br />
    Rezervujte si termín.
  </p>
</div>
<div id="contact-holder">
  <h3>Kde nás najdete?</h3>
  <br />
  <p>Masarykovo náměstí 2<br />Třeboň 37901</p>
  <p><strong>Otevírací doba:</strong></p>
  <p><span>Pátek</span> ZAVŘENO<br /><span>Sobota</span> 22:00 - 4:00</p>
</div>
</body></html>`;

const FIXTURE_HOME = `<!DOCTYPE html>
<html><head><title>Music Club Beseda Třeboň</title></head>
<body>
<nav><a href="/program.html">Program</a></nav>
<h2>Jediná diskotéka <strong>v Třeboni</strong></h2>
<a href="/program.html" class="button">Program</a>
<h3>Kde nás najdete?</h3>
<p><span>Sobota</span> 22:00 - 4:00</p>
</body></html>`;

const FIXTURE_PRAZDNY = `<!DOCTYPE html>
<html><head>
<title>Program | Music Club Beseda Třeboň</title>
<link rel="canonical" href="https://www.besedaclub.cz/program.html">
</head><body>
<h2>Program</h2>
<p>Aktuálně není naplánovaná žádná akce.</p>
</body></html>`;

const FIXTURE_DVOU_CASU = `<!DOCTYPE html>
<html><head>
<title>Program | Music Club Beseda Třeboň</title>
<link rel="canonical" href="https://www.besedaclub.cz/program.html">
</head><body>
<h2>Program</h2>
<h3>Dvojí čas</h3>
<p><strong>Pátek 1.11.2026</strong></p>
<p>Popis<br />20:00<br />21:00<br />Beseda</p>
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

const OKOLO_MINI = `<!DOCTYPE html>
<html><head>
<title>Program a prodej :: Okolo Třeboně</title>
<link rel="canonical" href="https://www.okolotrebone.cz/program/">
</head><body>
<div class="b b-text cf"><div class="b-c b-text-c">
<p><strong>16. srpna 2026 od 11:00</strong></p>
<p><strong>Třeboňská lázeňská matiné: Jiří Rajniš, Altán u lázeňského domu Berta / nepříznivé počasí LDA</strong></p>
</div></div>
</body></html>`;

function verejnyJazyk(
  k: BesedaScanKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
): { co: string; kde: string; nazevVerejne: string; kotva: string | null } {
  const kotva = najitBesedaKotvuId(polozky);
  if (!kotva) {
    return { co: "", kde: "", nazevVerejne: k.nazev, kotva: null };
  }
  const sparovani = sparovatVlastnictvimHlidaneKotvy(polozky, [kotva], kotva);
  assert(sparovani.ok, `ownership fail ${k.zdrojIdentita}`);
  const pravidlo = polozky.find((p) => p.id === sparovani.redakcniPolozkaId);
  assert(pravidlo, "pravidlo");
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: pravidlo.polozka,
    kandidatMisto: k.mistoNeboTyp,
    zdrojNazev: "Music Club Beseda",
    jazykVerejny: pravidlo.jazykVerejny,
  });
  const zapis = sestavBesedaZapisPoSparovani({
    surovyNazev: k.nazev,
    jazyk,
  });
  const rozloz = rozlozAkci({
    nazev: zapis.nazev,
    mistoNeboTyp: zapis.mistoNeboTyp,
    cas: k.cas,
    verejneCo: zapis.verejneCo,
    verejneRozliseni: zapis.verejneRozliseni,
  });
  return {
    co: rozloz.typ,
    kde: rozloz.misto,
    nazevVerejne: rozloz.nazev,
    kotva: sparovani.redakcniPolozkaId,
  };
}

function doScanVstupu(
  k: BesedaScanKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
): BranaScanAutomatickaUdalostVstup {
  const j = verejnyJazyk(k, polozky);
  assert(j.kotva, `chybí kotva pro ${k.zdrojIdentita}`);
  const zapis = sestavBesedaZapisPoSparovani({
    surovyNazev: k.nazev,
    jazyk: {
      mistoNeboTyp: `${j.co} ${j.kde}`,
      verejneCo: j.co,
      verejneRozliseni: j.kde,
    },
  });
  return {
    redakcniPolozkaId: j.kotva,
    datumOd: k.datumOd,
    datumDo: k.datumDo,
    cas: k.cas,
    mistoNeboTyp: zapis.mistoNeboTyp,
    nazev: zapis.nazev,
    verejneCo: zapis.verejneCo,
    verejneRozliseni: zapis.verejneRozliseni,
    nazevProScanKlic: zapis.nazevProScanKlic,
    zdrojIdentita: k.zdrojIdentita,
    typZdroje: "RYCHLY",
  };
}

function overUrlADiscovery(): void {
  assert(jeBesedaZdrojUrl(HOME_URL), "home URL");
  assert(jeBesedaZdrojUrl(PROGRAM_URL), "program URL");
  assert(jeBesedaZdrojUrl("https://besedaclub.cz/foo"), "host bez www");
  assert(!jeBesedaZdrojUrl("https://www.trebonsko.cz/"), "cizí host");
  assert(sestavBesedaHomeUrl(PROGRAM_URL) === HOME_URL, "program → home");
  assert(sestavBesedaProgramUrl(HOME_URL) === PROGRAM_URL, "home → program");
  assert(
    vytahnoutBesedaProgramUrl(FIXTURE_HOME, HOME_URL) === PROGRAM_URL,
    "discovery odkaz Program",
  );
  assert(
    vytahnoutBesedaProgramUrl(FIXTURE_PROGRAM, PROGRAM_URL) === "",
    "program stránka bez nav odkazu → prázdné (scan sáhne na kanonické)",
  );
  console.log("OK URL / discovery Program");
}

function overCas(): void {
  assert(
    vytahnoutJednoznacnyCasZacatkuBesedy(
      "WELCOME DRINK<br /><br />Přednostní vstup už ve 20:30!<br /><br />VIP zónu",
    ) === "",
    "VIP 20:30 není začátek",
  );
  assert(
    vytahnoutJednoznacnyCasZacatkuBesedy(
      "12. září 2026<br />21:00<br />Beseda Music Club Třeboň",
    ) === "21:00",
    "samostatný 21:00",
  );
  assert(
    vytahnoutJednoznacnyCasZacatkuBesedy("20:00<br />21:00") === "",
    "dva samostatné časy → prázdné",
  );
  assert(
    vytahnoutJednoznacnyCasZacatkuBesedy("Sobota 22:00 - 4:00") === "",
    "provozní rozmezí",
  );
  assert(
    vytahnoutJednoznacnyCasZacatkuBesedy("START 22:00") === "22:00",
    "řádek START HH:mm",
  );
  console.log("OK čas fail-closed");
}

function overFixture(): void {
  const seed = vytvoritVychoziRedakcniPoradi();
  assert(najitBesedaKotvuId(seed) === null, "seed nemá Besedu — nehádáme ID");

  const masarykAno = seed.map((p) =>
    p.id === "masarykovo-namesti" ? { ...p, pouzivat: "ANO" as const } : p,
  );
  assert(
    najitBesedaKotvuId(masarykAno) === null,
    "Masarykovo náměstí není Beseda",
  );
  assert(najitBesedaKotvuId(seed) === null, "Trhy na náměstí nejsou Beseda");

  const dve = redakceProBesedu([
    testovaciPolozka("a", BRANA_BESEDA_POLOZKA),
    testovaciPolozka("b", BRANA_BESEDA_POLOZKA),
  ]);
  assert(najitBesedaKotvuId(dve) === null, "2 shody → fail closed");

  const ne = redakceProBesedu([
    testovaciPolozka(VERIFY_BESEDA_ID, BRANA_BESEDA_POLOZKA, "NE"),
  ]);
  assert(najitBesedaKotvuId(ne) === null, "Používat NE → žádná kotva");

  const polozky = redakceProBesedu();
  assert(
    najitBesedaKotvuId(polozky) === VERIFY_BESEDA_ID,
    "právě jedna ANO Music Club Beseda",
  );

  const home = parsovatUdalostiZeZdroje(FIXTURE_HOME, "text/html");
  assert(home.length === 0, "homepage není program");

  const prazdny = parsovatBesedaProgram(FIXTURE_PRAZDNY);
  assert(prazdny.length === 0, "prázdný program");

  const dvou = parsovatBesedaProgram(FIXTURE_DVOU_CASU);
  assert(dvou.length === 1, "karta s dvěma časy existuje");
  assert(dvou[0]?.cas === "", "dva časy → BEZ ČASU");

  const dispatch = parsovatUdalostiZeZdroje(FIXTURE_PROGRAM, "text/html");
  const karty = parsovatBesedaProgram(FIXTURE_PROGRAM);
  assert(dispatch.length === 3, `dispatch 3, bylo ${dispatch.length}`);
  assert(karty.length === 3, `program 3, bylo ${karty.length}`);

  const dorian = karty.find((k) => k.nazev === "Dorian&Lboy Show");
  const fousatej = karty.find((k) => k.nazev === "Fousatej Hat");
  const alkehol = karty.find((k) => k.nazev === "Alkehol");
  assert(dorian && fousatej && alkehol, "tři pojmenované karty");

  assert(dorian.datumOd === "2026-08-21", `Dorian datum ${dorian.datumOd}`);
  assert(dorian.cas === "", "Dorian BEZ ČASU (VIP 20:30 se nebere)");
  assert(
    dorian.zdrojIdentita ===
      sestavBesedaZdrojIdentitu({
        datumOd: "2026-08-21",
        nazev: "Dorian&Lboy Show",
      }),
    "Dorian identita",
  );
  assert(
    dorian.zdrojIdentita === "beseda|2026-08-21|dorian-lboy-show",
    `Dorian identita text ${dorian.zdrojIdentita}`,
  );

  assert(fousatej.datumOd === "2026-09-12", "Fousatej datum");
  assert(fousatej.cas === "21:00", "Fousatej 21:00 začátek");
  assert(
    fousatej.zdrojIdentita === "beseda|2026-09-12|fousatej-hat",
    "Fousatej identita",
  );

  assert(alkehol.datumOd === "2026-10-16", "Alkehol datum");
  assert(alkehol.cas === "21:00", "Alkehol 21:00 začátek");
  assert(alkehol.zdrojIdentita === "beseda|2026-10-16|alkehol", "Alkehol identita");

  for (const k of karty) {
    const j = verejnyJazyk(k, polozky);
    assert(j.kotva === VERIFY_BESEDA_ID, `kotva ${k.nazev} ${j.kotva}`);
    assert(j.co === k.nazev, `CO přesný název: ${j.co}`);
    assert(j.kde === BRANA_BESEDA_KDE, `KDE ${j.kde}`);
    assert(j.nazevVerejne === "", `název skrytý: ${j.nazevVerejne}`);
    assert(j.kotva === VERIFY_BESEDA_ID, "kotva není Masarykovo náměstí / Trhy");
    assert(
      !/Koncert|VIP|vstupné|WIDLE|diskot/i.test(`${j.co} ${j.kde} ${j.nazevVerejne}`),
      "žánr / doprovod ve veřejném jazyku",
    );
  }

  const seedJazyk = verejnyJazyk(dorian, seed);
  assert(seedJazyk.kotva === null, "seed ownership fail-closed");

  console.log("OK fixture: 3 karty, čas, KDE, ownership, prázdný program");
}

function overDedup(): void {
  const polozky = redakceProBesedu();
  const kandidati = parsovatBesedaProgram(FIXTURE_PROGRAM).map((k) =>
    doScanVstupu(k, polozky),
  );
  assert(kandidati.length === 3, "3 vstupy");

  const prazdne: BranaKonkretniUdalost[] = [];
  const prvni = aplikovatScanKandidatyNaUdalosti(
    prazdne,
    kandidati,
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(prvni.vysledek.pridano === 3, `první pridano ${prvni.vysledek.pridano}`);
  assert(prvni.udalosti.length === 3, "první 3 CEKA");

  const druhy = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    kandidati,
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(druhy.vysledek.pridano === 0, "druhý pridano 0");
  assert(
    druhy.vysledek.jizExistuje === 3,
    `druhý jizExistuje ${druhy.vysledek.jizExistuje}`,
  );
  assert(druhy.udalosti.length === 3, "stále 3");
  console.log("OK opakovaný scan: bez duplicity");
}

function overCiziParsery(): void {
  const kino = parsovatUdalostiZeZdroje(KINOTREBON_MINI, "text/html");
  assert(kino.length >= 1 && kino[0].nazev === "Test Film", "kino beze změny");
  const okolo = parsovatUdalostiZeZdroje(OKOLO_MINI, "text/html");
  assert(
    okolo.some((k) => /matiné/i.test(k.nazev)),
    "okolo matiné beze změny",
  );
  console.log("OK kino / Okolo parser beze změny");
}

overUrlADiscovery();
overCas();
overFixture();
overDedup();
overCiziParsery();
console.log("OK verify-brana-beseda-parser");

type ZivaKotva = {
  id: string | null;
  polozka: string | null;
  duvod: string;
};

function doplnBranaAdminBlobEnvZLokalnichSouboru(): void {
  if (process.env.BLOB_BRANA_ADMIN_READ_WRITE_TOKEN) {
    return;
  }
  const soubory = [".env.local.production", ".env.local", ".env"];
  for (const soubor of soubory) {
    let text = "";
    try {
      text = readFileSync(soubor, "utf8");
    } catch {
      continue;
    }
    for (const radek of text.split(/\r?\n/)) {
      const m = radek.match(
        /^(BLOB_BRANA_ADMIN_READ_WRITE_TOKEN|BLOB_BRANA_ADMIN_STORE_ID)\s*=\s*(.*)$/,
      );
      if (!m) {
        continue;
      }
      const klic = m[1] ?? "";
      if (!klic || process.env[klic]) {
        continue;
      }
      let hodnota = (m[2] ?? "").trim();
      if (
        (hodnota.startsWith('"') && hodnota.endsWith('"')) ||
        (hodnota.startsWith("'") && hodnota.endsWith("'"))
      ) {
        hodnota = hodnota.slice(1, -1);
      }
      if (hodnota) {
        process.env[klic] = hodnota;
      }
    }
  }
}

async function nacistZivouBesedaKotvu(): Promise<ZivaKotva> {
  doplnBranaAdminBlobEnvZLokalnichSouboru();
  const token = process.env.BLOB_BRANA_ADMIN_READ_WRITE_TOKEN;
  if (!token) {
    return {
      id: null,
      polozka: null,
      duvod: "Blob token v procesu chybí — lookup podle Položka + Používat=ANO",
    };
  }
  const storeIdRaw = process.env.BLOB_BRANA_ADMIN_STORE_ID;
  const storeId = storeIdRaw
    ? storeIdRaw.startsWith("store_")
      ? storeIdRaw.slice("store_".length)
      : storeIdRaw
    : undefined;
  try {
    const { get } = await import("@vercel/blob");
    const blob = await get("data/brana-redakcni-poradi.json", {
      access: "private",
      token,
      ...(storeId ? { storeId } : {}),
    });
    if (!blob) {
      return { id: null, polozka: null, duvod: "Blob redakčního pořadí chybí" };
    }
    const text = await new Response(blob.stream).text();
    const data = JSON.parse(text) as {
      polozky?: BranaRedakcniPolozkaStav[];
    };
    const polozky = Array.isArray(data.polozky) ? data.polozky : [];
    const id = najitBesedaKotvuId(polozky);
    const shody = polozky.filter(
      (p) =>
        p.pouzivat === "ANO" && (p.polozka ?? "").trim() === BRANA_BESEDA_POLOZKA,
    );
    if (!id) {
      return {
        id: null,
        polozka: null,
        duvod: `živě ${shody.length} shod Položka=${BRANA_BESEDA_POLOZKA} Používat=ANO`,
      };
    }
    return { id, polozka: BRANA_BESEDA_POLOZKA, duvod: "právě jedna živá shoda" };
  } catch {
    return {
      id: null,
      polozka: null,
      duvod: "čtení živého Redakčního pořadí selhalo — lookup podle Položka + Používat=ANO",
    };
  }
}

async function zivyPredscan(): Promise<void> {
  const homeRes = await fetch(HOME_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  if (!homeRes.ok) {
    fail(`živá homepage GET ${homeRes.status}`);
  }
  const homeHtml = await homeRes.text();
  const zOdkazu = vytahnoutBesedaProgramUrl(homeHtml, HOME_URL);
  const programUrl = zOdkazu || sestavBesedaProgramUrl(HOME_URL);
  console.log(`\nŽIVÝ ZDROJ homepage: ${HOME_URL}`);
  console.log(`  discovery Program: ${zOdkazu || "(fallback kanonické /program.html)"}`);
  console.log(`  čte se: ${programUrl}`);

  const progRes = await fetch(programUrl, {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  if (!progRes.ok) {
    fail(`živý program GET ${progRes.status}`);
  }
  const html = await progRes.text();
  const vsichni = parsovatBesedaProgram(html);
  const dnesIso = dnesIsoVPraze();
  const budouci = vsichni.filter((k) => !jeUdalostCelaMinula(k, dnesIso));
  const kotva = await nacistZivouBesedaKotvu();

  console.log(`  parser celkem: ${vsichni.length}, budoucí (dnes ${dnesIso}): ${budouci.length}`);
  console.log(
    `  živá kotva: ${kotva.id ?? "NENALEZENA"} | ${kotva.duvod}${
      kotva.polozka ? ` | Položka=${kotva.polozka}` : ""
    }`,
  );

  if (budouci.length === 0) {
    console.log("\n(žádné budoucí karty)");
    return;
  }

  console.log("\nKANDIDÁTI, které by scan dnes vytvořil (READ-ONLY, nic se nezapisuje):");
  for (const k of budouci) {
    const cas = k.cas ? k.cas : "BEZ ČASU";
    console.log(
      [
        `  datum: ${k.datumOd}`,
        `čas: ${cas}`,
        `CO: ${k.nazev}`,
        `KDE: ${BRANA_BESEDA_KDE}`,
        `identita: ${k.zdrojIdentita ?? ""}`,
        `kotva: ${kotva.id ?? "NENALEZENA"}`,
      ].join(" | "),
    );
    assert(k.nazev.trim().length > 0, "živě: prázdný název");
    assert(k.mistoNeboTyp === BRANA_BESEDA_KDE, "živě: KDE");
    assert(!/^\s*20:30\s*$/.test(k.cas), "živě: falešný VIP čas jako jediný údaj");
  }
}

if (process.argv.includes("--zivy")) {
  zivyPredscan().catch((e) => {
    fail(e instanceof Error ? e.message : String(e));
  });
}
