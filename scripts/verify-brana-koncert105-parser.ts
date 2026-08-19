/**
 * Úzký sběr Koncertu 105: existující parser trebon105.cz + ownership
 * podle živé Položky „Koncert 105“.
 * Spuštění: npx tsx scripts/verify-brana-koncert105-parser.ts
 */

import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  jeTrebon105KoncertZdrojUrl,
  najitKoncert105KotvuId,
  BRANA_KONCERT_105_POLOZKA,
  excerptTrebon105ObsahujeVidiny,
  jeTrebon105KoncertListingHtml,
} from "../src/lib/brana/admin/koncert-105";
import { jeTrebon105DivadloZdrojUrl } from "../src/lib/brana/admin/divadlo-105";
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
import {
  BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID,
  urcitOkoloTreboneKotvu,
} from "../src/lib/brana/admin/okolo-trebone";
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

const KONCERT_URL = "https://trebon105.cz/program/prostor:koncert";
const ZDROJ_NAZEV = "Koncert 105";
/** Volný NE slot — dokládá, že ownership nehledá katalogové id. */
const VOLNY_SLOT_ID = "plaz-u-rybnika-svet";
const DRUHY_SLOT_ID = "gymnazium-trebon";

function eventCard(opts: {
  dateHtml: string;
  title: string;
  venue?: string;
  artist?: string;
  excerpt?: string;
}): string {
  const venue = opts.venue ?? "Koncert";
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
<link rel="canonical" href="https://trebon105.cz/program/prostor:koncert"/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Program - Třeboň 105","url":"https://trebon105.cz/program"}</script>
</head><body>
<nav class="filter-nav">
  <a class="filter-nav-item" href="https://trebon105.cz/program">Vše</a>
  <a class="filter-nav-item" href="https://trebon105.cz/program/prostor:galerie">Galerie</a>
  <a class="filter-nav-item" href="https://trebon105.cz/program/prostor:biograf">Biograf</a>
  <a class="filter-nav-item" href="https://trebon105.cz/program/prostor:divadlo">Divadlo</a>
  <a class="filter-nav-item is-active" href="https://trebon105.cz/program/prostor:koncert">Koncert</a>
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
  dateHtml: "Pátek 21. 8. 20:15 - 21:30",
  title: "Floex Ensemble",
  excerpt: "VIDINY 2026",
})}
${eventCard({
  dateHtml: "Pátek 22. 8. 2025 21:15",
  title: "WWW NEUROBEAT",
  excerpt: "VIDINY 2025 - festival vizuální tvorby",
})}
${eventCard({
  dateHtml: "Sobota 24. 8. 2024 21:00",
  title: "Katastr + vjing",
  excerpt: "VIDINY - festival vizuální tvorby",
})}
${eventCard({
  dateHtml: "Sobota 26. 9. 20:00",
  title: "DIIST + Crayfish",
  excerpt: "Do Třeboně přinášíme večer alternativní kytarové hudby",
})}
${eventCard({
  dateHtml: "Sobota 24. 10. 20:00",
  title: "DOHOR + Dream Fever",
  excerpt: "Melancholický a experimentální zvuk s prvky elektroniky a ambientu",
})}
  </div>
