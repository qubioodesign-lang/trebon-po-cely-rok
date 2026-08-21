/**
 * Ověření: společná synchronizace dnyStav Admin Kalendáře po úspěšné action.
 * Spuštění: npx tsx scripts/verify-kalendar-dny-stav.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  najitUdalostVKalendari,
  pridatPotvrzenouZmenuKalendare,
  sladitKalendarDnySProps,
  type BranaKalendarPotvrzenaZmena,
} from "../src/lib/brana/admin/kalendar-dny-stav";
import type {
  BranaKalendarDen,
  BranaKonkretniUdalost,
  BranaStavSchvaleni,
} from "../src/lib/brana/admin/konkretni-udalost";

function udalost(vstup: {
  id: string;
  stav: BranaStavSchvaleni;
  nazev: string;
  datumOd?: string;
}): BranaKonkretniUdalost {
  const den = vstup.datumOd ?? "2026-08-25";
  return {
    id: vstup.id,
    redakcniPolozkaId: "pol-1",
    datumOd: den,
    datumDo: den,
    cas: "17:00",
    mistoNeboTyp: "Kino",
    nazev: vstup.nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: vstup.stav,
  };
}

function den(
  isoDen: string,
  udalosti: BranaKonkretniUdalost[],
): BranaKalendarDen {
  return { isoDen, datumLabel: isoDen, udalosti };
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

function stav(
  dny: readonly BranaKalendarDen[],
  id: string,
): BranaStavSchvaleni | null {
  return najitUdalostVKalendari(dny, id)?.stavSchvaleni ?? null;
}

function nazev(dny: readonly BranaKalendarDen[], id: string): string | null {
  return najitUdalostVKalendari(dny, id)?.nazev ?? null;
}

function jeVKalendari(dny: readonly BranaKalendarDen[], id: string): boolean {
  return najitUdalostVKalendari(dny, id) !== null;
}

/** Zrcadlo klientské smyčky: action přidá potvrzení, props se sladí. */
function seskupeni() {
  let potvrzene: BranaKalendarPotvrzenaZmena[] = [];
  let propsDny: BranaKalendarDen[] = [];

  return {
    nastavProps(dny: BranaKalendarDen[]) {
      propsDny = dny;
      const sladene = sladitKalendarDnySProps(propsDny, potvrzene);
      potvrzene = sladene.potvrzene;
      return sladene.dny;
    },
    poAction(...zmeny: BranaKalendarPotvrzenaZmena[]) {
      potvrzene = zmeny.reduce(pridatPotvrzenouZmenuKalendare, potvrzene);
      return sladitKalendarDnySProps(propsDny, potvrzene).dny;
    },
  };
}

const ceka = udalost({
  id: "kino-1",
  stav: "CEKA_NA_SCHVALENI",
  nazev: "Mimoni a monstra",
});
const schvaleno = { ...ceka, stavSchvaleni: "SCHVALENO" as const };
const propsCeka = [den("2026-08-25", [ceka])];

const s = seskupeni();
s.nastavProps(propsCeka);
const poSchvalit = s.poAction({ typ: "upsert", udalost: schvaleno });
assert(
  stav(poSchvalit, "kino-1") === "SCHVALENO",
  "A1: po Schválit dnyStav drží SCHVALENO",
);
const poStarychPropsCeka = s.nastavProps(propsCeka);
assert(
  stav(poStarychPropsCeka, "kino-1") === "SCHVALENO",
  "A2: starší props CEKA nesmí vrátit SCHVALENO zpět",
);

const staryObsah = udalost({
  id: "auto-uprava",
  stav: "CEKA_NA_SCHVALENI",
  nazev: "Původní název",
});
const novyObsah = {
  ...staryObsah,
  nazev: "Upravený název",
  cas: "19:30",
};
const u = seskupeni();
u.nastavProps([den("2026-08-25", [staryObsah])]);
const poUpravit = u.poAction({ typ: "upsert", udalost: novyObsah });
assert(
  nazev(poUpravit, "auto-uprava") === "Upravený název" &&
    najitUdalostVKalendari(poUpravit, "auto-uprava")?.cas === "19:30",
  "B1: po Upravit dnyStav drží vrácený obsah",
);
const poStarychPropsUprava = u.nastavProps([den("2026-08-25", [staryObsah])]);
assert(
  nazev(poStarychPropsUprava, "auto-uprava") === "Upravený název",
  "B2: starší props nesmí přepsat upravený obsah",
);

const skryvana = udalost({
  id: "skryt-1",
  stav: "CEKA_NA_SCHVALENI",
  nazev: "Ke skrytí",
});
const k = seskupeni();
k.nastavProps([den("2026-08-25", [skryvana, ceka])]);
const poSkryt = k.poAction({ typ: "odstranit", id: "skryt-1" });
assert(
  !jeVKalendari(poSkryt, "skryt-1") && jeVKalendari(poSkryt, "kino-1"),
  "C1: po Skrýt karta zmizí, ostatní zůstanou",
);
const poStarychPropsSkryt = k.nastavProps([
  den("2026-08-25", [skryvana, ceka]),
]);
assert(
  !jeVKalendari(poStarychPropsSkryt, "skryt-1"),
  "C2: starší props nesmí skrytou kartu vrátit",
);

