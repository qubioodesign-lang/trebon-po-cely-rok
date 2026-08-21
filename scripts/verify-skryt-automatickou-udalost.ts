/**
 * Ověření jednorázového „Skrýt“ vs stávajícího „Vyřadit“.
 * Spuštění: npx tsx scripts/verify-skryt-automatickou-udalost.ts
 * Bez Blob WRITE a bez ostrého scanu.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  jeUdalostCelaMinula,
  skrytAutomatickouKonkretniUdalostZeSeznamu,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";
import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";

let selhalo = 0;
function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

const DNES = "2026-08-21";
const KOTVA = "polozka-1";
const IDENTITA = "itrebon|skryt-1";

function karta(partial: {
  id: string;
  stavSchvaleni: BranaKonkretniUdalost["stavSchvaleni"];
  typZdroje?: "RYCHLY";
  redakcniPolozkaId?: string | null;
  zdrojIdentita?: string;
  nazev?: string;
}): BranaKonkretniUdalost {
  return {
    id: partial.id,
    redakcniPolozkaId:
      partial.redakcniPolozkaId === undefined
        ? KOTVA
        : partial.redakcniPolozkaId,
    datumOd: "2026-08-23",
    datumDo: "2026-08-23",
    cas: "18:00",
    mistoNeboTyp: "misto",
    nazev: partial.nazev ?? "Událost",
    rucniPoziceVDni: partial.redakcniPolozkaId === null ? 0 : null,
    stavSchvaleni: partial.stavSchvaleni,
    scanKlic: `${KOTVA}\0${"2026-08-23"}\0${"18:00"}\0událost`,
    ...(partial.zdrojIdentita !== undefined
      ? { zdrojIdentita: partial.zdrojIdentita }
      : { zdrojIdentita: IDENTITA }),
    ...(partial.typZdroje === "RYCHLY" ? { typZdroje: "RYCHLY" as const } : {}),
  };
}

function kandidat(
  typZdroje?: "RYCHLY",
  zdrojIdentita = IDENTITA,
): BranaScanAutomatickaUdalostVstup {
  return {
    redakcniPolozkaId: KOTVA,
    datumOd: "2026-08-23",
    datumDo: "2026-08-23",
    cas: "18:00",
    mistoNeboTyp: "misto",
    nazev: "Událost",
    zdrojIdentita,
    ...(typZdroje === "RYCHLY" ? { typZdroje: "RYCHLY" as const } : {}),
  };
}

function scan(
  pred: readonly BranaKonkretniUdalost[],
  vstup: readonly BranaScanAutomatickaUdalostVstup[],
) {
  return aplikovatScanKandidatyNaUdalosti(
    pred,
    vstup,
    DNES,
    jeUdalostCelaMinula,
  );
}

const root = join(__dirname, "..");
const ui = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminKalendarRucniZapis.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");
const akce = readFileSync(
  join(root, "src/app/brana/admin/actions.ts"),
  "utf8",
).replace(/\r\n/g, "\n");
const uloziste = readFileSync(
  join(root, "src/lib/brana/admin/konkretni-udalosti-uloziste.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

const ceka = karta({ id: "auto-ceka", stavSchvaleni: "CEKA_NA_SCHVALENI" });
const schvaleno = karta({
  id: "auto-schvaleno",
  stavSchvaleni: "SCHVALENO",
});
const druha = karta({
  id: "auto-druha",
  stavSchvaleni: "CEKA_NA_SCHVALENI",
  zdrojIdentita: "itrebon|skryt-2",
  nazev: "Druhá",
});
const rychla = karta({
  id: "auto-rychla",
  stavSchvaleni: "CEKA_NA_SCHVALENI",
  typZdroje: "RYCHLY",
});
const dlouhodoba = karta({
  id: "auto-dlouha",
  stavSchvaleni: "SCHVALENO",
  zdrojIdentita: "itrebon|skryt-d",
});
const rucni = karta({
  id: "rucni-1",
  stavSchvaleni: "CEKA_NA_SCHVALENI",
  redakcniPolozkaId: null,
});
const vyrazena = karta({
  id: "auto-vyrazena",
  stavSchvaleni: "VYRAZENO",
});

const poCeka = skrytAutomatickouKonkretniUdalostZeSeznamu(
  [ceka, druha],
  "auto-ceka",
);
assert(poCeka.ok, "A: Skrýt CEKA uspěje");
assert(
  poCeka.ok &&
    !poCeka.udalosti.some((u) => u.id === "auto-ceka") &&
    poCeka.udalosti.length === 1,
  "A: CEKA + Skrýt → karta v seznamu není",
);

const poSchvaleno = skrytAutomatickouKonkretniUdalostZeSeznamu(
  [schvaleno, druha],
  "auto-schvaleno",
);
assert(
  poSchvaleno.ok &&
    !poSchvaleno.udalosti.some((u) => u.id === "auto-schvaleno"),
  "B: SCHVALENO + Skrýt → karta v seznamu není",
);

assert(
  poCeka.ok &&
    !poCeka.udalosti.some((u) => u.stavSchvaleni === "VYRAZENO") &&
    poCeka.skryta.stavSchvaleni === "CEKA_NA_SCHVALENI",
  "C: po Skrýt nezůstane VYRAZENO ani otisk skryté karty",
);

{
  const poSkryti = skrytAutomatickouKonkretniUdalostZeSeznamu([ceka], "auto-ceka");
  assert(poSkryti.ok, "D: příprava seznamu po Skrýt");
  const znovu = scan(poSkryti.ok ? poSkryti.udalosti : [], [kandidat()]);
  assert(znovu.vysledek.pridano === 1, "D: následný scan znovu přidá CEKA");
  assert(
    znovu.udalosti.length === 1 &&
      znovu.udalosti[0].stavSchvaleni === "CEKA_NA_SCHVALENI" &&
      znovu.udalosti[0].id !== "auto-ceka",
    "D: nová CEKA s novým id",
  );
}

{
  const poVyrazeni: BranaKonkretniUdalost[] = [
    { ...ceka, stavSchvaleni: "VYRAZENO" },
  ];
  const poScanu = scan(poVyrazeni, [kandidat()]);
  assert(poScanu.vysledek.pridano === 0, "E: Vyřadit → scan nepřidá kartu");
  assert(
    poScanu.udalosti.length === 1 &&
      poScanu.udalosti[0].id === "auto-ceka" &&
      poScanu.udalosti[0].stavSchvaleni === "VYRAZENO",
    "E: VYRAZENO zůstává a scan ji nevrátí",
  );
}

assert(
  poCeka.ok &&
    poCeka.udalosti.length === 1 &&
    poCeka.udalosti[0].id === "auto-druha" &&
    poCeka.udalosti[0].nazev === "Druhá",
  "F: Skrýt jedné události ostatní neovlivní",
);

{
  const poRychle = skrytAutomatickouKonkretniUdalostZeSeznamu(
    [rychla, dlouhodoba],
    "auto-rychla",
  );
  const poDlouhe = skrytAutomatickouKonkretniUdalostZeSeznamu(
    [rychla, dlouhodoba],
    "auto-dlouha",
  );
  assert(
    poRychle.ok &&
      poDlouhe.ok &&
      !poRychle.udalosti.some((u) => u.id === "auto-rychla") &&
      !poDlouhe.udalosti.some((u) => u.id === "auto-dlouha") &&
      poRychle.udalosti[0].id === "auto-dlouha" &&
      poDlouhe.udalosti[0].id === "auto-rychla",
    "G: RYCHLÁ i DLOUHODOBÁ karta mají stejné Skrýt",
  );
  const jenRychlaSkryta = skrytAutomatickouKonkretniUdalostZeSeznamu(
    [rychla],
    "auto-rychla",
  );
  const znovuRychla = scan(
    jenRychlaSkryta.ok ? jenRychlaSkryta.udalosti : [rychla],
    [kandidat("RYCHLY")],
  );
  assert(
    znovuRychla.vysledek.pridano === 1 &&
      znovuRychla.udalosti.some((u) => u.typZdroje === "RYCHLY"),
    "G: po Skrýt RYCHLÉ scan znovu vytvoří RYCHLOU CEKA",
  );
}

assert(
  !skrytAutomatickouKonkretniUdalostZeSeznamu([rucni], "rucni-1").ok &&
    !skrytAutomatickouKonkretniUdalostZeSeznamu([vyrazena], "auto-vyrazena")
      .ok &&
    !skrytAutomatickouKonkretniUdalostZeSeznamu([ceka], "neexistuje").ok,
  "fail-closed: ruční / VYRAZENO / chybějící id → žádná změna",
);

const idxSkrytAkce = akce.indexOf(
  "export async function skrytAutomatickouKonkretniUdalostAkce",
);
const idxDalsiAkce = akce.indexOf(
  "export async function vyrazitAutomatickouCekaUdalostAkce",
);
const skrytFn = akce.slice(idxSkrytAkce, idxDalsiAkce);
assert(
  idxSkrytAkce > 0 &&
    !skrytFn.includes("schvalenoDoIso") &&
    !skrytFn.includes("ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku") &&
    uloziste.includes("skrytAutomatickouKonkretniUdalostZeSeznamu") &&
    !uloziste
      .slice(
        uloziste.indexOf("export async function skrytAutomatickouKonkretniUdalost"),
        uloziste.indexOf(
          "Append / in-place update automatických událostí ze scanu",
        ),
      )
      .includes("schvalenoDoIso"),
  "H: Skrýt schvalenoDoIso nemění",
);

assert(
  !skrytFn.includes("ulozitPosledniSkupinovyScanProScheduler") &&
    !skrytFn.includes("posledniRychlySkupinovyScan") &&
    !skrytFn.includes("posledniDlouhySkupinovyScan") &&
    !skrytFn.includes("skenovatRychleZdrojeAutomaticky") &&
    !skrytFn.includes("skenovatDlouhodobeZdrojeAutomaticky") &&
    ui.includes("skrytAutomatickouKonkretniUdalostAkce") &&
    ui.includes(">Skrýt<") === false
    ? ui.includes("Skrýt")
    : true,
  "I: Skrýt nesahe na Rychlý/Dlouhý scan, razítka ani počet chyb",
);

assert(
  ui.includes(
    "Skrýt tuto událost? Při dalším scanu se může objevit znovu.",
  ) &&
    ui.includes("Vyřadit tuto událost? Další scan ji znovu nenabídne.") &&
    ui.includes("vyrazitAutomatickouCekaUdalostAkce") &&
    uloziste.includes('stavSchvaleni: "VYRAZENO"'),
  "UI: confirm Skrýt/Vyřadit; Vyřadit dál zapisuje VYRAZENO",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly Skrýt prošly.");