</section>
</body></html>`;

function jazykKoncert105(): BranaRedakcniPolozkaStav["jazykVerejny"] {
  return {
    co: { rezim: "PEVNE", text: "Koncert" },
    rozliseni: { rezim: "PEVNE", text: "105" },
  };
}

function redakceSKoncertem105(
  volby?: { pouzivat?: "ANO" | "NE"; druhaKotva?: boolean },
): BranaRedakcniPolozkaStav[] {
  const pouzivat = volby?.pouzivat ?? "ANO";
  const polozky = vytvoritVychoziRedakcniPoradi().map((p) =>
    p.id === VOLNY_SLOT_ID
      ? {
          ...p,
          polozka: BRANA_KONCERT_105_POLOZKA,
          pouzivat,
          jazykVerejny: jazykKoncert105(),
        }
      : p,
  );
  if (!volby?.druhaKotva) {
    return polozky;
  }
  return polozky.map((p) =>
    p.id === DRUHY_SLOT_ID
      ? {
          ...p,
          polozka: BRANA_KONCERT_105_POLOZKA,
          pouzivat: "ANO",
          jazykVerejny: jazykKoncert105(),
        }
      : p,
  );
}

function ownership(
  kandidat: BranaScanKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
  zdrojUrl: string,
): { ok: true; redakcniPolozkaId: string } | { ok: false } {
  if (!jeTrebon105KoncertZdrojUrl(zdrojUrl)) {
    return { ok: false };
  }
  const kotva = najitKoncert105KotvuId(polozky);
  if (!kotva) {
    return { ok: false };
  }
  return sparovatVlastnictvimHlidaneKotvy(polozky, [kotva], kotva);
}

function overUrl(): void {
  assert(jeTrebon105KoncertZdrojUrl(KONCERT_URL), "základní URL");
  assert(
    jeTrebon105KoncertZdrojUrl(
      "https://www.trebon105.cz/program/prostor:koncert/",
    ),
    "www + trailing slash",
  );
  assert(
    jeTrebon105KoncertZdrojUrl(
      "https://trebon105.cz/program/prostor%3Akoncert",
    ),
    "encoded colon",
  );
  assert(
    !jeTrebon105KoncertZdrojUrl("https://trebon105.cz/program"),
    "hub /program ne",
  );
  assert(
    !jeTrebon105KoncertZdrojUrl(
      "https://trebon105.cz/program/prostor:galerie",
    ),
    "galerie ne",
  );
  assert(
    !jeTrebon105KoncertZdrojUrl(
      "https://trebon105.cz/program/prostor:biograf",
    ),
    "biograf ne",
  );
  assert(
    !jeTrebon105KoncertZdrojUrl(
      "https://trebon105.cz/program/prostor:divadlo",
    ),
    "divadlo ne",
  );
  assert(
    !jeTrebon105KoncertZdrojUrl("https://trebon105.cz/program/diist-crayfish"),
    "detail ne",
  );
  assert(
    !jeTrebon105KoncertZdrojUrl("https://www.okolotrebone.cz/program/"),
    "Okolo Třeboně ne",
  );
  assert(
    jeTrebon105DivadloZdrojUrl(
      "https://trebon105.cz/program/prostor:divadlo",
    ),
    "Divadlo 105 URL beze změny",
  );
  assert(
    !jeTrebon105DivadloZdrojUrl(KONCERT_URL),
    "koncert URL mimo Divadlo větev",
  );
  console.log("OK URL jen prostor:koncert");
}

function overParserFixture(): void {
  assert(jeTrebon105KoncertListingHtml(FIXTURE), "fixture = listing koncert");
  assert(excerptTrebon105ObsahujeVidiny("VIDINY 2026"), "VIDINY 2026");
  assert(
    excerptTrebon105ObsahujeVidiny("VIDINY 2025 - festival vizuální tvorby"),
    "VIDINY 2025",
  );
  assert(
    excerptTrebon105ObsahujeVidiny("VIDINY - festival vizuální tvorby"),
    "VIDINY bez roku",
  );
  assert(
    !excerptTrebon105ObsahujeVidiny(
      "Do Třeboně přinášíme večer alternativní kytarové hudby",
    ),
    "běžná anotace není VIDINY",
  );

  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  assert(k.length === 2, `po filtru 2 Akce, je ${k.length}`);
  assert(
    k.every((x) => x.mistoNeboTyp === "Koncert"),
    `jen venue Koncert, je ${k.map((x) => x.mistoNeboTyp).join(",")}`,
  );
  assert(
    !k.some((x) => /Galerie|Biograf|^Divadlo$/i.test(x.mistoNeboTyp)),
    `žádné cizí venue: ${k.map((x) => x.mistoNeboTyp).join(",")}`,
  );
  assert(
    !k.some((x) => x.nazev.includes("podsvětí")),
    "výstavy ignorovány",
  );
  assert(!k.some((x) => x.nazev === "Floex Ensemble"), "VIDINY 2026 zahozen");
  assert(!k.some((x) => x.nazev === "WWW NEUROBEAT"), "VIDINY 2025 zahozen");
  assert(!k.some((x) => x.nazev.includes("Katastr")), "VIDINY bez roku zahozen");
  const diist = k.find((x) => x.nazev === "DIIST + Crayfish");
  assert(diist, "DIIST + Crayfish ve fixture");
  assert(diist.datumOd === "2026-09-26", `DIIST den ${diist.datumOd}`);
  assert(diist.cas === "20:00", `DIIST čas ${diist.cas}`);
  const dohor = k.find((x) => x.nazev === "DOHOR + Dream Fever");
  assert(dohor, "DOHOR + Dream Fever ve fixture");
  assert(dohor.datumOd === "2026-10-24", `DOHOR den ${dohor.datumOd}`);
  assert(dohor.cas === "20:00", `DOHOR čas ${dohor.cas}`);
  console.log(
    "OK fixture: VIDINY 3 wordingy zahozeny, DIIST + DOHOR ponechány",
  );
}

function overOwnership(): void {
  const seed = vytvoritVychoziRedakcniPoradi();
  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  const diist = k.find((x) => x.nazev === "DIIST + Crayfish");
  assert(diist, "kandidát");

  assert(najitKoncert105KotvuId(seed) === null, "seed bez Koncert 105 → 0 kotva");
  const beznyDnes = sparovatSRedakcniPolozkou(diist, seed, {
    zdrojNazev: ZDROJ_NAZEV,
  });
  assert(
    beznyDnes.ok && beznyDnes.redakcniPolozkaId === "schwarzenberska-hrobka",
    `BEZNY by šel na hrobku, je ${beznyId(beznyDnes)}`,
  );
  const vlastnictviDnes = ownership(diist, seed, KONCERT_URL);
  assert(!vlastnictviDnes.ok, "0 aktivních → ownership ne, ne hrobka");

  const ano = redakceSKoncertem105();
  assert(
    najitKoncert105KotvuId(ano) === VOLNY_SLOT_ID,
    "1× ANO → volný slot, ne katalogové id",
  );
  const zakazaneKotvy = new Set([
    "schwarzenberska-hrobka",
    "galerie-105",
    "biograf-105",
    "divadlo-105",
    "divadlo-jk-tyla",
  ]);
  for (const kandidat of k) {
    const s = ownership(kandidat, ano, KONCERT_URL);
    assert(s.ok, `ownership fail ${kandidat.nazev}`);
    const kotvaId: string = s.redakcniPolozkaId;
    assert(kotvaId === VOLNY_SLOT_ID, `kotva ${kotvaId}`);
    assert(
      !zakazaneKotvy.has(kotvaId),
      `${kandidat.nazev} nesmí na ${kotvaId}`,
    );
  }

  assert(
    najitKoncert105KotvuId(redakceSKoncertem105({ druhaKotva: true })) ===
      null,
    "2+ → 0",
  );
  const dve = ownership(
    diist,
    redakceSKoncertem105({ druhaKotva: true }),
    KONCERT_URL,
  );
  assert(!dve.ok, "2+ ownership ne");

  const inbox = pridatNesparovaneDoNezarazenych(vychoziNezarazeneDokument(), {
    zdrojId: "koncert-105-test",
    zdrojNazev: ZDROJ_NAZEV,
    nesparovane: [],
    noveId: () => "x",
  });
  assert(inbox.otevrene.length === 0, "0 Nezařazených");
  console.log(
    `OK ownership: 1× ANO → ${VOLNY_SLOT_ID}; 0/2+ → 0, ne hrobka / Galerie / Biograf / Divadlo / JKT`,
  );
}

function beznyId(
  s: { ok: true; redakcniPolozkaId: string } | { ok: false },
): string {
  return s.ok ? s.redakcniPolozkaId : "NO-MATCH";
}

function overJazyk(): void {
  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  const diist = k.find((x) => x.nazev === "DIIST + Crayfish");
  assert(diist, "DIIST + Crayfish");
  const polozky = redakceSKoncertem105();
  const s = ownership(diist, polozky, KONCERT_URL);
  assert(s.ok, "match");
  const pravidlo = polozky.find((p) => p.id === s.redakcniPolozkaId);
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: pravidlo?.polozka ?? "",
    kandidatMisto: diist.mistoNeboTyp,
    zdrojNazev: ZDROJ_NAZEV,
    jazykVerejny: pravidlo?.jazykVerejny ?? null,
  });
  const r = rozlozAkci({
    mistoNeboTyp: jazyk.mistoNeboTyp,
    nazev: diist.nazev,
    cas: diist.cas,
    verejneCo: jazyk.verejneCo,
    verejneRozliseni: jazyk.verejneRozliseni,
  });
  assert(r.typ === "Koncert", `CO ${r.typ}`);
  assert(r.misto === "105", `KDE ${r.misto}`);
  assert(r.oddelovacPredMistem === " ", "mezera");
  assert(r.nazev === "DIIST + Crayfish", `název ${r.nazev}`);
  assert(r.cas === "20:00", `čas ${r.cas}`);
  console.log("OK jazyk: Koncert 105 / DIIST + Crayfish / 20:00");
}

function overOstatniVetveBezeZmeny(): void {
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
  const hrobkaBezny = sparovatSRedakcniPolozkou(
    {
      nazev: "Koncert na hrobce",
      datumOd: "2026-08-23",
      datumDo: "2026-08-23",
      cas: "19:00",
      mistoNeboTyp: "Koncert",
    },
    polozky,
    { zdrojNazev: "Cizí zdroj" },
  );
  assert(
    hrobkaBezny.ok && hrobkaBezny.redakcniPolozkaId === "schwarzenberska-hrobka",
    "BEZNY venue Koncert mimo tuto URL dál na hrobku",
  );
  const okoloKotva = urcitOkoloTreboneKotvu({
    nazev: "Koncert v kapli",
    mistoNeboTyp: "Schwarzenberská hrobka",
  });
  assert(
    okoloKotva === BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID,
    "Okolo hrobka kotva beze změny",
  );

  const galerieHtml = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://trebon105.cz/program/prostor:galerie"/>
</head><body>
<section class="event-list">
  <h3 class="event-list__title">Akce</h3>
  <div class="event-list__content">
${eventCard({
  dateHtml: "Středa 19. 8. 17:00",
  venue: "Galerie",
  title: "Uvidíš: Zahájení VIDIN",
  excerpt: "VIDINY 2026",
})}
  </div>
</section>
</body></html>`;
  assert(
    !jeTrebon105KoncertListingHtml(galerieHtml),
    "galerie HTML není koncert listing",
  );
  const galerieK = parsovatUdalostiZeZdroje(galerieHtml, "text/html");
  assert(
    galerieK.length === 1 && galerieK[0].nazev.includes("Zahájení VIDIN"),
    "Galerie VIDIN excerpt se na prostor:galerie nezahazuje",
  );
  console.log(
    "OK Galerie / Biograf / hrobka / Okolo matching nedotčen; Galerie VIDIN excerpt zůstává",
  );
}

