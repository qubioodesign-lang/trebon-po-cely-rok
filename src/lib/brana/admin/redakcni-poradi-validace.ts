import type {
  BranaJazykSlot,
  BranaRedakcniJazykVerejny,
  BranaRedakcniPolozkaStav,
  BranaRedakcniPolozkaVychozi,
} from "./redakcni-kostra";
import {
  BRANA_REDAKCNI_CISLO_MAX,
  BRANA_REDAKCNI_CISLO_MIN,
  BRANA_REDAKCNI_JAZYK_CO_MAX,
  BRANA_REDAKCNI_JAZYK_ROZLISENI_MAX,
  BRANA_REDAKCNI_POLOZKA_MAX,
  BRANA_REDAKCNI_POZNAMKA_MAX,
  BRANA_REDAKCNI_VSECHNY_VYCHOZI,
  vychoziJazykVerejnyProId,
  vychoziVyhledProId,
  vytvoritVychoziRedakcniPoradi,
  vytvoritVychoziStavPolozky,
  type BranaRedakcniVyhled,
} from "./redakcni-kostra";

export type BranaRedakcniValidaceVysledek =
  | { ok: true; polozky: BranaRedakcniPolozkaStav[] }
  | { ok: false; chyba: string };

function normalizovatCislo(hodnota: unknown): number | null | "neplatne" {
  if (hodnota === null || hodnota === undefined || hodnota === "") {
    return null;
  }

  if (typeof hodnota === "number") {
    if (!Number.isInteger(hodnota)) {
      return "neplatne";
    }
    if (
      hodnota < BRANA_REDAKCNI_CISLO_MIN ||
      hodnota > BRANA_REDAKCNI_CISLO_MAX
    ) {
      return "neplatne";
    }
    return hodnota;
  }

  if (typeof hodnota === "string") {
    const trim = hodnota.trim();
    if (trim === "") {
      return null;
    }
    if (!/^\d+$/.test(trim)) {
      return "neplatne";
    }
    const cislo = Number(trim);
    if (
      cislo < BRANA_REDAKCNI_CISLO_MIN ||
      cislo > BRANA_REDAKCNI_CISLO_MAX
    ) {
      return "neplatne";
    }
    return cislo;
  }

  return "neplatne";
}

/**
 * Výhled při čtení starých dat: ANO/NE beze změny; null / "" / neplatné → legacy mapa.
 * Při striktním save: jen ANO/NE, jinak "neplatne".
 */
function normalizovatVyhled(
  id: string,
  hodnota: unknown,
  legacy: boolean,
): BranaRedakcniVyhled | "neplatne" {
  if (hodnota === "ANO" || hodnota === "NE") {
    return hodnota;
  }
  if (legacy) {
    return vychoziVyhledProId(id);
  }
  return "neplatne";
}

/**
 * Admin Výhled: série (true) × jednotlivé události (false).
 * Chybí / null / neznámé → true (zpětná kompatibilita starého Blobu).
 * Striktní save: jen boolean, jinak "neplatne".
 */
function normalizovatVyhledSerie(
  hodnota: unknown,
  legacy: boolean,
): boolean | "neplatne" {
  if (hodnota === true || hodnota === false) {
    return hodnota;
  }
  if (hodnota === undefined || hodnota === null) {
    return true;
  }
  if (legacy) {
    return true;
  }
  return "neplatne";
}

function normalizovatPouzivat(
  hodnota: unknown,
): "ANO" | "NE" | "neplatne" {
  if (hodnota === "ANO" || hodnota === true || hodnota === 1) {
    return "ANO";
  }
  if (hodnota === "NE" || hodnota === false || hodnota === 0) {
    return "NE";
  }
  return "neplatne";
}

/**
 * Redakční text Položka – trim, max délka.
 * Prázdný řetězec povolen jen u rezervních slotů (Používat = NE).
 */
function normalizovatNazevPolozky(
  hodnota: unknown,
  volby?: { povolitPrazdne?: boolean },
): { ok: true; text: string } | { ok: false; chyba: "neplatne" | "prazdne" | "dlouhe" } {
  if (typeof hodnota !== "string") {
    return { ok: false, chyba: "neplatne" };
  }
  const text = hodnota.trim();
  if (text === "") {
    if (volby?.povolitPrazdne === true) {
      return { ok: true, text: "" };
    }
    return { ok: false, chyba: "prazdne" };
  }
  if (text.length > BRANA_REDAKCNI_POLOZKA_MAX) {
    return { ok: false, chyba: "dlouhe" };
  }
  return { ok: true, text };
}

