/**
 * Ověření zobrazovacího filtru pracovního Kalendáře (minulé dny).
 * Spuštění: npx tsx scripts/verify-pracovni-kalendar-skryt-minule-dny.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { okamzikZPrahy } from "../src/lib/brana/cas";
import {
  dnesIsoVPraze,
  filtrujDnyPracovnihoKalendareOdDnes,
  type BranaKalendarDen,
} from "../src/lib/brana/admin/konkretni-udalost";

let selhalo = 0;
function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function den(isoDen: string): BranaKalendarDen {
  return { isoDen, datumLabel: isoDen, udalosti: [] };
}

function isoDny(dny: readonly BranaKalendarDen[]): string[] {
  return dny.map((d) => d.isoDen);
}

{
  const vstup = [
    den("2026-08-16"),
    den("2026-08-17"),
    den("2026-08-18"),
    den("2026-08-19"),
  ];
  const po = filtrujDnyPracovnihoKalendareOdDnes(vstup, "2026-08-17");
  assert(!isoDny(po).includes("2026-08-16"), "1: den < dnes nezobrazen");
  assert(isoDny(po).includes("2026-08-17"), "2: dnešek zobrazen");
  assert(isoDny(po).includes("2026-08-18"), "3a: budoucí den zobrazen");
  assert(isoDny(po).includes("2026-08-19"), "3b: další budoucí den zobrazen");
  assert(po.length === 3, "3c: jen dnes + budoucnost");
}

{
  const vstup = [
    den("2026-08-17"),
    den("2026-08-18"),
    den("2026-08-25"),
  ];
  const predPulnoci = filtrujDnyPracovnihoKalendareOdDnes(
    vstup,
    dnesIsoVPraze(okamzikZPrahy(2026, 8, 17, 23, 59)),
  );
  const poPulnoci = filtrujDnyPracovnihoKalendareOdDnes(
    vstup,
    dnesIsoVPraze(okamzikZPrahy(2026, 8, 18, 0, 0)),
  );
  assert(
    dnesIsoVPraze(okamzikZPrahy(2026, 8, 17, 23, 59)) === "2026-08-17",
    "4a: 23:59 SELČ = 17. 8.",
  );
  assert(
    dnesIsoVPraze(okamzikZPrahy(2026, 8, 18, 0, 0)) === "2026-08-18",
    "4b: 00:00 SELČ = 18. 8.",
  );
  assert(isoDny(predPulnoci).includes("2026-08-17"), "4c: před půlnocí dnešek 17. vidět");
  assert(!isoDny(poPulnoci).includes("2026-08-17"), "4d: po 00:00 SELČ 17. skryt");
  assert(isoDny(poPulnoci).includes("2026-08-18"), "4e: po 00:00 SELČ 18. vidět");
}

{
  const letoPredUtcPulnoci = new Date(Date.UTC(2026, 7, 17, 21, 59));
  const letoPoPrahaPulnoci = new Date(Date.UTC(2026, 7, 17, 22, 0));
  const letoUtcPulnoc = new Date(Date.UTC(2026, 7, 18, 0, 0));
  assert(
    dnesIsoVPraze(letoPredUtcPulnoci) === "2026-08-17",
    "5a: léto 21:59 UTC = 23:59 Prague 17. 8.",
  );
  assert(
    dnesIsoVPraze(letoPoPrahaPulnoci) === "2026-08-18",
    "5b: léto 22:00 UTC = 00:00 Prague 18. 8. (ne UTC půlnoc)",
  );
  assert(
    dnesIsoVPraze(letoUtcPulnoc) === "2026-08-18",
    "5c: léto 00:00 UTC = 02:00 Prague 18. 8. (UTC půlnoc den nemění)",
  );

  const zimaPred = okamzikZPrahy(2026, 1, 15, 23, 59);
  const zimaPo = okamzikZPrahy(2026, 1, 16, 0, 0);
  const zimaUtcPulnoc = new Date(Date.UTC(2026, 0, 16, 0, 0));
  assert(dnesIsoVPraze(zimaPred) === "2026-01-15", "5d: zima 23:59 SEČ = 15. 1.");
  assert(dnesIsoVPraze(zimaPo) === "2026-01-16", "5e: zima 00:00 SEČ = 16. 1.");
  assert(
    dnesIsoVPraze(zimaUtcPulnoc) === "2026-01-16",
    "5f: zima 00:00 UTC = 01:00 Prague 16. 1. (UTC půlnoc den nemění)",
  );

  const zimaVstup = [den("2026-01-15"), den("2026-01-16"), den("2026-01-20")];
  const zimaPoFiltru = filtrujDnyPracovnihoKalendareOdDnes(
    zimaVstup,
    dnesIsoVPraze(zimaPo),
  );
  assert(!isoDny(zimaPoFiltru).includes("2026-01-15"), "5g: zima po 00:00 15. skryt");
  assert(isoDny(zimaPoFiltru).includes("2026-01-16"), "5h: zima po 00:00 16. vidět");
}

{
  const budoucniKontrolni = den("2026-08-30");
  const po = filtrujDnyPracovnihoKalendareOdDnes(
    [den("2026-08-16"), den("2026-08-17"), budoucniKontrolni],
    "2026-08-17",
  );
  assert(
    isoDny(po).includes("2026-08-30"),
    "8: budoucí den kontrolního bloku filtr neskryje",
  );
}

const root = join(__dirname, "..");
const stranka = readFileSync(
  join(root, "src/app/brana/admin/sprava/kalendar/page.tsx"),
  "utf8",
);
const uloziste = readFileSync(
  join(root, "src/lib/brana/admin/konkretni-udalosti-uloziste.ts"),
  "utf8",
);
const route = readFileSync(
  join(root, "src/app/api/brana/casovy-plan/route.ts"),
  "utf8",
);
const vercel = readFileSync(join(root, "vercel.json"), "utf8");
const akce = readFileSync(join(root, "src/app/brana/admin/actions.ts"), "utf8");

assert(
  /filtrujDnyPracovnihoKalendareOdDnes\(\s*doplnPrazdneDnyDoKalendare\(/.test(
    stranka,
  ) && stranka.includes("dnesIsoVPraze()"),
  "page: filtr až na výsledných dnech po doplnPrazdneDny",
);
assert(
  stranka.includes("sestavIdProSchvalitKontrolu(rucniUdalosti") &&
    stranka.includes("spocitejPrazdneDnyKontrolnihoBloku") &&
    stranka.includes("isoDenPoslednihoDneKontrolnihoBlokuVPraze()"),
  "8: 21denní blok a Schválit kontrolu beze změny vstupu",
);
assert(
  stranka.includes("persistovaneIdUdalosti={rucniUdalosti.map((u) => u.id)}"),
  "7: persistované ID (vč. skrytých dnů) beze změny",
);
assert(
  uloziste.includes("uklidMinulychKonkretnichUdalostiProScheduler") &&
    route.includes("uklidMinulychKonkretnichUdalostiProScheduler") &&
    /"path": "\/api\/brana\/casovy-plan"/.test(vercel) &&
    /"schedule": "0 7 \* \* \*"/.test(vercel) &&
    /"schedule": "0 8 \* \* \*"/.test(vercel),
  "6: cron a fyzický úklid beze změny",
);
assert(
  akce.includes("schvalitKonkretniUdalostAkce") &&
    akce.includes("upravitAutomatickouCekaUdalostAkce") &&
    akce.includes("vyrazitAutomatickouCekaUdalostAkce"),
  "7: Schválit / Upravit / Vyřadit akce beze změny",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly skrytí minulých dnů prošly.");
