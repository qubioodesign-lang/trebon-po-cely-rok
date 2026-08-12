/**
 * Regrese: režim HLIDANE_KOTVY + zpětná kompatibilita BEZNY.
 * Spuštění: npx tsx scripts/verify-brana-hlidane-kotvy.ts
 */

import {
  doplnVychoziPoleZdroje,
  validovatZdrojVstup,
  type BranaZdroj,
} from "../src/lib/brana/admin/zdroj";
import {
  sparovatSHlidanymiKotvami,
  sparovatSRedakcniPolozkou,
} from "../src/lib/brana/admin/zdroj-scan-sparovani";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";
import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import type { BranaScanKandidat } from "../src/lib/brana/admin/zdroj-scan-parser";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function kandidat(partial: Partial<BranaScanKandidat> & { nazev: string }): BranaScanKandidat {
  return {
    nazev: partial.nazev,
    datumOd: partial.datumOd ?? "2027-06-15",
    datumDo: partial.datumDo ?? "2027-06-15",
    cas: partial.cas ?? "18:00",
    mistoNeboTyp: partial.mistoNeboTyp ?? "",
  };
}

function overZpetnaKompatibilita(): void {
  const stary = doplnVychoziPoleZdroje({
    id: "zdroj-1",
    nazev: "Galerie 105",
    typ: "DLOUHODOBY",
    url: "https://trebon105.cz/program/prostor:galerie",
  });
  assert(stary.rezimScanu === "BEZNY", "default rezim BEZNY");
  assert(
    Array.isArray(stary.hlidaneRedakcniPolozkaIds) &&
      stary.hlidaneRedakcniPolozkaIds.length === 0,
    "default kotvy []",
  );

  const validace = validovatZdrojVstup({
    nazev: "Galerie 105",
    typ: "DLOUHODOBY",
    url: "https://trebon105.cz/program/prostor:galerie",
  });
  assert(validace.ok, "validace starého vstupu");
  if (validace.ok) {
    assert(validace.rezimScanu === "BEZNY", "validace default BEZNY");
    assert(validace.hlidaneRedakcniPolozkaIds.length === 0, "validace default []");
  }
  console.log("OK zpětná kompatibilita BEZNY / []");
}

function overHlidanePrazdne(): void {
  const zdroj: BranaZdroj = doplnVychoziPoleZdroje({
    id: "z",
    nazev: "Zámecká lékárna Třeboň",
    typ: "DLOUHODOBY",
    url: "https://www.zameckalekarnatrebon.cz/",
    rezimScanu: "HLIDANE_KOTVY",
    hlidaneRedakcniPolozkaIds: [],
  });
  assert(zdroj.rezimScanu === "HLIDANE_KOTVY", "rezim");
  assert(zdroj.hlidaneRedakcniPolozkaIds.length === 0, "kotvy prázdné");
  const polozky = vytvoritVychoziRedakcniPoradi();
  const r = sparovatSHlidanymiKotvami(
    kandidat({ nazev: "Francouzské dny TRE(s)BON" }),
    polozky,
    zdroj.hlidaneRedakcniPolozkaIds,
  );
  assert(!r.ok, "prázdné kotvy → žádný match i při správném názvu");
  console.log("OK HLIDANE_KOTVY + [] → 0 CEKA / 0 Nezařazených");
}

function overFrancouzskeDny(): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  const ids = ["zamecka-lekarna-trebon"];

  const shoda = sparovatSHlidanymiKotvami(
    kandidat({ nazev: "Francouzské dny TRE(s)BON" }),
    polozky,
    ids,
  );
  assert(shoda.ok, "Francouzské dny match");
  if (shoda.ok) {
    assert(
      shoda.redakcniPolozkaId === "zamecka-lekarna-trebon",
      `id ${shoda.redakcniPolozkaId}`,
    );
  }

  for (const nazev of [
    "Večer pod platany",
    "Leonardo",
    "Prohlídka s Petrem Vokem",
    "LEONARDO - HRAVÁ VÝSTAVA PRO CELOU RODINU",
  ]) {
    const r = sparovatSHlidanymiKotvami(kandidat({ nazev }), polozky, ids);
    assert(!r.ok, `ignorovat: ${nazev}`);
  }
  console.log("OK Francouzské dny match / Večer+Leonardo+prohlídka ignorovat");
}