function normalizovatTextSlotu(
  hodnota: unknown,
  max: number,
): { ok: true; text: string } | { ok: false } {
  if (typeof hodnota !== "string") {
    return { ok: false };
  }
  const text = hodnota.trim();
  if (text === "" || text.length > max) {
    return { ok: false };
  }
  return { ok: true, text };
}

/**
 * Slot: PEVNE + text | Z_UDALOSTI | NIC.
 * Chybí při legacy čtení → seed z katalogu (volá volající).
 */
function normalizovatJazykSlot(
  hodnota: unknown,
  maxText: number,
): { ok: true; slot: BranaJazykSlot } | { ok: false } {
  if (!hodnota || typeof hodnota !== "object") {
    return { ok: false };
  }
  const data = hodnota as Record<string, unknown>;
  if (data.rezim === "Z_UDALOSTI") {
    return { ok: true, slot: { rezim: "Z_UDALOSTI" } };
  }
  if (data.rezim === "NIC") {
    return { ok: true, slot: { rezim: "NIC" } };
  }
  if (data.rezim === "PEVNE") {
    const text = normalizovatTextSlotu(data.text, maxText);
    if (!text.ok) {
      return { ok: false };
    }
    return { ok: true, slot: { rezim: "PEVNE", text: text.text } };
  }
  return { ok: false };
}

/**
 * jazykVerejny:
 * - null = strukturovaný jazyk není nastaven (legacy)
 * - { co, rozliseni } = nastaven
 * Chybí při legacy čtení → výchozí pro id.
 */
function normalizovatJazykVerejny(
  id: string,
  hodnota: unknown,
  legacy: boolean,
): { ok: true; hodnota: BranaRedakcniJazykVerejny | null } | { ok: false } {
  if (hodnota === undefined) {
    if (legacy) {
      return { ok: true, hodnota: vychoziJazykVerejnyProId(id) };
    }
    return { ok: false };
  }
  if (hodnota === null) {
    return { ok: true, hodnota: null };
  }
  if (!hodnota || typeof hodnota !== "object") {
    return { ok: false };
  }
  const data = hodnota as Record<string, unknown>;
  const co = normalizovatJazykSlot(data.co, BRANA_REDAKCNI_JAZYK_CO_MAX);
  if (!co.ok) {
    return { ok: false };
  }
  const rozliseni = normalizovatJazykSlot(
    data.rozliseni,
    BRANA_REDAKCNI_JAZYK_ROZLISENI_MAX,
  );
  if (!rozliseni.ok) {
    return { ok: false };
  }
  return {
    ok: true,
    hodnota: { co: co.slot, rozliseni: rozliseni.slot },
  };
}

/**
 * Validuje a normalizuje kompletní sadu řádků podle stabilních id.
 * Musí obsahovat přesně všech 54 pevných položek, žádné jiné.
 * Text Položka se zachová (validovaný); katalog slouží jen jako výchozí při chybějících datech.
 *
 * @param volby.legacyVyhled – true při načtení starého Blobu (null → mapa);
 *   výchozí false = striktní save (jen ANO/NE).
 */
