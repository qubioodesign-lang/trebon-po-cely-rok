/**
 * Úzký parser iTřeboň → Divadlo J. K. Tyla.
 * Spuštění: npx tsx scripts/verify-brana-itrebon-jkt-parser.ts
 * READ-ONLY: fixture HTML, žádný Blob / ostrý scan / admin zdroj.
 * Živý předscan: npx tsx scripts/verify-brana-itrebon-jkt-parser.ts --prescan
 */

import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  BRANA_JKT_CO,
  BRANA_JKT_REDAKCNI_POLOZKA_ID,
  jeItrebonDivadloJkTylaZdroj,
  jeItrebonJktJednorazovaVernisazNazev,
  klasifikovatItrebonJktKartu,
  parsovatItrebonDivadloJkTyla,
} from "../src/lib/brana/admin/divadlo-jk-tyla";
import { BRANA_GBU_REDAKCNI_POLOZKA_ID } from "../src/lib/brana/admin/gbu-titulek";
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
  jeItrebonGalerieBuddhistickehoUmeniZdrojUrl,
  parsovatUdalostiZeZdroje,
  sestavItrebonKalendarUrlky,
} from "../src/lib/brana/admin/zdroj-scan-parser";
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

function karta(opts: {
  datum: string;
  cas: string;
  misto: string;
  href: string;
  nazev: string;
  anotace?: string;
  /** Celý vnitřek `kalTerminDatum`, když listing nese dva dny. */
  datumHtml?: string;
}): string {
  const anotace = opts.anotace
    ? `<div class="kalanotace">${opts.anotace}</div>`
    : "";
  const datumHtml =
    opts.datumHtml ?? `<strong>${opts.datum}</strong>`;
  return `
    <div class='kalendarAkceBox' ><div class='kalendar_akce' ><div class='kalendar_info foto' ><h2><a href='${opts.href}'><span class='kal-nazev'>${opts.nazev}</span></a></h2><div class="kalTerminDatum">${datumHtml}</div><div class="kalTerminCas">${opts.cas}</div><div class="kalTerminMisto">${opts.misto}</div>${anotace}</div></div></div>`;
}

function shell(vnitr: string): string {
  return `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://www.itrebon.cz/kalendar.html"/>
<title>Kalendář akcí | Informační servis města Třeboně</title>
</head><body>
<span>itrebon.cz</span>
${vnitr}
</body></html>`;
}

const HREF_CINOHRA =
  "https://www.itrebon.cz/kalendar/-buh-masakru-cinohra_20351.html";
const HREF_KONCERT =
  "https://www.itrebon.cz/kalendar/-koncert-cross-tower_20068.html";
const HREF_CELLO =
  "https://www.itrebon.cz/kalendar/-cello-republic_20007.html";
const HREF_SEX =
  "https://www.itrebon.cz/kalendar/-sex-na-vlnach_19441.html";
const HREF_CAVEMAN =
  "https://www.itrebon.cz/kalendar/-caveman-one-man-show_19896.html";
const HREF_PROHLIDKA =
  "https://www.itrebon.cz/kalendar/-komentovana-prohlidka-divadla-j-k-tyla_20465.html";
const HREF_TDF_NAZEV =
  "https://www.itrebon.cz/kalendar/-tdf-za-dvermi_19485.html";
const HREF_TDF_MISTO =
  "https://www.itrebon.cz/kalendar/-chlapi-radsi-lzou-cinohra_19442.html";
const HREF_NOCTURNA_ZIMNI =
  "https://www.itrebon.cz/kalendar/-trebonska-zimni-nocturna-smetana_20317.html";
const HREF_NOCTURNA =
  "https://www.itrebon.cz/kalendar/-trebonska-nocturna-abonent_20399.html";
const HREF_FOYER =
  "https://www.itrebon.cz/kalendar/-beauty-workshop_20332.html";
const HREF_GBU =
  "https://www.itrebon.cz/kalendar/-zvukova-lazen_19895.html";
const HREF_KRASA_ZENY =
  "https://www.itrebon.cz/kalendar/-krasa-zeny-vystava-fotografii_20053.html";
const HREF_VERNISAZ =
  "https://www.itrebon.cz/kalendar/-vernisaz-vystavy-krasa-zeny_20901.html";
const HREF_ZAHAJENI =
  "https://www.itrebon.cz/kalendar/-zahajeni-vystavy-krasa-zeny_20902.html";

