/**
 * Úzký parser Okolo Třeboně: hrobka + lázeňské matiné automaticky;
 * úplný třeboňský zbytek bez kotvy → Nezařazené.
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
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  pridatNesparovaneDoNezarazenych,
  vychoziNezarazeneDokument,
} from "../src/lib/brana/admin/nezarazene";
import {
  dnesIsoVPraze,
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
${blok(`<p><strong>8. září 2026 od 19:30</strong></p>
<p><strong>Třeboňská nocturna: Abonentní koncert, Kostel sv. Jiljí</strong></p>`)}
${blok(`<p><strong>12. září 2026 od 19:00</strong></p>
<p><strong>TDF: Hamlet, Zámek Třeboň</strong></p>`)}
${blok(`<p><strong>6. září 2026 od 14:00</strong></p>
<p><strong>Zavírání plavecké sezóny, Ostende</strong></p>`)}
${blok(`<p><strong>20. září 2026 od 11:00</strong></p>
<p><strong>Třeboňská lázeňská matiné: připravujeme</strong></p>`)}
${blok(`<p><strong>12. října 2026 od 18:00</strong></p>
<p><strong>Podzimní koncert pěveckého sboru, Zámecké nádvoří</strong></p>`)}
${blok(`<p><strong>3. listopadu 2026 od 17:00</strong></p>
<p><strong>Křest knihy o Třeboni, Infocentrum Třeboň</strong></p>`)}
${blok(`<p><strong>8. prosince 2026 od 19:00</strong></p>
<p><strong>Svíčkový koncert, Kostel sv. Jiljí Třeboň</strong></p>`)}
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

function jazykPoKotve(
  kandidat: { nazev: string; mistoNeboTyp: string },
  kotvaId: string,
): { verejneCo?: string | null; verejneRozliseni?: string | null } {
  const pravidlo = vytvoritVychoziRedakcniPoradi().find((p) => p.id === kotvaId);
  assert(pravidlo, `chybí pravidlo ${kotvaId}`);
  return sestavJazykBranyPoSparovani({
    polozka: pravidlo.polozka,
    kandidatMisto: kandidat.mistoNeboTyp,
    zdrojNazev: "Okolo Třeboně",
    jazykVerejny: pravidlo.jazykVerejny,
  });
}

function overFixture(): void {
  const shrnuti = parsovatOkoloTreboneProgram(FIXTURE);
  const k = parsovatUdalostiZeZdroje(FIXTURE, "text/html");
  assert(k.length === 7, `7 kandidátů (2 auto + 5 nezařazených), je ${k.length}`);
  assert(shrnuti.kandidati.length === 7, "shrnutí kandidáti");
  assert(shrnuti.prijetoHrobka === 1, `hrobka ${shrnuti.prijetoHrobka}`);
  assert(shrnuti.prijetoMatine === 1, `matiné ${shrnuti.prijetoMatine}`);
  assert(shrnuti.prijetoNezarazene === 5, `nezařazené ${shrnuti.prijetoNezarazene}`);
  assert(shrnuti.odmitnutoJkt === 2, `JKT drop ${shrnuti.odmitnutoJkt}`);
  assert(shrnuti.odmitnutoNocturna === 1, `nocturna ${shrnuti.odmitnutoNocturna}`);
  assert(shrnuti.odmitnutoTdf === 1, `TDF ${shrnuti.odmitnutoTdf}`);
  assert(shrnuti.odmitnutoMimo === 1, `mimo ${shrnuti.odmitnutoMimo}`);
  assert(shrnuti.odmitnutoNeuplne >= 1, `neúplné ${shrnuti.odmitnutoNeuplne}`);

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
  const jazykHrobka = jazykPoKotve(hrobka, BRANA_OKOLO_HROBKA_REDAKCNI_POLOZKA_ID);
  assert(jazykHrobka.verejneCo === "Koncert", `hrobka CO ${jazykHrobka.verejneCo}`);
  assert(
    jazykHrobka.verejneRozliseni === "Schwarzenberská hrobka",
    `hrobka KDE ${jazykHrobka.verejneRozliseni}`,
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
  const jazykMatine = jazykPoKotve(matine, BRANA_OKOLO_MATINE_REDAKCNI_POLOZKA_ID);
  assert(
    jazykMatine.verejneCo === "Lázeňské matiné",
    `matiné CO ${jazykMatine.verejneCo}`,
  );
  assert(
    /berta/i.test(jazykMatine.verejneRozliseni ?? ""),
    `matiné KDE z události ${jazykMatine.verejneRozliseni}`,
  );

  const ocekavanaNeznama = [
    "Zavírání plavecké sezóny",
    "Podzimní koncert pěveckého sboru",
    "Křest knihy o Třeboni",
    "Svíčkový koncert",
    "Žalman",
  ];
  const neznama = k.filter((x) => urcitOkoloTreboneKotvu(x) === null);
  assert(neznama.length === 5, `5 bez kotvy, je ${neznama.length}`);
  for (const nazev of ocekavanaNeznama) {
    const polozka = neznama.find((x) => x.nazev.includes(nazev));
    assert(polozka, `neznámá položka ${nazev}`);
    assert(polozka.datumOd.length === 10, `${nazev} datum`);
    assert(/^\d{2}:\d{2}$/.test(polozka.cas), `${nazev} čas`);
    assert(polozka.mistoNeboTyp.trim().length >= 2, `${nazev} místo`);
  }
  assert(neznama[4], "pátá neznámá se neztratila");

  assert(
    !k.some((x) => /tyla/i.test(x.mistoNeboTyp) || /Deczi|Spálený/.test(x.nazev)),
    "žádný JKT kandidát",
  );
  assert(
    !k.some((x) => /lomnice/i.test(x.mistoNeboTyp)),
    "žádný mimo Třeboň",
  );
  assert(!k.some((x) => /nocturn/i.test(x.nazev)), "žádná nocturna");
  assert(!k.some((x) => /\bTDF\b/i.test(x.nazev)), "žádné TDF");
  assert(!k.some((x) => /připravujeme/i.test(x.nazev)), "žádné neúplné");

  let n = 0;
  const inbox = pridatNesparovaneDoNezarazenych(vychoziNezarazeneDokument(), {
    zdrojId: "okolo-test",
    zdrojNazev: "Okolo Třeboně",
    nesparovane: neznama,
    noveId: () => `n-${++n}`,
  });
  assert(inbox.otevrene.length === 5, `inbox 5, je ${inbox.otevrene.length}`);
  assert(
    !inbox.otevrene.some((x) => /Veverka|matiné/i.test(x.nazev)),
    "A/B nesmí do Nezařazených",
  );
  for (const nazev of ocekavanaNeznama) {
    assert(
      inbox.otevrene.some((x) => x.nazev.includes(nazev)),
      `inbox má ${nazev}`,
    );
  }

  console.log("OK fixture: 1 hrobka, 1 matiné, 5 nezařazených, JKT+nocturna+TDF+mimo+neúplné = 0");
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
  const dnesIso = dnesIsoVPraze();

  const automaticky: string[] = [];
  const nezarazene: string[] = [];
  const minule: string[] = [];

  for (const k of shrnuti.kandidati) {
    const radek = `${k.nazev} | ${k.datumOd} | ${k.cas} | ${k.mistoNeboTyp}`;
    if (jeUdalostCelaMinula(k, dnesIso)) {
      minule.push(radek);
      continue;
    }
    const kotva = urcitOkoloTreboneKotvu(k);
    if (kotva) {
      const sparovani = sparovatVlastnictvimHlidaneKotvy(
        polozky,
        HLIDANE_KOTVY,
        kotva,
      );
      const kotvaId = sparovani.ok ? sparovani.redakcniPolozkaId : "(nesparováno)";
      automaticky.push(`${radek} | ${kotvaId}`);
      continue;
    }
    nezarazene.push(radek);
  }

  console.log("\nREAD-ONLY předscan", url);
  console.log("\nAUTOMATICKY:");
  if (automaticky.length === 0) {
    console.log("(žádné)");
  } else {
    for (const r of automaticky) {
      console.log(`- ${r}`);
    }
  }
  console.log("\nNEZAŘAZENÉ:");
  if (nezarazene.length === 0) {
    console.log("(žádné)");
  } else {
    for (const r of nezarazene) {
      console.log(`- ${r}`);
    }
  }
  console.log("\nZAHOZENO:");
  console.log(`- JKT: ${shrnuti.odmitnutoJkt}`);
  console.log(`- nocturna: ${shrnuti.odmitnutoNocturna}`);
  console.log(`- TDF: ${shrnuti.odmitnutoTdf}`);
  console.log(`- mimo Třeboň: ${shrnuti.odmitnutoMimo}`);
  console.log(`- neúplné: ${shrnuti.odmitnutoNeuplne}`);
  console.log(`- bez termínu (layout/šum): ${shrnuti.odmitnutoBezTerminu}`);
  console.log(`- minulá (scan by nezapsal): ${minule.length}`);
  for (const z of shrnuti.zahazene) {
    console.log(
      `  · ${z.skupina}: ${z.nazev} | ${z.datumOd} | ${z.cas} | ${z.mistoNeboTyp}`,
    );
  }
  for (const r of minule) {
    console.log(`  · minulá: ${r}`);
  }
}

if (process.argv.includes("--zivy")) {
  void zivyPredscan();
}
