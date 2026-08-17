/**
 * Validace ručně vložené konkrétní události – pouze administrace BRÁNY.
 */

import type { BranaKonkretniUdalost } from "./konkretni-udalost";
import { slozitMistoNeboTypZCoKde } from "./redakcni-override";

const ISO_DEN = /^\d{4}-\d{2}-\d{2}$/;
const CAS = /^([01]\d|2[0-3]):[0-5]\d$/;

export type BranaRucniUdalostVstup = {
  datumOd: string;
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  nazev: string;
  rucniPoziceVDni: number;
};

export type ValidaceRucniUdalostiVysledek =
  | { ok: true; udalost: Omit<BranaKonkretniUdalost, "id"> }
  | { ok: false; chyba: string };

function jePlatnyIsoDen(iso: string): boolean {
  if (!ISO_DEN.test(iso)) {
    return false;
  }
  const [y, m, d] = iso.split("-").map(Number);
  const datum = new Date(Date.UTC(y, m - 1, d));
  return (
    datum.getUTCFullYear() === y &&
    datum.getUTCMonth() + 1 === m &&
    datum.getUTCDate() === d
  );
}

/**
 * Přijme číslo včetně 0. Nulu nesmí vyhodnotit jako chybějící hodnotu.
 * Číselný řetězec ("0") se normalizuje – obrana proti serializaci přes hranici akce.
 */
function normalizovatRucniPoziciVDni(hodnota: unknown): number | null {
  if (typeof hodnota === "number") {
    if (!Number.isInteger(hodnota) || hodnota < 0) {
      return null;
    }
    return hodnota;
  }
  if (typeof hodnota === "string" && hodnota.trim() !== "") {
    const cislo = Number(hodnota.trim());
    if (!Number.isInteger(cislo) || cislo < 0) {
      return null;
    }
    return cislo;
  }
  return null;
}

export function validovatRucniUdalostVstup(
  vstup: unknown,
): ValidaceRucniUdalostiVysledek {
  if (!vstup || typeof vstup !== "object") {
    return { ok: false, chyba: "Neplatný vstup." };
  }

  const data = vstup as Record<string, unknown>;
  const datumOd = typeof data.datumOd === "string" ? data.datumOd.trim() : "";
  const datumDo = typeof data.datumDo === "string" ? data.datumDo.trim() : "";
  const cas = typeof data.cas === "string" ? data.cas.trim() : "";
  const mistoNeboTyp =
    typeof data.mistoNeboTyp === "string" ? data.mistoNeboTyp.trim() : "";
  const nazev = typeof data.nazev === "string" ? data.nazev.trim() : "";
  const rucniPoziceVDni = normalizovatRucniPoziciVDni(data.rucniPoziceVDni);

  if (!jePlatnyIsoDen(datumOd)) {
    return { ok: false, chyba: "Datum OD není platné." };
  }
  if (!jePlatnyIsoDen(datumDo)) {
    return { ok: false, chyba: "Datum DO není platné." };
  }
  if (datumDo < datumOd) {
    return { ok: false, chyba: "Datum DO nesmí být dříve než datum OD." };
  }
  if (!CAS.test(cas)) {
    return { ok: false, chyba: "Čas musí být ve formátu HH:MM." };
  }
  if (!mistoNeboTyp) {
    return { ok: false, chyba: "Vyplňte CO / místo nebo typ." };
  }
  if (mistoNeboTyp.length > 100) {
    return { ok: false, chyba: "CO / místo je příliš dlouhé." };
  }
  if (!nazev) {
    return { ok: false, chyba: "Vyplňte název." };
  }
  if (nazev.length > 200) {
    return { ok: false, chyba: "Název je příliš dlouhý." };
  }
  if (rucniPoziceVDni === null) {
    return { ok: false, chyba: "Neplatné místo v dni." };
  }

  return {
    ok: true,
    udalost: {
      redakcniPolozkaId: null,
      datumOd,
      datumDo,
      cas,
      mistoNeboTyp,
      nazev,
      rucniPoziceVDni,
      /** Ruční zápis redaktora – vždy schváleno, bez schvalovacího workflow */
      stavSchvaleni: "SCHVALENO",
    },
  };
}

