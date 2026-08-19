/**
 * Regrese: úzký HTML parser Galerie 105 / Biograf 105 / trebon105.cz (`article.event`).
 * Jen sekce Akce (`event-list` bez `event-list--exhibitions`).
 * Biograf: vnořený `event-list` v `<section class="section">`.
 * Spuštění: npx tsx scripts/verify-brana-galerie105-parser.ts
 */

import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import { sparovatSRedakcniPolozkou } from "../src/lib/brana/admin/zdroj-scan-sparovani";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";
import { excerptTrebon105ObsahujeVidiny } from "../src/lib/brana/admin/koncert-105";
import { projektujKalendarDny } from "../src/lib/brana/admin/konkretni-udalost";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function eventCard(opts: {
  dateHtml: string;
  title: string;
  venue?: string;
  artist?: string;
  excerpt?: string;
}): string {
  const venue = opts.venue ?? "Galerie";
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

/** Reprezentativní stránka: 2 Výstavy + 4 Akce ve správných sekcích. */
const FIXTURE = `<!DOCTYPE html>
<html><head>
<title>Program - Třeboň 105</title>
<link rel="canonical" href="https://trebon105.cz/program/prostor:galerie"/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Program - Třeboň 105","url":"https://trebon105.cz/program"}</script>
</head><body>
<nav class="filter-nav">
  <a class="filter-nav-item" href="https://trebon105.cz/program">Vše</a>
  <a class="filter-nav-item is-active" href="https://trebon105.cz/program/prostor:galerie">Galerie</a>
</nav>
<section class="event-list event-list--exhibitions">
  <h3 class="event-list__title">Výstavy</h3>
  <div class="event-list__content">
${eventCard({
  dateHtml: "27. 6. - 30. 8. 2026",
  artist: "Veronika Holcová",
  title: "Nad světem v podsvětí",
})}
${eventCard({
  dateHtml: "12. 9. - 1. 11. 2026",
  artist: "Karolína Netolická",
  title: "Výstava",
})}
  </div>
</section>
<section class="event-list">
  <h3 class="event-list__title">Akce</h3>
  <div class="event-list__content">
${eventCard({
  dateHtml: "Pátek<br> 14. 8. 21:15 - 23:00",
  title: "Anežka Hlinková: Videoprojekce na stěny Stopětky",
})}
${eventCard({
  dateHtml: "Středa<br> 19. 8. 17:00 - 17:30",
  title: "Uvidíš: Zahájení VIDIN",
})}
${eventCard({
  dateHtml: "Pátek<br> 21. 8. 22:00 - 22. 8. 2026 23:59",
  title: "Fluence - videomapping na fasádu ZUŠ (pátek)",
})}
${eventCard({
  dateHtml: "Sobota<br> 22. 8. 22:00 - 23:59",
  title: "Fluence - videomapping na fasádu ZUŠ (sobota)",
})}
${eventCard({
  dateHtml: "Sobota<br> 4. 9. 18:00",
  title: "Literárně-hudební představení",
  venue: "Galerie",
})}
  </div>
</section>
<footer>Masarykovo náměstí 105</footer>
</body></html>`;

/** Živá struktura filtru Biograf: event-list vnořený v section.section. */
const FIXTURE_BIOGRAF_VNORENA = `<!DOCTYPE html>
<html><head>
<title>Program - Třeboň 105</title>
<link rel="canonical" href="https://trebon105.cz/program/prostor:biograf"/>
</head><body>
<nav class="filter-nav">
  <a class="filter-nav-item" href="https://trebon105.cz/program">Vše</a>
  <a class="filter-nav-item" href="https://trebon105.cz/program/prostor:galerie">Galerie</a>
  <a class="filter-nav-item is-active" href="https://trebon105.cz/program/prostor:biograf">Biograf</a>
</nav>
<section class="section">
<section class="event-list event-list--exhibitions">
  <h3 class="event-list__title">Výstavy</h3>
${eventCard({
  dateHtml: "27. 6. - 30. 8. 2026",
  title: "Výstava nesmí projít",
  venue: "Galerie",
})}
</section>
<section class="event-list">
  <h3 class="event-list__title">Akce</h3>
${eventCard({
  dateHtml: "Středa<br> 19. 8. 18:00 - 19:15",
  title: "Soutěžní videoklipy (Ozvěny Anifilmu)",
  venue: "Biograf",
})}
${eventCard({
  dateHtml: "Čtvrtek<br> 20. 8. 14:00 - 15:00",
  title: "Bardo",
  venue: "Biograf",
})}
</section>
</section>
</body></html>`;

/** Timed overnight, ale konec ≠ 23:59 → rozsah se nesmí zkrátit. */
const FIXTURE_SKUTECNY_OVERNIGHT = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://trebon105.cz/program"/>
</head><body>
<section class="event-list">
${eventCard({
  dateHtml: "Pátek<br> 21. 8. 22:00 - 22. 8. 2026 02:00",
  title: "Skutečný overnight do 02:00",
})}
</section>
</body></html>`;

/** Timed overnight přes 2+ dny (ne +1) → rozsah zůstane. */
const FIXTURE_VICEDENNI_TIMED = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://trebon105.cz/program"/>
</head><body>
<section class="event-list">
${eventCard({
  dateHtml: "Pátek<br> 21. 8. 22:00 - 23. 8. 2026 23:59",
  title: "Vícedenní timed přes 2 dny",
})}
</section>
</body></html>`;

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

const DSN_MINI = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://www.dumstepankanetolickeho.cz/kalendar-akci/"/>
</head><body>
<div class="home-block-wrapper event-item">
  <h2><a href="/akce/x/" title="Vernisáž test">Vernisáž test</a></h2>
  <small>19.08.2026 17:00</small>
</div>
</body></html>`;

function overFixture(): void {
  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  assert(k.length === 5, `fixture: 5 Akcí, je ${k.length}`);

  assert(
    !k.some((x) => x.nazev.includes("podsvětí") || x.nazev === "Výstava"),
    "kartu z event-list--exhibitions nesmí parser vrátit",
  );

  const video = k.find((x) => x.nazev.includes("Videoprojekce"));
  assert(video, "jednodenní s časem");
  assert(video.datumOd === "2026-08-14", `video den: ${video.datumOd}`);
  assert(video.datumDo === "2026-08-14", `video do: ${video.datumDo}`);
  assert(video.cas === "21:15", `video čas OD: ${video.cas}`);
  assert(video.mistoNeboTyp === "Galerie", `venue: ${video.mistoNeboTyp}`);

  const pate = k.find((x) => x.nazev.includes("Fluence") && x.nazev.includes("pátek"));
  assert(pate, "Fluence pátek");
  assert(pate.datumOd === "2026-08-21", `pátek od: ${pate.datumOd}`);
  assert(pate.datumDo === "2026-08-21", `pátek do (CMS 23:59): ${pate.datumDo}`);
  assert(pate.cas === "22:00", `pátek cas: ${pate.cas}`);

  const sob = k.find((x) => x.nazev.includes("Fluence") && x.nazev.includes("sobota"));
  assert(sob, "Fluence sobota");
  assert(sob.datumOd === "2026-08-22", `sobota od: ${sob.datumOd}`);
  assert(sob.datumDo === "2026-08-22", `sobota do: ${sob.datumDo}`);
  assert(sob.cas === "22:00", `sobota cas: ${sob.cas}`);

  const zahajeni = k.find((x) => x.nazev.includes("Zahájení"));
  assert(zahajeni, "zahájení");
  assert(zahajeni.cas === "17:00", `zahájení cas: ${zahajeni.cas}`);

  const jenCasOd = k.find((x) => x.nazev.includes("Literárně"));
  assert(jenCasOd, "jediný čas bez rozsahu");
  assert(jenCasOd.datumOd === "2026-09-04", `4.9.: ${jenCasOd.datumOd}`);
  assert(jenCasOd.cas === "18:00", `18:00: ${jenCasOd.cas}`);

  console.log("OK Galerie 105: Výstavy ignorovány, Fluence pátek/sobota 1 den");
}

function overVidinyExcerptRedukce(): void {
  const html = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://trebon105.cz/program/prostor:galerie"/>
</head><body>
<section class="event-list">
  <h3 class="event-list__title">Akce</h3>
${eventCard({
  dateHtml: "Středa 19. 8. 17:00",
  title: "Uvidíš: Zahájení VIDIN",
  excerpt: "VIDINY 2026",
})}
${eventCard({
  dateHtml: "Sobota 4. 9. 18:00",
  title: "Literárně-hudební představení",
  excerpt: "Běžná anotace",
})}
</section>
</body></html>`;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, `Galerie excerpt: 1 běžná, je ${k.length}`);
  assert(
    k[0].nazev.includes("Literárně-hudební"),
    `zůstala běžná karta, je ${k[0].nazev}`,
  );

  const biograf = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://trebon105.cz/program/prostor:biograf"/>
