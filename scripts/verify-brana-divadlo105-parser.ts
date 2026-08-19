/**
 * Úzký sběr Divadla 105: existující parser trebon105.cz + ownership
 * podle živé Položky „Divadlo 105“.
 * Spuštění: npx tsx scripts/verify-brana-divadlo105-parser.ts
 */

import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  jeTrebon105DivadloZdrojUrl,
  najitDivadlo105KotvuId,
  BRANA_DIVADLO_105_POLOZKA,
} from "../src/lib/brana/admin/divadlo-105";
import { excerptTrebon105ObsahujeVidiny } from "../src/lib/brana/admin/koncert-105";
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

const DIVADLO_URL = "https://trebon105.cz/program/prostor:divadlo";
const ZDROJ_NAZEV = "Divadlo 105";

function eventCard(opts: {
  dateHtml: string;
  title: string;
  venue?: string;
  artist?: string;
  excerpt?: string;
}): string {
  const venue = opts.venue ?? "Divadlo";
  const excerpt = opts.excerpt ?? "Anotace";
  const artist = opts.artist
    ? `<div class="event__artist">${opts.artist}</div>`
    : "";
  return `
<a href="https://trebon105.cz/program/example">
  <article class="event">
    <div class="event__img-wrapper"></div>
    <div class="event__meta">
      <div class="event__date">${opts.dateHtml}</div>
      <div class="event__venue">${venue}</div>
      <div class="event__labels"></div>
    </div>
    <header class="event__header">
      ${artist}
      <h4 class="event__title">${opts.title}</h4>
    </header>
    <div class="event__excerpt-wrapper">
      <p class="event__excerpt">${excerpt}</p>
    </div>
  </article>
</a>`;
}

const FIXTURE = `<!DOCTYPE html>
<html><head>
<title>Program - Třeboň 105</title>
<link rel="canonical" href="https://trebon105.cz/program/prostor:divadlo"/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Program - Třeboň 105","url":"https://trebon105.cz/program"}</script>
</head><body>
<nav class="filter-nav">
  <a class="filter-nav-item" href="https://trebon105.cz/program">Vše</a>
  <a class="filter-nav-item" href="https://trebon105.cz/program/prostor:galerie">Galerie</a>
  <a class="filter-nav-item" href="https://trebon105.cz/program/prostor:biograf">Biograf</a>
  <a class="filter-nav-item is-active" href="https://trebon105.cz/program/prostor:divadlo">Divadlo</a>
  <a class="filter-nav-item" href="https://trebon105.cz/program/prostor:koncert">Koncert</a>
</nav>
<section class="event-list event-list--exhibitions">
  <h3 class="event-list__title">Výstavy</h3>
  <div class="event-list__content">
${eventCard({
  dateHtml: "27. 6. - 30. 8. 2026",
  venue: "Galerie",
  title: "Nad světem v podsvětí",
})}
  </div>
</section>
<section class="event-list">
  <h3 class="event-list__title">Akce</h3>
  <div class="event-list__content">
${eventCard({
  dateHtml: "Sobota 22. 8. 17:00 - 18:00",
  title: "Eliška Brtnická: OBRYSY",
})}
${eventCard({
  dateHtml: "Pátek 4. 9. 2026 18:00",
  title: "Znovuzrozená",
})}
  </div>
</section>
</body></html>`;

function jazykDivadlo105(): BranaRedakcniPolozkaStav["jazykVerejny"] {
  return {
    co: { rezim: "PEVNE", text: "Divadlo" },
    rozliseni: { rezim: "PEVNE", text: "105" },
  };
}

