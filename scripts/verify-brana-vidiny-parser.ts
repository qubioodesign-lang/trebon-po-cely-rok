/**
 * Úzký sběr festivalu VIDINY: oficiální single-event detail + ownership
 * podle živé Položky „VIDINY“.
 * Spuštění: npx tsx scripts/verify-brana-vidiny-parser.ts
 */

import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  BRANA_VIDINY_KANDIDAT_NAZEV,
  BRANA_VIDINY_POLOZKA,
  jeTrebon105VidinyFestivalDetailHtml,
  jeTrebon105VidinyFestivalZdrojUrl,
  najitVidinyKotvuId,
} from "../src/lib/brana/admin/vidiny";
import {
  jeTrebon105DivadloZdrojUrl,
} from "../src/lib/brana/admin/divadlo-105";
import {
  jeTrebon105KoncertZdrojUrl,
} from "../src/lib/brana/admin/koncert-105";
import {
  sparovatSRedakcniPolozkou,
  sparovatVlastnictvimHlidaneKotvy,
} from "../src/lib/brana/admin/zdroj-scan-sparovani";
import {
  vytvoritVychoziRedakcniPoradi,
  type BranaRedakcniPolozkaStav,
} from "../src/lib/brana/admin/redakcni-kostra";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import {
  pridatNesparovaneDoNezarazenych,
  vychoziNezarazeneDokument,
} from "../src/lib/brana/admin/nezarazene";
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

const VIDINY_URL_2026 =
  "https://trebon105.cz/program/festival-vizualni-tvorby-vidiny-2026";
const VIDINY_URL_2025 =
  "https://trebon105.cz/program/festival-vizualni-tvorby-vidiny-2025";
const VIDINY_URL_2024 =
  "https://trebon105.cz/program/festival-vizualni-tvorby-vidiny";
const ZDROJ_NAZEV = "VIDINY";

function fixtureDetail(opts: {
  canonical: string;
  h1: string;
  dateText: string;
  venue?: string;
}): string {
  const venue = opts.venue ?? "Třeboň 105";
  return `<!DOCTYPE html>
<html><head>
<title>${opts.h1} - Třeboň 105</title>
<link rel="canonical" href="${opts.canonical}"/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"${opts.h1} - Třeboň 105","url":"https://trebon105.cz/program"}</script>
</head><body>
<div class="wrapper" data-template="event-exhibition">
  <div class="single-event">
    <h1 class="single-event__title">${opts.h1}</h1>
    <div class="meta single-event__meta">
      <div class="meta-item meta-item--date">
        <span class="meta-item__text">${opts.dateText}</span>
      </div>
      <div class="meta-item meta-item--venue">
        <span class="meta-item__text">${venue}</span>
      </div>
      <div class="meta-item meta-item--price">
        <span class="meta-item__text">250 – 1000 Kč</span>
      </div>
    </div>
    <section class="single-event__annotation">
      <p>Anotace festivalu se nesmí číst.</p>
    </section>
  </div>
</div>
</body></html>`;
}

function jazykVidiny(): BranaRedakcniPolozkaStav["jazykVerejny"] {
  return {
    co: { rezim: "PEVNE", text: "Festival" },
    rozliseni: { rezim: "PEVNE", text: "VIDINY" },
  };
}

function redakceSVidiny(
  volby?: { pouzivat?: "ANO" | "NE"; druhaKotva?: boolean },
): BranaRedakcniPolozkaStav[] {
  const pouzivat = volby?.pouzivat ?? "ANO";
  const polozky = vytvoritVychoziRedakcniPoradi().map((p) =>
    p.id === "plaz-u-rybnika-svet"
      ? {
          ...p,
          polozka: BRANA_VIDINY_POLOZKA,
          pouzivat,
          jazykVerejny: jazykVidiny(),
        }
      : p,
  );
  if (!volby?.druhaKotva) {
    return polozky;
  }
  return polozky.map((p) =>
    p.id === "vidiny"
      ? {
          ...p,
          polozka: BRANA_VIDINY_POLOZKA,
          pouzivat: "ANO",
          jazykVerejny: jazykVidiny(),
        }
      : p,
  );
}

