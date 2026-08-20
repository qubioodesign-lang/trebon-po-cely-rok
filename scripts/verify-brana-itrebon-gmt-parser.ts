/**
 * Úzký sběr iTřeboň → Galerie města Třeboň (Vernisáž / Komentovaná prohlídka).
 * Spuštění: npx tsx scripts/verify-brana-itrebon-gmt-parser.ts
 * READ-ONLY: fixture HTML + veřejný výpis, žádný Blob / ostrý scan / admin zdroj.
 */

import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  BRANA_JKT_REDAKCNI_POLOZKA_ID,
  jeItrebonDivadloJkTylaZdroj,
} from "../src/lib/brana/admin/divadlo-jk-tyla";
import {
  BRANA_GALERIE_MESTA_TREBON_CO_KOMENTOVANA,
  BRANA_GALERIE_MESTA_TREBON_CO_VERNISAZ,
  BRANA_GALERIE_MESTA_TREBON_KATALOG_ID,
  BRANA_GALERIE_MESTA_TREBON_KDE,
  BRANA_GALERIE_MESTA_TREBON_POLOZKA,
  jeItrebonGalerieMestaTrebonJednorazovyNazev,
  jeItrebonGalerieMestaTrebonZdroj,
  najitGalerieMestaTrebonKotvuId,
  parsovatItrebonGalerieMestaTrebon,
  sestavGalerieMestaTrebonZapisPoSparovani,
} from "../src/lib/brana/admin/galerie-mesta-trebon";
import { BRANA_GBU_REDAKCNI_POLOZKA_ID } from "../src/lib/brana/admin/gbu-titulek";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  jeUdalostCelaMinula,
  vytvoritScanKlicAutomatickeUdalosti,
} from "../src/lib/brana/admin/konkretni-udalost";
import {
  pridatNesparovaneDoNezarazenych,
  vychoziNezarazeneDokument,
} from "../src/lib/brana/admin/nezarazene";
import {
  vytvoritVychoziRedakcniPoradi,
  type BranaRedakcniPolozkaStav,
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
}): string {
  return `
<div class="kalendarAkceBox">
  <div class="kalendar_levy">
    <div class="kalTerminDatum">${opts.datum}</div>
    <div class="kalTerminCas">${opts.cas}</div>
    <div class="kalTerminMisto">${opts.misto}</div>
  </div>
  <div class="kalendar_info">
    <h2 class="kal-nazev"><a href="${opts.href}">${opts.nazev}</a></h2>
    <div class="kalanotace">${opts.anotace ?? ""}</div>
  </div>
</div>`;
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

const HREF_AMARCORD =
  "https://www.itrebon.cz/kalendar/-vernisaz-vystavy-amarcord-s-prof-vladimirem-franzem_20304.html";
const HREF_STORM_VERNISAZ =
  "https://www.itrebon.cz/kalendar/-vernisaz-vystavy-vecny-navrat-frantisek-storm_19508.html";
const HREF_KOMENTOVANA_K =
  "https://www.itrebon.cz/kalendar/-komentovana-prohlidka-s-frantiskem-stormem-k-vystave_19750.html";
const HREF_KOMENTOVANA =
  "https://www.itrebon.cz/kalendar/-komentovana-prohlidka-s-frantiskem-stormem_20093.html";
const HREF_ODKAZ =
  "https://www.itrebon.cz/kalendar/-vystava-trebonsky-odkaz_18511.html";
const HREF_STORM_DEN =
  "https://www.itrebon.cz/kalendar/-vecny-navrat-frantisek-storm_19665.html";
const HREF_POHLAZENI =
  "https://www.itrebon.cz/kalendar/-vystava-pohlazeni-erotikou_19080.html";
const HREF_GBU =
  "https://www.itrebon.cz/kalendar/-zvukova-lazen_19895.html";
const HREF_105 =
  "https://www.itrebon.cz/kalendar/-vystava_19900.html";
const HREF_ZAHAJENI =
  "https://www.itrebon.cz/kalendar/-zahajeni-vystavy_19901.html";

const FIXTURE = shell(
  [
    karta({
      datum: "19.8.2026",
      cas: "17:00-19:00",
      misto: "Galerie města Třeboň",
      href: HREF_AMARCORD,
      nazev: "Vernisáž výstavy Amarcord s prof. Vladimírem Franzem",
      anotace: "Srdečně Vás zveme na vernisáž výstavy prof. Vladimíra Franze",
    }),
    karta({
      datum: "10.4.2026",
      cas: "17:00-19:00",
      misto: "Galerie města Třeboň",
      href: HREF_STORM_VERNISAZ,
      nazev: "Vernisáž výstavy Věčný návrat - František Štorm",
    }),
    karta({
      datum: "23.5.2026",
      cas: "13:00-14:00",
      misto: "Galerie města Třeboň",
      href: HREF_KOMENTOVANA_K,
      nazev: "Komentovaná prohlídka s Františkem Štormem k výstavě",
    }),
    karta({
      datum: "8.7.2026",
      cas: "17:00-18:00",
      misto: "Galerie města Třeboň",
      href: HREF_KOMENTOVANA,
      nazev: "Komentovaná prohlídka s Františkem Štormem",
    }),
    karta({
      datum: "5.2.2025",
      cas: "13:00-16:00",
      misto: "Galerie města Třeboň",
      href: HREF_ODKAZ,
      nazev: "Výstava Třeboňský odkaz",
    }),
    karta({
      datum: "15.4.2026",
      cas: "10:00 - 16:00",
      misto: "Galerie města Třeboň",
      href: HREF_STORM_DEN,
      nazev: "Věčný návrat: František Štorm",
    }),
    karta({
      datum: "1.8.2025",
      cas: "16:00-17:30",
      misto: "Galerie města Třeboň",
      href: HREF_POHLAZENI,
      nazev: "Výstava Pohlazení erotikou",
    }),
    karta({
      datum: "12.9.2026",
      cas: "17:00-19:00",
      misto: "Galerie města Třeboň",
      href: HREF_ZAHAJENI,
      nazev: "Zahájení výstavy Něco",
    }),
    karta({
      datum: "23.8.2026",
      cas: "18:00-20:00",
      misto: "Galerie buddhistického umění",
      href: HREF_GBU,
      nazev: "Zvuková lázeň",
    }),
    karta({
      datum: "12.9.2026 - 1.11.2026",
      cas: "",
      misto: "Galerie 105, Masarykovo nám.105",
      href: HREF_105,
      nazev: "Vernisáž výstavy v Galerii 105",
    }),
  ].join("\n"),
);

function gmtZdroj() {
  return {
    url: "https://www.itrebon.cz/kalendar.html",
    rezimScanu: "HLIDANE_KOTVY",
    hlidaneRedakcniPolozkaIds: [BRANA_GALERIE_MESTA_TREBON_KATALOG_ID],
  };
}

function gbuZdroj() {
  return {
    url: "https://www.itrebon.cz/kalendar.html",
    rezimScanu: "HLIDANE_KOTVY",
    hlidaneRedakcniPolozkaIds: [BRANA_GBU_REDAKCNI_POLOZKA_ID],
  };
}

function jktZdroj() {
  return {
    url: "https://www.itrebon.cz/kalendar.html",
    rezimScanu: "HLIDANE_KOTVY",
    hlidaneRedakcniPolozkaIds: [BRANA_JKT_REDAKCNI_POLOZKA_ID],
  };
}

function jazykGmt() {
  return sestavJazykBranyPoSparovani({
    polozka: BRANA_GALERIE_MESTA_TREBON_POLOZKA,
    kandidatMisto: BRANA_GALERIE_MESTA_TREBON_POLOZKA,
    zdrojNazev: "iTřeboň – Galerie města Třeboň",
    jazykVerejny: null,
  });
}

function redakceSGmt(
  volby?: { pouzivat?: "ANO" | "NE"; druhaKotva?: boolean; jinySlot?: boolean },
): BranaRedakcniPolozkaStav[] {
  const pouzivat = volby?.pouzivat ?? "ANO";
  if (volby?.jinySlot) {
    return vytvoritVychoziRedakcniPoradi().map((p) =>
      p.id === "plaz-u-rybnika-svet"
        ? {
            ...p,
            polozka: BRANA_GALERIE_MESTA_TREBON_POLOZKA,
            pouzivat: "ANO",
          }
        : p,
    );
  }
  const polozky = vytvoritVychoziRedakcniPoradi().map((p) =>
    p.id === BRANA_GALERIE_MESTA_TREBON_KATALOG_ID
      ? { ...p, pouzivat }
      : p,
  );
  if (!volby?.druhaKotva) {
    return polozky;
  }
  return polozky.map((p) =>
    p.id === "muzeum-mesta-trebon"
      ? {
          ...p,
          polozka: BRANA_GALERIE_MESTA_TREBON_POLOZKA,
          pouzivat: "ANO",
        }
      : p,
  );
}

function ownership(
  polozky: readonly BranaRedakcniPolozkaStav[],
  zdroj = gmtZdroj(),
): { ok: true; redakcniPolozkaId: string } | { ok: false } {
  if (!jeItrebonGalerieMestaTrebonZdroj(zdroj)) {
    return { ok: false };
  }
  const kotva = najitGalerieMestaTrebonKotvuId(polozky);
  if (!kotva) {
    return { ok: false };
  }
  return sparovatVlastnictvimHlidaneKotvy(polozky, [kotva], kotva);
}

/* --- URL lock + stránkování + větve --- */
{
  assert(jeItrebonGalerieMestaTrebonZdroj(gmtZdroj()), "GMT zdroj");
  assert(!jeItrebonGalerieMestaTrebonZdroj(gbuZdroj()), "GBU zdroj není GMT");
  assert(!jeItrebonGalerieMestaTrebonZdroj(jktZdroj()), "JKT zdroj není GMT");
  assert(
    !jeItrebonGalerieMestaTrebonZdroj({
      url: "https://www.itrebon.cz/kalendar.html",
      rezimScanu: "HLIDANE_KOTVY",
      hlidaneRedakcniPolozkaIds: [
        BRANA_GALERIE_MESTA_TREBON_KATALOG_ID,
        BRANA_GBU_REDAKCNI_POLOZKA_ID,
      ],
    }),
    "GMT+GBU → ne GMT větev",
  );
  assert(!jeItrebonDivadloJkTylaZdroj(gmtZdroj()), "GMT není JKT");
  assert(
    jeItrebonGalerieBuddhistickehoUmeniZdrojUrl(gmtZdroj().url),
    "stejná URL dál lockuje iTřeboň stránkování",
  );
  const urlky = sestavItrebonKalendarUrlky(gmtZdroj().url);
  assert(urlky.length === 12, `stránek ${urlky.length}`);
  console.log("OK URL lock + větve oddělené od GBU/JKT");
}

const kandidati = parsovatItrebonGalerieMestaTrebon(FIXTURE);

/* Historické ANO */
{
  const ids = kandidati.map((k) => k.zdrojIdentita).sort();
  assert(ids.length === 4, `ANO karet ${ids.length}: ${ids.join(",")}`);
  const amarcord = kandidati.find((k) => k.zdrojIdentita === "itrebon|20304");
  assert(amarcord !== undefined, "AMARCORD");
  assert(amarcord.datumOd === "2026-08-19", `AMARCORD datum ${amarcord.datumOd}`);
  assert(amarcord.cas === "17:00", `AMARCORD čas ${amarcord.cas}`);
  assert(
    amarcord.nazev ===
      "Vernisáž výstavy Amarcord s prof. Vladimírem Franzem",
    "AMARCORD název",
  );
  assert(
    amarcord.mistoNeboTyp === BRANA_GALERIE_MESTA_TREBON_POLOZKA,
    "AMARCORD místo",
  );
  const storm = kandidati.find((k) => k.zdrojIdentita === "itrebon|19508");
  assert(storm?.datumOd === "2026-04-10" && storm.cas === "17:00", "Štorm vernisáž");
  const kom1 = kandidati.find((k) => k.zdrojIdentita === "itrebon|19750");
  assert(kom1?.datumOd === "2026-05-23" && kom1.cas === "13:00", "komentovaná k výstavě");
  const kom2 = kandidati.find((k) => k.zdrojIdentita === "itrebon|20093");
  assert(kom2?.datumOd === "2026-07-08" && kom2.cas === "17:00", "komentovaná");
  console.log("OK historické ANO: 4 jednorázové karty včetně AMARCORD");
}

/* Historické NE */
{
  assert(
    !kandidati.some((k) => k.zdrojIdentita === "itrebon|18511"),
    "Odkaz denní karta → 0",
  );
  assert(
    !kandidati.some((k) => k.zdrojIdentita === "itrebon|19665"),
    "Štorm denní výstava → 0",
  );
  assert(
    !kandidati.some((k) => k.zdrojIdentita === "itrebon|19080"),
    "Pohlazení erotikou → 0",
  );
  assert(
    !kandidati.some((k) => k.zdrojIdentita === "itrebon|19901"),
    "Zahájení výstavy → 0",
  );
  assert(
    !kandidati.some((k) => k.zdrojIdentita === "itrebon|19895"),
    "GBU → 0",
  );
  assert(
    !kandidati.some((k) => k.zdrojIdentita === "itrebon|19900"),
    "Galerie 105 i s Vernisáž → 0",
  );
  assert(
    !jeItrebonGalerieMestaTrebonJednorazovyNazev("Výstava Třeboňský odkaz"),
    "prefix Výstava není jednorázový",
  );
  console.log("OK historické NE: výstavy / GBU / 105 / Zahájení výstavy");
}

/* GBU dispatcher stejný HTML nebere GMT */
{
  const gbu = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  assert(
    !gbu.some((k) => k.mistoNeboTyp === BRANA_GALERIE_MESTA_TREBON_POLOZKA),
    "GBU parser GMT místo → 0",
  );
  assert(
    gbu.some((k) => k.zdrojIdentita === "itrebon|19895"),
    "GBU parser dál bere GBU kartu",
  );
  console.log("OK GBU parser GMT ignoruje, GBU kartu nechá");
}

/* Veřejný jazyk: CO z typu akce, KDE Galerie města */
{
  const jazyk = jazykGmt();
  const vernisaz = sestavGalerieMestaTrebonZapisPoSparovani({
    surovyNazev: "Vernisáž výstavy Amarcord s prof. Vladimírem Franzem",
    jazyk,
  });
  assert(
    vernisaz.verejneCo === BRANA_GALERIE_MESTA_TREBON_CO_VERNISAZ,
    `CO vernisáž ${vernisaz.verejneCo}`,
  );
  assert(
    vernisaz.verejneRozliseni === BRANA_GALERIE_MESTA_TREBON_KDE,
    `KDE ${vernisaz.verejneRozliseni}`,
  );
  const renderV = rozlozAkci({
    mistoNeboTyp: vernisaz.mistoNeboTyp,
    nazev: vernisaz.nazev,
    cas: "17:00",
    verejneCo: vernisaz.verejneCo ?? null,
    verejneRozliseni: vernisaz.verejneRozliseni ?? null,
  });
  assert(renderV.typ === BRANA_GALERIE_MESTA_TREBON_CO_VERNISAZ, "render CO Vernisáž");
  assert(renderV.misto === BRANA_GALERIE_MESTA_TREBON_KDE, "render KDE");
  assert(
    renderV.nazev === "výstavy Amarcord s prof. Vladimírem Franzem",
    `render název ${renderV.nazev}`,
  );

  const kom = sestavGalerieMestaTrebonZapisPoSparovani({
    surovyNazev: "Komentovaná prohlídka s Františkem Štormem",
    jazyk,
  });
  assert(
    kom.verejneCo === BRANA_GALERIE_MESTA_TREBON_CO_KOMENTOVANA,
    `CO komentovaná ${kom.verejneCo}`,
  );
  assert(kom.verejneRozliseni === BRANA_GALERIE_MESTA_TREBON_KDE, "KDE komentovaná");
  const renderK = rozlozAkci({
    mistoNeboTyp: kom.mistoNeboTyp,
    nazev: kom.nazev,
    cas: "17:00",
    verejneCo: kom.verejneCo ?? null,
    verejneRozliseni: kom.verejneRozliseni ?? null,
  });
  assert(
    renderK.typ === BRANA_GALERIE_MESTA_TREBON_CO_KOMENTOVANA,
    "render CO Komentovaná prohlídka",
  );
  assert(renderK.misto === BRANA_GALERIE_MESTA_TREBON_KDE, "render KDE komentovaná");
  assert(
    vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: BRANA_GALERIE_MESTA_TREBON_KATALOG_ID,
      datumOd: "2026-08-19",
      cas: "17:00",
      nazev: vernisaz.nazevProScanKlic ?? vernisaz.nazev,
    }) ===
      vytvoritScanKlicAutomatickeUdalosti({
        redakcniPolozkaId: BRANA_GALERIE_MESTA_TREBON_KATALOG_ID,
        datumOd: "2026-08-19",
        cas: "17:00",
        nazev: "Vernisáž výstavy Amarcord s prof. Vladimírem Franzem",
      }),
    "scanKlic ze surového názvu",
  );
  console.log("OK veřejný jazyk: Vernisáž i Komentovaná prohlídka + KDE Galerie města");
}

