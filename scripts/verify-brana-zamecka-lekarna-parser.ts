/**
 * Zámecká lékárna — parser + HLIDANE_KOTVY (read-only, bez produkčního scanu).
 * Spuštění: npx tsx scripts/verify-brana-zamecka-lekarna-parser.ts
 */

import https from "node:https";
import {
  jeUdalostCelaMinula,
  dnesIsoVPraze,
  vytvoritScanKlicAutomatickeUdalosti,
} from "../src/lib/brana/admin/konkretni-udalost";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";
import {
  deduplikovatScanKandidaty,
  jeZameckaLekarnaZdrojUrl,
  parsovatUdalostiZeZdroje,
  sestavZameckaLekarnaHubUrl,
  vytahnoutZameckaLekarnaMesicUrlky,
  type BranaScanKandidat,
} from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  sparovatSHlidanymiKotvami,
  sparovatSRedakcniPolozkou,
} from "../src/lib/brana/admin/zdroj-scan-sparovani";
import { doplnVychoziPoleZdroje } from "../src/lib/brana/admin/zdroj";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function get(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 BRANA-verify" } }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve({ status: r.statusCode ?? 0, body: d }));
      })
      .on("error", reject);
  });
}

const KOTVA_IDS = ["zamecka-lekarna-trebon"] as const;

function fixtureMesicHtml(extraLi: string): string {
  return `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.zameckalekarnatrebon.cz/c-111-srpen-2026.html"/>
<title>Srpen 2026 | Zámecká lékárna Třeboň</title>
</head><body>
<div id="content-1">
<div class="articleContent">
<p><strong>ZAČÁTKY PROHLÍDEK V 10:10; 11:40</strong></p>
<p><strong>20.8.&nbsp;</strong></p>
<ul>
<li><strong>LEONARDO - HRAV&Aacute; V&Yacute;STAVA PRO CELOU RODINU - <a href="#">VSTUPENKY</a></strong></li>
<li><strong>VEČER POD PLATANY S DEGUSTAC&Iacute; V&Iacute;NA - 18-21 HOD. - INFO</strong></li>
<li><strong>PROHL&Iacute;DKY S PAN&Iacute; L&Eacute;K&Aacute;RN&Iacute;KOVOU - zač. 10:10; 11:40; 13:10 - VSTUPENKY</strong></li>
${extraLi}
</ul>
<p><strong>14.8</strong>.</p>
<ul>
<li><strong>18,00 HOD. KOUZELN&Iacute;K PET - VYSTOUPEN&Iacute; PRO DĚTI - VSTUPENKY</strong></li>
</ul>
</div>
<div class="cleaner"></div>
</div>
</body></html>`;
}

function overDiscoveryAParserHelpers(): void {
  assert(
    jeZameckaLekarnaZdrojUrl("https://www.zameckalekarnatrebon.cz/"),
    "host ok",
  );
  assert(
    sestavZameckaLekarnaHubUrl("https://www.zameckalekarnatrebon.cz/") ===
      "https://www.zameckalekarnatrebon.cz/c-24-denni-program.html",
    "hub z homepage",
  );
  const hubOk = `<div class="submenuArea"><div class="subcategory"><h2 class="title">Srpen 2026</h2>
<a href="/c-111-srpen-2026.html"><span>více</span></a></div></div>`;
  const urls = vytahnoutZameckaLekarnaMesicUrlky(
    hubOk,
    "https://www.zameckalekarnatrebon.cz/c-24-denni-program.html",
  );
  assert(urls.length === 1, `discovery 1, got ${urls.length}`);
  assert(urls[0].endsWith("/c-111-srpen-2026.html"), urls[0]);
  console.log("OK discovery helpers");
}

function overFixtureFrancouzske(): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const html = fixtureMesicHtml(
    `<li><strong>Francouzské dny TRE(s)BON - 10-20 HOD. - VSTUPENKY</strong></li>`,
  );
  const kandidati = parsovatUdalostiZeZdroje(html, "text/html");
  assert(kandidati.length >= 4, `fixture kandidáti ${kandidati.length}`);

  const matchnute = kandidati.filter((k) => {
    const r = sparovatSHlidanymiKotvami(k, polozky, KOTVA_IDS);
    return r.ok;
  });
  assert(matchnute.length === 1, `očekáván 1 match, je ${matchnute.length}`);
  assert(
    matchnute[0].nazev === "Francouzské dny TRE(s)BON",
    `nazev=${matchnute[0].nazev}`,
  );
  const spar = sparovatSHlidanymiKotvami(matchnute[0], polozky, KOTVA_IDS);
  assert(
    spar.ok && spar.redakcniPolozkaId === "zamecka-lekarna-trebon",
    "kotva id",
  );

  for (const nazevCast of [
    "VEČER POD PLATANY",
    "LEONARDO",
    "PROHLÍDKY S PANÍ",
    "KOUZELNÍK PET",
  ]) {
    const k = kandidati.find((x) =>
      x.nazev.toUpperCase().includes(nazevCast.split(" ")[0]),
    );
    assert(k, `chybí kandidát ${nazevCast}`);
    assert(
      !sparovatSHlidanymiKotvami(k, polozky, KOTVA_IDS).ok,
      `ignorovat ${k.nazev}`,
    );
  }

  // Minulost: 14.8.2026 při „dnes“ 20.8.2026
  const kouzelnik = kandidati.find((k) => /kouzeln/i.test(k.nazev));
  assert(kouzelnik, "kouzelník v fixture");
  assert(
    jeUdalostCelaMinula(kouzelnik, "2026-08-20"),
    "14.8 je minulá vůči 20.8",
  );

  // Prázdné kotvy
  assert(
    !sparovatSHlidanymiKotvami(matchnute[0], polozky, []).ok,
    "prázdné kotvy → žádný match",
  );

  // scanKlic tvar
  const klic = vytvoritScanKlicAutomatickeUdalosti({
    redakcniPolozkaId: "zamecka-lekarna-trebon",
    datumOd: matchnute[0].datumOd,
    cas: matchnute[0].cas,
    nazev: matchnute[0].nazev,
  });
  assert(klic.includes("zamecka-lekarna-trebon"), "scanKlic");
  assert(
    deduplikovatScanKandidaty([...kandidati, ...kandidati]).length ===
      kandidati.length,
    "dedup",
  );

  console.log(
    `OK fixture Francouzské dny: kandidátů=${kandidati.length}, matchů=${matchnute.length}, cas=${matchnute[0].cas}`,
  );
}

