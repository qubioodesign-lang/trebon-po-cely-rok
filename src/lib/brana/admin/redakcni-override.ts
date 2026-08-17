/**
 * Redakční override automatické události (Upravit).
 * Čisté funkce bez I/O — testovatelné unitárně.
 */

import {
  BRANA_REDAKCNI_OVERRIDE_POLE,
  jeBranaRedakcniOverridePole,
  type BranaKonkretniUdalost,
  type BranaRedakcniOverridePole,
} from "./konkretni-udalost";

export type BranaAutomatickaUpravaObsahu = {
  datumOd: string;
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  nazev: string;
};

export function normalizovatRedakcneUpravenaPoleZBlobu(
  hodnota: unknown,
): readonly BranaRedakcniOverridePole[] | undefined {
  if (!Array.isArray(hodnota)) {
    return undefined;
  }
  const videna = new Set<BranaRedakcniOverridePole>();
  for (const polozka of hodnota) {
    if (jeBranaRedakcniOverridePole(polozka)) {
      videna.add(polozka);
    }
  }
  if (videna.size === 0) {
    return undefined;
  }
  return BRANA_REDAKCNI_OVERRIDE_POLE.filter((pole) => videna.has(pole));
}

export function maRedakcniOverride(
  udalost: Pick<BranaKonkretniUdalost, "redakcneUpravenaPole">,
  pole: BranaRedakcniOverridePole,
): boolean {
  return (udalost.redakcneUpravenaPole ?? []).includes(pole);
}

export function zjistitZmenenaRedakcniPole(
  pred: Pick<
    BranaKonkretniUdalost,
    "datumOd" | "datumDo" | "cas" | "nazev" | "mistoNeboTyp"
  >,
  po: BranaAutomatickaUpravaObsahu,
): BranaRedakcniOverridePole[] {
  const zmenena: BranaRedakcniOverridePole[] = [];
  if (pred.datumOd !== po.datumOd) {
    zmenena.push("datumOd");
  }
  if ((pred.datumDo || pred.datumOd) !== (po.datumDo || po.datumOd)) {
    zmenena.push("datumDo");
  }
  if (pred.cas.trim() !== po.cas.trim()) {
    zmenena.push("cas");
  }
  if (pred.nazev.trim() !== po.nazev.trim()) {
    zmenena.push("nazev");
  }
  if (pred.mistoNeboTyp.trim() !== po.mistoNeboTyp.trim()) {
    zmenena.push("mistoNeboTyp");
  }
  return zmenena;
}

export function sloucitRedakcneUpravenaPole(
  existujici: readonly BranaRedakcniOverridePole[] | undefined,
  nova: readonly BranaRedakcniOverridePole[],
): readonly BranaRedakcniOverridePole[] | undefined {
  const videna = new Set<BranaRedakcniOverridePole>(existujici ?? []);
  for (const pole of nova) {
    videna.add(pole);
  }
  if (videna.size === 0) {
    return undefined;
  }
  return BRANA_REDAKCNI_OVERRIDE_POLE.filter((pole) => videna.has(pole));
}

/**
 * Invertuje známé skládání `verejneCo + " " + verejneRozliseni`.
 * Nehádá význam, když prefix nesedí.
 * Legacy (verejneCo chybí) → null, pole se nepřidávají.
 */
export function synchronizovatVerejnyZapisZMistoNeboTyp(
  mistoNeboTyp: string,
  existujiciVerejneCo: string | null | undefined,
  maStrukturovanyJazyk: boolean,
): { verejneCo: string | null; verejneRozliseni: string | null } | null {
  if (!maStrukturovanyJazyk) {
    return null;
  }
  const radek = mistoNeboTyp.trim();
  const co = (existujiciVerejneCo ?? "").trim();
  if (co && (radek === co || radek.startsWith(`${co} `))) {
    const zbytek = radek === co ? "" : radek.slice(co.length + 1).trim();
    return {
      verejneCo: co,
      verejneRozliseni: zbytek.length > 0 ? zbytek : null,
    };
  }
  return {
    verejneCo: radek.length > 0 ? radek : null,
    verejneRozliseni: null,
  };
}

/**
 * Aplikuje Upravit na automatickou událost: obsah, sync verejne*, evidence override.
 * Nemění id, redakcniPolozkaId, scanKlic, stav, zdrojIdentita.
 */
export function aplikovatUpravuAutomatickeUdalosti(
  existujici: BranaKonkretniUdalost,
  uprava: BranaAutomatickaUpravaObsahu,
): BranaKonkretniUdalost {
  const zmenena = zjistitZmenenaRedakcniPole(existujici, uprava);
  const slouceny = sloucitRedakcneUpravenaPole(
    existujici.redakcneUpravenaPole,
    zmenena,
  );
  const verejny = synchronizovatVerejnyZapisZMistoNeboTyp(
    uprava.mistoNeboTyp,
    existujici.verejneCo,
    existujici.verejneCo !== undefined,
  );

  return {
    id: existujici.id,
    redakcniPolozkaId: existujici.redakcniPolozkaId,
    datumOd: uprava.datumOd,
    datumDo: uprava.datumDo,
    cas: uprava.cas,
    mistoNeboTyp: uprava.mistoNeboTyp,
    nazev: uprava.nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: existujici.stavSchvaleni,
    ...(existujici.scanKlic !== undefined
      ? { scanKlic: existujici.scanKlic }
      : {}),
    ...(existujici.zdrojIdentita !== undefined
      ? { zdrojIdentita: existujici.zdrojIdentita }
      : {}),
    ...(verejny
      ? {
          verejneCo: verejny.verejneCo,
          verejneRozliseni: verejny.verejneRozliseni,
        }
      : existujici.verejneCo !== undefined
        ? {
            verejneCo: existujici.verejneCo,
            verejneRozliseni: existujici.verejneRozliseni ?? null,
          }
        : {}),
    ...(slouceny !== undefined ? { redakcneUpravenaPole: slouceny } : {}),
  };
}