/* Ownership fail-closed */
{
  const seed = vytvoritVychoziRedakcniPoradi();
  assert(najitGalerieMestaTrebonKotvuId(seed) === null, "seed Používat NE → 0");
  assert(!ownership(seed).ok, "0 ANO → 0 zápisů");

  const katalogAno = redakceSGmt();
  assert(
    najitGalerieMestaTrebonKotvuId(katalogAno) ===
      BRANA_GALERIE_MESTA_TREBON_KATALOG_ID,
    "1× katalog ANO",
  );
  const s1 = ownership(katalogAno);
  assert(
    s1.ok && s1.redakcniPolozkaId === BRANA_GALERIE_MESTA_TREBON_KATALOG_ID,
    "1× → katalogová kotva",
  );

  const jiny = redakceSGmt({ jinySlot: true });
  assert(
    najitGalerieMestaTrebonKotvuId(jiny) === "plaz-u-rybnika-svet",
    "1× ANO na jiném id podle Položky",
  );
  const sJiny = ownership(jiny);
  assert(
    sJiny.ok && sJiny.redakcniPolozkaId === "plaz-u-rybnika-svet",
    "ownership nejde přes interní id galerie-mesta-trebon",
  );

  assert(najitGalerieMestaTrebonKotvuId(redakceSGmt({ druhaKotva: true })) === null, "2+ → 0");
  assert(!ownership(redakceSGmt({ druhaKotva: true })).ok, "2+ ownership ne");
  assert(!ownership(katalogAno, gbuZdroj()).ok, "GBU zdroj → 0");
  assert(!ownership(katalogAno, jktZdroj()).ok, "JKT zdroj → 0");

  const inbox = pridatNesparovaneDoNezarazenych(vychoziNezarazeneDokument(), {
    zdrojId: "gmt-test",
    zdrojNazev: "iTřeboň GMT",
    nesparovane: [],
    noveId: () => "x",
  });
  assert(inbox.otevrene.length === 0, "0 Nezařazených");

  const zapis = sestavGalerieMestaTrebonZapisPoSparovani({
    surovyNazev: "Vernisáž výstavy Amarcord s prof. Vladimírem Franzem",
    jazyk: jazykGmt(),
  });
  const vstup: BranaScanAutomatickaUdalostVstup = {
    redakcniPolozkaId: BRANA_GALERIE_MESTA_TREBON_KATALOG_ID,
    datumOd: "2026-08-19",
    datumDo: "2026-08-19",
    cas: "17:00",
    mistoNeboTyp: zapis.mistoNeboTyp,
    nazev: zapis.nazev,
    zdrojIdentita: "itrebon|20304",
    nazevProScanKlic: zapis.nazevProScanKlic,
    verejneCo: zapis.verejneCo,
    verejneRozliseni: zapis.verejneRozliseni ?? null,
  };
  const ceka = aplikovatScanKandidatyNaUdalosti(
    [],
    [vstup],
    "2026-08-19",
    jeUdalostCelaMinula,
  );
  assert(ceka.vysledek.pridano === 1, "AMARCORD → CEKA");
  console.log("OK ownership: 1× ANO Položka; 0/2+ → 0; ne id slotu");
}