const DATUM_KRASA_ZENY_ROZSAH =
  "<strong>13.10.2026</strong> - <strong>22.11.2026</strong>";

function jktZdroj() {
  return {
    url: "https://www.itrebon.cz/kalendar.html",
    rezimScanu: "HLIDANE_KOTVY" as const,
    hlidaneRedakcniPolozkaIds: [BRANA_JKT_REDAKCNI_POLOZKA_ID],
  };
}

function gbuZdroj() {
  return {
    url: "https://www.itrebon.cz/kalendar.html",
    rezimScanu: "HLIDANE_KOTVY" as const,
    hlidaneRedakcniPolozkaIds: [BRANA_GBU_REDAKCNI_POLOZKA_ID],
  };
}

function jazykJkt(kandidatMisto = BRANA_JKT_CO) {
  return sestavJazykBranyPoSparovani({
    polozka: "Divadlo J. K. Tyla",
    kandidatMisto,
    zdrojNazev: "Divadlo J. K. Tyla – program",
    jazykVerejny: vychoziJazykVerejnyProId(BRANA_JKT_REDAKCNI_POLOZKA_ID),
  });
}

function overZapis(kandidatNazev: string, popis: string): void {
  const jazyk = jazykJkt();
  const rozlozeni = rozlozAkci({
    mistoNeboTyp: jazyk.mistoNeboTyp,
    nazev: kandidatNazev,
    cas: "19:30",
    verejneCo: jazyk.verejneCo,
    verejneRozliseni: jazyk.verejneRozliseni ?? null,
  });
  assert(rozlozeni.typ === BRANA_JKT_CO, `${popis} CO`);
  assert(rozlozeni.misto === "", `${popis} KDE prázdné`);
  assert(rozlozeni.nazev === kandidatNazev, `${popis} název`);
}

function jediny(html: string, ocekavanyNazev: string, id: string): void {
  const k = parsovatItrebonDivadloJkTyla(html);
  assert(k.length === 1, `${ocekavanyNazev}: ${k.length}`);
  assert(k[0].nazev === ocekavanyNazev, `název ${k[0].nazev}`);
  assert(k[0].zdrojIdentita === `itrebon|${id}`, `id ${k[0].zdrojIdentita}`);
  assert(k[0].mistoNeboTyp === BRANA_JKT_CO, "místo kandidáta");
  overZapis(k[0].nazev, ocekavanyNazev);
}

const MIX = shell(
  [
    karta({
      datum: "18.9.2026",
      cas: "19:30-21:00",
      misto: "Divadlo J. K. Tyla ",
      href: HREF_CINOHRA,
      nazev: "Bůh masakru - činohra",
    }),
    karta({
      datum: "2.10.2026",
      cas: "19:00-20:30",
      misto: "Divadlo J. K. Tyla",
      href: HREF_KONCERT,
      nazev: "Koncert: Cross Tower",
    }),
    karta({
      datum: "20.10.2026",
      cas: "19:00-21:00",
      misto: "Divadlo J. K. Tyla",
      href: HREF_CELLO,
      nazev: "Cello Republic",
    }),
    karta({
      datum: "25.9.2026",
      cas: "19:30-21:50",
      misto: "Divadlo J. K. Tyla",
      href: HREF_SEX,
      nazev: "Sex na vlnách",
    }),
    karta({
      datum: "28.11.2026",
      cas: "19:30-21:00",
      misto: "Divadlo J. K. Tyla",
      href: HREF_CAVEMAN,
      nazev: "CAVEMAN- one man show",
    }),
    karta({
      datum: "18.8.2026",
      cas: "13:30-14:30",
      misto: "Divadlo J. K. Tyla",
      href: HREF_PROHLIDKA,
      nazev: "Komentovaná prohlídka Divadla J. K. Tyla",
    }),
    karta({
      datum: "3.9.2026",
      cas: "19:30-22:35",
      misto: "Divadlo J. K. Tyla - TDF_zadní lóže",
      href: HREF_TDF_NAZEV,
      nazev: "TDF: Za dveřmi kanceláří - Divadlo Kalich",
    }),
    karta({
      datum: "8.10.2026",
      cas: "19:30-21:00",
      misto: "Divadlo J. K. Tyla - TDF",
      href: HREF_TDF_MISTO,
      nazev: "Chlapi radši lžou - činohra",
    }),
    karta({
      datum: "15.10.2026",
      cas: "19:00-20:30",
      misto: "Divadlo J. K. Tyla",
      href: HREF_NOCTURNA_ZIMNI,
      nazev: "Třeboňská zimní nocturna: Smetana Reborn",
    }),
    karta({
      datum: "1.7.2027",
      cas: "19:00-20:30",
      misto: "Divadlo J. K. Tyla",
      href: HREF_NOCTURNA,
      nazev: "Třeboňská nocturna: Abonentní koncert",
    }),
    karta({
      datum: "29.8.2026",
      cas: "13:00-15:00",
      misto: "Foyer Divadla J.K. Tyla",
      href: HREF_FOYER,
      nazev: "Beauty Workshop a kurz líčení",
    }),
    karta({
      datum: "13.10.2026",
      datumHtml: DATUM_KRASA_ZENY_ROZSAH,
      cas: "00:00",
      misto: "Divadlo J. K. Tyla",
      href: HREF_KRASA_ZENY,
      nazev: "Krása ženy- výstava fotografií",
    }),
    karta({
      datum: "23.8.2026",
      cas: "18:00-20:00",
      misto: "Galerie buddhistického umění",
      href: HREF_GBU,
      nazev: "Zvuková lázeň",
      anotace: "Galerie buddhistického umění v Třeboni",
    }),
  ].join("\n"),
);

