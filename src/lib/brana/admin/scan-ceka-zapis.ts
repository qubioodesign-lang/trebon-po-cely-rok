/**
 * Čistá logika zápisu automatických CEKA ze scanu.
 * Bez Blob / server-only — testovatelná unitárně.
 *
 * Etapa 1: zdrojIdentita → CEKA in-place update (redakční override zachová
 * změněná pole); SCHVALENO/VYRAZENO bez overwrite.
 */

import {
  vytvoritScanKlicAutomatickeUdalosti,
  type BranaKonkretniUdalost,
  type BranaStavSchvaleni,
} from "./konkretni-udalost";
import { maRedakcniOverride } from "./redakcni-override";

export type BranaScanAutomatickaUdalostVstup = {
  redakcniPolozkaId: string;
  datumOd: string;
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  nazev: string;
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
  /** Stabilní identita napříč scany (bez volatilního data, pokud možné). */
  zdrojIdentita?: string;
};

export type PridatCekajiciZeScanuVysledek = {
  pridano: number;
  jizExistuje: number;
  /** Počet CEKA aktualizovaných in-place (stejná zdrojIdentita, jiný obsah). */
  aktualizovano: number;
};

export function normalizovatZdrojIdentitu(
  hodnota: string | undefined | null,
): string | undefined {
  if (typeof hodnota !== "string") {
    return undefined;
  }
  const t = hodnota.trim();
  return t.length > 0 ? t : undefined;
}

function jeStejnyObsahCeka(
  existujici: BranaKonkretniUdalost,
  kandidat: BranaScanAutomatickaUdalostVstup,
): boolean {
  if (
    existujici.datumOd !== kandidat.datumOd ||
    (existujici.datumDo || existujici.datumOd) !==
      (kandidat.datumDo || kandidat.datumOd) ||
    existujici.cas.trim() !== kandidat.cas.trim() ||
    existujici.nazev.trim() !== kandidat.nazev.trim() ||
    existujici.mistoNeboTyp.trim() !== kandidat.mistoNeboTyp.trim()
  ) {
    return false;
  }
  if (kandidat.verejneCo !== undefined) {
    if ((existujici.verejneCo ?? null) !== (kandidat.verejneCo ?? null)) {
      return false;
    }
    if (
      (existujici.verejneRozliseni ?? null) !==
      (kandidat.verejneRozliseni ?? null)
    ) {
      return false;
    }
  }
  return true;
}

function jeDuplicitniPodleScanKlic(
  existujici: BranaKonkretniUdalost,
  kandidat: BranaScanAutomatickaUdalostVstup,
  kandidatScanKlic: string,
): boolean {
  if (
    typeof existujici.scanKlic === "string" &&
    existujici.scanKlic.length > 0
  ) {
    return existujici.scanKlic === kandidatScanKlic;
  }
  return (
    existujici.redakcniPolozkaId === kandidat.redakcniPolozkaId &&
    existujici.datumOd === kandidat.datumOd &&
    existujici.cas.trim() === kandidat.cas.trim() &&
    existujici.nazev.trim().toLowerCase() === kandidat.nazev.trim().toLowerCase()
  );
}

function verejnaPolePoScanu(
  existujici: BranaKonkretniUdalost,
  kandidat: BranaScanAutomatickaUdalostVstup,
  zamknoutMisto: boolean,
): {
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
} {
  if (zamknoutMisto) {
    return existujici.verejneCo !== undefined
      ? {
          verejneCo: existujici.verejneCo,
          verejneRozliseni: existujici.verejneRozliseni ?? null,
        }
      : {};
  }
  if (kandidat.verejneCo !== undefined) {
    return {
      verejneCo: kandidat.verejneCo,
      verejneRozliseni: kandidat.verejneRozliseni ?? null,
    };
  }
  if (existujici.verejneCo !== undefined) {
    return {
      verejneCo: existujici.verejneCo,
      verejneRozliseni: existujici.verejneRozliseni ?? null,
    };
  }
  return {};
}

function aplikovatObsahNaCeka(
  existujici: BranaKonkretniUdalost,
  kandidat: BranaScanAutomatickaUdalostVstup,
  zdrojIdentita: string,
): BranaKonkretniUdalost {
  const datumOd = maRedakcniOverride(existujici, "datumOd")
    ? existujici.datumOd
    : kandidat.datumOd;
  const datumDo = maRedakcniOverride(existujici, "datumDo")
    ? existujici.datumDo
    : kandidat.datumDo || kandidat.datumOd;
  const cas = maRedakcniOverride(existujici, "cas")
    ? existujici.cas
    : kandidat.cas;
  const nazev = maRedakcniOverride(existujici, "nazev")
    ? existujici.nazev
    : kandidat.nazev;
  const zamknoutMisto = maRedakcniOverride(existujici, "mistoNeboTyp");
  const mistoNeboTyp = zamknoutMisto
    ? existujici.mistoNeboTyp
    : kandidat.mistoNeboTyp;
  const scanKlic = vytvoritScanKlicAutomatickeUdalosti({
    redakcniPolozkaId: existujici.redakcniPolozkaId as string,
    datumOd,
    cas,
    nazev,
  });

  return {
    id: existujici.id,
    redakcniPolozkaId: existujici.redakcniPolozkaId,
    datumOd,
    datumDo,
    cas,
    mistoNeboTyp,
    nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: "CEKA_NA_SCHVALENI" satisfies BranaStavSchvaleni,
    scanKlic,
    zdrojIdentita,
    ...verejnaPolePoScanu(existujici, kandidat, zamknoutMisto),
    ...(existujici.redakcneUpravenaPole !== undefined
      ? { redakcneUpravenaPole: existujici.redakcneUpravenaPole }
      : {}),
  };
}

