/**
 * Ověření kroku 4: Upravit/Vyřadit SCHVALENO + UI podmínky.
 * Spuštění: npx tsx scripts/verify-upravit-vyrazit-schvaleno.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import type {
  BranaKonkretniUdalost,
  BranaStavSchvaleni,
} from "../src/lib/brana/admin/konkretni-udalost";
import { vytvoritScanKlicAutomatickeUdalosti } from "../src/lib/brana/admin/konkretni-udalost";

function udalost(
  id: string,
  stav: BranaStavSchvaleni,
  opts?: { rucni?: boolean; bezScanKlic?: boolean; nazev?: string },
): BranaKonkretniUdalost {
  const rucni = opts?.rucni === true;
  const nazev = opts?.nazev ?? id;
  return {
    id,
    redakcniPolozkaId: rucni ? null : "pol-1",
    datumOd: "2026-08-20",
    datumDo: "2026-08-20",
    cas: "10:00",
    mistoNeboTyp: "misto",
    nazev,
    rucniPoziceVDni: rucni ? 0 : null,
    stavSchvaleni: stav,
    ...(rucni || opts?.bezScanKlic
      ? {}
      : {
          scanKlic: vytvoritScanKlicAutomatickeUdalosti({
            redakcniPolozkaId: "pol-1",
            datumOd: "2026-08-20",
            cas: "10:00",
            nazev: id,
          }),
        }),
  };
}

/** Zrcadlo UI predikátů. */
function muzeUpravit(
  u: BranaKonkretniUdalost,
  persistovane: ReadonlySet<string>,
): boolean {
  return (
    u.redakcniPolozkaId !== null &&
    (u.stavSchvaleni === "CEKA_NA_SCHVALENI" ||
      u.stavSchvaleni === "SCHVALENO") &&
    typeof u.scanKlic === "string" &&
    u.scanKlic.length > 0 &&
    persistovane.has(u.id)
  );
}

function muzeVyrazit(
  u: BranaKonkretniUdalost,
  persistovane: ReadonlySet<string>,
): boolean {
  return (
    u.redakcniPolozkaId !== null &&
    (u.stavSchvaleni === "CEKA_NA_SCHVALENI" ||
      u.stavSchvaleni === "SCHVALENO") &&
    persistovane.has(u.id)
  );
}

function muzeSchvalit(
  u: BranaKonkretniUdalost,
  persistovane: ReadonlySet<string>,
): boolean {
  return (
    u.redakcniPolozkaId !== null &&
    u.stavSchvaleni === "CEKA_NA_SCHVALENI" &&
    persistovane.has(u.id)
  );
}

/** Zrcadlo storage Upravit: zachovat stav. */
function aplikujUpravu(
  existujici: BranaKonkretniUdalost,
  uprava: {
    datumOd: string;
    datumDo: string;
    cas: string;
    mistoNeboTyp: string;
    nazev: string;
  },
): BranaKonkretniUdalost | { chyba: string } {
  if (existujici.redakcniPolozkaId === null) {
    return { chyba: "ruční" };
  }
  if (
    existujici.stavSchvaleni !== "CEKA_NA_SCHVALENI" &&
    existujici.stavSchvaleni !== "SCHVALENO"
  ) {
    return { chyba: "stav" };
  }
  if (!existujici.scanKlic) {
    return { chyba: "scanKlic" };
  }
  return {
    ...existujici,
    datumOd: uprava.datumOd,
    datumDo: uprava.datumDo,
    cas: uprava.cas,
    mistoNeboTyp: uprava.mistoNeboTyp,
    nazev: uprava.nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: existujici.stavSchvaleni,
    scanKlic: existujici.scanKlic,
  };
}

function aplikujVyrazit(
  existujici: BranaKonkretniUdalost,
): BranaKonkretniUdalost | { chyba: string } {
  if (existujici.redakcniPolozkaId === null) {
    return { chyba: "ruční" };
  }
  if (
    existujici.stavSchvaleni !== "CEKA_NA_SCHVALENI" &&
    existujici.stavSchvaleni !== "SCHVALENO"
  ) {
    return { chyba: "stav" };
  }
  return {
    ...existujici,
    rucniPoziceVDni: null,
    stavSchvaleni: "VYRAZENO",
  };
}

function jeDuplicitni(
  existujici: BranaKonkretniUdalost,
  kandidatScanKlic: string,
): boolean {
  return (
    typeof existujici.scanKlic === "string" &&
    existujici.scanKlic.length > 0 &&
    existujici.scanKlic === kandidatScanKlic
  );
}

let selhalo = 0;
function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

const persistovane = new Set([
  "ceka",
  "schvaleno",
  "vyrazeno",
  "rucni",
]);

const ceka = udalost("ceka", "CEKA_NA_SCHVALENI");
const schvaleno = udalost("schvaleno", "SCHVALENO");
const vyrazeno = udalost("vyrazeno", "VYRAZENO");
const rucni = udalost("rucni", "SCHVALENO", { rucni: true });

