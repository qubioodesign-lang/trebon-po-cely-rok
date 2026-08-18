/**
 * Úzký parser tanečních večerů Aurora/Berta z Třeboňsko hubu.
 * Spuštění: npx tsx scripts/verify-brana-tanecni-vecery-parser.ts
 * READ-ONLY předscan: npx tsx scripts/verify-brana-tanecni-vecery-parser.ts --zivy
 */

import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  BRANA_TANECNI_VECER_ADELA_POLOZKA,
  BRANA_TANECNI_VECER_CO,
  BRANA_TANECNI_VECER_HARMONIE_POLOZKA,
  jeTrebonskoLazenskyKulturniProgramZdrojUrl,
  najitTanecniVecerKotvuPodlePolozky,
  parsovatTanecniVeceryProgram,
  sestavTrebonskoLazenskyKulturniProgramHubUrl,
  urcitTanecniVecerKotvu,
  vytahnoutTrebonskoTanecniVecerMesicUrlky,
  type TanecniVecerKandidat,
} from "../src/lib/brana/admin/tanecni-vecery";
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

const HUB_URL =
  "https://www.trebonsko.cz/kategorie/lazensky-kulturni-program/";
const REF_SRPEN = new Date("2026-08-18T12:00:00+02:00");

const VERIFY_HARMONIE_ID = "verify-restaurace-harmonie";
const VERIFY_ADELA_ID = "verify-restaurace-adela";

function pevne(text: string): { rezim: "PEVNE"; text: string } {
  return { rezim: "PEVNE", text };
}

function testovaciPolozka(
  id: string,
  polozka: string,
): BranaRedakcniPolozkaStav {
  return {
    id,
    polozka,
    pouzivat: "ANO",
    priorita: 9,
    subpriorita: null,
    vyhled: "NE",
    vyhledSerie: true,
    poznamka: "",
    mimoKostru: true,
    jazykVerejny: {
      co: pevne(BRANA_TANECNI_VECER_CO),
      rozliseni: pevne(polozka),
    },
  };
}

function redakceProTanecniVecery(): BranaRedakcniPolozkaStav[] {
  return [
    ...vytvoritVychoziRedakcniPoradi(),
    testovaciPolozka(VERIFY_HARMONIE_ID, BRANA_TANECNI_VECER_HARMONIE_POLOZKA),
    testovaciPolozka(VERIFY_ADELA_ID, BRANA_TANECNI_VECER_ADELA_POLOZKA),
  ];
}

function clanekHtml(args: {
  spa: "Aurora" | "Berta";
  mesic: string;
  rok: number;
  radky: string[];
}): string {
  const title = `Kultura v lázeňském domě ${args.spa} - ${args.mesic} ${args.rok}`;
  const slug = args.spa === "Aurora" ? "aurora" : "berta";
  const lis = args.radky.map((r) => `<li>${r}</li>`).join("\n");
  return `<!DOCTYPE html>
<html><head>
<title>${title} | Třeboň a okolí - Třeboňsko.cz</title>
<link rel="canonical" href="https://www.trebonsko.cz/kultura-v-lazenskem-dome-${slug}-${args.mesic}-2026">
</head><body>
<h1>${title}</h1>
<ul>
${lis}
</ul>
</body></html>`;
}

const FIXTURE_AURORA = clanekHtml({
  spa: "Aurora",
  mesic: "srpen",
  rok: 2026,
  radky: [
    `6.8. čt 19.00 Taneční večer, hraje TWO FACES, vstupné zdarma, (H)`,
    `7.8. pá 19.00 Přednáška "Léčivá síla rašeliny", přednáší Doc. Petr, vstupné zdarma, (BS)`,
    `10.8. po 19.30 Kino "Bardotky", komedie, vstupné 160,- Kč, (S)`,
    `13.8. čt 19.00 Taneční večer, hraje ALCANTO, vstupné zdarma, (H)`,
  ],
});

const FIXTURE_BERTA = clanekHtml({
  spa: "Berta",
  mesic: "srpen",
  rok: 2026,
  radky: [
    `3.8. po 19.00 Taneční večer, hraje DJ PÁNEK, vstupné zdarma, (A)`,
    `16.8. ne 11.00 Třeboňská lázeňská matiné "Italské árie", vstupné zdarma – LDB (Altán)`,
    `17.8. po 19.00 Taneční večer, hraje FALKO MELODI, vstupné zdarma, (A)`,
    `20.8. čt 19.00 Přednáška "Rebelka Erzsi", přednáší Dagmar, vstupné zdarma, (SZS)`,
  ],
});