function jeStejnyObsahPoAktualizaci(
  pred: BranaKonkretniUdalost,
  po: BranaKonkretniUdalost,
): boolean {
  return (
    pred.datumOd === po.datumOd &&
    pred.datumDo === po.datumDo &&
    pred.cas === po.cas &&
    pred.mistoNeboTyp === po.mistoNeboTyp &&
    pred.nazev === po.nazev &&
    (pred.verejneCo ?? null) === (po.verejneCo ?? null) &&
    (pred.verejneRozliseni ?? null) === (po.verejneRozliseni ?? null) &&
    (pred.scanKlic ?? "") === (po.scanKlic ?? "")
  );
}

/**
 * Aplikuje scan kandidáty na existující seznam událostí (bez I/O).
 * Nefiltruje minulost — volající má přeskočit minulé předem, nebo předat dnesIso.
 */
export function aplikovatScanKandidatyNaUdalosti(
  existujici: readonly BranaKonkretniUdalost[],
  kandidati: readonly BranaScanAutomatickaUdalostVstup[],
  dnesIso: string,
  jeMinula: (
    u: { datumOd: string; datumDo?: string | null },
    dnes: string,
  ) => boolean,
): {
  udalosti: BranaKonkretniUdalost[];
  vysledek: PridatCekajiciZeScanuVysledek;
  zmena: boolean;
} {
  let pridano = 0;
  let jizExistuje = 0;
  let aktualizovano = 0;
  let zmena = false;
  const nove = existujici.slice();

  for (const kandidat of kandidati) {
    const redakcniPolozkaId = kandidat.redakcniPolozkaId.trim();
    if (!redakcniPolozkaId) {
      continue;
    }

    const zdrojIdentita = normalizovatZdrojIdentitu(kandidat.zdrojIdentita);
    const normalizovany: BranaScanAutomatickaUdalostVstup = {
      redakcniPolozkaId,
      datumOd: kandidat.datumOd.trim(),
      datumDo: kandidat.datumDo.trim(),
      cas: kandidat.cas.trim(),
      mistoNeboTyp: kandidat.mistoNeboTyp.trim(),
      nazev: kandidat.nazev.trim(),
      ...(kandidat.verejneCo !== undefined
        ? {
            verejneCo: kandidat.verejneCo,
            verejneRozliseni:
              kandidat.verejneRozliseni === undefined
                ? null
                : kandidat.verejneRozliseni,
          }
        : {}),
      ...(zdrojIdentita !== undefined ? { zdrojIdentita } : {}),
    };

    if (!normalizovany.nazev || !normalizovany.datumOd) {
      continue;
    }

    if (jeMinula(normalizovany, dnesIso)) {
      continue;
    }

    const scanKlic = vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: normalizovany.redakcniPolozkaId,
      datumOd: normalizovany.datumOd,
      cas: normalizovany.cas,
      nazev: normalizovany.nazev,
    });

    // 1) Primární match: zdrojIdentita
    if (zdrojIdentita) {
      const idx = nove.findIndex(
        (u) =>
          typeof u.zdrojIdentita === "string" &&
          u.zdrojIdentita === zdrojIdentita,
      );
      if (idx >= 0) {
        const exist = nove[idx];
        if (exist.stavSchvaleni === "CEKA_NA_SCHVALENI") {
          if (jeStejnyObsahCeka(exist, normalizovany)) {
            jizExistuje += 1;
            continue;
          }
          const slouceny = aplikovatObsahNaCeka(
            exist,
            normalizovany,
            zdrojIdentita,
          );
          if (jeStejnyObsahPoAktualizaci(exist, slouceny)) {
            jizExistuje += 1;
            continue;
          }
          nove[idx] = slouceny;
          aktualizovano += 1;
          zmena = true;
          continue;
        }
        // SCHVALENO / VYRAZENO: žádný silent overwrite, žádná druhá CEKA.
        jizExistuje += 1;
        continue;
      }
    }

    // 2) Fallback: scanKlic (včetně starých záznamů bez identity)
    const idxKlic = nove.findIndex((u) =>
      jeDuplicitniPodleScanKlic(u, normalizovany, scanKlic),
    );
    if (idxKlic >= 0) {
      jizExistuje += 1;
      const exist = nove[idxKlic];
      // Doplň identitu jen u CEKA, pokud chybí (bez změny obsahu).
      if (
        zdrojIdentita &&
        exist.stavSchvaleni === "CEKA_NA_SCHVALENI" &&
        !exist.zdrojIdentita
      ) {
        nove[idxKlic] = { ...exist, zdrojIdentita };
        zmena = true;
      }
      continue;
    }

    const nova: BranaKonkretniUdalost = {
      id: `auto-${crypto.randomUUID()}`,
      redakcniPolozkaId: normalizovany.redakcniPolozkaId,
      datumOd: normalizovany.datumOd,
      datumDo: normalizovany.datumDo || normalizovany.datumOd,
      cas: normalizovany.cas,
      mistoNeboTyp: normalizovany.mistoNeboTyp,
      nazev: normalizovany.nazev,
      rucniPoziceVDni: null,
      stavSchvaleni: "CEKA_NA_SCHVALENI",
      scanKlic,
      ...(zdrojIdentita !== undefined ? { zdrojIdentita } : {}),
      ...(normalizovany.verejneCo !== undefined
        ? {
            verejneCo: normalizovany.verejneCo,
            verejneRozliseni: normalizovany.verejneRozliseni ?? null,
          }
        : {}),
    };
    nove.push(nova);
    pridano += 1;
    zmena = true;
  }

  return {
    udalosti: nove,
    vysledek: { pridano, jizExistuje, aktualizovano },
    zmena,
  };
}
