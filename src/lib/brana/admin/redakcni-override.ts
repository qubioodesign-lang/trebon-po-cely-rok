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
  /**
   * Klíč přítomen = strukturovaný zápis Upravit (i když hodnota je null).
   * Legacy payload klíč neobsahuje.
   */
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

/** Záznam už má strukturovaný veřejný jazyk (klíč verejneCo, i null). */
export function jeStrukturovanyVerejnyZapis(
  udalost: Pick<BranaKonkretniUdalost, "verejneCo">,
): boolean {
  return udalost.verejneCo !== undefined;
}

export function normalizovatVerejnySlot(
  hodnota: string | null | undefined,
): string | null {
  const text = (hodnota ?? "").trim();
  return text.length > 0 ? text : null;
}

/** Interní kompatibilní mistoNeboTyp: CO + mezera + KDE, prázdné části pryč. */
export function slozitMistoNeboTypZCoKde(
  co: string | null | undefined,
  kde: string | null | undefined,
): string {
  const c = normalizovatVerejnySlot(co) ?? "";
  const k = normalizovatVerejnySlot(kde) ?? "";
  if (c && k) {
    return `${c} ${k}`;
  }
  return c || k;
}

function maExplicitniCoKde(
  uprava: BranaAutomatickaUpravaObsahu,
): boolean {
  return Object.prototype.hasOwnProperty.call(uprava, "verejneCo");
}

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
    | "datumOd"
    | "datumDo"
    | "cas"
    | "nazev"
    | "mistoNeboTyp"
    | "verejneCo"
    | "verejneRozliseni"
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
  if (jeStrukturovanyVerejnyZapis(pred) && maExplicitniCoKde(po)) {
    const coZmena =
      normalizovatVerejnySlot(pred.verejneCo) !==
      normalizovatVerejnySlot(po.verejneCo);
    const kdeZmena =
      normalizovatVerejnySlot(pred.verejneRozliseni) !==
      normalizovatVerejnySlot(po.verejneRozliseni);
    if (coZmena || kdeZmena) {
      zmenena.push("mistoNeboTyp");
    }
  } else if (pred.mistoNeboTyp.trim() !== po.mistoNeboTyp.trim()) {
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
 * Aplikuje Upravit na automatickou událost: obsah, přímý zápis verejne*, override.
 * Nemění id, redakcniPolozkaId, scanKlic, stav, zdrojIdentita, typZdroje.
 * Strukturovaná událost vyžaduje explicitní CO/KDE — neskládá je z mistoNeboTyp.
 */
export function aplikovatUpravuAutomatickeUdalosti(
  existujici: BranaKonkretniUdalost,
  uprava: BranaAutomatickaUpravaObsahu,
): BranaKonkretniUdalost {
  const strukturovana = jeStrukturovanyVerejnyZapis(existujici);
  if (strukturovana && !maExplicitniCoKde(uprava)) {
    throw new Error("Strukturovanou událost upravte poli CO a KDE.");
  }

  const verejneCo = strukturovana
    ? normalizovatVerejnySlot(uprava.verejneCo)
    : undefined;
  const verejneRozliseni = strukturovana
    ? normalizovatVerejnySlot(uprava.verejneRozliseni)
    : undefined;
  const mistoNeboTyp = strukturovana
    ? slozitMistoNeboTypZCoKde(verejneCo, verejneRozliseni)
    : uprava.mistoNeboTyp;
  if (!mistoNeboTyp) {
    throw new Error(
      strukturovana ? "Vyplňte CO nebo KDE." : "Vyplňte CO / místo nebo typ.",
    );
  }

  const zmenena = zjistitZmenenaRedakcniPole(existujici, {
    ...uprava,
    mistoNeboTyp,
    ...(strukturovana
      ? { verejneCo: verejneCo ?? null, verejneRozliseni: verejneRozliseni ?? null }
      : {}),
  });
  const slouceny = sloucitRedakcneUpravenaPole(
    existujici.redakcneUpravenaPole,
    zmenena,
  );

  return {
    id: existujici.id,
    redakcniPolozkaId: existujici.redakcniPolozkaId,
    datumOd: uprava.datumOd,
    datumDo: uprava.datumDo,
    cas: uprava.cas,
    mistoNeboTyp,
    nazev: uprava.nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: existujici.stavSchvaleni,
    ...(existujici.scanKlic !== undefined
      ? { scanKlic: existujici.scanKlic }
      : {}),
    ...(existujici.zdrojIdentita !== undefined
      ? { zdrojIdentita: existujici.zdrojIdentita }
      : {}),
    ...(existujici.typZdroje === "RYCHLY"
      ? { typZdroje: "RYCHLY" as const }
      : {}),
    ...(strukturovana
      ? {
          verejneCo: verejneCo ?? null,
          verejneRozliseni: verejneRozliseni ?? null,
        }
      : {}),
    ...(slouceny !== undefined ? { redakcneUpravenaPole: slouceny } : {}),
  };
}
