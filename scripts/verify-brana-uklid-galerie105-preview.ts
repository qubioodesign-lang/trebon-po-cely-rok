/**
 * Regrese: dočasný výběr výstav Galerie 105 (preview, bez zápisu).
 * Spuštění: npx tsx scripts/verify-brana-uklid-galerie105-preview.ts
 */

import type { BranaKonkretniUdalost } from "../src/lib/brana/admin/konkretni-udalost";
import {
  BRANA_UKLID_GALERIE_105_VYSTAV_OCEKAVANY_POCET,
  sestavPreviewUklidGalerie105Vystavy,
  vybratGalerie105VystavyCekaKUklidu,
} from "../src/lib/brana/admin/uklid-galerie-105-vystavy";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function udalost(
  partial: Partial<BranaKonkretniUdalost> &
    Pick<
      BranaKonkretniUdalost,
      "id" | "nazev" | "datumOd" | "datumDo" | "cas"
    >,
): BranaKonkretniUdalost {
  return {
    redakcniPolozkaId: "galerie-105",
    mistoNeboTyp: "Galerie 105",
    rucniPoziceVDni: null,
    stavSchvaleni: "CEKA_NA_SCHVALENI",
    scanKlic: `galerie-105\0${partial.datumOd}\0${partial.cas}\0${partial.nazev.toLowerCase()}`,
    ...partial,
  };
}

function overFiltrOddeliAkce(): void {
  const data: BranaKonkretniUdalost[] = [
    udalost({
      id: "v1",
      nazev: "Výstava A",
      datumOd: "2026-06-27",
      datumDo: "2026-08-30",
      cas: "",
    }),
    udalost({
      id: "a1",
      nazev: "Videoprojekce",
      datumOd: "2026-08-14",
      datumDo: "2026-08-14",
      cas: "21:15",
    }),
    udalost({
      id: "jina",
      nazev: "Cizí",
      datumOd: "2026-08-20",
      datumDo: "2026-08-20",
      cas: "",
      redakcniPolozkaId: "dum-stepanka-netolickeho",
      scanKlic: "x",
    }),
  ];
  const v = vybratGalerie105VystavyCekaKUklidu(data);
  assert(v.length === 1, `filtr 1, je ${v.length}`);
  assert(v[0].id === "v1", `id ${v[0].id}`);
  console.log("OK filtr oddělí Akci s časem a jinou položku");
}

function overFailClosed19(): void {
  const vystavy = Array.from({ length: 19 }, (_, i) =>
    udalost({
      id: `v-${i}`,
      nazev: `Vystava ${i}`,
      datumOd: `2026-08-${String(10 + (i % 20)).padStart(2, "0")}`,
      datumDo: "2026-08-23",
      cas: "",
    }),
  );
  const akce = udalost({
    id: "akce",
    nazev: "Zahájení",
    datumOd: "2026-08-19",
    datumDo: "2026-08-19",
    cas: "17:00",
  });
  const ok = sestavPreviewUklidGalerie105Vystavy([...vystavy, akce]);
  assert(ok.ok, "19 výstav + 1 akce → preview ok");
  if (ok.ok) {
    assert(ok.vybrano.length === 19, "19");
    assert(ok.spravneAkceSCasemVeVyberu === 0, "0 akcí ve výběru");
  }

  const malo = sestavPreviewUklidGalerie105Vystavy(vystavy.slice(0, 18));
  assert(!malo.ok, "18 → STOP");
  if (!malo.ok) {
    assert(malo.skutecnyPocet === 18, `18, je ${malo.skutecnyPocet}`);
  }

  assert(
    BRANA_UKLID_GALERIE_105_VYSTAV_OCEKAVANY_POCET === 19,
    "konstanta 19",
  );
  console.log("OK fail-closed count === 19");
}

overFiltrOddeliAkce();
overFailClosed19();
console.log("ALL OK verify-brana-uklid-galerie105-preview");