function ownership(
  kandidat: BranaScanKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
  zdrojUrl: string,
): { ok: true; redakcniPolozkaId: string } | { ok: false } {
  if (!jeTrebon105VidinyFestivalZdrojUrl(zdrojUrl)) {
    return { ok: false };
  }
  const kotva = najitVidinyKotvuId(polozky);
  if (!kotva) {
    return { ok: false };
  }
  return sparovatVlastnictvimHlidaneKotvy(polozky, [kotva], kotva);
}

function overUrl(): void {
  assert(jeTrebon105VidinyFestivalZdrojUrl(VIDINY_URL_2026), "2026");
  assert(jeTrebon105VidinyFestivalZdrojUrl(VIDINY_URL_2025), "2025");
  assert(jeTrebon105VidinyFestivalZdrojUrl(VIDINY_URL_2024), "2024 bez roku");
  assert(
    jeTrebon105VidinyFestivalZdrojUrl(
      "https://www.trebon105.cz/program/festival-vizualni-tvorby-vidiny-2026/",
    ),
    "www + trailing slash",
  );
  assert(
    !jeTrebon105VidinyFestivalZdrojUrl("https://trebon105.cz/program"),
    "hub ne",
  );
  assert(
    !jeTrebon105VidinyFestivalZdrojUrl(
      "https://trebon105.cz/program/prostor:galerie",
    ),
    "galerie ne",
  );
  assert(
    !jeTrebon105VidinyFestivalZdrojUrl(
      "https://trebon105.cz/program/prostor:biograf",
    ),
    "biograf ne",
  );
  assert(
    !jeTrebon105VidinyFestivalZdrojUrl(
      "https://trebon105.cz/program/prostor:divadlo",
    ),
    "divadlo ne",
  );
  assert(
    !jeTrebon105VidinyFestivalZdrojUrl(
      "https://trebon105.cz/program/prostor:koncert",
    ),
    "koncert ne",
  );
  assert(
    !jeTrebon105VidinyFestivalZdrojUrl(
      "https://trebon105.cz/program/znovuzrozena",
    ),
    "jiný detail ne",
  );
  assert(
    !jeTrebon105VidinyFestivalZdrojUrl(
      "https://trebon105.cz/program/uvidis-zahajeni-vidin",
    ),
    "zahájení detail ne",
  );
  assert(
    !jeTrebon105VidinyFestivalZdrojUrl(
      "https://trebon105.cz/program/festival-vizualni-tvorby-vidiny-202",
    ),
    "neúplný rok ne",
  );
  assert(
    !jeTrebon105DivadloZdrojUrl(VIDINY_URL_2026),
    "festival URL není Divadlo 105",
  );
  assert(
    !jeTrebon105KoncertZdrojUrl(VIDINY_URL_2026),
    "festival URL není Koncert 105",
  );
  console.log("OK URL jen rodina festival-vizualni-tvorby-vidiny");
}