function redakceSDivadlem105(
  volby?: { pouzivat?: "ANO" | "NE"; druhaKotva?: boolean },
): BranaRedakcniPolozkaStav[] {
  const pouzivat = volby?.pouzivat ?? "ANO";
  const polozky = vytvoritVychoziRedakcniPoradi().map((p) =>
    p.id === "divadlo-105"
      ? {
          ...p,
          pouzivat,
          jazykVerejny: jazykDivadlo105(),
        }
      : p,
  );
  if (!volby?.druhaKotva) {
    return polozky;
  }
  return polozky.map((p) =>
    p.id === "plaz-u-rybnika-svet"
      ? {
          ...p,
          polozka: BRANA_DIVADLO_105_POLOZKA,
          pouzivat: "ANO",
          jazykVerejny: jazykDivadlo105(),
        }
      : p,
  );
}

function ownership(
  kandidat: BranaScanKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
  zdrojUrl: string,
): { ok: true; redakcniPolozkaId: string } | { ok: false } {
  if (!jeTrebon105DivadloZdrojUrl(zdrojUrl)) {
    return { ok: false };
  }
  const kotva = najitDivadlo105KotvuId(polozky);
  if (!kotva) {
    return { ok: false };
  }
  return sparovatVlastnictvimHlidaneKotvy(polozky, [kotva], kotva);
}

function overUrl(): void {
  assert(jeTrebon105DivadloZdrojUrl(DIVADLO_URL), "základní URL");
  assert(
    jeTrebon105DivadloZdrojUrl("https://www.trebon105.cz/program/prostor:divadlo/"),
    "www + trailing slash",
  );
  assert(
    jeTrebon105DivadloZdrojUrl(
      "https://trebon105.cz/program/prostor%3Adivadlo",
    ),
    "encoded colon",
  );
  assert(
    !jeTrebon105DivadloZdrojUrl("https://trebon105.cz/program"),
    "hub /program ne",
  );
  assert(
    !jeTrebon105DivadloZdrojUrl(
      "https://trebon105.cz/program/prostor:galerie",
    ),
    "galerie ne",
  );
  assert(
    !jeTrebon105DivadloZdrojUrl(
      "https://trebon105.cz/program/prostor:biograf",
    ),
    "biograf ne",
  );
  assert(
    !jeTrebon105DivadloZdrojUrl(
      "https://trebon105.cz/program/prostor:koncert",
    ),
    "koncert ne",
  );
  assert(
    !jeTrebon105DivadloZdrojUrl("https://trebon105.cz/program/znovuzrozena"),
    "detail ne",
  );
  console.log("OK URL jen prostor:divadlo");
}

function overParserFixture(): void {
  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  assert(k.length === 2, `2 Akce, je ${k.length}`);
  assert(
    !k.some((x) => /Galerie|Biograf|^Koncert$/i.test(x.mistoNeboTyp)),
    `žádné cizí venue: ${k.map((x) => x.mistoNeboTyp).join(",")}`,
  );
  assert(
    !k.some((x) => x.nazev.includes("podsvětí")),
    "výstavy ignorovány",
  );
  const z = k.find((x) => x.nazev === "Znovuzrozená");
  assert(z, "Znovuzrozená ve fixture");
  assert(z.datumOd === "2026-09-04", `Znovuzrozená den ${z.datumOd}`);
  assert(z.cas === "18:00", `Znovuzrozená čas ${z.cas}`);
  assert(z.mistoNeboTyp === "Divadlo", `Znovuzrozená venue ${z.mistoNeboTyp}`);
  const obrysy = k.find((x) => x.nazev === "Eliška Brtnická: OBRYSY");
  assert(obrysy, "OBRYSY");
  assert(obrysy.cas === "17:00", `OBRYSY čas ${obrysy.cas}`);
  console.log("OK fixture parser: 2 Divadlo, 0 výstavy, Znovuzrozená 4. 9. 18:00");
}