if (!process.argv.includes("--prescan")) {
  /* A–F přijetí */
  jediny(
    shell(
      karta({
        datum: "18.9.2026",
        cas: "19:30-21:00",
        misto: "Divadlo J. K. Tyla ",
        href: HREF_CINOHRA,
        nazev: "Bůh masakru - činohra",
      }),
    ),
    "Bůh masakru - činohra",
    "20351",
  );
  console.log("OK A činohra");

  jediny(
    shell(
      karta({
        datum: "2.10.2026",
        cas: "19:00-20:30",
        misto: "Divadlo J. K. Tyla",
        href: HREF_KONCERT,
        nazev: "Koncert: Cross Tower",
      }),
    ),
    "Koncert: Cross Tower",
    "20068",
  );
  console.log("OK B Koncert:");

  jediny(
    shell(
      karta({
        datum: "20.10.2026",
        cas: "19:00-21:00",
        misto: "Divadlo J. K. Tyla",
        href: HREF_CELLO,
        nazev: "Cello Republic",
      }),
    ),
    "Cello Republic",
    "20007",
  );
  console.log("OK C Cello Republic");

  jediny(
    shell(
      karta({
        datum: "25.9.2026",
        cas: "19:30-21:50",
        misto: "Divadlo J. K. Tyla",
        href: HREF_SEX,
        nazev: "Sex na vlnách",
        anotace: "Sex na vlnách je jednou z nejslavnějších komedií.",
      }),
    ),
    "Sex na vlnách",
    "19441",
  );
  console.log("OK D Sex na vlnách");

  jediny(
    shell(
      karta({
        datum: "28.11.2026",
        cas: "19:30-21:00",
        misto: "Divadlo J. K. Tyla",
        href: HREF_CAVEMAN,
        nazev: "CAVEMAN- one man show",
      }),
    ),
    "CAVEMAN- one man show",
    "19896",
  );
  console.log("OK E CAVEMAN");

  jediny(
    shell(
      karta({
        datum: "18.8.2026",
        cas: "13:30-14:30",
        misto: "Divadlo J. K. Tyla",
        href: HREF_PROHLIDKA,
        nazev: "Komentovaná prohlídka Divadla J. K. Tyla",
      }),
    ),
    "Komentovaná prohlídka Divadla J. K. Tyla",
    "20465",
  );
  console.log("OK F komentovaná prohlídka");

  /* G–L vyřazení */
  assert(
    klasifikovatItrebonJktKartu(
      "Divadlo J. K. Tyla",
      "TDF: Za dveřmi kanceláří - Divadlo Kalich",
    ) === "tdf",
    "G klasifikace TDF název",
  );
  assert(
    parsovatItrebonDivadloJkTyla(
      shell(
        karta({
          datum: "3.9.2026",
          cas: "19:30-22:35",
          misto: "Divadlo J. K. Tyla",
          href: HREF_TDF_NAZEV,
          nazev: "TDF: Za dveřmi kanceláří - Divadlo Kalich",
        }),
      ),
    ).length === 0,
    "G TDF název → 0",
  );
  console.log("OK G TDF název");

  assert(
    klasifikovatItrebonJktKartu(
      "Divadlo J. K. Tyla - TDF",
      "Chlapi radši lžou - činohra",
    ) === "tdf",
    "H klasifikace TDF místo",
  );
  assert(
    parsovatItrebonDivadloJkTyla(
      shell(
        karta({
          datum: "8.10.2026",
          cas: "19:30-21:00",
          misto: "Divadlo J. K. Tyla - TDF",
          href: HREF_TDF_MISTO,
          nazev: "Chlapi radši lžou - činohra",
        }),
      ),
    ).length === 0,
    "H TDF místo → 0",
  );
  console.log("OK H TDF místo");

  assert(
    klasifikovatItrebonJktKartu(
      "Divadlo J. K. Tyla",
      "Třeboňská zimní nocturna: Smetana Reborn",
    ) === "nocturna",
    "I klasifikace zimní nocturna",
  );
  assert(
    parsovatItrebonDivadloJkTyla(
      shell(
        karta({
          datum: "15.10.2026",
          cas: "19:00-20:30",
          misto: "Divadlo J. K. Tyla",
          href: HREF_NOCTURNA_ZIMNI,
          nazev: "Třeboňská zimní nocturna: Smetana Reborn",
        }),
      ),
    ).length === 0,
    "I zimní nocturna → 0",
  );
  console.log("OK I Třeboňská zimní nocturna");

  assert(
    klasifikovatItrebonJktKartu(
      "Divadlo J. K. Tyla",
      "Třeboňská nocturna: Abonentní koncert",
    ) === "nocturna",
    "J klasifikace nocturna",
  );
  assert(
    parsovatItrebonDivadloJkTyla(
      shell(
        karta({
          datum: "1.7.2027",
          cas: "19:00-20:30",
          misto: "Divadlo J. K. Tyla",
          href: HREF_NOCTURNA,
          nazev: "Třeboňská nocturna: Abonentní koncert",
        }),
      ),
    ).length === 0,
    "J nocturna → 0",
  );
  console.log("OK J Třeboňská nocturna");

  assert(
    klasifikovatItrebonJktKartu(
      "Foyer Divadla J.K. Tyla",
      "Beauty Workshop a kurz líčení",
    ) === "foyer",
    "K klasifikace foyer",
  );
  assert(
    parsovatItrebonDivadloJkTyla(
      shell(
        karta({
          datum: "29.8.2026",
          cas: "13:00-15:00",
          misto: "Foyer Divadla J.K. Tyla",
          href: HREF_FOYER,
          nazev: "Beauty Workshop a kurz líčení",
        }),
      ),
    ).length === 0,
    "K foyer → 0",
  );
  console.log("OK K foyer");

  assert(
    klasifikovatItrebonJktKartu(
      "Galerie buddhistického umění",
      "Zvuková lázeň",
    ) === "jine",
    "L klasifikace jiné místo",
  );
  assert(
    parsovatItrebonDivadloJkTyla(
      shell(
        karta({
          datum: "23.8.2026",
          cas: "18:00-20:00",
          misto: "Galerie buddhistického umění",
          href: HREF_GBU,
          nazev: "Zvuková lázeň",
        }),
      ),
    ).length === 0,
    "L jiné místo → 0",
  );
  console.log("OK L jiné místo");

  /* M název ze zdroje */
  {
    const k = parsovatItrebonDivadloJkTyla(
      shell(
        karta({
          datum: "2.10.2026",
          cas: "19:00-20:30",
          misto: "Divadlo J. K. Tyla",
          href: HREF_KONCERT,
          nazev: "Koncert: Cross Tower",
          anotace: "Popisek žánru, který se nesmí stát názvem.",
        }),
      ),
    );
    assert(k[0]?.nazev === "Koncert: Cross Tower", "M název");
    console.log("OK M zdrojový název");
  }

  /* N + O + P seed a veřejný zápis */
  {
    const seed = vychoziJazykVerejnyProId(BRANA_JKT_REDAKCNI_POLOZKA_ID);
    assert(seed?.co.rezim === "PEVNE" && seed.co.text === BRANA_JKT_CO, "N seed CO");
    assert(seed?.rozliseni.rezim === "NIC", "O seed KDE NIC");
    const radek = vytvoritVychoziRedakcniPoradi().find(
      (p) => p.id === BRANA_JKT_REDAKCNI_POLOZKA_ID,
    );
    assert(radek?.vyhled === "NE", "P Výhled NE");
    assert(radek?.pouzivat === "ANO", "P Používat ANO");
    assert(radek?.priorita === 5, "P priorita 5");
    const jazyk = jazykJkt();
    assert(jazyk.verejneCo === BRANA_JKT_CO, "N verejneCo");
    assert(jazyk.verejneRozliseni === null, "O verejneRozliseni null");
    console.log("OK N/O/P seed CO / KDE NIC / Výhled NE");
  }

  /* Q JKT parser nespustí GBU; R GBU dispatcher stále GBU */
  {
    const jkt = parsovatItrebonDivadloJkTyla(MIX);
    assert(jkt.length === 6, `Q JKT mix ${jkt.length}`);
    assert(
      jkt.every((x) => x.mistoNeboTyp === BRANA_JKT_CO),
      "Q jen JKT místo",
    );
    assert(
      !jkt.some((x) =>
        /Zvuková|TDF:|nocturna|Beauty|Chlapi|Krása ženy/i.test(x.nazev),
      ),
      "Q bez GBU/TDF/nocturna/foyer/dlouhodobé výstavy",
    );
    const gbu = parsovatUdalostiZeZdroje(MIX, "text/html");
    assert(gbu.length === 1, `R GBU mix ${gbu.length}`);
    assert(gbu[0].nazev === "Zvuková lázeň", `R GBU název ${gbu[0].nazev}`);
    assert(
      jeItrebonDivadloJkTylaZdroj(jktZdroj()),
      "Q JKT zdroj detekován",
    );
    assert(
      !jeItrebonDivadloJkTylaZdroj(gbuZdroj()),
      "R GBU zdroj není JKT větev",
    );
    assert(
      jeItrebonGalerieBuddhistickehoUmeniZdrojUrl(gbuZdroj().url),
      "R GBU URL lock platí",
    );
    assert(
      jeItrebonGalerieBuddhistickehoUmeniZdrojUrl(jktZdroj().url),
      "Q stejná URL pořád lockuje iTřeboň stránkování",
    );
    console.log("OK Q/R JKT větev ≠ GBU parser");
  }

  /* S identita / dedup */
  {
    const html = shell(
      karta({
        datum: "20.10.2026",
        cas: "19:00-21:00",
        misto: "Divadlo J. K. Tyla",
        href: HREF_CELLO,
        nazev: "Cello Republic",
      }),
    );
    const k = parsovatItrebonDivadloJkTyla(html);
    assert(k[0].zdrojIdentita === "itrebon|20007", "S identita");
    const jazyk = jazykJkt();
    const vstup = (kandidat: typeof k[0]): BranaScanAutomatickaUdalostVstup => ({
      redakcniPolozkaId: BRANA_JKT_REDAKCNI_POLOZKA_ID,
      datumOd: kandidat.datumOd,
      datumDo: kandidat.datumDo,
      cas: kandidat.cas,
      mistoNeboTyp: jazyk.mistoNeboTyp,
      nazev: kandidat.nazev,
      zdrojIdentita: kandidat.zdrojIdentita,
      verejneCo: jazyk.verejneCo,
      verejneRozliseni: jazyk.verejneRozliseni ?? null,
    });
    const prvni = aplikovatScanKandidatyNaUdalosti(
      [],
      [vstup(k[0])],
      "2026-08-18",
      jeUdalostCelaMinula,
    );
    assert(prvni.vysledek.pridano === 1, "S první zápis");
    const druhe = aplikovatScanKandidatyNaUdalosti(
      prvni.udalosti,
      [vstup(k[0])],
      "2026-08-18",
      jeUdalostCelaMinula,
    );
    assert(druhe.vysledek.pridano === 0, "S druhý scan 0");
    assert(druhe.vysledek.jizExistuje === 1, "S již existuje");
    assert(druhe.udalosti.length === 1, "S stále 1 karta");
    const gbuVstup: BranaScanAutomatickaUdalostVstup = {
      redakcniPolozkaId: BRANA_GBU_REDAKCNI_POLOZKA_ID,
      datumOd: "2026-08-23",
      datumDo: "2026-08-23",
      cas: "18:00",
      mistoNeboTyp: "Zvuková lázeň Galerie buddhistického um.",
      nazev: "Zvuková lázeň",
      zdrojIdentita: "itrebon|19895",
      verejneCo: "Zvuková lázeň",
      verejneRozliseni: "Galerie buddhistického um.",
    };
    const mixIdentit = aplikovatScanKandidatyNaUdalosti(
      prvni.udalosti,
      [gbuVstup],
      "2026-08-18",
      jeUdalostCelaMinula,
    );
    assert(mixIdentit.udalosti.length === 2, "S GBU + JKT dvě karty");
    assert(
      mixIdentit.udalosti.some(
        (u) => u.redakcniPolozkaId === BRANA_JKT_REDAKCNI_POLOZKA_ID,
      ) &&
        mixIdentit.udalosti.some(
          (u) => u.redakcniPolozkaId === BRANA_GBU_REDAKCNI_POLOZKA_ID,
        ),
      "S kotvy se nemíchají",
    );
    const jktUdalost = prvni.udalosti[0];
    const gbuUdalost = mixIdentit.udalosti.find(
      (u) => u.redakcniPolozkaId === BRANA_GBU_REDAKCNI_POLOZKA_ID,
    );
    assert(jktUdalost.redakcniPolozkaId, "S JKT kotva");
    assert(gbuUdalost?.redakcniPolozkaId, "S GBU kotva");
    const klicJkt = vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: jktUdalost.redakcniPolozkaId,
      datumOd: jktUdalost.datumOd,
      cas: jktUdalost.cas,
      nazev: jktUdalost.nazev,
    });
    const klicGbu = vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: gbuUdalost.redakcniPolozkaId,
      datumOd: gbuUdalost.datumOd,
      cas: gbuUdalost.cas,
      nazev: gbuUdalost.nazev,
    });
    assert(klicJkt !== klicGbu, "S scanKlic různý");
    console.log("OK S identita / dedup");
  }

  /* Ownership + stránkování */
  {
    const poradi = vytvoritVychoziRedakcniPoradi();
    const r = sparovatVlastnictvimHlidaneKotvy(
      poradi,
      [BRANA_JKT_REDAKCNI_POLOZKA_ID],
      BRANA_JKT_REDAKCNI_POLOZKA_ID,
    );
    assert(r.ok && r.redakcniPolozkaId === BRANA_JKT_REDAKCNI_POLOZKA_ID, "ownership JKT");
    const urlky = sestavItrebonKalendarUrlky(
      "https://www.itrebon.cz/kalendar.html",
    );
    assert(urlky.length === 12, "stránkování 12");
    console.log("OK ownership + stránkování");
  }

  /* Prázdný název → 0 */
  {
    const k = parsovatItrebonDivadloJkTyla(
      shell(
        karta({
          datum: "1.9.2026",
          cas: "19:00-20:00",
          misto: "Divadlo J. K. Tyla",
          href: "https://www.itrebon.cz/kalendar/-_1.html",
          nazev: "",
          anotace: "Anotace se nesmí stát názvem.",
        }),
      ),
    );
    assert(k.length === 0, "prázdný kal-nazev → 0");
    console.log("OK prázdný název → 0");
  }

  /* Dlouhodobá výstava / jednorázová vernisáž */
  {
    assert(
      klasifikovatItrebonJktKartu(
        "Divadlo J. K. Tyla",
        "Krása ženy- výstava fotografií",
        "13.10.2026 - 22.11.2026",
      ) === "vystava",
      "T klasifikace Krása ženy rozsah",
    );
    const krasa = parsovatItrebonDivadloJkTyla(
      shell(
        karta({
          datum: "13.10.2026",
          datumHtml: DATUM_KRASA_ZENY_ROZSAH,
          cas: "00:00",
          misto: "Divadlo J. K. Tyla",
          href: HREF_KRASA_ZENY,
          nazev: "Krása ženy- výstava fotografií",
        }),
      ),
    );
    assert(krasa.length === 0, "T Krása ženy dlouhodobý rozsah → 0");
    console.log("OK T Krása ženy dlouhodobá výstava → 0");
  }

  {
    assert(
      klasifikovatItrebonJktKartu(
        "Divadlo J. K. Tyla",
        "Bůh masakru - činohra",
        "18.9.2026 - 19.9.2026",
      ) === "prijmout",
      "U vícedenní činohra není vystava",
    );
    jediny(
      shell(
        karta({
          datum: "18.9.2026",
          datumHtml:
            "<strong>18.9.2026</strong> - <strong>19.9.2026</strong>",
          cas: "19:30-21:00",
          misto: "Divadlo J. K. Tyla",
          href: HREF_CINOHRA,
          nazev: "Bůh masakru - činohra",
        }),
      ),
      "Bůh masakru - činohra",
      "20351",
    );
    console.log("OK U vícedenní karta bez slova výstava → 1");
  }

  {
    const prvniDen = parsovatItrebonDivadloJkTyla(
      shell(
        karta({
          datum: "13.10.2026",
          datumHtml:
            "<strong>13.10.2026</strong> – <strong>22.11.2026</strong>",
          cas: "19:00-20:00",
          misto: "Divadlo J. K. Tyla",
          href: HREF_KRASA_ZENY,
          nazev: "Krása ženy- výstava fotografií",
        }),
      ),
    );
    assert(prvniDen.length === 0, "první den rozsahu výstavy ≠ vernisáž → 0");
    jediny(
      shell(
        karta({
          datum: "13.10.2026",
          cas: "17:00-19:00",
          misto: "Divadlo J. K. Tyla",
          href: HREF_KRASA_ZENY,
          nazev: "Krása ženy- výstava fotografií",
        }),
      ),
      "Krása ženy- výstava fotografií",
      "20053",
    );
    console.log("OK jednodenní výstava bez rozsahu není automaticky 0");
  }

  {
    assert(
      jeItrebonJktJednorazovaVernisazNazev("Vernisáž výstavy Krása ženy"),
      "V prefix Vernisáž",
    );
    jediny(
      shell(
        karta({
          datum: "13.10.2026",
          cas: "17:00-19:00",
          misto: "Divadlo J. K. Tyla",
          href: HREF_VERNISAZ,
          nazev: "Vernisáž výstavy Krása ženy",
        }),
      ),
      "Vernisáž výstavy Krása ženy",
      "20901",
    );
    assert(
      klasifikovatItrebonJktKartu(
        "Divadlo J. K. Tyla",
        "Vernisáž výstava fotografií Krása ženy",
        "13.10.2026 - 22.11.2026",
      ) === "prijmout",
      "V prefix Vernisáž + rozsah není vystava",
    );
    console.log("OK V jednorázová Vernisáž → 1");
  }

  {
    assert(
      jeItrebonJktJednorazovaVernisazNazev(
        "Zahájení výstavy Krása ženy",
      ),
      "W prefix Zahájení výstavy",
    );
    jediny(
      shell(
        karta({
          datum: "13.10.2026",
          cas: "17:00-19:00",
          misto: "Divadlo J. K. Tyla",
          href: HREF_ZAHAJENI,
          nazev: "Zahájení výstavy Krása ženy",
        }),
      ),
      "Zahájení výstavy Krása ženy",
      "20902",
    );
    console.log("OK W jednorázové Zahájení výstavy → 1");
  }

  {
    jediny(
      shell(
        karta({
          datum: "18.9.2026",
          cas: "00:00",
          misto: "Divadlo J. K. Tyla",
          href: HREF_CINOHRA,
          nazev: "Bůh masakru - činohra",
        }),
      ),
      "Bůh masakru - činohra",
      "20351",
    );
    console.log("OK X čas 00:00 není obecné vyřazení");
  }

  console.log("\nVšechny kontroly JKT parseru prošly.");
}