export function validovatRedakcniPoradiVstup(
  vstup: unknown,
  volby?: { legacyVyhled?: boolean },
): BranaRedakcniValidaceVysledek {
  const legacyVyhled = volby?.legacyVyhled === true;

  if (!Array.isArray(vstup)) {
    return { ok: false, chyba: "Neplatný formát dat." };
  }

  if (vstup.length !== BRANA_REDAKCNI_VSECHNY_VYCHOZI.length) {
    return {
      ok: false,
      chyba: `Očekáváno ${BRANA_REDAKCNI_VSECHNY_VYCHOZI.length} položek.`,
    };
  }

  const podleId = new Map<string, unknown>();
  for (const radek of vstup) {
    if (!radek || typeof radek !== "object") {
      return { ok: false, chyba: "Neplatný řádek." };
    }
    const id = (radek as { id?: unknown }).id;
    if (typeof id !== "string" || id.trim() === "") {
      return { ok: false, chyba: "Chybí stabilní identifikátor položky." };
    }
    if (podleId.has(id)) {
      return { ok: false, chyba: `Duplicitní identifikátor: ${id}` };
    }
    podleId.set(id, radek);
  }

  const vysledek: BranaRedakcniPolozkaStav[] = [];

  for (const vychozi of BRANA_REDAKCNI_VSECHNY_VYCHOZI) {
    const radek = podleId.get(vychozi.id);
    if (!radek) {
      return { ok: false, chyba: `Chybí položka: ${vychozi.id}` };
    }

    const data = radek as Record<string, unknown>;

    const pouzivat = normalizovatPouzivat(data.pouzivat);
    if (pouzivat === "neplatne") {
      return {
        ok: false,
        chyba: `Neplatné Používat u „${vychozi.id}“.`,
      };
    }

    const nazev = normalizovatNazevPolozky(data.polozka, {
      povolitPrazdne: pouzivat === "NE",
    });
    if (!nazev.ok) {
      if (nazev.chyba === "prazdne") {
        return {
          ok: false,
          chyba: `Prázdný text Položka u „${vychozi.id}“.`,
        };
      }
      if (nazev.chyba === "dlouhe") {
        return {
          ok: false,
          chyba: `Text Položka u „${vychozi.id}“ přesahuje ${BRANA_REDAKCNI_POLOZKA_MAX} znaků.`,
        };
      }
      return {
        ok: false,
        chyba: `Neplatný text Položka u „${vychozi.id}“.`,
      };
    }

    const popisekChyby = nazev.text || vychozi.id;

    const priorita = normalizovatCislo(data.priorita);
    if (priorita === "neplatne") {
      return {
        ok: false,
        chyba: `Neplatná Priorita u „${popisekChyby}“ (povolené ${BRANA_REDAKCNI_CISLO_MIN}–${BRANA_REDAKCNI_CISLO_MAX} nebo prázdné).`,
      };
    }

    const subpriorita = normalizovatCislo(data.subpriorita);
    if (subpriorita === "neplatne") {
      return {
        ok: false,
        chyba: `Neplatná Subpriorita u „${popisekChyby}“ (povolené ${BRANA_REDAKCNI_CISLO_MIN}–${BRANA_REDAKCNI_CISLO_MAX} nebo prázdné).`,
      };
    }

    const vyhled = normalizovatVyhled(vychozi.id, data.vyhled, legacyVyhled);
    if (vyhled === "neplatne") {
      return {
        ok: false,
        chyba: `Neplatný Výhled u „${popisekChyby}“.`,
      };
    }

    const vyhledSerie = normalizovatVyhledSerie(
      data.vyhledSerie,
      legacyVyhled,
    );
    if (vyhledSerie === "neplatne") {
      return {
        ok: false,
        chyba: `Neplatné „Výhled jako“ u „${popisekChyby}“.`,
      };
    }

    let poznamka = "";
    if (data.poznamka !== undefined && data.poznamka !== null) {
      if (typeof data.poznamka !== "string") {
        return {
          ok: false,
          chyba: `Neplatná Poznámka u „${popisekChyby}“.`,
        };
      }
      poznamka = data.poznamka.trim();
      if (poznamka.length > BRANA_REDAKCNI_POZNAMKA_MAX) {
        return {
          ok: false,
          chyba: `Poznámka u „${popisekChyby}“ přesahuje ${BRANA_REDAKCNI_POZNAMKA_MAX} znaků.`,
        };
      }
    }

    const jazykVerejny = normalizovatJazykVerejny(
      vychozi.id,
      data.jazykVerejny,
      legacyVyhled,
    );
    if (!jazykVerejny.ok) {
      return {
        ok: false,
        chyba: `Neplatný jazykVerejny u „${popisekChyby}“.`,
      };
    }

    vysledek.push({
      id: vychozi.id,
      polozka: nazev.text,
      pouzivat,
      priorita,
      subpriorita,
      vyhled,
      vyhledSerie,
      poznamka,
      mimoKostru: vychozi.mimoKostru,
      jazykVerejny: jazykVerejny.hodnota,
    });
  }

  return { ok: true, polozky: vysledek };
}

/**
 * Sloučí uložené hodnoty s pevným katalogem podle stabilního id.
 * Uložený prázdný NE slot (Položka "") se nesmí doplnit seedovým názvem.
 * Seed jen pro id, které v uloženém dokumentu chybí.
 * `katalog` jen pro izolovaný test rozšíření; produkce bere 54 ID.
 */