function overParserFixture(): void {
  const html = fixtureDetail({
    canonical: VIDINY_URL_2026,
    h1: "Festival vizuální tvorby VIDINY",
    dateText: "19. 8. – 23. 8. 2026",
    venue: "Třeboň 105",
  });
  assert(jeTrebon105VidinyFestivalDetailHtml(html), "fixture canonical");
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `1 kandidát, je ${k.length}`);
  assert(k[0].nazev === BRANA_VIDINY_KANDIDAT_NAZEV, `název ${k[0].nazev}`);
  assert(k[0].datumOd === "2026-08-19", `od ${k[0].datumOd}`);
  assert(k[0].datumDo === "2026-08-23", `do ${k[0].datumDo}`);
  assert(k[0].cas === "", `čas '${k[0].cas}'`);

  const venueGalerie = parsovatUdalostiZeZdroje(
    fixtureDetail({
      canonical: VIDINY_URL_2024,
      h1: "festival vizuální tvorby VIDINY",
      dateText: "21. 8. - 25. 8. 2024",
      venue: "Galerie",
    }),
    "text/html",
  );
  assert(venueGalerie.length === 1, "venue Galerie není podmínka");
  assert(venueGalerie[0].datumOd === "2024-08-21", "2024 od");
  assert(venueGalerie[0].datumDo === "2024-08-25", "2024 do");

  const bezH1 = parsovatUdalostiZeZdroje(
    fixtureDetail({
      canonical: VIDINY_URL_2026,
      h1: "Festival vizuální tvorby",
      dateText: "19. 8. – 23. 8. 2026",
    }),
    "text/html",
  );
  assert(bezH1.length === 0, "H1 bez VIDINY → 0");

  const jedenDen = parsovatUdalostiZeZdroje(
    fixtureDetail({
      canonical: VIDINY_URL_2026,
      h1: "Festival vizuální tvorby VIDINY",
      dateText: "19. 8. 2026",
    }),
    "text/html",
  );
  assert(jedenDen.length === 0, "jeden den → 0");

  const jinyDetail = parsovatUdalostiZeZdroje(
    fixtureDetail({
      canonical: "https://trebon105.cz/program/znovuzrozena",
      h1: "Znovuzrozená VIDINY",
      dateText: "19. 8. – 23. 8. 2026",
    }),
    "text/html",
  );
  assert(jinyDetail.length === 0, "cizí detail i s VIDINY v H1 → 0");
  console.log("OK fixture: 1 karta 19.–23. 8. 2026, fail-closed H1/rozsah/cizí URL");
}

function overOwnership(): void {
  const seed = vytvoritVychoziRedakcniPoradi();
  const k = parsovatUdalostiZeZdroje(
    fixtureDetail({
      canonical: VIDINY_URL_2026,
      h1: "Festival vizuální tvorby VIDINY",
      dateText: "19. 8. – 23. 8. 2026",
    }),
    "text/html",
  );
  assert(k.length === 1, "kandidát");
  const z = k[0];

  assert(najitVidinyKotvuId(seed) === null, "seed Používat NE → 0 kotva");
  const vlastnictviSeed = ownership(z, seed, VIDINY_URL_2026);
  assert(!vlastnictviSeed.ok, "0 aktivních → ownership ne");

  const galerie = sparovatSRedakcniPolozkou(
    {
      nazev: "Zahájení",
      datumOd: "2026-08-19",
      datumDo: "2026-08-19",
      cas: "17:00",
      mistoNeboTyp: "Galerie",
    },
    seed,
    { zdrojNazev: "Galerie 105" },
  );
  assert(
    galerie.ok && galerie.redakcniPolozkaId === "galerie-105",
    "Galerie 105 matching beze změny",
  );

  const ano = redakceSVidiny();
  const kotva = najitVidinyKotvuId(ano);
  assert(kotva === "plaz-u-rybnika-svet", `1× ANO volný slot, je ${kotva}`);
  const s = ownership(z, ano, VIDINY_URL_2026);
  assert(s.ok && s.redakcniPolozkaId === "plaz-u-rybnika-svet", "kotva podle názvu");

  assert(
    najitVidinyKotvuId(redakceSVidiny({ druhaKotva: true })) === null,
    "2+ → 0",
  );
  assert(
    !ownership(z, redakceSVidiny({ druhaKotva: true }), VIDINY_URL_2026).ok,
    "2+ ownership ne",
  );

  assert(
    !ownership(z, ano, "https://trebon105.cz/program/prostor:galerie").ok,
    "galerie URL → 0",
  );

  const inbox = pridatNesparovaneDoNezarazenych(vychoziNezarazeneDokument(), {
    zdrojId: "vidiny-test",
    zdrojNazev: ZDROJ_NAZEV,
    nesparovane: [],
    noveId: () => "x",
  });
  assert(inbox.otevrene.length === 0, "0 Nezařazených");
  console.log("OK ownership: 1× ANO → volný slot; 0/2+ → 0, ne id vidiny");
}