</head><body>
<nav class="filter-nav">
  <a class="filter-nav-item is-active" href="https://trebon105.cz/program/prostor:biograf">Biograf</a>
</nav>
<section class="section">
<section class="event-list">
${eventCard({
  dateHtml: "Středa 19. 8. 18:00",
  title: "Festivalový film",
  venue: "Biograf",
  excerpt: "VIDINY 2026",
})}
${eventCard({
  dateHtml: "Čtvrtek 20. 8. 14:00",
  title: "Bardo",
  venue: "Biograf",
  excerpt: "Běžná anotace",
})}
</section>
</section>
</body></html>`;
  const b = parsovatUdalostiZeZdroje(biograf, "text/html");
  assert(b.length === 1 && b[0].nazev === "Bardo", "Biograf: VIDIN zahozen, Bardo zůstane");

  const hub = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://trebon105.cz/program"/>
</head><body>
<section class="event-list">
${eventCard({
  dateHtml: "Středa 19. 8. 17:00",
  title: "Hub karta s VIDINY",
  excerpt: "VIDINY 2026",
})}
</section>
</body></html>`;
  const h = parsovatUdalostiZeZdroje(hub, "text/html");
  assert(
    h.length === 1 && h[0].nazev.includes("Hub karta"),
    "hub excerpt VIDINY se nefiltruje",
  );
  console.log("OK excerpt VIDINY: Galerie/Biograf listing zahodí, hub ne, běžná karta projde");
}