export function sloucitUlozeneSKostrou(
  ulozene: unknown,
  katalog: readonly BranaRedakcniPolozkaVychozi[] = BRANA_REDAKCNI_VSECHNY_VYCHOZI,
): BranaRedakcniPolozkaStav[] {
  if (!ulozene || typeof ulozene !== "object") {
    return vytvoritVychoziRedakcniPoradi();
  }

  const root = ulozene as { polozky?: unknown };
  if (!Array.isArray(root.polozky)) {
    return vytvoritVychoziRedakcniPoradi();
  }

  const mapa = new Map<string, Record<string, unknown>>();
  for (const radek of root.polozky) {
    if (!radek || typeof radek !== "object") {
      continue;
    }
    const id = (radek as { id?: unknown }).id;
    if (typeof id === "string") {
      mapa.set(id, radek as Record<string, unknown>);
    }
  }

  return katalog.map((vychozi) => {
    const ulozeny = mapa.get(vychozi.id);
    if (!ulozeny) {
      return vytvoritVychoziStavPolozky(vychozi);
    }

    const pouzivatRaw = normalizovatPouzivat(ulozeny.pouzivat);
    const pouzivat =
      pouzivatRaw === "neplatne" ? vychozi.pouzivat : pouzivatRaw;
    const nazev = normalizovatNazevPolozky(ulozeny.polozka, {
      povolitPrazdne: pouzivat === "NE",
    });
    const prioritaRaw = normalizovatCislo(ulozeny.priorita);
    const subprioritaRaw = normalizovatCislo(ulozeny.subpriorita);
    const vyhledRaw = normalizovatVyhled(vychozi.id, ulozeny.vyhled, true);
    const vyhledSerieRaw = normalizovatVyhledSerie(ulozeny.vyhledSerie, true);
    let poznamka = "";
    if (typeof ulozeny.poznamka === "string") {
      poznamka = ulozeny.poznamka.trim().slice(0, BRANA_REDAKCNI_POZNAMKA_MAX);
    }
    const jazykVerejnyRaw = normalizovatJazykVerejny(
      vychozi.id,
      ulozeny.jazykVerejny,
      true,
    );

    return {
      id: vychozi.id,
      polozka: nazev.ok ? nazev.text : vychozi.polozka,
      pouzivat,
      priorita: prioritaRaw === "neplatne" ? null : prioritaRaw,
      subpriorita: subprioritaRaw === "neplatne" ? null : subprioritaRaw,
      vyhled: vyhledRaw === "neplatne" ? vychoziVyhledProId(vychozi.id) : vyhledRaw,
      vyhledSerie: vyhledSerieRaw === "neplatne" ? true : vyhledSerieRaw,
      poznamka,
      mimoKostru: vychozi.mimoKostru,
      jazykVerejny: jazykVerejnyRaw.ok
        ? jazykVerejnyRaw.hodnota
        : vychoziJazykVerejnyProId(vychozi.id),
    };
  });
}

export const BRANA_REDAKCNI_PATCH_POLE = [
  "polozka",
  "pouzivat",
  "priorita",
  "subpriorita",
  "vyhled",
  "vyhledSerie",
  "poznamka",
  "jazykVerejny",
] as const;

export type BranaRedakcniPatchPole = (typeof BRANA_REDAKCNI_PATCH_POLE)[number];

export type BranaRedakcniPatchZmena = {
  id: string;
  pole: BranaRedakcniPatchPole;
  expectedOld: unknown;
  newValue: unknown;
};

export const BRANA_REDAKCNI_CHYBA_FIELD_KONFLIKT =
  "se mezitím změnila. Načtěte stránku znovu a teprve potom uložte.";

export class BranaRedakcniFieldKonfliktError extends Error {
  readonly id: string;
  readonly pole: string;

  constructor(id: string, pole: string) {
    super(`Položka „${id}“, pole „${pole}“ ${BRANA_REDAKCNI_CHYBA_FIELD_KONFLIKT}`);
    this.name = "BranaRedakcniFieldKonfliktError";
    this.id = id;
    this.pole = pole;
  }
}

export class BranaRedakcniPatchNeplatnyError extends Error {
  constructor(chyba: string) {
    super(chyba);
    this.name = "BranaRedakcniPatchNeplatnyError";
  }
}

function jePovolenePatchPole(hodnota: unknown): hodnota is BranaRedakcniPatchPole {
  return (
    typeof hodnota === "string" &&
    (BRANA_REDAKCNI_PATCH_POLE as readonly string[]).includes(hodnota)
  );
}

function seraditKlicProSrovnani(hodnota: unknown): unknown {
  if (hodnota === null || typeof hodnota !== "object") {
    return hodnota;
  }
  if (Array.isArray(hodnota)) {
    return hodnota.map(seraditKlicProSrovnani);
  }
  const zaznam = hodnota as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(zaznam)
      .sort()
      .map((klic) => [klic, seraditKlicProSrovnani(zaznam[klic])]),
  );
}