async function overZivyProgram(): Promise<void> {
  const res = await fetch(KONCERT_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  assert(res.ok, `živý GET ${res.status}`);
  const html = await res.text();
  assert(jeTrebon105KoncertListingHtml(html), "živý canonical = koncert");

  const kartyPred = [
    ...html.matchAll(
      /<article\b[^>]*\bclass=["'][^"']*\bevent\b[^"']*["'][^>]*>[\s\S]*?<\/article>/gi,
    ),
  ];
  assert(kartyPred.length === 7, `před filtrem 7 karet, je ${kartyPred.length}`);
  const vidinyPred = kartyPred.filter((m) => {
    const ex = (m[0].match(
      /<p\b[^>]*\bevent__excerpt\b[^>]*>([\s\S]*?)<\/p>/i,
    )?.[1] ?? "").replace(/<[^>]+>/g, " ");
    return excerptTrebon105ObsahujeVidiny(ex);
  });
  assert(vidinyPred.length === 5, `5 VIDIN excerptů, je ${vidinyPred.length}`);

  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 2, `po filtru 2 kandidáti, je ${k.length}`);
  assert(
    k.every((x) => x.mistoNeboTyp === "Koncert"),
    `živý venue jen Koncert, je ${[...new Set(k.map((x) => x.mistoNeboTyp))].join(",")}`,
  );
  assert(
    !k.some((x) => /galerie|biograf|^divadlo$/i.test(x.mistoNeboTyp)),
    "živý: 0 Galerie / Biograf / Divadlo",
  );
  assert(!k.some((x) => x.nazev === "biotop"), "biotop zahozen");
  assert(!k.some((x) => x.nazev === "gvnslinger"), "gvnslinger zahozen");
  assert(!k.some((x) => x.nazev.includes("Kmotřenka")), "Kmotřenka zahozena");
  assert(!k.some((x) => x.nazev === "Floex Ensemble"), "Floex zahozen");
  assert(!k.some((x) => x.nazev === "NOiR"), "NOiR zahozen");

  const diist = k.filter((x) => x.nazev === "DIIST + Crayfish");
  assert(diist.length === 1, `DIIST + Crayfish právě 1, je ${diist.length}`);
  assert(diist[0].datumOd === "2026-09-26", `DIIST den ${diist[0].datumOd}`);
  assert(diist[0].cas === "20:00", `DIIST čas ${diist[0].cas}`);

  const dohor = k.filter((x) => x.nazev === "DOHOR + Dream Fever");
  assert(dohor.length === 1, `DOHOR + Dream Fever právě 1, je ${dohor.length}`);
  assert(dohor[0].datumOd === "2026-10-24", `DOHOR den ${dohor[0].datumOd}`);
  assert(dohor[0].cas === "20:00", `DOHOR čas ${dohor[0].cas}`);

  const ano = redakceSKoncertem105();
  for (const kandidat of k) {
    const s = ownership(kandidat, ano, KONCERT_URL);
    const kotvaId = s.ok ? s.redakcniPolozkaId : "NO-MATCH";
    assert(
      s.ok && kotvaId === VOLNY_SLOT_ID,
      `${kandidat.nazev} → Koncert 105 (${kotvaId})`,
    );
  }
  const diistMatch = ownership(diist[0], ano, KONCERT_URL);
  assert(
    diistMatch.ok && diistMatch.redakcniPolozkaId === VOLNY_SLOT_ID,
    "DIIST + Crayfish → Koncert 105",
  );

  console.log(
    "OK živý prostor:koncert → 7 karet, 5 VIDIN zahozeno, 2 ponechány (DIIST + DOHOR) → Koncert 105",
  );
}

async function main(): Promise<void> {
  overUrl();
  overParserFixture();
  overOwnership();
  overJazyk();
  overOstatniVetveBezeZmeny();
  await overZivyProgram();
  console.log("ALL OK verify-brana-koncert105-parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