async function overZivyVypis(): Promise<void> {
  const headers = {
    "User-Agent": "Mozilla/5.0 BranaVerifyGmt/1.0",
    Accept: "text/html",
  };
  async function nacti(url: string) {
    const r = await fetch(url, { headers });
    assert(r.ok, `živý GET ${url} → ${r.status}`);
    return parsovatItrebonGalerieMestaTrebon(await r.text());
  }

  // Veřejný denní filtr iTřeboň — AMARCORD po 19. 8. zmizí z výpisu „budoucí“.
  const den = await nacti(
    "https://www.itrebon.cz/kalendar.html?od=2026-08-19&do=2026-08-19",
  );
  assert(den.length === 1, `19.8. GMT karet ${den.length}`);
  const amarcord = den[0];
  assert(amarcord.zdrojIdentita === "itrebon|20304", "živě AMARCORD id");
  assert(amarcord.datumOd === "2026-08-19", `živé datum ${amarcord.datumOd}`);
  assert(amarcord.cas === "17:00", `živý čas ${amarcord.cas}`);
  assert(
    amarcord.nazev ===
      "Vernisáž výstavy Amarcord s prof. Vladimírem Franzem",
    `živý název ${amarcord.nazev}`,
  );
  assert(
    amarcord.mistoNeboTyp === BRANA_GALERIE_MESTA_TREBON_POLOZKA,
    "živé místo",
  );

  const budoucnost: ReturnType<typeof parsovatItrebonGalerieMestaTrebon> = [];
  const videne = new Set<string>();
  for (const url of sestavItrebonKalendarUrlky(
    "https://www.itrebon.cz/kalendar.html",
  )) {
    for (const k of await nacti(url)) {
      const id = k.zdrojIdentita ?? "";
      if (!id || videne.has(id)) {
        continue;
      }
      videne.add(id);
      budoucnost.push(k);
    }
  }
  assert(
    !budoucnost.some((k) => /^výstava/i.test(k.nazev)),
    "budoucí výpis: žádná Výstava …",
  );
  assert(
    !budoucnost.some((k) => /^zahájení výstavy/i.test(k.nazev)),
    "budoucí výpis: žádné Zahájení výstavy",
  );
  console.log(
    "OK živý iTřeboň: 1 karta AMARCORD 19.8.2026 17:00; budoucí výpis bez výstav",
  );
}

overZivyVypis()
  .then(() => {
    console.log("ALL OK verify-brana-itrebon-gmt-parser");
  })
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  });
