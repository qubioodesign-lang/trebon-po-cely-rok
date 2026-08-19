/**
 * Úzká větev Třeboňských lázeňských matiné ze stejného Třeboňsko hubu.
 * Spuštění: npx tsx scripts/verify-brana-lazenska-matine-parser.ts
 * READ-ONLY předscan: npx tsx scripts/verify-brana-lazenska-matine-parser.ts --zivy
 */

import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  BRANA_MATINE_CO,
  BRANA_MATINE_KDE_ALTAN_BERTA,
  BRANA_MATINE_REDAKCNI_POLOZKA_ID,
  jeMatineZdrojIdentita,
  kanonizovatMatinePrimarniMisto,
  najitMatineKotvuPodlePolozky,
  parsovatLazenskaMatineProgram,
  sestavMatineZdrojIdentitu,
  urcitLazenskaMatineKotvu,
} from "../src/lib/brana/admin/lazenska-matine";
import {
  parsovatTanecniVeceryProgram,
  urcitTanecniVecerKotvu,
  vytahnoutTrebonskoTanecniVecerMesicUrlky,
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
  vytvoritScanKlicAutomatickeUdalosti,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";
import type { BranaScanAutomatickaUdalostVstup } from "../src/lib/brana/admin/scan-ceka-zapis";
import type { BranaScanKandidat } from "../src/lib/brana/admin/zdroj-scan-parser";

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

const RADEK_AURORA_16_8 =
  `16.8. ne 11.00 Třeboňská lázeňská matiné "Italské árie a kantilény" , Jiří Rajniš (baryton) a Ladislav Horák (akordeon) vstupné zdarma (Altán LDB) 384 754 455 - v případě nepříznivého počasí společenský sál LDA`;
const RADEK_BERTA_16_8 =
  `16.8. ne 11.00 Třeboňská lázeňská matiné "Italské árie a kantilény", Jiří Rajniš (baryton) a Ladislav Horák (akordeon) vstupné zdarma – LDB (Altán) 384 754 455 - v případě nepříznivého počasí společenský sál LDA`;

const FIXTURE_AURORA = clanekHtml({
  spa: "Aurora",
  mesic: "srpen",
  rok: 2026,
  radky: [
    `6.8. čt 19.00 Taneční večer, hraje TWO FACES, vstupné zdarma, (H)`,
    `13.8. čt 19.00 Taneční večer, hraje ALCANTO, vstupné zdarma, (H)`,
    RADEK_AURORA_16_8,
    `16.8. ne 19.30 Kino "Po večeřce", komedie, vstupné 150,- Kč, (S)`,
  ],
});

const FIXTURE_BERTA = clanekHtml({
  spa: "Berta",
  mesic: "srpen",
  rok: 2026,
  radky: [
    `3.8. po 19.00 Taneční večer, hraje DJ PÁNEK, vstupné zdarma, (A)`,
    RADEK_BERTA_16_8,
    `17.8. po 19.00 Taneční večer, hraje FALKO MELODI, vstupné zdarma, (A)`,
  ],
});

function verejnyJazykMatine(
  k: BranaScanKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
): { co: string; kde: string; nazevVerejne: string; kotva: string } {
  const kotva = urcitLazenskaMatineKotvu(k, polozky);
  assert(kotva, `chybí kotva matiné pro ${k.zdrojIdentita}`);
  const sparovani = sparovatVlastnictvimHlidaneKotvy(polozky, [kotva], kotva);
  assert(sparovani.ok, `ownership fail ${k.zdrojIdentita}`);
  const pravidlo = polozky.find((p) => p.id === sparovani.redakcniPolozkaId);
  assert(pravidlo, "pravidlo");
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: pravidlo.polozka,
    kandidatMisto: k.mistoNeboTyp,
    zdrojNazev: "Třeboňsko lázeňský program",
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
  k: BranaScanKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
): BranaScanAutomatickaUdalostVstup {
  const j = verejnyJazykMatine(k, polozky);
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
  };
}

function overMisto(): void {
  assert(
    kanonizovatMatinePrimarniMisto("LDB (Altán) – v případě nepříznivého počasí společenský sál LDA") ===
      BRANA_MATINE_KDE_ALTAN_BERTA,
    "LDB (Altán) → altán, ne LDA",
  );
  assert(
    kanonizovatMatinePrimarniMisto("Altán LDB") === BRANA_MATINE_KDE_ALTAN_BERTA,
    "Altán LDB",
  );
  assert(
    kanonizovatMatinePrimarniMisto(
      "Altán u lázeňského domu Berta / nepříznivé počasí LDA",
    ) === BRANA_MATINE_KDE_ALTAN_BERTA,
    "Okolo místo → altán",
  );
  assert(
    kanonizovatMatinePrimarniMisto("společenský sál LDA") === "Lázně Aurora",
    "jen sál LDA",
  );
  assert(
    kanonizovatMatinePrimarniMisto("Restaurace Harmonie") === null,
    "Harmonie není místo matiné",
  );
  console.log("OK kanonizace primárního místa");
}