assert(
  muzeSchvalit(ceka, persistovane) &&
    muzeUpravit(ceka, persistovane) &&
    muzeVyrazit(ceka, persistovane),
  "1: CEKA auto — Schválit / Upravit / Vyřadit",
);
assert(
  !muzeSchvalit(schvaleno, persistovane) &&
    muzeUpravit(schvaleno, persistovane) &&
    muzeVyrazit(schvaleno, persistovane),
  "2: SCHVALENO auto — Upravit / Vyřadit, Schválit NE",
);
assert(
  !muzeSchvalit(vyrazeno, persistovane) &&
    !muzeUpravit(vyrazeno, persistovane) &&
    !muzeVyrazit(vyrazeno, persistovane),
  "3: VYRAZENO auto — žádné akce",
);

const poUprave = aplikujUpravu(schvaleno, {
  datumOd: "2026-08-21",
  datumDo: "2026-08-21",
  cas: "11:30",
  mistoNeboTyp: "opraveno",
  nazev: "opraveny-nazev",
});
assert(!("chyba" in poUprave), "4a: Upravit SCHVALENO povoleno");
if (!("chyba" in poUprave)) {
  assert(poUprave.id === schvaleno.id, "4b: stejné ID");
  assert(poUprave.scanKlic === schvaleno.scanKlic, "4c: stejný scanKlic");
  assert(poUprave.stavSchvaleni === "SCHVALENO", "4d: stav stále SCHVALENO");
  assert(
    poUprave.nazev === "opraveny-nazev" &&
      poUprave.mistoNeboTyp === "opraveno" &&
      poUprave.cas === "11:30",
    "4e: změněný obsah uložen",
  );
}

const poVyrazeni = aplikujVyrazit(schvaleno);
assert(!("chyba" in poVyrazeni), "5a: Vyřadit SCHVALENO povoleno");
if (!("chyba" in poVyrazeni)) {
  assert(poVyrazeni.stavSchvaleni === "VYRAZENO", "5b: stav VYRAZENO");
  assert(poVyrazeni.id === schvaleno.id, "5c: stejné ID");
  assert(poVyrazeni.scanKlic === schvaleno.scanKlic, "5d: stejný scanKlic");
}

const kandidatKlic = schvaleno.scanKlic!;
assert(
  jeDuplicitni(
    "chyba" in poVyrazeni ? schvaleno : poVyrazeni,
    kandidatKlic,
  ),
  "6: po Vyřadit scan stejný kandidát = duplicita (nepřidá)",
);

assert("chyba" in aplikujUpravu(vyrazeno, {
  datumOd: "2026-08-20",
  datumDo: "2026-08-20",
  cas: "10:00",
  mistoNeboTyp: "x",
  nazev: "y",
}), "VYRAZENO nelze upravit");
assert("chyba" in aplikujVyrazit(vyrazeno), "VYRAZENO nelze znovu vyřadit");
assert(!muzeUpravit(rucni, persistovane), "ruční nemá auto Upravit");

const root = join(__dirname, "..");
const ui = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminKalendarRucniZapis.tsx"),
  "utf8",
);
const uloziste = readFileSync(
  join(root, "src/lib/brana/admin/konkretni-udalosti-uloziste.ts"),
  "utf8",
);

assert(
  /stavSchvaleni === "SCHVALENO"/.test(ui) &&
    ui.includes("muzeUpravitAutomatickou") &&
    ui.includes("muzeVyrazitAutomatickou"),
  "UI: SCHVALENO v podmínkách Upravit/Vyřadit",
);
assert(
  uloziste.includes("stavSchvaleni: existujici.stavSchvaleni") &&
    !/stavSchvaleni:\s*"CEKA_NA_SCHVALENI"/.test(
      uloziste.slice(
        uloziste.indexOf("export async function upravitAutomatickouCekaUdalost"),
        uloziste.indexOf("export async function vyrazitAutomatickouCekaUdalost"),
      ),
    ),
  "storage: Upravit zachová existující stav (ne hardcode CEKA)",
);
assert(
  /schválenou automatickou událost/.test(uloziste),
  "storage: Vyřadit/Upravit povolují SCHVALENO",
);

// Veřejná projekce: SCHVALENO s opraveným obsahem se používá; VYRAZENO ne.
const verejne = (u: BranaKonkretniUdalost) => u.stavSchvaleni === "SCHVALENO";
assert(
  !("chyba" in poUprave) && verejne(poUprave),
  "veřejná: po Upravit SCHVALENO stále v projekci",
);
assert(
  !("chyba" in poVyrazeni) && !verejne(poVyrazeni),
  "veřejná: po Vyřadit VYRAZENO mimo projekci",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly kroku 4 prošly.");