if (process.argv.includes("--prescan")) {
  spustitJktPrescan().catch((chyba: unknown) => {
    console.error(chyba);
    process.exit(1);
  });
}

async function spustitJktPrescan(): Promise<void> {
  const urlky = sestavItrebonKalendarUrlky(
    "https://www.itrebon.cz/kalendar.html",
  );
  const prijate: ReturnType<typeof parsovatItrebonDivadloJkTyla> = [];
  const tdf: string[][] = [];
  const nocturna: string[][] = [];
  const foyer: string[][] = [];
  const vystava: string[][] = [];
  const jine: string[][] = [];
  const videne = new Set<string>();

  for (const url of urlky) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BranaReadOnly/1.0)",
        Accept: "text/html",
      },
    });
    const html = await res.text();
    prijate.push(...parsovatItrebonDivadloJkTyla(html));
    for (const stopa of vytahnoutJktRelevantniStopu(html)) {
      if (videne.has(stopa.id)) {
        continue;
      }
      videne.add(stopa.id);
      const druh = klasifikovatItrebonJktKartu(
        stopa.misto,
        stopa.nazev,
        stopa.datum,
      );
      const radek = [
        stopa.datum,
        stopa.cas,
        stopa.nazev,
        stopa.misto,
        `itrebon|${stopa.id}`,
      ];
      if (druh === "tdf") {
        tdf.push(radek);
      } else if (druh === "nocturna") {
        nocturna.push(radek);
      } else if (druh === "foyer") {
        foyer.push(radek);
      } else if (druh === "vystava") {
        vystava.push(radek);
      } else if (druh === "jine") {
        jine.push(radek);
      }
    }
  }

  const jedinecnePrijate = new Map<string, (typeof prijate)[0]>();
  for (const k of prijate) {
    const id = k.zdrojIdentita ?? k.nazev;
    if (!jedinecnePrijate.has(id)) {
      jedinecnePrijate.set(id, k);
    }
  }
  const jazyk = jazykJkt();
  console.log("\n=== READ-ONLY PŘEDSCAN JKT ===");
  console.log(`PŘIJATO: ${jedinecnePrijate.size}`);
  for (const k of jedinecnePrijate.values()) {
    console.log(
      [
        k.datumOd,
        k.cas || "—",
        k.nazev,
        k.mistoNeboTyp,
        k.zdrojIdentita,
        `CO=${jazyk.verejneCo}`,
        `KDE=${jazyk.verejneRozliseni === null ? "null" : jazyk.verejneRozliseni}`,
        BRANA_JKT_REDAKCNI_POLOZKA_ID,
      ].join(" | "),
    );
  }
  console.log(`\nTDF: ${tdf.length}`);
  for (const r of tdf) {
    console.log(r.join(" | "));
  }
  console.log(`\nNOCTURNA: ${nocturna.length}`);
  for (const r of nocturna) {
    console.log(r.join(" | "));
  }
  console.log(`\nFOYER: ${foyer.length}`);
  for (const r of foyer) {
    console.log(r.join(" | "));
  }
  console.log(`\nDLOUHODOBÁ VÝSTAVA: ${vystava.length}`);
  for (const r of vystava) {
    console.log(r.join(" | "));
  }
  console.log(`\nJINÉ: ${jine.length}`);
  for (const r of jine) {
    console.log(r.join(" | "));
  }
  console.log(
    `\nETALON 20/2/6/1/1/0 → živě ${jedinecnePrijate.size}/${tdf.length}/${nocturna.length}/${foyer.length}/${vystava.length}/${jine.length}`,
  );
}

