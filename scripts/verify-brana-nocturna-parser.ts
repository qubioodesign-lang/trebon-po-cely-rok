/**
 * Regrese: úzký HTML parser Třeboňské nocturny (+ neporušený kinotrebon).
 * Spuštění: npx tsx scripts/verify-brana-nocturna-parser.ts
 */

import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

/** Stabilní reprezentace homepage karet (Oxygen oxy-dynamic-list). */
const NOCTURNA_HOMEPAGE_FIXTURE = `<!DOCTYPE html>
<html><head><title>Úvod | Třeboňská nocturna</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Třeboňská nocturna","url":"https://www.trebonskanocturna.cz"}</script>
</head><body>
<p>Mezinárodní hudební festival 7. – 11. 7. 2026</p>
<p>Koncert dne 10. 7. 2026 se koná za podpory partnerů.</p>
<div class="oxy-dynamic-list">
  <div class="ct-div-block">
    <a href="https://www.trebonskanocturna.cz/koncert/1-abonentni-koncert-2/"></a>
    <div><span>15. 10. 2026 19:00</span></div>
    <div><span><a href="https://www.trebonskanocturna.cz/koncert/1-abonentni-koncert-2/">Maty&aacute;&scaron; Nov&aacute;k - Smetana Reborn</a></span></div>
    <div><span>Divadlo J. K. Tyla, T&#345;ebo&#328;</span></div>
    <div><span><p>1. ABONENTNÍ KONCERT</p></span></div>
  </div>
  <div class="ct-div-block">
    <a href="https://www.trebonskanocturna.cz/koncert/2-abonentni-koncert-2/"></a>
    <div><span>19. 11. 2026 19:00</span></div>
    <div><span><a href="https://www.trebonskanocturna.cz/koncert/2-abonentni-koncert-2/">Al&#382;b&#283;ta Pol&aacute;&#269;kov&aacute; a Zden&#283;k Klauda</a></span></div>
    <div><span>Divadlo J. K. Tyla, T&#345;ebo&#328;</span></div>
    <div><span><p>2. ABONENTNÍ KONCERT</p></span></div>
  </div>
  <div class="ct-div-block">
    <div><span>17. 12. 2026 19:00</span></div>
    <div><span><a href="https://www.trebonskanocturna.cz/koncert/3-abonentni-koncert-2/">D&#283;tsk&yacute; p&#283;veck&yacute; sbor &#268;esk&eacute;ho rozhlasu</a></span></div>
    <div><span>Divadlo J. K. Tyla, T&#345;ebo&#328;</span></div>
  </div>
  <div class="ct-div-block">
    <div><span>21. 1. 2027 19:00</span></div>
    <div><span><a href="https://www.trebonskanocturna.cz/koncert/4-abonentni-koncert-2/">Dvo&#345;&aacute;kovo klav&iacute;rn&iacute; kvarteto a Miroslav T&aacute;borsk&yacute; - Dvo&#345;&aacute;k a jeho korespondence</a></span></div>
    <div><span>Divadlo J. K. Tyla, T&#345;ebo&#328;</span></div>
  </div>
  <div class="ct-div-block">
    <div><span>18. 2. 2027 19:00</span></div>
    <div><span><a href="https://www.trebonskanocturna.cz/koncert/5-abonentni-koncert/">Smetanovo trio</a></span></div>
    <div><span>Divadlo J. K. Tyla, T&#345;ebo&#328;</span></div>
  </div>
  <div class="ct-div-block">
    <div><span>18. 3. 2027 19:00</span></div>
    <div><span><a href="https://www.trebonskanocturna.cz/koncert/6-abonentni-koncert-2/">Irvin Veny&scaron; a Epoque Quartet</a></span></div>
    <div><span>Divadlo J. K. Tyla, T&#345;ebo&#328;</span></div>
  </div>
</div>
<nav><a href="https://www.trebonskanocturna.cz/program/">Program</a></nav>
</body></html>`;

/** Minimální kinotrebon fixture – musí zůstat funkční. */
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