function overFluenceKalendarSimulace(): void {
  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html").filter((x) =>
    x.nazev.includes("Fluence"),
  );
  assert(k.length === 2, `2 Fluence kandidáti, je ${k.length}`);
  const udalosti = k.map((x, i) => ({
    id: `f${i}`,
    redakcniPolozkaId: "galerie-105",
    nazev: x.nazev,
    datumOd: x.datumOd,
    datumDo: x.datumDo,
    cas: x.cas,
    mistoNeboTyp: x.mistoNeboTyp,
    popis: "",
    stavSchvaleni: "CEKA_NA_SCHVALENI" as const,
    rucniPoziceVDni: null,
    verejneCo: null,
    verejneRozliseni: null,
  }));
  const dny = projektujKalendarDny(udalosti);
  const patek = dny.find((d) => d.isoDen === "2026-08-21");
  const sobota = dny.find((d) => d.isoDen === "2026-08-22");
  assert(patek?.udalosti.length === 1, `21.8. = 1× Fluence, je ${patek?.udalosti.length}`);
  assert(sobota?.udalosti.length === 1, `22.8. = 1× Fluence, je ${sobota?.udalosti.length}`);
  console.log("OK kalendářní simulace Fluence 21./22.8. = 1×/1×");
}

function overSkutecnyOvernightNezkracovat(): void {
  const k = parsovatUdalostiZeZdroje(FIXTURE_SKUTECNY_OVERNIGHT, "text/html");
  assert(k.length === 1, `skutečný overnight 1, je ${k.length}`);
  assert(k[0].datumOd === "2026-08-21", `od: ${k[0].datumOd}`);
  assert(
    k[0].datumDo === "2026-08-22",
    `konec 02:00 musí zůstat vícedenní: ${k[0].datumDo}`,
  );
  assert(k[0].cas === "22:00", `cas: ${k[0].cas}`);

  const v = parsovatUdalostiZeZdroje(FIXTURE_VICEDENNI_TIMED, "text/html");
  assert(v.length === 1, `vícedenní timed 1, je ${v.length}`);
  assert(v[0].datumOd === "2026-08-21", `víc od: ${v[0].datumOd}`);
  assert(
    v[0].datumDo === "2026-08-23",
    `+2 dny i s 23:59 nesmí zkrátit: ${v[0].datumDo}`,
  );
  console.log("OK skutečné vícedenní/overnight bez přesné CMS 23:59+1 zůstávají");
}