function overFixture16(): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  assert(
    najitMatineKotvuPodlePolozky(polozky) === BRANA_MATINE_REDAKCNI_POLOZKA_ID,
    "seed kotva matiné",
  );

  const auroraTanecni = parsovatTanecniVeceryProgram(FIXTURE_AURORA);
  const bertaTanecni = parsovatTanecniVeceryProgram(FIXTURE_BERTA);
  assert(auroraTanecni.length === 2, `Aurora taneční ${auroraTanecni.length}`);
  assert(bertaTanecni.length === 2, `Berta taneční ${bertaTanecni.length}`);
  for (const k of [...auroraTanecni, ...bertaTanecni]) {
    assert(urcitTanecniVecerKotvu(k, polozky) === null, "seed bez Harmonie/Adély");
    assert(!jeMatineZdrojIdentita(k.zdrojIdentita), "taneční není matine|");
  }

  const auroraMatine = parsovatLazenskaMatineProgram(FIXTURE_AURORA);
  const bertaMatine = parsovatLazenskaMatineProgram(FIXTURE_BERTA);
  assert(auroraMatine.length === 1, `Aurora matiné ${auroraMatine.length}`);
  assert(bertaMatine.length === 1, `Berta matiné ${bertaMatine.length}`);
  assert(
    auroraMatine[0].zdrojIdentita === bertaMatine[0].zdrojIdentita,
    "stejná identita Aurora/Berta",
  );
  assert(
    auroraMatine[0].zdrojIdentita === "matine|2026-08-16",
    `identita ${auroraMatine[0].zdrojIdentita}`,
  );

  const sloucene = parsovatUdalostiZeZdroje(
    FIXTURE_AURORA,
    "text/html",
  ).concat(parsovatUdalostiZeZdroje(FIXTURE_BERTA, "text/html"));
  const matine = sloucene.filter((k) => jeMatineZdrojIdentita(k.zdrojIdentita));
  const identit = new Set(matine.map((k) => k.zdrojIdentita));
  assert(identit.size === 1, `1 identita, je ${identit.size}`);

  const vstupy = matine.map((k) => doScanVstupu(k, polozky));
  const zapsane = aplikovatScanKandidatyNaUdalosti(
    [],
    vstupy,
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(zapsane.vysledek.pridano === 1, `pridano ${zapsane.vysledek.pridano}`);
  assert(zapsane.udalosti.length === 1, "1 karta Aurora+Berta");

  const k = zapsane.udalosti[0];
  assert(k.datumOd === "2026-08-16", `datum ${k.datumOd}`);
  assert(k.cas === "11:00", `čas ${k.cas}`);
  assert(k.verejneCo === BRANA_MATINE_CO, `CO ${k.verejneCo}`);
  assert(k.verejneRozliseni === BRANA_MATINE_KDE_ALTAN_BERTA, `KDE ${k.verejneRozliseni}`);
  assert(
    k.nazev === "Italské árie a kantilény / Jiří Rajniš a Ladislav Horák",
    `název ${k.nazev}`,
  );
  assert(k.redakcniPolozkaId === BRANA_MATINE_REDAKCNI_POLOZKA_ID, "kotva");
  assert(k.zdrojIdentita === sestavMatineZdrojIdentitu("2026-08-16"), "identita zápis");

  const j = verejnyJazykMatine(auroraMatine[0], polozky);
  assert(j.kotva === BRANA_MATINE_REDAKCNI_POLOZKA_ID, "ownership kotva");
  assert(j.co === BRANA_MATINE_CO, `jazyk CO ${j.co}`);
  assert(j.kde === BRANA_MATINE_KDE_ALTAN_BERTA, `jazyk KDE ${j.kde}`);
  assert(
    !["lazensky-dum-aurora", "kino-aurora", "okolo-trebone"].includes(j.kotva),
    "nesmí jiná lázeňská kotva",
  );

  const pouzivatNe = polozky.map((p) =>
    p.id === BRANA_MATINE_REDAKCNI_POLOZKA_ID ? { ...p, pouzivat: "NE" as const } : p,
  );
  assert(najitMatineKotvuPodlePolozky(pouzivatNe) === null, "Používat NE → 0");
  assert(
    urcitLazenskaMatineKotvu(auroraMatine[0], pouzivatNe) === null,
    "ownership NE",
  );

  const minule = aplikovatScanKandidatyNaUdalosti(
    [],
    vstupy,
    "2026-08-19",
    jeUdalostCelaMinula,
  );
  assert(minule.vysledek.pridano === 0, "16.8. po datu se nezapisuje");
  assert(minule.udalosti.length === 0, "minulé 0 karet");

  console.log("OK fixture 16.8.: 1 kandidát, jazyk, ownership, minulé 0");
}