function overNocturnaFixture(): void {
  const kandidati = parsovatUdalostiZeZdroje(
    NOCTURNA_HOMEPAGE_FIXTURE,
    "text/html; charset=UTF-8",
  );
  assert(kandidati.length === 6, `očekáváno 6 kandidátů, je ${kandidati.length}`);

  const prvni = kandidati[0];
  assert(prvni.nazev === "Matyáš Novák - Smetana Reborn", `název: ${prvni.nazev}`);
  assert(prvni.datumOd === "2026-10-15", `datumOd: ${prvni.datumOd}`);
  assert(prvni.datumDo === "2026-10-15", `datumDo: ${prvni.datumDo}`);
  assert(prvni.cas === "19:00", `cas: ${prvni.cas}`);
  assert(
    prvni.mistoNeboTyp === "Divadlo J. K. Tyla, Třeboň",
    `misto: ${prvni.mistoNeboTyp}`,
  );

  const posledni = kandidati[5];
  assert(
    posledni.nazev === "Irvin Venyš a Epoque Quartet",
    `poslední název: ${posledni.nazev}`,
  );
  assert(posledni.datumOd === "2027-03-18", `poslední datum: ${posledni.datumOd}`);
  assert(posledni.cas === "19:00", `poslední čas: ${posledni.cas}`);

  // Falešné kandidáty z běžného textu (festival / partner) nesmí vzniknout.
  assert(
    !kandidati.some((k) => k.datumOd === "2026-07-10"),
    "nemá vzniknout falešný kandidát z textu „Koncert dne 10. 7. 2026“",
  );
  assert(
    !kandidati.some((k) => /program/i.test(k.nazev)),
    "nemá vzniknout kandidát z navigace Program",
  );

  console.log("OK nocturna fixture:", kandidati.length, "kandidátů");
  console.log(
    "  příklady:",
    kandidati
      .slice(0, 2)
      .map((k) => `${k.datumOd} ${k.cas} | ${k.nazev} | ${k.mistoNeboTyp}`)
      .join(" || "),
  );
}

function overKinotrebonZůstává(): void {
  const kandidati = parsovatUdalostiZeZdroje(
    KINOTREBON_FIXTURE,
    "text/html; charset=UTF-8",
  );
  assert(kandidati.length === 1, `kino: očekáván 1 kandidát, je ${kandidati.length}`);
  assert(kandidati[0].nazev === "Test Film", `kino název: ${kandidati[0].nazev}`);
  assert(kandidati[0].datumOd === "2026-08-10", `kino datum: ${kandidati[0].datumOd}`);
  assert(kandidati[0].cas === "20:00", `kino čas: ${kandidati[0].cas}`);
  assert(
    kandidati[0].mistoNeboTyp === "Kino Světozor",
    `kino místo: ${kandidati[0].mistoNeboTyp}`,
  );
  console.log("OK kinotrebon fixture: 1 kandidát beze změny");
}

async function overZiveHomepageVolitelne(): Promise<void> {
  if (process.env.BRANA_NOCTURNA_LIVE !== "1") {
    console.log("SKIP živý fetch (nastav BRANA_NOCTURNA_LIVE=1 pro ověření)");
    return;
  }
  const res = await fetch("https://www.trebonskanocturna.cz/", {
    headers: { Accept: "text/html", "User-Agent": "BranaAdminScan/1.0" },
  });
  assert(res.ok, `živý HTTP ${res.status}`);
  const html = await res.text();
  const kandidati = parsovatUdalostiZeZdroje(
    html,
    res.headers.get("content-type"),
  );
  assert(kandidati.length > 0, `živý fetch: Nalezeno=0`);
  assert(kandidati.length >= 6, `živý fetch: očekáváno ≥6, je ${kandidati.length}`);
  console.log(
    "OK živý homepage fetch:",
    kandidati.length,
    "kandidátů; první=",
    `${kandidati[0].datumOd} ${kandidati[0].cas} ${kandidati[0].nazev}`,
  );
}

async function main(): Promise<void> {
  overNocturnaFixture();
  overKinotrebonZůstává();
  await overZiveHomepageVolitelne();
  console.log("ALL PASS");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
