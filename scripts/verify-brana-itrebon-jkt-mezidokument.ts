/**
 * JKT scan čte ověřený JSON mezidokument, ne živé iTřeboň HTTP.
 * Spuštění: npx tsx scripts/verify-brana-itrebon-jkt-mezidokument.ts
 * READ-ONLY: žádný Blob / ostrý scan / admin zdroj.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BRANA_JKT_CO,
  BRANA_JKT_ITREBON_MEZIDOKUMENT_RELATIVNI_CESTA,
  BRANA_JKT_REDAKCNI_POLOZKA_ID,
  jeItrebonDivadloJkTylaZdroj,
  nacistItrebonJktKandidatyZMezidokumentu,
  nacistItrebonJktMezidokumentZeSouboru,
  parsovatItrebonJktMezidokument,
} from "../src/lib/brana/admin/divadlo-jk-tyla";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import {
  dnesIsoVPraze,
  jeUdalostCelaMinula,
} from "../src/lib/brana/admin/konkretni-udalost";
import {
  vychoziJazykVerejnyProId,
  vytvoritVychoziRedakcniPoradi,
} from "../src/lib/brana/admin/redakcni-kostra";
import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";
import {
  deduplikovatScanKandidaty,
  jeItrebonGalerieBuddhistickehoUmeniZdrojUrl,
} from "../src/lib/brana/admin/zdroj-scan-parser";
import { sparovatVlastnictvimHlidaneKotvy } from "../src/lib/brana/admin/zdroj-scan-sparovani";
import { BRANA_GBU_REDAKCNI_POLOZKA_ID } from "../src/lib/brana/admin/gbu-titulek";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function ocekavaChybu(fn: () => unknown, jehla: string, popis: string): void {
  try {
    fn();
    fail(`${popis}: očekávaná chyba nepřišla`);
  } catch (chyba: unknown) {
    const text = chyba instanceof Error ? chyba.message : String(chyba);
    assert(text.includes(jehla), `${popis}: ${text}`);
    assert(
      text.includes("Nic nebylo uloženo."),
      `${popis}: chybí fail-closed věta`,
    );
  }
}

const VZOR = {
  vytvoreno: "2026-08-18T09:44:40.265Z",
  zdrojUrl: "https://www.itrebon.cz/kalendar.html",
  kandidati: [
    {
      nazev: "Cello Republic",
      datumOd: "2026-10-20",
      datumDo: "2026-10-20",
      cas: "19:00",
      mistoNeboTyp: "Divadlo J. K. Tyla",
      zdrojIdentita: "itrebon|20007",
    },
  ],
};

function overScanVetevBezHttp(): void {
  const skenovat = readFileSync(
    path.join("src", "lib", "brana", "admin", "skenovat-zdroj.ts"),
    "utf8",
  );
  const jktStart = skenovat.indexOf(
    "} else if (jeItrebonDivadloJkTylaZdroj(zdroj)) {",
  );
  const gbuStart = skenovat.indexOf(
    "} else if (jeItrebonGalerieBuddhistickehoUmeniZdrojUrl(zdroj.url)) {",
  );
  assert(jktStart >= 0, "JKT větev existuje");
  assert(gbuStart > jktStart, "GBU větev je za JKT");
  const jktVetev = skenovat.slice(jktStart, gbuStart);
  const gbuKonec = skenovat.indexOf(
    "} else if (jeDumPrirodyTrebonskaZdrojUrl(zdroj.url)) {",
    gbuStart,
  );
  const gbuVetev = skenovat.slice(gbuStart, gbuKonec);

  assert(
    jktVetev.includes("nacistItrebonJktKandidatyZMezidokumentu()"),
    "A JKT čte JSON mezidokument",
  );
  assert(!jktVetev.includes("nacistTeloZdroje"), "B JKT nevolá živý fetch");
  assert(
    !jktVetev.includes("sestavItrebonKalendarUrlky"),
    "B JKT nesestavuje iTřeboň URL",
  );
  assert(
    !jktVetev.includes("parsovatItrebonDivadloJkTyla"),
    "B JKT neparsuje živé HTML",
  );
  assert(gbuVetev.includes("nacistTeloZdroje"), "G GBU dál fetchuje");
  assert(
    gbuVetev.includes("sestavItrebonKalendarUrlky"),
    "G GBU dál stránkuje iTřeboň",
  );
  assert(
    gbuVetev.includes("parsovatUdalostiZeZdroje"),
    "G GBU dál používá živý parser",
  );
  assert(
    !skenovat.includes("parsovatItrebonDivadloJkTyla"),
    "produkční scan už neimportuje HTML JKT parser",
  );
}

function overFailClosed(): void {
  ocekavaChybu(
    () => nacistItrebonJktMezidokumentZeSouboru("neexistuje-jkt.json"),
    "chybí",
    "E chybějící soubor",
  );
  ocekavaChybu(
    () => parsovatItrebonJktMezidokument("{"),
    "není validní JSON",
    "E nevalidní JSON",
  );
  ocekavaChybu(
    () => parsovatItrebonJktMezidokument({ vytvoreno: "x" }),
    "nemá pole kandidati",
    "E bez kandidati",
  );
  ocekavaChybu(
    () =>
      parsovatItrebonJktMezidokument({
        ...VZOR,
        kandidati: [{ ...VZOR.kandidati[0], zdrojIdentita: "" }],
      }),
    "bez zdrojIdentita",
    "F prázdná identita",
  );
  ocekavaChybu(
    () =>
      parsovatItrebonJktMezidokument({
        ...VZOR,
        kandidati: [
          VZOR.kandidati[0],
          { ...VZOR.kandidati[0], nazev: "Kopi" },
        ],
      }),
    "duplicitní zdrojIdentita",
    "F duplicitní identita",
  );
}

function overJsonDoPipeline(): void {
  const zeSouboru = nacistItrebonJktMezidokumentZeSouboru(
    BRANA_JKT_ITREBON_MEZIDOKUMENT_RELATIVNI_CESTA,
  );
  const zImportu = nacistItrebonJktKandidatyZMezidokumentu();
  const zDedup = deduplikovatScanKandidaty(zImportu);
  assert(zeSouboru.length === zImportu.length, "soubor = import počet");
  assert(zDedup.length === zImportu.length, "dedup nemění počet");
  assert(
    zImportu.every((k, i) => k.zdrojIdentita === zeSouboru[i]?.zdrojIdentita),
    "soubor = import identity",
  );
  assert(
    zImportu.every((k) => (k.zdrojIdentita ?? "").startsWith("itrebon|")),
    "C identita itrebon|",
  );
  assert(
    zImportu.every((k) => k.mistoNeboTyp === BRANA_JKT_CO),
    "místo JKT",
  );

  const jktZdroj = {
    url: "https://www.itrebon.cz/kalendar.html",
    rezimScanu: "HLIDANE_KOTVY",
    hlidaneRedakcniPolozkaIds: [BRANA_JKT_REDAKCNI_POLOZKA_ID],
  };
  const gbuZdroj = {
    url: "https://www.itrebon.cz/kalendar.html",
    rezimScanu: "HLIDANE_KOTVY",
    hlidaneRedakcniPolozkaIds: [BRANA_GBU_REDAKCNI_POLOZKA_ID],
  };
  assert(jeItrebonDivadloJkTylaZdroj(jktZdroj), "JKT zámek zdroje");
  assert(!jeItrebonDivadloJkTylaZdroj(gbuZdroj), "GBU není JKT větev");
  assert(
    jeItrebonGalerieBuddhistickehoUmeniZdrojUrl(jktZdroj.url),
    "URL zdroje zůstává iTřeboň",
  );

  const poradi = vytvoritVychoziRedakcniPoradi();
  const dnes = dnesIsoVPraze();
  const jazykVerejny = vychoziJazykVerejnyProId(BRANA_JKT_REDAKCNI_POLOZKA_ID);
  const vstupy: BranaScanAutomatickaUdalostVstup[] = [];
  let minule = 0;
  let nezarazeno = 0;
  for (const kandidat of zDedup) {
    if (jeUdalostCelaMinula(kandidat, dnes)) {
      minule += 1;
      continue;
    }
    const sparovani = sparovatVlastnictvimHlidaneKotvy(
      poradi,
      [BRANA_JKT_REDAKCNI_POLOZKA_ID],
      BRANA_JKT_REDAKCNI_POLOZKA_ID,
    );
    if (!sparovani.ok) {
      nezarazeno += 1;
      continue;
    }
    const jazyk = sestavJazykBranyPoSparovani({
      polozka: "Divadlo J. K. Tyla",
      kandidatMisto: kandidat.mistoNeboTyp,
      zdrojNazev: "Divadlo J. K. Tyla – program",
      jazykVerejny,
    });
    vstupy.push({
      redakcniPolozkaId: sparovani.redakcniPolozkaId,
      datumOd: kandidat.datumOd,
      datumDo: kandidat.datumDo,
      cas: kandidat.cas,
      mistoNeboTyp: jazyk.mistoNeboTyp,
      nazev: kandidat.nazev,
      zdrojIdentita: kandidat.zdrojIdentita,
      verejneCo: jazyk.verejneCo,
      verejneRozliseni: jazyk.verejneRozliseni ?? null,
    });
  }

  const zapis = aplikovatScanKandidatyNaUdalosti(
    [],
    vstupy,
    dnes,
    jeUdalostCelaMinula,
  );
  const nalezeno = zDedup.length;
  const soucet = zapis.vysledek.pridano + zapis.vysledek.jizExistuje;
  assert(nezarazeno === 0, `D Nezařazeno ${nezarazeno}`);
  assert(
    soucet === nalezeno - minule,
    `D Přidáno+Již existuje ${soucet} ≠ ${nalezeno - minule}`,
  );

  console.log("OK A–D JSON → matching pipeline");
  console.log("\n=== READ-ONLY PŘEDSCAN JKT JSON ===");
  console.log(`Nalezeno: ${nalezeno}`);
  console.log(`Nezařazeno: ${nezarazeno}`);
  console.log(`Minulé (mimo zápis): ${minule}`);
  console.log(`Přidáno: ${zapis.vysledek.pridano}`);
  console.log(`Již existuje: ${zapis.vysledek.jizExistuje}`);
  console.log(
    `Přidáno + Již existuje: ${soucet}`,
  );
  for (const k of zDedup) {
    console.log(
      [k.datumOd, k.cas, k.nazev, k.zdrojIdentita].join(" | "),
    );
  }
}

overScanVetevBezHttp();
console.log("OK A/B/G JKT JSON vs GBU živý fetch");
overFailClosed();
console.log("OK E/F fail-closed");
overJsonDoPipeline();
console.log("\nVšechny kontroly JKT mezidokumentu prošly.");
