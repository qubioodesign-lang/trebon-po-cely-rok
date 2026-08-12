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
  title: "Fluence - videomapping na fasádu ZUŠ",
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
  assert(k.length === 4, `fixture: 4 Akce, je ${k.length}`);

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

  const overnight = k.find((x) => x.nazev.includes("Fluence"));
  assert(overnight, "overnight");
  assert(overnight.datumOd === "2026-08-21", `overnight od: ${overnight.datumOd}`);
  assert(overnight.datumDo === "2026-08-22", `overnight do: ${overnight.datumDo}`);
  assert(overnight.cas === "22:00", `overnight cas: ${overnight.cas}`);

  const zahajeni = k.find((x) => x.nazev.includes("Zahájení"));
  assert(zahajeni, "zahájení");
  assert(zahajeni.cas === "17:00", `zahájení cas: ${zahajeni.cas}`);

  const jenCasOd = k.find((x) => x.nazev.includes("Literárně"));
  assert(jenCasOd, "jediný čas bez rozsahu");
  assert(jenCasOd.datumOd === "2026-09-04", `4.9.: ${jenCasOd.datumOd}`);
  assert(jenCasOd.cas === "18:00", `18:00: ${jenCasOd.cas}`);

  console.log("OK Galerie 105: Výstavy ignorovány, 4 Akce OK");
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
  console.log(`OK živý prostor:galerie → ${k.length} Akcí (z ${cards} karet)`);
}

async function main(): Promise<void> {
  overFixture();
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
