/**
 * Regrese: úzký HTML parser Galerie 105 / trebon105.cz (`article.event`).
 * Jen sekce Akce (`event-list` bez `event-list--exhibitions`).
 * Spuštění: npx tsx scripts/verify-brana-galerie105-parser.ts
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import { sparovatSRedakcniPolozkou } from "../src/lib/brana/admin/zdroj-scan-sparovani";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";
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
}): string {
  const venue = opts.venue ?? "Galerie";
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
      <p class="event__excerpt">Anotace</p>
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
  const temp = process.env.TEMP || process.env.TMP || "/tmp";
  const cached = join(temp, "g105-galerie.html");
  let html: string | null = null;
  if (existsSync(cached)) {
    html = readFileSync(cached, "utf8");
  } else {
    try {
      const res = await fetch(
        "https://trebon105.cz/program/prostor:galerie",
      );
      if (res.ok) {
        html = await res.text();
      }
    } catch {
      html = null;
    }
  }
  if (!html) {
    console.log("SKIP živý program (není cache/síť)");
    return;
  }
  const cards = (html.match(/<article class="event">/g) || []).length;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(cards === 25, `živý article.event = 25, je ${cards}`);
  assert(k.length === 6, `živý: právě 6 Akcí, je ${k.length}`);
  assert(
    !k.some((x) => x.cas === "" && x.datumOd !== x.datumDo && x.datumOd <= "2026-08-10"),
    "nesmí projít typická dlouhodobá výstava bez času ze sekce Výstavy",
  );
  assert(
    k.every((x) => x.mistoNeboTyp === "Galerie"),
    "filtr Galerie → venue Galerie",
  );
  const nazvy = k.map((x) => x.nazev).join(" | ");
  assert(nazvy.includes("Videoprojekce"), `akce videoprojekce: ${nazvy}`);
  assert(nazvy.includes("Zahájení"), `akce zahájení: ${nazvy}`);
  assert(nazvy.includes("Fluence"), `akce Fluence: ${nazvy}`);
  const fluence = k.filter((x) => x.nazev.includes("Fluence"));
  assert(fluence.length === 2, `živý: 2 Fluence, je ${fluence.length}`);
  const f21 = fluence.find((x) => x.datumOd === "2026-08-21");
  const f22 = fluence.find((x) => x.datumOd === "2026-08-22");
  assert(f21 && f21.datumDo === "2026-08-21" && f21.cas === "22:00", "živý pátek Fluence 1 den");
  assert(f22 && f22.datumDo === "2026-08-22" && f22.cas === "22:00", "živý sobota Fluence 1 den");
  console.log(`OK živý prostor:galerie → ${k.length} Akcí (z ${cards} karet)`);
}

async function main(): Promise<void> {
  overFixture();
  overFluenceKalendarSimulace();
  overSkutecnyOvernightNezkracovat();
  overNavigaceNedavaKandidaty();
  overJenVystavySekce();
  overMatching();
  overRegreseOstatni();
  await overZivyProgramVolitelne();
  console.log("ALL OK verify-brana-galerie105-parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
