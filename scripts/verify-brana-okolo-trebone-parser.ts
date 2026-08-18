/**
 * Úzký v1 parser Okolo Třeboně: jen hrobka + lázeňské matiné.
 * Spuštění: npx tsx scripts/verify-brana-okolo-trebone-parser.ts
 * READ-ONLY předscan: npx tsx scripts/verify-brana-okolo-trebone-parser.ts --zivy
 */

import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID,
  BRANA_OKOLO_MATINE_REDAKCNI_POLOZKA_ID,
  jeOkoloTreboneZdrojUrl,
  parsovatOkoloTreboneProgram,
  sestavOkoloTreboneProgramUrl,
  urcitOkoloTreboneKotvu,
} from "../src/lib/brana/admin/okolo-trebone";
import { sparovatVlastnictvimHlidaneKotvy } from "../src/lib/brana/admin/zdroj-scan-sparovani";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";
import { aplikovatScanKandidatyNaUdalosti } from "../src/lib/brana/admin/scan-ceka-zapis";
import {
  jeUdalostCelaMinula,
  vytvoritScanKlicAutomatickeUdalosti,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";
import type { BranaScanAutomatickaUdalostVstup } from "../src/lib/brana/admin/scan-ceka-zapis";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function blok(vnitr: string): string {
  return `<div class="b b-text cf"><div class="b-c b-text-c b-s b-s-t60 b-s-b60 b-cs cf">${vnitr}</div></div>`;
}

const FIXTURE = `<!DOCTYPE html>
<html><head>
<title>Program a prodej :: Okolo Třeboně</title>
<link rel="canonical" href="https://www.okolotrebone.cz/program/">
<meta property="og:url" content="https://www.okolotrebone.cz/program/">
</head><body>
${blok(`<p><strong>Okolo Třeboně - 2026</strong></p><p><strong>VŠECHNY VSTUPENKY ZAKOUPÍTE ZDE NEBO V TIC TŘEBOŇ</strong></p>`)}
${blok(`<p><strong>16. srpna 2026 od 11:00</strong></p>
<p><strong>Třeboňská lázeňská matiné: Jiří Rajniš (bariton) a Ladislav Horák (akordeon), Altán u lázeňského domu Berta / nepříznivé počasí LDA</strong></p>
<p class="wnd-align-justify">Na repertoáru budou slavné italské árie. Vstupné zdarma.</p>`)}
${blok(`<p><strong>23. srpna 2026 od 20:00 <a href="http://shop.entradio.cz/event/107864" target="_blank">Koupit lístky</a></strong></p>
<p><strong>Vilém Veverka - The Electric Recital, Schwarzenberská hrobka</strong></p>
<p class="wnd-align-justify">Hoboj a elektronika.</p>`)}
${blok(`<p><strong>23. srpna 2026 od 20:00 <a href="https://shop.entradio.cz/event/107864">Koupit lístky</a></strong></p>
<p><strong>Vilém Veverka - The Electric Recital, Schwarzenberská hrobka</strong></p>`)}
${blok(`<p><strong>29. října 2026 od 19:00 <a href="https://shop.entradio.cz/event/109247">Koupit lístky</a></strong></p>
<p><strong>Jazz and blues v Třeboni: Laco Deczi, Divadlo J. K. Tyla</strong></p>
<p class="wnd-align-justify">Trumpetista.</p>`)}
${blok(`<p><strong>30. října 2026 od 19:00 <a href="https://shop.entradio.cz/event/109819">Koupit lístky</a></strong></p>
<p><strong>Jazz and blues v Třeboni: Jan Spálený, Foyer Divadla J.K. Tyla</strong></p>`)}
${blok(`<p><strong>5. září 2026 od 19:00</strong></p>
<p><strong>Hosté z Lomnici, Lomnice nad Lužnicí</strong></p>`)}
${blok(`<p><strong>6. září 2026 od 14:00</strong></p>
<p><strong>Zavírání plavecké sezóny, Ostende</strong></p>`)}
${blok(`<p><strong>20. září 2026 od 11:00</strong></p>
<p><strong>Třeboňská lázeňská matiné: připravujeme</strong></p>`)}
${blok(`<p><strong>25. června 2027 od 20:00</strong></p>
<p><strong>Žalman, Masarykovo náměstí</strong></p>`)}
</body></html>`;

const KINOTREBON_MINI = `<!DOCTYPE html>
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

const HLIDANE_KOTVY = [
  BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID,
  BRANA_OKOLO_MATINE_REDAKCNI_POLOZKA_ID,
];

function sparujOkolo(kandidat: {
  nazev: string;
  mistoNeboTyp: string;
}): string {
  const kotva = urcitOkoloTreboneKotvu(kandidat);
  assert(kotva, `chybí kotva pro ${kandidat.nazev}`);
  const r = sparovatVlastnictvimHlidaneKotvy(
    vytvoritVychoziRedakcniPoradi(),
    HLIDANE_KOTVY,
    kotva,
  );
  assert(r.ok, `ownership fail: ${kandidat.nazev}`);
  return r.redakcniPolozkaId;
}

function overUrl(): void {
  assert(
    jeOkoloTreboneZdrojUrl("https://www.okolotrebone.cz/program/"),
    "url program",
  );
  assert(
    jeOkoloTreboneZdrojUrl("https://okolotrebone.cz/"),
    "url homepage host",
  );
  assert(
    sestavOkoloTreboneProgramUrl("https://www.okolotrebone.cz/") ===
      "https://www.okolotrebone.cz/program/",
    "canonicalize /program/",
  );
  assert(
    !jeOkoloTreboneZdrojUrl("https://www.trebonskanocturna.cz/program/"),
    "ne nocturna",
  );
  console.log("OK URL Okolo Třeboně");
}

function overFixture(): void {
  const shrnuti = parsovatOkoloTreboneProgram(FIXTURE);
  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  assert(k.length === 2, `právě 2 kandidáti, je ${k.length}`);
  assert(shrnuti.kandidati.length === 2, "shrnutí kandidáti");
  assert(shrnuti.prijetoHrobka === 1, `hrobka ${shrnuti.prijetoHrobka}`);
  assert(shrnuti.prijetoMatine === 1, `matiné ${shrnuti.prijetoMatine}`);
  assert(shrnuti.odmitnutoJkt === 2, `JKT drop ${shrnuti.odmitnutoJkt}`);
  assert(shrnuti.odmitnutoOstatni >= 3, `ostatní ${shrnuti.odmitnutoOstatni}`);

  const hrobka = k.find((x) => x.nazev.includes("Veverka"));
  assert(hrobka, "hrobka kandidát");
  assert(hrobka.datumOd === "2026-08-23", `hrobka den ${hrobka.datumOd}`);
  assert(hrobka.cas === "20:00", `hrobka čas ${hrobka.cas}`);
  assert(
    /hrobka/i.test(hrobka.mistoNeboTyp),
    `hrobka místo ${hrobka.mistoNeboTyp}`,
  );
  assert(
    hrobka.zdrojIdentita === "okolo|entradio|107864",
    `hrobka identita ${hrobka.zdrojIdentita}`,
  );
  assert(
    sparujOkolo(hrobka) === BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID,
    "kotva hrobka",
  );

  const matine = k.find((x) => /matiné/i.test(x.nazev));
  assert(matine, "matiné kandidát");
  assert(matine.datumOd === "2026-08-16", `matiné den ${matine.datumOd}`);
  assert(matine.cas === "11:00", `matiné čas ${matine.cas}`);
  assert(
    /berta/i.test(matine.mistoNeboTyp),
    `matiné místo ${matine.mistoNeboTyp}`,
  );
  assert(
    matine.zdrojIdentita ===
      "okolo|2026-08-16|11:00|trebonska-lazenska-matine-jiri-rajnis-bariton-a-ladislav-horak-akordeon",
    `matiné identita ${matine.zdrojIdentita}`,
  );
  assert(
    sparujOkolo(matine) === BRANA_OKOLO_MATINE_REDAKCNI_POLOZKA_ID,
    "kotva matiné",
  );

  assert(
    !k.some((x) => /tyla/i.test(x.mistoNeboTyp) || /Deczi|Spálený/.test(x.nazev)),
    "žádný JKT kandidát",
  );
  assert(
    !k.some((x) => /lomnice/i.test(x.mistoNeboTyp)),
    "žádný mimo Třeboň",
  );
  assert(!k.some((x) => /Ostende|Žalman|připravujeme/i.test(x.nazev)), "žádný festival/Ostende/neúplné");

  console.log("OK fixture: 1 hrobka, 1 matiné, JKT+mimo+ostatní = 0");
}

function overJktKotvaNull(): void {
  assert(
    urcitOkoloTreboneKotvu({
      nazev: "Jazz and blues v Třeboni: Laco Deczi",
      mistoNeboTyp: "Divadlo J. K. Tyla",
    }) === null,
    "JKT místo → žádná okolo kotva",
  );
  assert(
    urcitOkoloTreboneKotvu({
      nazev: "Jan Spálený",
      mistoNeboTyp: "Foyer Divadla J.K. Tyla",
    }) === null,
    "foyer JKT → 0",
  );
  assert(
    urcitOkoloTreboneKotvu({
      nazev: "Hosté",
      mistoNeboTyp: "Lomnice nad Lužnicí",
    }) === null,
    "mimo Třeboň → 0",
  );
  console.log("OK JKT/mimo urcitOkoloTreboneKotvu = null");
}

function overIdentitaDedup(): void {
  const identita = "okolo|entradio|107864";
  const pred: BranaKonkretniUdalost[] = [
    {
      id: "auto-okolo-1",
      redakcniPolozkaId: BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID,
      datumOd: "2026-08-23",
      datumDo: "2026-08-23",
      cas: "20:00",
      mistoNeboTyp: "Schwarzenberská hrobka",
      nazev: "Vilém Veverka - The Electric Recital",
      rucniPoziceVDni: null,
      stavSchvaleni: "CEKA_NA_SCHVALENI",
      scanKlic: vytvoritScanKlicAutomatickeUdalosti({
        redakcniPolozkaId: BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID,
        datumOd: "2026-08-23",
        cas: "20:00",
        nazev: "Vilém Veverka - The Electric Recital",
      }),
      zdrojIdentita: identita,
    },
  ];
  const vstup: BranaScanAutomatickaUdalostVstup = {
    redakcniPolozkaId: BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID,
    datumOd: "2026-08-23",
    datumDo: "2026-08-23",
    cas: "20:00",
    mistoNeboTyp: "Schwarzenberská hrobka",
    nazev: "Vilém Veverka - The Electric Recital",
    zdrojIdentita: identita,
  };
  const { udalosti, vysledek } = aplikovatScanKandidatyNaUdalosti(
    pred,
    [vstup, vstup],
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(vysledek.pridano === 0, "identita: nepřidávat kopii");
  assert(udalosti.length === 1, "identita: stále 1 CEKA");
  assert(udalosti[0].zdrojIdentita === identita, "identita zachována");
  console.log("OK identita Entrádio: bez duplicitní CEKA");
}

function overCiziParsery(): void {
  const kino = parsovatUdalostiZeZdroje(KINOTREBON_MINI, "text/html");
  assert(kino.length >= 1 && kino[0].nazev === "Test Film", "kino beze změny");
  const noc = parsovatUdalostiZeZdroje(NOCTURNA_MINI, "text/html");
  assert(noc.length === 1 && noc[0].nazev === "Koncert A", "nocturna beze změny");
  console.log("OK kino / nocturna parser beze změny");
}

overUrl();
overFixture();
overJktKotvaNull();
overIdentitaDedup();
overCiziParsery();
console.log("OK verify-brana-okolo-trebone-parser");

async function zivyPredscan(): Promise<void> {
  const url = "https://www.okolotrebone.cz/program/";
  const res = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "BranaAdminScan/1.0",
    },
  });
  if (!res.ok) {
    fail(`živý GET ${res.status}`);
  }
  const html = await res.text();
  const shrnuti = parsovatOkoloTreboneProgram(html);
  const polozky = vytvoritVychoziRedakcniPoradi();
  console.log("\nREAD-ONLY předscan", url);
  for (const k of shrnuti.kandidati) {
    const kotva = urcitOkoloTreboneKotvu(k);
    const sparovani = kotva
      ? sparovatVlastnictvimHlidaneKotvy(polozky, HLIDANE_KOTVY, kotva)
      : { ok: false as const };
    const kotvaId = sparovani.ok ? sparovani.redakcniPolozkaId : "(žádná)";
    console.log(
      `- ${k.nazev} | ${k.datumOd} ${k.cas} | ${k.mistoNeboTyp} | ${kotvaId} | ${k.zdrojIdentita ?? ""}`,
    );
  }
  console.log("Nalezeno", shrnuti.nalezeno);
  console.log("Přijato hrobka", shrnuti.prijetoHrobka);
  console.log("Přijato matiné", shrnuti.prijetoMatine);
  console.log("Odmítnuto JKT", shrnuti.odmitnutoJkt);
  console.log("Odmítnuto ostatní", shrnuti.odmitnutoOstatni);
}

if (process.argv.includes("--zivy")) {
  void zivyPredscan();
}