function overRemiza(): void {
  const polozky = vytvoritVychoziRedakcniPoradi().map((p) => {
    if (p.id === "galerie-105") {
      return { ...p, polozka: "Stejný název test", pouzivat: "ANO" as const };
    }
    if (p.id === "biograf-105") {
      return { ...p, polozka: "Stejný název test", pouzivat: "ANO" as const };
    }
    return p;
  });
  const r = sparovatSHlidanymiKotvami(
    kandidat({ nazev: "Stejný název test" }),
    polozky,
    ["galerie-105", "biograf-105"],
  );
  assert(!r.ok, "remíza → ignorovat");
  console.log("OK remíza hlídaných kotev → ignorovat");
}

function overBeznyRegrese(): void {
  const polozky = vytvoritVychoziRedakcniPoradi();
  // Identita zdroje Galerie 105
  const g = sparovatSRedakcniPolozkou(
    kandidat({
      nazev: "Nějaká akce",
      mistoNeboTyp: "",
      datumOd: "2026-08-20",
      datumDo: "2026-08-20",
      cas: "17:00",
    }),
    polozky,
    { zdrojNazev: "Galerie 105" },
  );
  assert(g.ok && g.redakcniPolozkaId === "galerie-105", "BEZNY identita Galerie 105");

  const n = sparovatSRedakcniPolozkou(
    kandidat({
      nazev: "Koncert A",
      mistoNeboTyp: "",
      datumOd: "2026-10-15",
      datumDo: "2026-10-15",
      cas: "19:00",
    }),
    polozky,
    { zdrojNazev: "Třeboňská nocturna" },
  );
  assert(n.ok && n.redakcniPolozkaId === "trebonska-nocturna", "BEZNY Nocturna");

  // HLIDANE helper nesmí ovlivnit BEZNY substring chování
  const substring = sparovatSRedakcniPolozkou(
    kandidat({
      nazev: "Cokoli",
      mistoNeboTyp: "Kino Světozor",
      cas: "20:00",
    }),
    polozky,
  );
  assert(
    substring.ok && substring.redakcniPolozkaId === "kino-svetozor",
    "BEZNY kino matching",
  );
  console.log("OK BEZNY matching Galerie / Nocturna / Kino");
}

function overParseryBezeZmeny(): void {
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
  assert(kino.length >= 1 && kino[0].nazev === "Test Film", "kino parser");

  const noc = parsovatUdalostiZeZdroje(
    `<!DOCTYPE html><html><head><title>Úvod | Třeboňská nocturna</title></head><body>
<div class="oxy-dynamic-list">
  <div class="ct-div-block">
    <div><span>15. 10. 2026 19:00</span></div>
    <div><span><a href="https://www.trebonskanocturna.cz/koncert/1/">Koncert A</a></span></div>
    <div><span>Divadlo J. K. Tyla, Třeboň</span></div>
  </div>
</div>
</body></html>`,
    "text/html",
  );
  assert(noc.length === 1 && noc[0].nazev === "Koncert A", "nocturna parser");

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
  assert(dsn.length === 1 && dsn[0].cas === "17:00", "DSN parser");
  console.log("OK parsery Kino / Nocturna / DSN beze změny");
}

function overNeznamaKotvaValidace(): void {
  const r = validovatZdrojVstup(
    {
      nazev: "Zámecká lékárna",
      typ: "DLOUHODOBY",
      url: "https://www.zameckalekarnatrebon.cz/",
      rezimScanu: "HLIDANE_KOTVY",
      hlidaneRedakcniPolozkaIds: ["neexistuje-id"],
    },
    { povoleneRedakcniPolozkaIds: new Set(["zamecka-lekarna-trebon"]) },
  );
  assert(!r.ok, "neznámá kotva fail-closed při SAVE");
  console.log("OK validace neznámé kotvy");
}

overZpetnaKompatibilita();
overHlidanePrazdne();
overFrancouzskeDny();
overRemiza();
overBeznyRegrese();
overParseryBezeZmeny();
overNeznamaKotvaValidace();
console.log("ALL OK verify-brana-hlidane-kotvy");
