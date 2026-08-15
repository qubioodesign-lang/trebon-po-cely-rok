/**
 * Rybářství Třeboň — parser + HLIDANE_KOTVY předscan (bez produkčního zápisu).
 * Spuštění: npx tsx scripts/verify-brana-rybarstvi-parser.ts
 */

import https from "node:https";
import {
  dnyTrvaniUdalosti,
  formatujDatumVyhled,
  formatujDenKalendare,
  dnesIsoVPraze,
  jeUdalostCelaMinula,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import type { BranaRedakcniPolozkaStav } from "../src/lib/brana/admin/redakcni-kostra";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";
import {
  jeRybarstviZdrojUrl,
  parsovatUdalostiZeZdroje,
  sestavRybarstviPodzimniVylovyUrl,
  type BranaScanKandidat,
} from "../src/lib/brana/admin/zdroj-scan-parser";
import { sparovatSHlidanymiKotvami } from "../src/lib/brana/admin/zdroj-scan-sparovani";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg);
}

function get(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 BRANA-verify" } }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

/** Redakční stav podle uživatelského rozhodnutí (simulace, ne Blob). */
function redakceProHlidaneKotvy(): BranaRedakcniPolozkaStav[] {
  const base = vytvoritVychoziRedakcniPoradi();
  return base.map((p) => {
    if (p.id === "vylov-rozmberka") {
      return {
        ...p,
        polozka: "Výlov Rožmberk",
        pouzivat: "ANO",
        vyhled: "ANO",
        priorita: 1,
        subpriorita: 1,
        poznamka: "Výlov rybníka Rožmberk",
        jazykVerejny: {
          co: { rezim: "PEVNE", text: "Výlov" },
          rozliseni: { rezim: "PEVNE", text: "Rožmberk" },
        },
      };
    }
    if (p.id === "vylov-sveta") {
      return {
        ...p,
        polozka: "Výlov Svět",
        pouzivat: "ANO",
        vyhled: "ANO",
        priorita: 1,
        subpriorita: 2,
        poznamka: "Výlov rybníka Svět",
        jazykVerejny: {
          co: { rezim: "PEVNE", text: "Výlov" },
          rozliseni: { rezim: "PEVNE", text: "Svět" },
        },
      };
    }
    return p;
  });
}

const KOTVY = ["vylov-rozmberka", "vylov-sveta"] as const;

function fixtureHtml2026(): string {
  return `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.rybarstvi.cz/podzimni-vylov-rybniku"/>
<title>Výlovy rybníků 2026 - Rybářství Třeboň</title>
</head><body>
<h3>Termíny podzimních výlovů vybraných rybníků 2026</h3>
<p>Termíny výlovů vybraných rybníků pro podzim 2026 oznámí třeboňští rybáři v září t. r.</p>
<p>Zatím je znám pouze jeden termín. Podzimní slavnostní výlov rybníka Rožmberk bude 16. – 18. 10. 2026.</p>
<h3>Termíny podzimních výlovů vybraných rybníků 2025</h3>
<table>
<tr><th>Datum</th><th>Rybník</th><th>Katastr. území</th><th>Výměra v ha</th></tr>
<tr><td>17. – 19. 10.</td><td>Rožmberk</td><td>Stará Hlína</td><td>644</td></tr>
<tr><td>3. – 5. 11.</td><td>Svět</td><td>Třeboň</td><td>213</td></tr>
<tr><td>29. – 31. 10.</td><td>Horusický velký</td><td>Horusice</td><td>439</td></tr>
</table>
<h3>Slavnostní výlov Rožmberka v roce 2026</h3>
<p>ve dnech 16. až 18. října 2026 výlov rybníka Rožmberk</p>
</body></html>`;
}

function overFixture(): void {
  assert(jeRybarstviZdrojUrl("https://www.rybarstvi.cz/"), "host");
  assert(
    sestavRybarstviPodzimniVylovyUrl("https://www.rybarstvi.cz/") ===
      "https://www.rybarstvi.cz/podzimni-vylov-rybniku",
    "podzimni url",
  );

  const kandidati = parsovatUdalostiZeZdroje(fixtureHtml2026(), "text/html");
  // Historie 2025 se nesmí propustit (rok < aktuální 2026).
  assert(
    !kandidati.some((k) => k.datumOd.startsWith("2025-")),
    "2025 ignorovat",
  );
  assert(
    !kandidati.some((k) => /horusick/i.test(k.nazev)),
    "Horusický z 2025 ne",
  );

  const rozm = kandidati.filter((k) => k.nazev === "Výlov Rožmberk");
  assert(rozm.length === 1, `Rožmberk count ${rozm.length}`);
  assert(rozm[0].datumOd === "2026-10-16", rozm[0].datumOd);
  assert(rozm[0].datumDo === "2026-10-18", rozm[0].datumDo);
  assert(rozm[0].cas === "", "čas prázdný");

  const polozky = redakceProHlidaneKotvy();
  const match = sparovatSHlidanymiKotvami(rozm[0], polozky, KOTVY);
  assert(match.ok && match.redakcniPolozkaId === "vylov-rozmberka", "match Rožmberk");

  for (const nazev of ["Výlov Horusický velký", "Výlov Dvořiště", "Cokoli"]) {
    const r = sparovatSHlidanymiKotvami(
      {
        nazev,
        datumOd: "2026-11-01",
        datumDo: "2026-11-03",
        cas: "",
        mistoNeboTyp: "",
      },
      polozky,
      KOTVY,
    );
    assert(!r.ok, `ignorovat ${nazev}`);
  }

  // Svět 2025 v tabulce – nesmí být v kandidátech
  assert(!kandidati.some((k) => k.nazev === "Výlov Svět"), "Svět 2025 ne");

  console.log("OK fixture Rožmberk 2026 / historie ignorována");
}

async function overZivyPrescan(): Promise<void> {
  const zdrojUrl = "https://www.rybarstvi.cz/";
  const url = sestavRybarstviPodzimniVylovyUrl(zdrojUrl);
  const html = await get(url);
  const kandidati = parsovatUdalostiZeZdroje(html, "text/html");
  const polozky = redakceProHlidaneKotvy();
  const dnes = dnesIsoVPraze();

  const poKotvach: {
    kandidat: BranaScanKandidat;
    redakcniPolozkaId: string;
  }[] = [];
  let ignorovano = 0;
  for (const k of kandidati) {
    if (jeUdalostCelaMinula(k, dnes)) {
      continue;
    }
    const s = sparovatSHlidanymiKotvami(k, polozky, KOTVY);
    if (!s.ok) {
      ignorovano += 1;
      continue;
    }
    poKotvach.push({ kandidat: k, redakcniPolozkaId: s.redakcniPolozkaId });
  }

  console.log(
    JSON.stringify(
      {
        fetchu: 1,
        autoritativniUrl: url,
        parserKandidatu: kandidati.length,
        kandidati,
        poHlidanychKotvach: poKotvach.length,
        ignorovanoMimoKotvy: ignorovano,
        ceka: poKotvach,
        ocekavanyScan: {
          nalezeno: kandidati.length,
          pridano: poKotvach.length,
          jizExistuje: 0,
          nezarazeno: 0,
        },
      },
      null,
      2,
    ),
  );

  assert(poKotvach.length <= 2, "max 2 kotvy");
  const rozm = poKotvach.find((x) => x.redakcniPolozkaId === "vylov-rozmberka");
  assert(rozm, "Rožmberk musí projít");
  assert(rozm.kandidat.datumOd === "2026-10-16", "datumOd");
  assert(rozm.kandidat.datumDo === "2026-10-18", "datumDo");
  assert(rozm.kandidat.cas === "", "bez vymyšleného času");
  assert(
    !poKotvach.some((x) => x.redakcniPolozkaId === "vylov-sveta"),
    "Svět 2026 zatím 0",
  );

  // Náhled Kalendáře / Výhledu
  const pravidlo = polozky.find((p) => p.id === "vylov-rozmberka")!;
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: pravidlo.polozka,
    kandidatMisto: rozm.kandidat.mistoNeboTyp,
    zdrojNazev: "Rybářství Třeboň – výlovy",
    jazykVerejny: pravidlo.jazykVerejny,
  });
  const udalost: BranaKonkretniUdalost = {
    id: "preview-rozmberk",
    redakcniPolozkaId: "vylov-rozmberka",
    datumOd: rozm.kandidat.datumOd,
    datumDo: rozm.kandidat.datumDo,
    cas: rozm.kandidat.cas,
    mistoNeboTyp: jazyk.mistoNeboTyp,
    nazev: rozm.kandidat.nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: "CEKA_NA_SCHVALENI",
    verejneCo: jazyk.verejneCo ?? null,
    verejneRozliseni: jazyk.verejneRozliseni ?? null,
  };
  const dny = dnyTrvaniUdalosti(udalost);
  console.log("\n=== NÁHLED KALENDÁŘ ===");
  console.log({
    CO: udalost.verejneCo,
    KDE: udalost.verejneRozliseni,
    datumOd: udalost.datumOd,
    datumDo: udalost.datumDo,
    cas: udalost.cas === "" ? "(prázdný – zdroj neuvedl)" : udalost.cas,
    nazev: udalost.nazev,
    mistoNeboTyp: udalost.mistoNeboTyp,
    dnyKalendare: dny.map((d) => formatujDenKalendare(d)),
  });
  console.log("\n=== NÁHLED VÝHLED ===");
  console.log({
    CO: udalost.verejneCo,
    KDE: udalost.verejneRozliseni,
    datumLabel: formatujDatumVyhled(udalost),
    nazev: udalost.nazev,
    cas: "(Výhled čas nezobrazuje)",
  });

  console.log("OK živý předscan");
}

async function main(): Promise<void> {
  overFixture();
  await overZivyPrescan();
  console.log("ALL OK verify-brana-rybarstvi-parser");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
