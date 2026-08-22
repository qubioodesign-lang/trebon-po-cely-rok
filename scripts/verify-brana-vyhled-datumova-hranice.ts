/**
 * Lokální ověření datumové hranice Výhledu (bez Blob zápisu, scanu, schválení).
 * Referenční datum: 22. 8. 2026 v Europe/Prague.
 * Spuštění: npx tsx scripts/verify-brana-vyhled-datumova-hranice.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { okamzikZPrahy, pridatDny, zitraVPraze } from "../src/lib/brana/cas";
import {
  isoDnyObdobi7DniVPraze,
  maDatumOdPatritDoVyhledu,
  type BranaVyhledDatumovaHranice,
} from "../src/lib/brana/admin/obdobi-7-dni";

const root = process.cwd();
let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function isoZ(datum: { rok: number; mesic: number; den: number }): string {
  return `${datum.rok}-${String(datum.mesic).padStart(2, "0")}-${String(datum.den).padStart(2, "0")}`;
}

const REFERECNI = okamzikZPrahy(2026, 8, 22, 12, 0);
const DNES_ISO = "2026-08-22";
const SEDM_DNI = isoDnyObdobi7DniVPraze(REFERECNI);
const HRANICE: BranaVyhledDatumovaHranice = {
  dnesIso: DNES_ISO,
  sedmDniIso: SEDM_DNI,
};

function patriDoVyhledu(isoDatumOd: string): boolean {
  return maDatumOdPatritDoVyhledu(isoDatumOd, HRANICE);
}

{
  const zitra = zitraVPraze(REFERECNI);
  const ocekavaneSedm = Array.from({ length: 7 }, (_, index) =>
    isoZ(pridatDny(zitra, index)),
  );
  assert(zitra.den === 23 && zitra.mesic === 8, "zítřek referenčního 22. 8. = 23. 8.");
  assert(
    ocekavaneSedm[0] === "2026-08-23" && ocekavaneSedm[6] === "2026-08-29",
    "I. veřejných 7 dní = 23.–29. 8. 2026",
  );
  assert(
    JSON.stringify(SEDM_DNI) === JSON.stringify(ocekavaneSedm),
    "I. isoDnyObdobi7DniVPraze(22. 8.) = 23.–29. 8.",
  );
  assert(!SEDM_DNI.includes(DNES_ISO), "I. veřejných 7 dní neobsahuje dnešek 22. 8.");
}

{
  const pripady: Array<[string, string, boolean]> = [
    ["A", "2026-08-21", false],
    ["B", "2026-08-22", false],
    ["C", "2026-08-23", false],
    ["D", "2026-08-29", false],
    ["E", "2026-08-30", true],
  ];
  for (const [kod, iso, ocekavano] of pripady) {
    const skutecne = patriDoVyhledu(iso);
    assert(
      skutecne === ocekavano,
      `${kod}. ${iso} → Výhled ${ocekavano ? "ANO" : "NE"} (je ${skutecne})`,
    );
  }
}

{
  const mintDatumOd = "2026-08-22";
  assert(
    !patriDoVyhledu(mintDatumOd),
    "F. MINT Market 22. 8. → Výhled NE",
  );
  assert(
    !patriDoVyhledu("2026-08-22"),
    "G. vícedenní 22.–23. 8. → Výhled NE (datumOd v blízkém okně)",
  );
}

{
  const helper = readFileSync(
    join(root, "src/lib/brana/admin/obdobi-7-dni.ts"),
    "utf8",
  );
  const verejne = readFileSync(
    join(root, "src/lib/brana/verejne-schvalene-pohledy.ts"),
    "utf8",
  );
  const admin = readFileSync(
    join(root, "src/lib/brana/admin/konkretni-udalost.ts"),
    "utf8",
  );
  const kontrolni = readFileSync(
    join(root, "src/lib/brana/admin/kontrolni-blok.ts"),
    "utf8",
  );
  const kotva = readFileSync(
    join(root, "src/lib/brana/casova-kotva.ts"),
    "utf8",
  );

  assert(
    helper.includes("isoDatumOd <= dnesIso") &&
      helper.includes("sedmDniIso.includes(isoDatumOd)"),
    "helper vylučuje dnes + veřejných 7 dní",
  );
  assert(
    verejne.includes("maDatumOdPatritDoVyhledu(u.datumOd, {") &&
      verejne.includes("dnesIso: okna.dnesIso") &&
      verejne.includes("sedmDniIso: okna.sedmDniIso") &&
      !verejne.includes("u.datumOd < okna.dnesIso"),
    "veřejný Výhled používá stejný helper a okna",
  );
  assert(
    admin.includes("maDatumOdPatritDoVyhledu(u.datumOd)") &&
      !admin.includes("hranice?: BranaVyhledDatumovaHranice") &&
      !admin.includes("maDatumOdPatritDoVyhledu(u.datumOd, hranice)"),
    "H. Admin Výhled používá maDatumOdPatritDoVyhledu(u.datumOd)",
  );
  assert(
    kotva.includes("Sedm po sobě jdoucích kalendářních dnů od zítřka") &&
      kotva.includes("Array.from({ length: 7 }") &&
      verejne.includes("datumNaIso(pridatDny(zitra, index))"),
    "I. veřejných 7 dní stále od zítřka, délka 7",
  );
  assert(
    kontrolni.includes("return [dnesIso, ...isoDnyObdobi7DniVPraze()];") &&
      kontrolni.includes("sestavIdProSchvalitKontrolu") &&
      kontrolni.includes("projektujVyhledPodleRoku"),
    "Schválit kontrolu / blízké okno helper beze změny workflow",
  );
}

if (selhalo > 0) {
  console.error(`\nSELHALO: ${selhalo}`);
  process.exit(1);
}

console.log("VŠE OK — datumová hranice Výhledu (dnes + veřejných 7 dní)");