export function jsouStejneRedakcniPole(
  pole: BranaRedakcniPatchPole,
  a: unknown,
  b: unknown,
): boolean {
  if (pole === "jazykVerejny") {
    return (
      JSON.stringify(seraditKlicProSrovnani(a)) ===
      JSON.stringify(seraditKlicProSrovnani(b))
    );
  }
  return a === b;
}

export function parsovatRedakcniPoradiPatche(
  vstup: unknown,
): { ok: true; patche: BranaRedakcniPatchZmena[] } | { ok: false; chyba: string } {
  if (!Array.isArray(vstup)) {
    return { ok: false, chyba: "Neplatný formát změn." };
  }

  const patche: BranaRedakcniPatchZmena[] = [];
  for (const radek of vstup) {
    if (!radek || typeof radek !== "object") {
      return { ok: false, chyba: "Neplatný formát změn." };
    }
    const data = radek as Record<string, unknown>;
    if (typeof data.id !== "string" || data.id.trim() === "") {
      return { ok: false, chyba: "Chybí identifikátor položky." };
    }
    if (!jePovolenePatchPole(data.pole)) {
      return { ok: false, chyba: "Neplatné pole. Změny se neuložily." };
    }
    if (!("expectedOld" in data) || !("newValue" in data)) {
      return { ok: false, chyba: "Neplatný formát změn." };
    }
    patche.push({
      id: data.id,
      pole: data.pole,
      expectedOld: data.expectedOld,
      newValue: data.newValue,
    });
  }

  return { ok: true, patche };
}

export function sestavitRedakcniPoradiPatche(
  zaklad: readonly BranaRedakcniPolozkaStav[],
  aktualni: readonly BranaRedakcniPolozkaStav[],
): BranaRedakcniPatchZmena[] {
  const podleId = new Map(zaklad.map((radek) => [radek.id, radek]));
  const patche: BranaRedakcniPatchZmena[] = [];

  for (const radek of aktualni) {
    const puvodni = podleId.get(radek.id);
    if (!puvodni) {
      continue;
    }
    for (const pole of BRANA_REDAKCNI_PATCH_POLE) {
      const expectedOld = puvodni[pole];
      const newValue = radek[pole];
      if (!jsouStejneRedakcniPole(pole, expectedOld, newValue)) {
        patche.push({
          id: radek.id,
          pole,
          expectedOld,
          newValue,
        });
      }
    }
  }

  return patche;
}

function klonovatPolozky(
  polozky: readonly BranaRedakcniPolozkaStav[],
): BranaRedakcniPolozkaStav[] {
  return JSON.parse(JSON.stringify(polozky)) as BranaRedakcniPolozkaStav[];
}

export function aplikovatRedakcniPoradiPatcheNaPolozky(
  polozky: readonly BranaRedakcniPolozkaStav[],
  patche: readonly BranaRedakcniPatchZmena[],
): BranaRedakcniPolozkaStav[] {
  const vysledek = klonovatPolozky(polozky);
  const podleId = new Map(vysledek.map((radek) => [radek.id, radek]));

  for (const zmena of patche) {
    if (!jePovolenePatchPole(zmena.pole)) {
      throw new BranaRedakcniPatchNeplatnyError(
        "Neplatné pole. Změny se neuložily.",
      );
    }
    const radek = podleId.get(zmena.id);
    if (!radek) {
      throw new BranaRedakcniPatchNeplatnyError(
        "Neznámá položka. Změny se neuložily.",
      );
    }
    const freshValue = radek[zmena.pole];
    if (!jsouStejneRedakcniPole(zmena.pole, freshValue, zmena.expectedOld)) {
      throw new BranaRedakcniFieldKonfliktError(zmena.id, zmena.pole);
    }
    (radek as unknown as Record<string, unknown>)[zmena.pole] = zmena.newValue;
  }

  return vysledek;
}

export function validovatRedakcniPoradiDokument(dokument: {
  verzeUloziste: number;
  polozky: BranaRedakcniPolozkaStav[];
}): { verzeUloziste: number; polozky: BranaRedakcniPolozkaStav[] } | null {
  if (dokument.verzeUloziste !== 2) {
    return null;
  }
  const validace = validovatRedakcniPoradiVstup(dokument.polozky);
  if (!validace.ok) {
    return null;
  }
  return {
    verzeUloziste: 2,
    polozky: validace.polozky,
  };
}