export type BranaAutomatickaCekaUpravaVstup = {
  datumOd: string;
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  nazev: string;
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

export type ValidaceAutomatickeCekaUpravyVysledek =
  | { ok: true; uprava: BranaAutomatickaCekaUpravaVstup }
  | { ok: false; chyba: string };

function normalizovatVolitelnySlot(
  hodnota: unknown,
): { ok: true; hodnota: string | null } | { ok: false } {
  if (hodnota === null || hodnota === undefined) {
    return { ok: true, hodnota: null };
  }
  if (typeof hodnota !== "string") {
    return { ok: false };
  }
  const text = hodnota.trim();
  return { ok: true, hodnota: text.length > 0 ? text : null };
}

/**
 * Validace obsahu automatické CEKA úpravy.
 * Nemění redakcniPolozkaId / scanKlic / stav / rucniPoziceVDni.
 * Klíč verejneCo ve vstupu = strukturovaná cesta CO + KDE.
 */
export function validovatAutomatickouCekaUpravuVstup(
  vstup: unknown,
): ValidaceAutomatickeCekaUpravyVysledek {
  if (!vstup || typeof vstup !== "object") {
    return { ok: false, chyba: "Neplatný vstup." };
  }

  const data = vstup as Record<string, unknown>;
  const datumOd = typeof data.datumOd === "string" ? data.datumOd.trim() : "";
  const datumDo = typeof data.datumDo === "string" ? data.datumDo.trim() : "";
  const cas = typeof data.cas === "string" ? data.cas.trim() : "";
  const nazev = typeof data.nazev === "string" ? data.nazev.trim() : "";
  const strukturovanyVstup = Object.prototype.hasOwnProperty.call(
    data,
    "verejneCo",
  );

  if (!jePlatnyIsoDen(datumOd)) {
    return { ok: false, chyba: "Datum OD není platné." };
  }
  if (!jePlatnyIsoDen(datumDo)) {
    return { ok: false, chyba: "Datum DO není platné." };
  }
  if (datumDo < datumOd) {
    return { ok: false, chyba: "Datum DO nesmí být dříve než datum OD." };
  }
  if (!CAS.test(cas)) {
    return { ok: false, chyba: "Čas musí být ve formátu HH:MM." };
  }
  if (!nazev) {
    return { ok: false, chyba: "Vyplňte název." };
  }
  if (nazev.length > 200) {
    return { ok: false, chyba: "Název je příliš dlouhý." };
  }

  if (strukturovanyVstup) {
    const co = normalizovatVolitelnySlot(data.verejneCo);
    const kde = normalizovatVolitelnySlot(data.verejneRozliseni);
    if (!co.ok || !kde.ok) {
      return { ok: false, chyba: "Neplatné CO nebo KDE." };
    }
    if ((co.hodnota ?? "").length > 100) {
      return { ok: false, chyba: "CO je příliš dlouhé." };
    }
    if ((kde.hodnota ?? "").length > 100) {
      return { ok: false, chyba: "KDE je příliš dlouhé." };
    }
    const mistoNeboTyp = slozitMistoNeboTypZCoKde(co.hodnota, kde.hodnota);
    if (!mistoNeboTyp) {
      return { ok: false, chyba: "Vyplňte CO nebo KDE." };
    }
    if (mistoNeboTyp.length > 100) {
      return { ok: false, chyba: "CO / místo je příliš dlouhé." };
    }
    return {
      ok: true,
      uprava: {
        datumOd,
        datumDo,
        cas,
        mistoNeboTyp,
        nazev,
        verejneCo: co.hodnota,
        verejneRozliseni: kde.hodnota,
      },
    };
  }

  const mistoNeboTyp =
    typeof data.mistoNeboTyp === "string" ? data.mistoNeboTyp.trim() : "";
  if (!mistoNeboTyp) {
    return { ok: false, chyba: "Vyplňte CO / místo nebo typ." };
  }
  if (mistoNeboTyp.length > 100) {
    return { ok: false, chyba: "CO / místo je příliš dlouhé." };
  }

  return {
    ok: true,
    uprava: { datumOd, datumDo, cas, mistoNeboTyp, nazev },
  };
}
