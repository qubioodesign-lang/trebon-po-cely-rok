import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";
import {
  BRANA_REDAKCNI_CISLO_MAX,
  BRANA_REDAKCNI_CISLO_MIN,
  BRANA_REDAKCNI_POZNAMKA_MAX,
  BRANA_REDAKCNI_VSECHNY_VYCHOZI,
  vytvoritVychoziRedakcniPoradi,
  vytvoritVychoziStavPolozky,
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

function normalizovatVyhled(
  hodnota: unknown,
): "ANO" | "NE" | null | "neplatne" {
  if (hodnota === null || hodnota === undefined || hodnota === "") {
    return null;
  }
  if (hodnota === "ANO" || hodnota === "NE") {
    return hodnota;
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
 * Validuje a normalizuje kompletní sadu řádků podle stabilních id.
 * Musí obsahovat přesně všech 52 pevných položek, žádné jiné.
 * Název položky a příslušnost ke kostře se berou z katalogu (nelze přejmenovat).
 */
export function validovatRedakcniPoradiVstup(
  vstup: unknown,
): BranaRedakcniValidaceVysledek {
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
        chyba: `Neplatné Používat u „${vychozi.polozka}“.`,
      };
    }

    const priorita = normalizovatCislo(data.priorita);
    if (priorita === "neplatne") {
      return {
        ok: false,
        chyba: `Neplatná Priorita u „${vychozi.polozka}“ (povolené ${BRANA_REDAKCNI_CISLO_MIN}–${BRANA_REDAKCNI_CISLO_MAX} nebo prázdné).`,
      };
    }

    const subpriorita = normalizovatCislo(data.subpriorita);
    if (subpriorita === "neplatne") {
      return {
        ok: false,
        chyba: `Neplatná Subpriorita u „${vychozi.polozka}“ (povolené ${BRANA_REDAKCNI_CISLO_MIN}–${BRANA_REDAKCNI_CISLO_MAX} nebo prázdné).`,
      };
    }

    const vyhled = normalizovatVyhled(data.vyhled);
    if (vyhled === "neplatne") {
      return {
        ok: false,
        chyba: `Neplatný Výhled u „${vychozi.polozka}“.`,
      };
    }

    let poznamka = "";
    if (data.poznamka !== undefined && data.poznamka !== null) {
      if (typeof data.poznamka !== "string") {
        return {
          ok: false,
          chyba: `Neplatná Poznámka u „${vychozi.polozka}“.`,
        };
      }
      poznamka = data.poznamka.trim();
      if (poznamka.length > BRANA_REDAKCNI_POZNAMKA_MAX) {
        return {
          ok: false,
          chyba: `Poznámka u „${vychozi.polozka}“ přesahuje ${BRANA_REDAKCNI_POZNAMKA_MAX} znaků.`,
        };
      }
    }

    vysledek.push({
      id: vychozi.id,
      polozka: vychozi.polozka,
      pouzivat,
      priorita,
      subpriorita,
      vyhled,
      poznamka,
      mimoKostru: vychozi.mimoKostru,
    });
  }

  return { ok: true, polozky: vysledek };
}

/** Sloučí uložené hodnoty s pevným katalogem podle stabilního id. */
export function sloucitUlozeneSKostrou(
  ulozene: unknown,
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

  return BRANA_REDAKCNI_VSECHNY_VYCHOZI.map((vychozi) => {
    const ulozeny = mapa.get(vychozi.id);
    if (!ulozeny) {
      return vytvoritVychoziStavPolozky(vychozi);
    }

    const pouzivat = normalizovatPouzivat(ulozeny.pouzivat);
    const prioritaRaw = normalizovatCislo(ulozeny.priorita);
    const subprioritaRaw = normalizovatCislo(ulozeny.subpriorita);
    const vyhledRaw = normalizovatVyhled(ulozeny.vyhled);
    let poznamka = "";
    if (typeof ulozeny.poznamka === "string") {
      poznamka = ulozeny.poznamka.trim().slice(0, BRANA_REDAKCNI_POZNAMKA_MAX);
    }

    return {
      id: vychozi.id,
      polozka: vychozi.polozka,
      pouzivat: pouzivat === "neplatne" ? vychozi.pouzivat : pouzivat,
      priorita: prioritaRaw === "neplatne" ? null : prioritaRaw,
      subpriorita: subprioritaRaw === "neplatne" ? null : subprioritaRaw,
      vyhled: vyhledRaw === "neplatne" ? null : vyhledRaw,
      poznamka,
      mimoKostru: vychozi.mimoKostru,
    };
  });
}