const vyrazovana = udalost({
  id: "vyrazit-1",
  stav: "SCHVALENO",
  nazev: "K vyřazení",
});
const v = seskupeni();
v.nastavProps([den("2026-08-25", [vyrazovana])]);
const poVyrazit = v.poAction({ typ: "odstranit", id: "vyrazit-1" });
assert(!jeVKalendari(poVyrazit, "vyrazit-1"), "D1: po Vyřadit karta zmizí");
assert(
  !jeVKalendari(v.nastavProps([den("2026-08-25", [vyrazovana])]), "vyrazit-1"),
  "D2: starší props nesmí vyřazenou kartu vrátit",
);

const cekaA = udalost({
  id: "davka-a",
  stav: "CEKA_NA_SCHVALENI",
  nazev: "A",
});
const cekaB = udalost({
  id: "davka-b",
  stav: "CEKA_NA_SCHVALENI",
  nazev: "B",
});
const h = seskupeni();
h.nastavProps([den("2026-08-25", [cekaA, cekaB])]);
const poHromadne = h.poAction(
  {
    typ: "upsert",
    udalost: { ...cekaA, stavSchvaleni: "SCHVALENO" },
  },
  {
    typ: "upsert",
    udalost: { ...cekaB, stavSchvaleni: "SCHVALENO" },
  },
);
assert(
  stav(poHromadne, "davka-a") === "SCHVALENO" &&
    stav(poHromadne, "davka-b") === "SCHVALENO",
  "E1: hromadné Schválit zobrazí celou dávku jako SCHVALENO",
);
const poStareDavce = h.nastavProps([den("2026-08-25", [cekaA, cekaB])]);
assert(
  stav(poStareDavce, "davka-a") === "SCHVALENO" &&
    stav(poStareDavce, "davka-b") === "SCHVALENO",
  "E2: starší props nesmí dávku vrátit do CEKA",
);

const f = seskupeni();
f.nastavProps(propsCeka);
f.poAction({ typ: "upsert", udalost: schvaleno });
const novaKarta = udalost({
  id: "nova-ze-serveru",
  stav: "CEKA_NA_SCHVALENI",
  nazev: "Nová ze scanu",
});
const propsDohonene = [
  den("2026-08-25", [schvaleno, novaKarta]),
];
const poNovejsichProps = f.nastavProps(propsDohonene);
assert(
  stav(poNovejsichProps, "kino-1") === "SCHVALENO" &&
    jeVKalendari(poNovejsichProps, "nova-ze-serveru"),
  "F1: props, které už odpovídají, se přijmou; nová karta ze serveru zůstane",
);
const poDruhemRefresh = f.nastavProps(propsDohonene);
assert(
  stav(poDruhemRefresh, "kino-1") === "SCHVALENO" &&
    nazev(poDruhemRefresh, "kino-1") === "Mimoni a monstra",
  "F2: po dohnání už overlay nebrání dalším shodným props",
);

const staleSNovou = sladitKalendarDnySProps(
  [den("2026-08-25", [ceka, novaKarta])],
  [{ typ: "upsert", udalost: schvaleno }],
);
assert(
  stav(staleSNovou.dny, "kino-1") === "SCHVALENO" &&
    jeVKalendari(staleSNovou.dny, "nova-ze-serveru"),
  "F3: při ještě starších props CEKA zůstane overlay a nová karta se přidá",
);

const root = join(__dirname, "..");
const ui = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminKalendarRucniZapis.tsx"),
  "utf8",
);

assert(
  ui.includes('from "@/lib/brana/admin/kalendar-dny-stav"') &&
    ui.includes("sladitKalendarDnySProps") &&
    ui.includes("potvrditZmenyKalendare") &&
    !ui.includes("setDnyStav(dny)") &&
    !ui.includes("setDnyStav((predchozi)"),
  "UI: společné slučování, bez slepého setDnyStav(dny)",
);
assert(
  ui.includes("potvrditZmenyKalendare({ typ: \"upsert\", udalost: vysledek.udalost })") &&
    ui.includes("schvalitKonkretniUdalostAkce") &&
    ui.includes("upravitAutomatickouCekaUdalostAkce") &&
    ui.includes("upravitRucniKonkretniUdalostAkce") &&
    ui.includes("pridatRucniKonkretniUdalostAkce"),
  "UI: Schválit / Upravit / Přidat berou vrácenou udalost",
);
assert(
  ui.includes('potvrditZmenyKalendare({ typ: "odstranit", id: vysledek.udalost.id })') &&
    ui.includes('potvrditZmenyKalendare({ typ: "odstranit", id: udalost.id })') &&
    ui.includes("skrytAutomatickouKonkretniUdalostAkce") &&
    ui.includes("vyrazitAutomatickouCekaUdalostAkce") &&
    ui.includes("smazatRucniKonkretniUdalostAkce") &&
    ui.includes("router.refresh()"),
  "UI: Skrýt / Vyřadit / Smazat odstraňují; refresh zůstává",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly prošly.");