function overLegacyOkoloAlias(): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const legacyIdentita =
    "okolo|2026-09-20|11:00|trebonska-lazenska-matine-cimbalova-muzika";
  const exist: BranaKonkretniUdalost = {
    id: "auto-okolo-matine",
    redakcniPolozkaId: BRANA_MATINE_REDAKCNI_POLOZKA_ID,
    datumOd: "2026-09-20",
    datumDo: "2026-09-20",
    cas: "11:00",
    mistoNeboTyp: "Lázeňské matiné Altán u lázeňského domu Berta",
    nazev: "Třeboňská lázeňská matiné: Cimbálová muzika",
    rucniPoziceVDni: null,
    stavSchvaleni: "SCHVALENO",
    scanKlic: vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: BRANA_MATINE_REDAKCNI_POLOZKA_ID,
      datumOd: "2026-09-20",
      cas: "11:00",
      nazev: "Třeboňská lázeňská matiné: Cimbálová muzika",
    }),
    zdrojIdentita: legacyIdentita,
    verejneCo: BRANA_MATINE_CO,
    verejneRozliseni: BRANA_MATINE_KDE_ALTAN_BERTA,
  };
  const trebonsko: BranaScanAutomatickaUdalostVstup = {
    redakcniPolozkaId: BRANA_MATINE_REDAKCNI_POLOZKA_ID,
    datumOd: "2026-09-20",
    datumDo: "2026-09-20",
    cas: "11:00",
    mistoNeboTyp: `${BRANA_MATINE_CO} ${BRANA_MATINE_KDE_ALTAN_BERTA}`,
    nazev: "Cimbálová muzika - pocta vínu",
    verejneCo: BRANA_MATINE_CO,
    verejneRozliseni: BRANA_MATINE_KDE_ALTAN_BERTA,
    zdrojIdentita: "matine|2026-09-20",
  };
  const vysledek = aplikovatScanKandidatyNaUdalosti(
    [exist],
    [trebonsko],
    "2026-08-19",
    jeUdalostCelaMinula,
  );
  assert(vysledek.vysledek.pridano === 0, "legacy: žádná druhá karta");
  assert(vysledek.udalosti.length === 1, "legacy: stále 1");
  assert(vysledek.udalosti[0].id === "auto-okolo-matine", "stejné id");
  assert(
    vysledek.udalosti[0].zdrojIdentita === legacyIdentita,
    "SCHVALENO nemění identitu",
  );
  assert(
    vysledek.udalosti[0].stavSchvaleni === "SCHVALENO",
    "zůstává SCHVALENO",
  );

  const entraadio: BranaKonkretniUdalost = {
    ...exist,
    id: "auto-okolo-entradio",
    stavSchvaleni: "CEKA_NA_SCHVALENI",
    zdrojIdentita: "okolo|entradio|999001",
  };
  const ceka = aplikovatScanKandidatyNaUdalosti(
    [entraadio],
    [trebonsko],
    "2026-08-19",
    jeUdalostCelaMinula,
  );
  assert(ceka.udalosti.length === 1, "CEKA entraadio: 1");
  assert(ceka.vysledek.pridano === 0, "CEKA entraadio: 0 nových");
  assert(
    ceka.udalosti[0].zdrojIdentita === "matine|2026-09-20",
    `CEKA migrace identity ${ceka.udalosti[0].zdrojIdentita}`,
  );
  console.log("OK alias: legacy Okolo SCHVALENO i CEKA entraadio = 1 karta");
}

function overCizi(): void {
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
  console.log("OK kino beze změny");
}

overMisto();
overFixture16();
overLegacyOkoloAlias();
overCizi();
console.log("OK verify-brana-lazenska-matine-parser");

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
  const polozky = vytvoritVychoziRedakcniPoradi();
  const dnesIso = dnesIsoVPraze();
  const nalezene: BranaScanKandidat[] = [];
  for (const mesic of mesice) {
    console.log(`  ${mesic.spa} ${mesic.rok}-${String(mesic.mesic).padStart(2, "0")} ${mesic.url}`);
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
    nalezene.push(...parsovatLazenskaMatineProgram(html));
  }
  const unikatni = new Map<string, BranaScanKandidat>();
  for (const k of nalezene) {
    const id = k.zdrojIdentita ?? "";
    if (id && !unikatni.has(id)) {
      unikatni.set(id, k);
    }
  }
  const budouci = [...unikatni.values()].filter(
    (k) => !jeUdalostCelaMinula(k, dnesIso),
  );
  console.log(`\nMATINÉ unikátní: ${unikatni.size}; budoucí: ${budouci.length}`);
  if (budouci.length === 0) {
    console.log("  (žádné budoucí matiné — očekáváno)");
  }
  for (const k of budouci) {
    const j = verejnyJazykMatine(k, polozky);
    console.log(
      `  ${k.datumOd} ${k.cas} | ${k.nazev} | CO: ${j.co} | KDE: ${j.kde} | ${k.zdrojIdentita}`,
    );
  }
}

if (process.argv.includes("--zivy")) {
  zivyPredscan().catch((e) => {
    fail(e instanceof Error ? e.message : String(e));
  });
}