function vytahnoutJktRelevantniStopu(html: string): Array<{
  nazev: string;
  misto: string;
  datum: string;
  cas: string;
  id: string;
}> {
  const out: Array<{
    nazev: string;
    misto: string;
    datum: string;
    cas: string;
    id: string;
  }> = [];
  const karty = [
    ...html.matchAll(
      /<div[^>]*\bclass=["'][^"']*\bkalendarAkceBox\b[^"']*["'][^>]*>[\s\S]*?(?=<div[^>]*\bclass=["'][^"']*\bkalendarAkceBox\b|<\/body>|$)/gi,
    ),
  ];
  for (const kartaMatch of karty) {
    const karta = kartaMatch[0];
    const misto = (karta.match(
      /class=["'][^"']*\bkalTerminMisto\b[^"']*["'][^>]*>([\s\S]*?)</i,
    )?.[1] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!/Tyla|Týla|foyer/i.test(misto)) {
      continue;
    }
    const nazev = (karta.match(
      /class=["'][^"']*\bkal-nazev\b[^"']*["'][^>]*>([\s\S]*?)</i,
    )?.[1] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const datum = (karta.match(
      /class=["'][^"']*\bkalTerminDatum\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    )?.[1] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const cas = (karta.match(
      /class=["'][^"']*\bkalTerminCas\b[^"']*["'][^>]*>([\s\S]*?)</i,
    )?.[1] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const id = karta.match(/\/kalendar\/[^"'?#]*_(\d+)\.html/i)?.[1] ?? "";
    out.push({ nazev, misto, datum, cas, id });
  }
  return out;
}
