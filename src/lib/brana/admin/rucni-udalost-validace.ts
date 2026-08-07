/**
 * Validace ručně vložené konkrétní události – pouze administrace BRÁNY.
 */

import type { BranaKonkretniUdalost } from "./konkretni-udalost";

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
  const rucniPoziceVDni = data.rucniPoziceVDni;

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
  if (
    typeof rucniPoziceVDni !== "number" ||
    !Number.isInteger(rucniPoziceVDni) ||
    rucniPoziceVDni < 0
  ) {
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
    },
  };
}