function overBeznyRegrese(): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const g = sparovatSRedakcniPolozkou(
    {
      nazev: "Nějaká akce",
      datumOd: "2026-08-20",
      datumDo: "2026-08-20",
      cas: "17:00",
      mistoNeboTyp: "",
    },
    polozky,
    { zdrojNazev: "Galerie 105" },
  );
  assert(g.ok && g.redakcniPolozkaId === "galerie-105", "Galerie 105");

  const n = sparovatSRedakcniPolozkou(
    {
      nazev: "Koncert A",
      datumOd: "2026-10-15",
      datumDo: "2026-10-15",
      cas: "19:00",
      mistoNeboTyp: "",
    },
    polozky,
    { zdrojNazev: "Třeboňská nocturna" },
  );
  assert(n.ok && n.redakcniPolozkaId === "trebonska-nocturna", "Nocturna");

  const kino = parsovatUdalostiZeZdroje(
    `<!DOCTYPE html><html><body>
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
</body></html>`,
    "text/html",
  );
  assert(kino[0]?.nazev === "Test Film", "kino parser");

  const dsn = parsovatUdalostiZeZdroje(
    `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.dumstepankanetolickeho.cz/kalendar-akci/"/>
</head><body>
<div class="home-block-wrapper event-item">
  <h2><a href="/akce/x/" title="Vernisáž test">Vernisáž test</a></h2>
  <small>19.08.2026 17:00</small>
</div>
</body></html>`,
    "text/html",
  );
  assert(dsn[0]?.cas === "17:00", "DSN parser");

  const stary = doplnVychoziPoleZdroje({
    id: "z",
    nazev: "Galerie 105",
    typ: "DLOUHODOBY",
    url: "https://trebon105.cz/x",
  });
  assert(stary.rezimScanu === "BEZNY", "BEZNY default");
  console.log("OK BEZNY / Galerie / Nocturna / Kino / DSN");
}

async function overZivyPrescan(): Promise<void> {
  const zdrojUrl = "https://www.zameckalekarnatrebon.cz/";
  const hubUrl = sestavZameckaLekarnaHubUrl(zdrojUrl);
  const hub = await get(hubUrl);
  assert(hub.status === 200, `hub status ${hub.status}`);
  const mesice = vytahnoutZameckaLekarnaMesicUrlky(hub.body, hubUrl);
  assert(mesice.length >= 1, "živý hub má ≥1 měsíc");
  assert(mesice.length <= 4, "max 4 měsíce");
  console.log(`živé měsíce (${mesice.length}):`, mesice);

  const fetchu = 1 + mesice.length;
  const sloucene: BranaScanKandidat[] = [];
  for (const u of mesice) {
    const m = await get(u);
    assert(m.status === 200, `měsíc ${u} status ${m.status}`);
    sloucene.push(...parsovatUdalostiZeZdroje(m.body, "text/html"));
  }
  const kandidati = deduplikovatScanKandidaty(sloucene);
  assert(kandidati.length > 20, `očekáváno desítky kandidátů, je ${kandidati.length}`);
  assert(
    !kandidati.some((k) => /francouz/i.test(k.nazev)),
    "živý program nemá Francouzské dny",
  );

  const polozky = vytvoritVychoziRedakcniPoradi();
  const dnes = dnesIsoVPraze();
  let budoucich = 0;
  let pustene = 0;
  for (const k of kandidati) {
    if (jeUdalostCelaMinula(k, dnes)) {
      continue;
    }
    budoucich += 1;
    if (sparovatSHlidanymiKotvami(k, polozky, KOTVA_IDS).ok) {
      pustene += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        fetchu,
        parserKandidatu: kandidati.length,
        budoucichPoFiltruMinulosti: budoucich,
        pustenePresKotvy: pustene,
        ocekavanyScan: {
          nalezeno: kandidati.length,
          pridano: 0,
          jizExistuje: 0,
          nezarazeno: 0,
        },
        samples: kandidati.slice(0, 5).map((k) => ({
          nazev: k.nazev,
          datumOd: k.datumOd,
          cas: k.cas,
        })),
      },
      null,
      2,
    ),
  );

  assert(pustene === 0, `STOP: živý program pustil ${pustene} kotev (očekáváno 0)`);
  console.log("OK živý předscan: 0 puštěných kotev");
}

async function main(): Promise<void> {
  overDiscoveryAParserHelpers();
  overFixtureFrancouzske();
  overBeznyRegrese();
  await overZivyPrescan();
  console.log("ALL OK verify-brana-zamecka-lekarna-parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});