function overNavigaceNedavaKandidaty(): void {
  const jenNav = `<!DOCTYPE html>
<html><head><link rel="canonical" href="https://trebon105.cz/program"/></head>
<body>
<nav class="filter-nav">
  <a href="https://trebon105.cz/program/prostor:galerie">Galerie</a>
  <a href="https://trebon105.cz/program/prostor:biograf">Biograf</a>
</nav>
<footer>14. 8. 2026 21:15 Galerie</footer>
</body></html>`;
  const k = parsovatUdalostiZeZdroje(jenNav, "text/html");
  assert(k.length === 0, `navigace/footer bez article.event → 0, je ${k.length}`);
  console.log("OK navigace/okolí → 0 kandidátů");
}

function overJenVystavySekce(): void {
  const jenVystavy = `<!DOCTYPE html>
<html><head><link rel="canonical" href="https://trebon105.cz/program"/></head>
<body>
<section class="event-list event-list--exhibitions">
  <h3 class="event-list__title">Výstavy</h3>
  ${eventCard({
    dateHtml: "27. 6. - 30. 8. 2026",
    title: "Jen výstava",
  })}
</section>
</body></html>`;
  const k = parsovatUdalostiZeZdroje(jenVystavy, "text/html");
  assert(k.length === 0, `jen exhibitions → 0, je ${k.length}`);
  console.log("OK samotná sekce Výstavy → 0");
}

function overMatching(): void {
  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  const polozky = vytvoritVychoziRedakcniPoradi();
  for (const kandidat of k) {
    const s = sparovatSRedakcniPolozkou(kandidat, polozky, {
      zdrojNazev: "Galerie 105",
    });
    assert(s.ok, `match fail pro ${kandidat.nazev}`);
    assert(
      s.redakcniPolozkaId === "galerie-105",
      `id ${s.ok ? s.redakcniPolozkaId : "?"}`,
    );
  }
  console.log("OK matching zdrojNazev Galerie 105 → galerie-105");
}

function overBiografVnorenaSekce(): void {
  const k = parsovatUdalostiZeZdroje(FIXTURE_BIOGRAF_VNORENA, "text/html");
  assert(k.length === 2, `vnořený Biograf: 2 kandidáti, je ${k.length}`);
  assert(
    k.every((x) => x.mistoNeboTyp === "Biograf"),
    `venue Biograf, je ${k.map((x) => x.mistoNeboTyp).join(",")}`,
  );
  assert(
    !k.some((x) => /Výstava|Galerie/i.test(x.nazev) || x.mistoNeboTyp === "Galerie"),
    "z Biografu nesmí vzniknout kandidát Galerie / výstavy",
  );
  const klipy = k.find((x) => x.nazev.includes("videoklipy"));
  assert(klipy, "videoklipy");
  assert(klipy.datumOd === "2026-08-19", `klipy den ${klipy.datumOd}`);
  assert(klipy.cas === "18:00", `klipy čas ${klipy.cas}`);
  const bardo = k.find((x) => x.nazev === "Bardo");
  assert(bardo, "Bardo");
  assert(bardo.datumOd === "2026-08-20", `Bardo den ${bardo.datumOd}`);
  assert(bardo.cas === "14:00", `Bardo čas ${bardo.cas}`);

  const polozky = vytvoritVychoziRedakcniPoradi();
  for (const kandidat of k) {
    const s = sparovatSRedakcniPolozkou(kandidat, polozky, {
      zdrojNazev: "Biograf 105",
    });
    assert(s.ok, `Biograf match fail ${kandidat.nazev}`);
    assert(
      s.redakcniPolozkaId === "biograf-105",
      `kotva ${s.ok ? s.redakcniPolozkaId : "?"}`,
    );
  }
  console.log("OK vnořený Biograf: 2 kandidáti → biograf-105, 0 Galerie/výstavy");
}

function overRegreseOstatni(): void {
  const kino = parsovatUdalostiZeZdroje(KINOTREBON_FIXTURE, "text/html");
  assert(kino.length >= 1, "kino regrese");
  assert(kino[0].nazev === "Test Film", `kino název: ${kino[0].nazev}`);

  const noc = parsovatUdalostiZeZdroje(NOCTURNA_MINI, "text/html");
  assert(noc.length === 1, `nocturna 1, je ${noc.length}`);
  assert(noc[0].nazev === "Koncert A", `nocturna: ${noc[0].nazev}`);

  const dsn = parsovatUdalostiZeZdroje(DSN_MINI, "text/html");
  assert(dsn.length === 1, `dsn 1, je ${dsn.length}`);
  assert(dsn[0].cas === "17:00", `dsn cas: ${dsn[0].cas}`);
  console.log("OK regrese kino / nocturna / DSN");
}