const HUB_FIXTURE = `<!DOCTYPE html>
<html><head>
<title>Lázeňský kulturní program | Třeboňsko.cz</title>
<link rel="canonical" href="${HUB_URL}">
</head><body>
<a href="https://www.trebonsko.cz/tl-matine-cimbalova-muzika" title="TL matiné: Cimbálová muzika - pocta vínu">TL matiné: Cimbálová muzika - pocta vínu</a>
<a href="https://www.trebonsko.cz/kultura-v-lazenskem-dome-aurora-srpen-2026" title="Kultura v lázeňském domě Aurora - srpen 2026">Kultura v lázeňském domě Aurora - srpen 2026</a>
<a href="https://www.trebonsko.cz/kultura-v-lazenskem-dome-berta-srpen-2026" title="Kultura v lázeňském domě Berta - srpen 2026">Kultura v lázeňském domě Berta - srpen 2026</a>
<a href="https://www.trebonsko.cz/kultura-v-lazenskem-dome-aurora-cervenec-2026-15476" title="Kultura v lázeňském domě Aurora - červenec 2026">Kultura v lázeňském domě Aurora - červenec 2026</a>
<a href="https://www.trebonsko.cz/kultura-v-lazenskem-dome-aurora-cervenec-2026" title="Kultura v lázeňském domě Berta - červenec 2026">Kultura v lázeňském domě Berta - červenec 2026</a>
<a href="https://www.trebonsko.cz/kategorie/lazne-aurora/" title="Lázně Aurora">Lázně Aurora</a>
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
  k: TanecniVecerKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
): { co: string; kde: string; nazevVerejne: string; kotva: string } {
  const kotva = urcitTanecniVecerKotvu(k, polozky);
  assert(kotva, `chybí kotva pro ${k.zdrojIdentita}`);
  const sparovani = sparovatVlastnictvimHlidaneKotvy(polozky, [kotva], kotva);
  assert(sparovani.ok, `ownership fail ${k.zdrojIdentita}`);
  const pravidlo = polozky.find((p) => p.id === sparovani.redakcniPolozkaId);
  assert(pravidlo, "pravidlo");
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: pravidlo.polozka,
    kandidatMisto: k.mistoNeboTyp,
    zdrojNazev: "Taneční večery",
    jazykVerejny: pravidlo.jazykVerejny,
  });
  const rozloz = rozlozAkci({
    nazev: k.nazev,
    mistoNeboTyp: jazyk.mistoNeboTyp,
    cas: k.cas,
    verejneCo: jazyk.verejneCo,
    verejneRozliseni: jazyk.verejneRozliseni,
  });
  return {
    co: rozloz.typ,
    kde: rozloz.misto,
    nazevVerejne: rozloz.nazev,
    kotva: sparovani.redakcniPolozkaId,
  };
}

function doScanVstupu(
  k: TanecniVecerKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
): BranaScanAutomatickaUdalostVstup {
  const j = verejnyJazyk(k, polozky);
  return {
    redakcniPolozkaId: j.kotva,
    datumOd: k.datumOd,
    datumDo: k.datumDo,
    cas: k.cas,
    mistoNeboTyp: `${j.co} ${j.kde}`,
    nazev: k.nazev,
    verejneCo: j.co,
    verejneRozliseni: j.kde,
    zdrojIdentita: k.zdrojIdentita,
    typZdroje: "RYCHLY",
  };
}

function overUrl(): void {
  assert(
    jeTrebonskoLazenskyKulturniProgramZdrojUrl(HUB_URL),
    "hub URL",
  );
  assert(
    sestavTrebonskoLazenskyKulturniProgramHubUrl(
      "https://www.trebonsko.cz/kultura-v-lazenskem-dome-aurora-srpen-2026",
    ) === HUB_URL,
    "měsíční URL → hub",
  );
  assert(
    !jeTrebonskoLazenskyKulturniProgramZdrojUrl(
      "https://www.trebonsko.cz/kategorie/kina/",
    ),
    "kino hub není taneční",
  );
  console.log("OK URL hub / kanonizace");
}

function overDiscovery(): void {
  const urlky = vytahnoutTrebonskoTanecniVecerMesicUrlky(
    HUB_FIXTURE,
    HUB_URL,
    REF_SRPEN,
  );
  assert(urlky.length === 2, `discovery 2 (srpen), bylo ${urlky.length}`);
  const aurora = urlky.find((u) => u.spa === "aurora");
  const berta = urlky.find((u) => u.spa === "berta");
  assert(
    aurora?.url.endsWith("/kultura-v-lazenskem-dome-aurora-srpen-2026"),
    "Aurora srpen z titulku",
  );
  assert(
    berta?.url.endsWith("/kultura-v-lazenskem-dome-berta-srpen-2026"),
    "Berta srpen z titulku",
  );
  assert(
    !urlky.some((u) => u.url.includes("cervenec")),
    "červenec není aktuální/následující",
  );
  assert(
    !urlky.some((u) => u.url.includes("lazne-aurora")),
    "kategorie Lázně Aurora se nebere",
  );

  const cervenecRef = new Date("2026-07-20T12:00:00+02:00");
  const cervenec = vytahnoutTrebonskoTanecniVecerMesicUrlky(
    HUB_FIXTURE,
    HUB_URL,
    cervenecRef,
  );
  const bertaCervenec = cervenec.find(
    (u) => u.spa === "berta" && u.mesic === 7,
  );
  assert(
    bertaCervenec?.url.endsWith(
      "/kultura-v-lazenskem-dome-aurora-cervenec-2026",
    ),
    "ležící slug: titulek Berta vyhrál nad aurora-cervenec",
  );
  const auroraCervenec = cervenec.find(
    (u) => u.spa === "aurora" && u.mesic === 7,
  );
  assert(
    auroraCervenec?.url.endsWith(
      "/kultura-v-lazenskem-dome-aurora-cervenec-2026-15476",
    ),
    "Aurora červenec z číslovaného slugu + titulku",
  );
  console.log("OK hub discovery (titulek > slug)");
}

function overFixture(): void {
  const polozky = redakceProTanecniVecery();
  const seed = vytvoritVychoziRedakcniPoradi();

  assert(
    najitTanecniVecerKotvuPodlePolozky(
      seed,
      BRANA_TANECNI_VECER_HARMONIE_POLOZKA,
    ) === null,
    "seed nemá Harmonii — nehádáme staré ID",
  );
  assert(
    najitTanecniVecerKotvuPodlePolozky(
      seed,
      BRANA_TANECNI_VECER_ADELA_POLOZKA,
    ) === null,
    "seed nemá Adélu — nehádáme staré ID",
  );

  const auroraDispatch = parsovatUdalostiZeZdroje(FIXTURE_AURORA, "text/html");
  const bertaDispatch = parsovatUdalostiZeZdroje(FIXTURE_BERTA, "text/html");
  const aurora = parsovatTanecniVeceryProgram(FIXTURE_AURORA);
  const berta = parsovatTanecniVeceryProgram(FIXTURE_BERTA);

  assert(auroraDispatch.length === 2, "Aurora dispatch 2");
  assert(bertaDispatch.length === 2, "Berta dispatch 2");
  assert(aurora.length === 2, "Aurora program 2");
  assert(berta.length === 2, "Berta program 2");

  for (const k of aurora) {
    const j = verejnyJazyk(k, polozky);
    assert(j.kotva === VERIFY_HARMONIE_ID, `Aurora kotva ${j.kotva}`);
    assert(j.co === BRANA_TANECNI_VECER_CO, `Aurora CO ${j.co}`);
    assert(j.kde === BRANA_TANECNI_VECER_HARMONIE_POLOZKA, `Aurora KDE ${j.kde}`);
    assert(j.nazevVerejne === "", `Aurora nazev skrytý: ${j.nazevVerejne}`);
    assert(
      !["lazensky-dum-aurora", "kino-aurora"].includes(j.kotva),
      "Aurora nesmí spadnout na Lázně Aurora / Kino Aurora",
    );
    assert(
      !/TWO FACES|ALCANTO|PÁNEK|DJ/i.test(`${j.co} ${j.kde} ${j.nazevVerejne}`),
      "kapela v Aurora jazyku",
    );
  }
  assert(aurora[0].interpretKontrola === "TWO FACES", "interpret kontrola 1");
  assert(aurora[1].interpretKontrola === "ALCANTO", "interpret kontrola 2");
  assert(aurora[0].cas === "19:00", "Aurora čas");
  assert(aurora[0].datumOd === "2026-08-06", "Aurora datum");
  assert(
    aurora[0].zdrojIdentita ===
      "trebonsko|tanecni-vecer|aurora|2026-08-06|19:00",
    "Aurora identita",
  );

  for (const k of berta) {
    const j = verejnyJazyk(k, polozky);
    assert(j.kotva === VERIFY_ADELA_ID, `Berta kotva ${j.kotva}`);
    assert(j.co === BRANA_TANECNI_VECER_CO, `Berta CO ${j.co}`);
    assert(j.kde === BRANA_TANECNI_VECER_ADELA_POLOZKA, `Berta KDE ${j.kde}`);
    assert(j.nazevVerejne === "", `Berta nazev skrytý: ${j.nazevVerejne}`);
    assert(
      !["lazensky-dum-berta", "trebonska-lazenska-matine"].includes(j.kotva),
      "Berta nesmí spadnout na starý význam Berty / matiné",
    );
    assert(
      !/PÁNEK|FALKO|DJ/i.test(`${j.co} ${j.kde} ${j.nazevVerejne}`),
      "kapela v Berta jazyku",
    );
  }
  assert(berta[0].interpretKontrola === "DJ PÁNEK", "Berta DJ kontrola");
  assert(berta[0].datumOd === "2026-08-03", "Berta datum");

  const seedAuroraKotva = urcitTanecniVecerKotvu(aurora[0], seed);
  assert(seedAuroraKotva === null, "seed ownership fail-closed");

  console.log("OK fixture: 2+2 kandidáti, ostatní 0, jazyk, ownership");
}

function overDedup(): void {
  const polozky = redakceProTanecniVecery();
  const kandidati = [
    ...parsovatTanecniVeceryProgram(FIXTURE_AURORA),
    ...parsovatTanecniVeceryProgram(FIXTURE_BERTA),
  ].map((k) => doScanVstupu(k, polozky));
  assert(kandidati.length === 4, "4 vstupy");

  const prazdne: BranaKonkretniUdalost[] = [];
  const prvni = aplikovatScanKandidatyNaUdalosti(
    prazdne,
    kandidati,
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(prvni.vysledek.pridano === 4, `první pridano ${prvni.vysledek.pridano}`);
  assert(prvni.udalosti.length === 4, "první 4 CEKA");

  const druhy = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    kandidati,
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(druhy.vysledek.pridano === 0, "druhý pridano 0");
  assert(druhy.vysledek.jizExistuje === 4, `druhý jizExistuje ${druhy.vysledek.jizExistuje}`);
  assert(druhy.udalosti.length === 4, "stále 4");
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

overUrl();
overDiscovery();
overFixture();
overDedup();
overCiziParsery();
console.log("OK verify-brana-tanecni-vecery-parser");

async function zivyPredscan(): Promise<void> {
  const res = await fetch(HUB_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  if (!res.ok) {
    fail(`živý hub GET ${res.status}`);
  }
  const hubHtml = await res.text();
  const mesice = vytahnoutTrebonskoTanecniVecerMesicUrlky(hubHtml, HUB_URL);
  console.log(
    `\nŽIVÝ HUB: ${mesice.length} měsíčních článků (aktuální+následující)`,
  );
  for (const m of mesice) {
    console.log(`  ${m.spa} ${m.rok}-${String(m.mesic).padStart(2, "0")} ${m.url}`);
  }

  const polozky = redakceProTanecniVecery();
  const dnesIso = dnesIsoVPraze();
  const aurora: TanecniVecerKandidat[] = [];
  const berta: TanecniVecerKandidat[] = [];

  for (const mesic of mesice) {
    const r = await fetch(mesic.url, {
      headers: {
        Accept: "text/html",
        "User-Agent": "BranaAdminScan/1.0",
      },
    });
    if (!r.ok) {
      fail(`živý měsíc GET ${mesic.url} ${r.status}`);
    }
    const html = await r.text();
    const kandidati = parsovatTanecniVeceryProgram(html);
    for (const k of kandidati) {
      if (k.spa === "aurora") {
        aurora.push(k);
      } else {
        berta.push(k);
      }
    }
  }

  const vypis = (skupina: string, seznam: TanecniVecerKandidat[]): void => {
    console.log(`\n${skupina}`);
    const budouci = seznam.filter((k) => !jeUdalostCelaMinula(k, dnesIso));
    if (budouci.length === 0) {
      console.log("  (žádné budoucí taneční večery)");
      return;
    }
    for (const k of budouci) {
      const j = verejnyJazyk(k, polozky);
      console.log(
        `  ${k.datumOd} ${k.cas} | interpret: ${k.interpretKontrola || "—"} | CO: ${j.co} | KDE: ${j.kde} | ${k.zdrojIdentita}`,
      );
      assert(j.nazevVerejne === "", "živě: nazev skrytý");
      assert(
        !/hraje|DJ |TWO FACES|ALCANTO|PÁNEK|FALKO|ZENIT/i.test(
          `${j.co} ${j.kde} ${j.nazevVerejne}`,
        ),
        "živě: kapela ve veřejném jazyku",
      );
    }
  };

  vypis("AURORA / HARMONIE", aurora);
  vypis("BERTA / ADÉLA", berta);
}

if (process.argv.includes("--zivy")) {
  zivyPredscan().catch((e) => {
    fail(e instanceof Error ? e.message : String(e));
  });
}