function overVidinyExcerptRedukce(): void {
  const html = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://trebon105.cz/program/prostor:divadlo"/>
</head><body>
<nav class="filter-nav">
  <a class="filter-nav-item is-active" href="https://trebon105.cz/program/prostor:divadlo">Divadlo</a>
</nav>
<section class="event-list">
  <h3 class="event-list__title">Akce</h3>
${eventCard({
  dateHtml: "Sobota 22. 8. 17:00",
  title: "Eliška Brtnická: OBRYSY",
  excerpt: "VIDINY 2026",
})}
${eventCard({
  dateHtml: "Pátek 4. 9. 2026 18:00",
  title: "Znovuzrozená",
  excerpt: "Hospicová péče sv. Kleofáše",
})}
</section>
</body></html>`;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `Divadlo excerpt: 1, je ${k.length}`);
  assert(k[0].nazev === "Znovuzrozená", `zůstala Znovuzrozená, je ${k[0].nazev}`);
  assert(k[0].datumOd === "2026-09-04", `den ${k[0].datumOd}`);
  assert(k[0].cas === "18:00", `čas ${k[0].cas}`);
  console.log("OK excerpt VIDINY: Divadlo zahodí festival, Znovuzrozená projde");
}

function overOwnership(): void {
  const seed = vytvoritVychoziRedakcniPoradi();
  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  const z = k.find((x) => x.nazev === "Znovuzrozená");
  assert(z, "kandidát");

  assert(najitDivadlo105KotvuId(seed) === null, "seed Používat NE → 0 kotva");
  const beznyDnes = sparovatSRedakcniPolozkou(z, seed, {
    zdrojNazev: ZDROJ_NAZEV,
  });
  assert(
    beznyDnes.ok && beznyDnes.redakcniPolozkaId === "divadlo-jk-tyla",
    `BEZNY při Používat NE by šel do JKT, je ${beznyId(beznyDnes)}`,
  );
  const vlastnictviDnes = ownership(z, seed, DIVADLO_URL);
  assert(!vlastnictviDnes.ok, "0 aktivních → ownership ne, ne JKT");

  const ano = redakceSDivadlem105();
  assert(najitDivadlo105KotvuId(ano) === "divadlo-105", "1× ANO → divadlo-105");
  for (const kandidat of k) {
    const s = ownership(kandidat, ano, DIVADLO_URL);
    assert(s.ok, `ownership fail ${kandidat.nazev}`);
    assert(
      s.redakcniPolozkaId === "divadlo-105",
      `kotva ${s.ok ? s.redakcniPolozkaId : "?"}`,
    );
  }

  assert(najitDivadlo105KotvuId(redakceSDivadlem105({ druhaKotva: true })) === null, "2+ → 0");
  const dve = ownership(z, redakceSDivadlem105({ druhaKotva: true }), DIVADLO_URL);
  assert(!dve.ok, "2+ ownership ne");

  const inbox = pridatNesparovaneDoNezarazenych(vychoziNezarazeneDokument(), {
    zdrojId: "divadlo-105-test",
    zdrojNazev: ZDROJ_NAZEV,
    nesparovane: [],
    noveId: () => "x",
  });
  assert(inbox.otevrene.length === 0, "0 Nezařazených");
  console.log("OK ownership: 1× ANO → divadlo-105; 0/2+ → 0, ne JKT");
}

function beznyId(
  s: { ok: true; redakcniPolozkaId: string } | { ok: false },
): string {
  return s.ok ? s.redakcniPolozkaId : "NO-MATCH";
}

function overJazyk(): void {
  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  const z = k.find((x) => x.nazev === "Znovuzrozená");
  assert(z, "Znovuzrozená");
  const polozky = redakceSDivadlem105();
  const s = ownership(z, polozky, DIVADLO_URL);
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
  assert(r.typ === "Divadlo", `CO ${r.typ}`);
  assert(r.misto === "105", `KDE ${r.misto}`);
  assert(r.oddelovacPredMistem === " ", "mezera");
  assert(r.nazev === "Znovuzrozená", `název ${r.nazev}`);
  assert(r.cas === "18:00", `čas ${r.cas}`);
  console.log("OK jazyk: Divadlo 105 / Znovuzrozená / 18:00");
}

function overGalerieBiografBezeZmeny(): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const galerie = sparovatSRedakcniPolozkou(
    {
      nazev: "Zahájení",
      datumOd: "2026-08-19",
      datumDo: "2026-08-19",
      cas: "17:00",
      mistoNeboTyp: "Galerie",
    },
    polozky,
    { zdrojNazev: "Galerie 105" },
  );
  assert(
    galerie.ok && galerie.redakcniPolozkaId === "galerie-105",
    "Galerie 105 matching beze změny",
  );
  const biograf = sparovatSRedakcniPolozkou(
    {
      nazev: "Bardo",
      datumOd: "2026-08-20",
      datumDo: "2026-08-20",
      cas: "14:00",
      mistoNeboTyp: "Biograf",
    },
    polozky,
    { zdrojNazev: "Biograf 105" },
  );
  assert(
    biograf.ok && biograf.redakcniPolozkaId === "biograf-105",
    "Biograf 105 matching beze změny",
  );
  assert(
    !jeTrebon105DivadloZdrojUrl("https://trebon105.cz/program/prostor:galerie"),
    "galerie URL mimo Divadlo větev",
  );
  assert(
    !jeTrebon105DivadloZdrojUrl("https://trebon105.cz/program/prostor:biograf"),
    "biograf URL mimo Divadlo větev",
  );
  console.log("OK Galerie 105 / Biograf 105 matching nedotčen");
}

async function overZivyProgram(): Promise<void> {
  const res = await fetch(DIVADLO_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  assert(res.ok, `živý GET ${res.status}`);
  const html = await res.text();
  const kartyPred = [
    ...html.matchAll(
      /<article\b[^>]*\bclass=["'][^"']*\bevent\b[^"']*["'][^>]*>[\s\S]*?<\/article>/gi,
    ),
  ];
  const vidinyPred = kartyPred.filter((m) => {
    const ex = (m[0].match(
      /<p\b[^>]*\bevent__excerpt\b[^>]*>([\s\S]*?)<\/p>/i,
    )?.[1] ?? "").replace(/<[^>]+>/g, " ");
    return excerptTrebon105ObsahujeVidiny(ex);
  });
  assert(kartyPred.length === 5, `před filtrem 5 karet, je ${kartyPred.length}`);
  assert(vidinyPred.length === 4, `4 VIDIN excerptů, je ${vidinyPred.length}`);
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `živý parser 5→1, je ${k.length}`);
  assert(
    k.every((x) => x.mistoNeboTyp === "Divadlo"),
    `živý venue jen Divadlo, je ${[...new Set(k.map((x) => x.mistoNeboTyp))].join(",")}`,
  );
  assert(
    !k.some((x) => /galerie|biograf|^koncert$/i.test(x.mistoNeboTyp)),
    "živý: 0 Galerie / Biograf / Koncert",
  );
  const znovu = k.filter((x) => x.nazev === "Znovuzrozená");
  assert(znovu.length === 1, `Znovuzrozená právě 1, je ${znovu.length}`);
  assert(znovu[0].datumOd === "2026-09-04", `Znovuzrozená den ${znovu[0].datumOd}`);
  assert(znovu[0].cas === "18:00", `Znovuzrozená čas ${znovu[0].cas}`);

  const ano = redakceSDivadlem105();
  for (const kandidat of k) {
    const s = ownership(kandidat, ano, DIVADLO_URL);
    assert(
      s.ok && s.redakcniPolozkaId === "divadlo-105",
      `${kandidat.nazev} → divadlo-105`,
    );
  }
  const zMatch = ownership(znovu[0], ano, DIVADLO_URL);
  assert(zMatch.ok && zMatch.redakcniPolozkaId === "divadlo-105", "Znovuzrozená → Divadlo 105");

  console.log(
    "OK živý prostor:divadlo → 5 karet, 4 VIDIN zahozeno, Znovuzrozená 2026-09-04 18:00 → divadlo-105",
  );
}

async function main(): Promise<void> {
  overUrl();
  overParserFixture();
  overVidinyExcerptRedukce();
  overOwnership();
  overJazyk();
  overGalerieBiografBezeZmeny();
  await overZivyProgram();
  console.log("ALL OK verify-brana-divadlo105-parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
