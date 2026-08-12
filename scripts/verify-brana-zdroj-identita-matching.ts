/**
 * Regrese: identita zdroje jako doplňkový matching signál.
 * Spuštění: npx tsx scripts/verify-brana-zdroj-identita-matching.ts
 */

import type { BranaRedakcniPolozkaStav } from "../src/lib/brana/admin/redakcni-kostra";
import type { BranaScanKandidat } from "../src/lib/brana/admin/zdroj-scan-parser";
import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import { sparovatSRedakcniPolozkou } from "../src/lib/brana/admin/zdroj-scan-sparovani";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function polozka(
  partial: Pick<BranaRedakcniPolozkaStav, "id" | "polozka"> &
    Partial<BranaRedakcniPolozkaStav>,
): BranaRedakcniPolozkaStav {
  return {
    id: partial.id,
    polozka: partial.polozka,
    pouzivat: partial.pouzivat ?? "ANO",
    priorita: partial.priorita ?? null,
    subpriorita: partial.subpriorita ?? null,
    vyhled: partial.vyhled ?? "NE",
    poznamka: partial.poznamka ?? "",
    mimoKostru: partial.mimoKostru ?? false,
    jazykVerejny: partial.jazykVerejny ?? null,
  };
}

const POLOZKY: BranaRedakcniPolozkaStav[] = [
  polozka({ id: "divadlo-jk-tyla", polozka: "Divadlo J. K. Tyla", priorita: 5 }),
  polozka({
    id: "trebonska-nocturna",
    polozka: "Třeboňská nocturna",
    priorita: 15,
  }),
  polozka({ id: "kino-svetozor", polozka: "Kino Světozor", priorita: 1 }),
];

const NOCTURNA_KANDIDAT: BranaScanKandidat = {
  nazev: "Matyáš Novák - Smetana Reborn",
  datumOd: "2026-10-15",
  datumDo: "2026-10-15",
  cas: "19:00",
  mistoNeboTyp: "Divadlo J. K. Tyla, Třeboň",
};

function overNocturnaSeZdrojem(): void {
  const r = sparovatSRedakcniPolozkou(NOCTURNA_KANDIDAT, POLOZKY, {
    zdrojNazev: "Třeboňská nocturna",
  });
  assert(r.ok, "Nocturna se zdrojem: očekáván MATCH");
  assert(
    r.redakcniPolozkaId === "trebonska-nocturna",
    `Nocturna se zdrojem: očekávána nocturna, je ${r.ok ? r.redakcniPolozkaId : "?"}`,
  );
  console.log("OK Nocturna + zdrojNazev → trebonska-nocturna");
}

function overNocturnaBezZdroje(): void {
  const r = sparovatSRedakcniPolozkou(NOCTURNA_KANDIDAT, POLOZKY);
  assert(r.ok, "Nocturna bez zdroje: očekáván MATCH (dnešní chování)");
  assert(
    r.redakcniPolozkaId === "divadlo-jk-tyla",
    `Nocturna bez zdroje: očekáváno JKT, je ${r.ok ? r.redakcniPolozkaId : "?"}`,
  );
  console.log("OK Nocturna bez zdrojNazev → divadlo-jk-tyla (legacy)");
}

function overAgregator(
  zdrojNazev: string,
  popisek: string,
): void {
  const r = sparovatSRedakcniPolozkou(NOCTURNA_KANDIDAT, POLOZKY, {
    zdrojNazev,
  });
  assert(r.ok, `${popisek}: očekáván MATCH podle místa`);
  assert(
    r.redakcniPolozkaId === "divadlo-jk-tyla",
    `${popisek}: nesmí vyhrát přes zdroj; je ${r.ok ? r.redakcniPolozkaId : "?"}`,
  );
  console.log(`OK agregátor „${zdrojNazev}“ → divadlo-jk-tyla (místo)`);
}

function overRemizaBezeZmeny(): void {
  const dveStejne: BranaRedakcniPolozkaStav[] = [
    polozka({ id: "a", polozka: "Divadlo J. K. Tyla" }),
    polozka({ id: "b", polozka: "Divadlo J. K. Tyla" }),
  ];
  const r = sparovatSRedakcniPolozkou(NOCTURNA_KANDIDAT, dveStejne);
  assert(!r.ok, "remíza stejného skóre → NO-MATCH");
  console.log("OK remíza dvou položek → Nezařazené");
}

function overKinoParserBezeZmeny(): void {
  const html = `<!DOCTYPE html>
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
  const kandidati = parsovatUdalostiZeZdroje(html, "text/html");
  assert(kandidati.length === 1, `kino parser: ${kandidati.length}`);
  const r = sparovatSRedakcniPolozkou(kandidati[0], POLOZKY, {
    zdrojNazev: "Kino Světozor",
  });
  assert(r.ok && r.redakcniPolozkaId === "kino-svetozor", "kino matching");
  console.log("OK kinotrebon parser + matching beze změny");
}

overNocturnaSeZdrojem();
overNocturnaBezZdroje();
overAgregator("iTřeboň – kalendář akcí", "iTřeboň");
overAgregator("VisitTřeboň – kalendář akcí", "VisitTřeboň");
overRemizaBezeZmeny();
overKinoParserBezeZmeny();
console.log("ALL PASS");