async function overZivyProgramVolitelne(): Promise<void> {
  const res = await fetch("https://trebon105.cz/program/prostor:galerie", {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  if (!res.ok) {
    fail(`živý GET Galerie ${res.status}`);
  }
  const html = await res.text();
  const cards = (html.match(/<article class="event">/g) || []).length;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  const kartyAkce = [
    ...html.matchAll(
      /<section\b([^>]*\bevent-list\b[^>]*)>([\s\S]*?)<\/section>/gi,
    ),
  ].filter((m) => {
    const classes = (m[1] ?? "").match(/\bclass=["']([^"']*)["']/i)?.[1] ?? "";
    return (
      classes.split(/\s+/).includes("event-list") &&
      !classes.split(/\s+/).includes("event-list--exhibitions")
    );
  });
  const akceHtml = kartyAkce.map((m) => m[2] ?? "").join("\n");
  const akceKarty = [
    ...akceHtml.matchAll(
      /<article\b[^>]*\bclass=["'][^"']*\bevent\b[^"']*["'][^>]*>[\s\S]*?<\/article>/gi,
    ),
  ];
  const vidinyAkce = akceKarty.filter((m) => {
    const ex = (m[0].match(
      /<p\b[^>]*\bevent__excerpt\b[^>]*>([\s\S]*?)<\/p>/i,
    )?.[1] ?? "").replace(/<[^>]+>/g, " ");
    return excerptTrebon105ObsahujeVidiny(ex);
  });
  assert(
    vidinyAkce.length === 5,
    `živý Galerie: 5 Akcí s excerptem VIDINY, je ${vidinyAkce.length} (karet ${cards})`,
  );
  assert(
    k.length === akceKarty.length - vidinyAkce.length,
    `živý Galerie po redukci ${akceKarty.length}→${k.length}, VIDIN ${vidinyAkce.length}`,
  );
  assert(
    k.every((x) => !/zahájení|fluence|videoprojekce/i.test(x.nazev)),
    "živý Galerie: 0 festivalových Akcí VIDINY",
  );
  assert(
    k.length === 0 || k.every((x) => x.mistoNeboTyp === "Galerie"),
    "filtr Galerie → venue Galerie",
  );
  assert(
    !k.some((x) => x.cas === "" && x.datumOd !== x.datumDo && x.datumOd <= "2026-08-10"),
    "nesmí projít typická dlouhodobá výstava bez času ze sekce Výstavy",
  );
  assert(
    k.every((x) => {
      const shoda = akceKarty.find((m) =>
        m[0].includes(x.nazev.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      if (!shoda) {
        return true;
      }
      const ex = (shoda[0].match(
        /<p\b[^>]*\bevent__excerpt\b[^>]*>([\s\S]*?)<\/p>/i,
      )?.[1] ?? "").replace(/<[^>]+>/g, " ");
      return !excerptTrebon105ObsahujeVidiny(ex);
    }),
    "živý Galerie: 0 emitovaných karet s excerptem vidiny",
  );
  console.log(
    `OK živý prostor:galerie → ${akceKarty.length} Akcí, ${vidinyAkce.length} VIDIN zahozeno, ${k.length} ponecháno (z ${cards} karet)`,
  );
}

async function zivyPredscanBiograf(): Promise<void> {
  const url = "https://trebon105.cz/program/prostor:biograf";
  const res = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  if (!res.ok) {
    fail(`živý GET Biograf ${res.status}`);
  }
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
  assert(kartyPred.length === 13, `před filtrem 13 karet, je ${kartyPred.length}`);
  assert(vidinyPred.length === 13, `13 VIDIN excerptů, je ${vidinyPred.length}`);
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 0, `po filtru 0 festivalových karet, je ${k.length}`);
  console.log("OK živý prostor:biograf → 13 karet, 13 VIDIN zahozeno, 0 ponecháno");
}

async function main(): Promise<void> {
  overFixture();
  overVidinyExcerptRedukce();
  overFluenceKalendarSimulace();
  overSkutecnyOvernightNezkracovat();
  overNavigaceNedavaKandidaty();
  overJenVystavySekce();
  overMatching();
  overBiografVnorenaSekce();
  overRegreseOstatni();
  await overZivyProgramVolitelne();
  await zivyPredscanBiograf();
  console.log("ALL OK verify-brana-galerie105-parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