function overJazyk(): void {
  const k = parsovatUdalostiZeZdroje(
    fixtureDetail({
      canonical: VIDINY_URL_2026,
      h1: "Festival vizuální tvorby VIDINY",
      dateText: "19. 8. – 23. 8. 2026",
    }),
    "text/html",
  );
  const z = k[0];
  const polozky = redakceSVidiny();
  const s = ownership(z, polozky, VIDINY_URL_2026);
  assert(s.ok, "match");
  const pravidlo = polozky.find((p) => p.id === s.redakcniPolozkaId);
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: pravidlo?.polozka ?? "",
    kandidatMisto: z.mistoNeboTyp,
    zdrojNazev: ZDROJ_NAZEV,
    jazykVerejny: pravidlo?.jazykVerejny ?? null,
  });
  const r = rozlozAkci({
    mistoNeboTyp: jazyk.mistoNeboTyp,
    nazev: z.nazev,
    cas: z.cas,
    verejneCo: jazyk.verejneCo,
    verejneRozliseni: jazyk.verejneRozliseni,
  });
  assert(r.typ === "Festival", `CO ${r.typ}`);
  assert(r.misto === "VIDINY", `KDE ${r.misto}`);
  assert(r.nazev === "", `druhý řádek '${r.nazev}'`);
  assert(r.cas === "", `čas '${r.cas}'`);
  assert(r.oddelovacPredMistem === " ", "mezera");
  console.log("OK jazyk: Festival VIDINY bez druhého řádku, bez času");
}

async function htmlZdroje(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  assert(res.ok, `živý GET ${url} ${res.status}`);
  return res.text();
}

async function overZivyDetailACiziVetve(): Promise<void> {
  const html = await htmlZdroje(VIDINY_URL_2026);
  assert(
    jeTrebon105VidinyFestivalDetailHtml(html),
    "živý canonical = festival 2026",
  );
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `živý 1 kandidát, je ${k.length}`);
  assert(k[0].nazev === BRANA_VIDINY_KANDIDAT_NAZEV, `živý název ${k[0].nazev}`);
  assert(k[0].datumOd === "2026-08-19", `živý od ${k[0].datumOd}`);
  assert(k[0].datumDo === "2026-08-23", `živý do ${k[0].datumDo}`);
  assert(k[0].cas === "", `živý čas '${k[0].cas}'`);

  const ano = redakceSVidiny();
  const s = ownership(k[0], ano, VIDINY_URL_2026);
  assert(s.ok && s.redakcniPolozkaId === "plaz-u-rybnika-svet", "živý ownership");
  const pravidlo = ano.find((p) => p.id === s.redakcniPolozkaId);
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: pravidlo?.polozka ?? "",
    kandidatMisto: k[0].mistoNeboTyp,
    zdrojNazev: ZDROJ_NAZEV,
    jazykVerejny: pravidlo?.jazykVerejny ?? null,
  });
  const r = rozlozAkci({
    mistoNeboTyp: jazyk.mistoNeboTyp,
    nazev: k[0].nazev,
    cas: k[0].cas,
    verejneCo: jazyk.verejneCo,
    verejneRozliseni: jazyk.verejneRozliseni,
  });
  assert(r.typ === "Festival" && r.misto === "VIDINY" && r.nazev === "", "živý Festival VIDINY");

  const cizi = [
    "https://trebon105.cz/program",
    "https://trebon105.cz/program/prostor:galerie",
    "https://trebon105.cz/program/prostor:biograf",
    "https://trebon105.cz/program/prostor:divadlo",
    "https://trebon105.cz/program/prostor:koncert",
  ];
  for (const url of cizi) {
    assert(!jeTrebon105VidinyFestivalZdrojUrl(url), `URL větev 0: ${url}`);
    const ciziHtml = await htmlZdroje(url);
    assert(
      !jeTrebon105VidinyFestivalDetailHtml(ciziHtml),
      `HTML větev 0: ${url}`,
    );
    const ck = parsovatUdalostiZeZdroje(ciziHtml, "text/html");
    assert(
      !ck.some((x) => x.nazev === BRANA_VIDINY_KANDIDAT_NAZEV),
      `listing nevydá kartu celku: ${url}`,
    );
  }
  console.log("OK živý 2026 → 1 karta 19.–23. 8.; hub/105 filtry tuto větev 0");
}

async function main(): Promise<void> {
  overUrl();
  overParserFixture();
  overOwnership();
  overJazyk();
  await overZivyDetailACiziVetve();
  console.log("ALL OK verify-brana-vidiny-parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
