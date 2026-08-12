/**
 * Jedna konkrétní událost v administraci BRÁNY.
 * Kalendář a Výhled jsou dva pohledy na stejná data – bez duplikace záznamů.
 */

import { dnesVPraze } from "@/lib/brana/cas";
import { maDatumOdPatritDoVyhledu } from "./obdobi-7-dni";

/**
 * Stav schválení / vyřazení k budoucí publikaci.
 * VYRAZENO = redaktor odmítl automatický nález (záznam zůstává kvůli dedupu).
 */
export type BranaStavSchvaleni =
  | "CEKA_NA_SCHVALENI"
  | "SCHVALENO"
  | "VYRAZENO";

export type BranaKonkretniUdalost = {
  /** Identita konkrétní události (ne redakční katalog) */
  id: string;
  /**
   * Stabilní ID položky Redakčního pořadí.
   * null = ručně vložená výjimečná událost bez vazby na pravidlo.
   */
  redakcniPolozkaId: string | null;
  /** ISO datum YYYY-MM-DD */
  datumOd: string;
  /** ISO datum YYYY-MM-DD (stejné jako od = jednodenní) */
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  nazev: string;
  /**
   * Strukturované veřejné CO.
   * pole chybí (undefined) = LEGACY → renderer použije mistoNeboTyp
   * null = explicitně bez CO
   * string = strukturované CO
   */
  verejneCo?: string | null;
  /**
   * Strukturované veřejné rozlišení (vedle CO na 1. řádku).
   * Při LEGACY pole chybí. null = bez rozlišení.
   */
  verejneRozliseni?: string | null;
  /**
   * Pořadí ruční události v dni (jen když redakcniPolozkaId === null).
   * 0 = před první automatickou; N = za N-tou automatickou.
   * U automatických událostí null.
   */
  rucniPoziceVDni: number | null;
  /**
   * Schválení k publikaci.
   * Starší záznamy bez pole se čtou jako SCHVALENO (viz normalizovatStavSchvaleni).
   */
  stavSchvaleni: BranaStavSchvaleni;
  /**
   * Neměnná identita původního automatického scan nálezu.
   * Chybí u starších / ručních záznamů. Nezobrazuje se v UI.
   */
  scanKlic?: string;
};

export function jeBranaStavSchvaleni(
  hodnota: unknown,
): hodnota is BranaStavSchvaleni {
  return (
    hodnota === "CEKA_NA_SCHVALENI" ||
    hodnota === "SCHVALENO" ||
    hodnota === "VYRAZENO"
  );
}

/**
 * Chybějící / neznámá hodnota → SCHVALENO.
 * VYRAZENO a CEKA_NA_SCHVALENI se zachovají.
 */
export function normalizovatStavSchvaleni(
  hodnota: unknown,
): BranaStavSchvaleni {
  if (hodnota === "CEKA_NA_SCHVALENI") {
    return "CEKA_NA_SCHVALENI";
  }
  if (hodnota === "VYRAZENO") {
    return "VYRAZENO";
  }
  return "SCHVALENO";
}

/**
 * Volitelná strukturovaná pole z Blobu.
 * Klíč chybí → {} (legacy) – jedna špatná událost nesmí shodit dokument.
 * Klíč přítomen → verejneCo (string|null) + verejneRozliseni (string|null).
 * Neplatný tvar → ok: false jen pro tuto událost (volající skipne pole).
 */
export function normalizovatVerejnaJazykovaPoleZBlobu(
  u: Record<string, unknown>,
):
  | { ok: true; pole: { verejneCo?: string | null; verejneRozliseni?: string | null } }
  | { ok: false } {
  if (!("verejneCo" in u)) {
    return { ok: true, pole: {} };
  }
  if (u.verejneCo !== null && typeof u.verejneCo !== "string") {
    return { ok: false };
  }
  const verejneCo =
    u.verejneCo === null ? null : (u.verejneCo as string).trim() || null;

  if (
    "verejneRozliseni" in u &&
    u.verejneRozliseni !== null &&
    typeof u.verejneRozliseni !== "string"
  ) {
    return { ok: false };
  }
  const verejneRozliseni =
    !("verejneRozliseni" in u) || u.verejneRozliseni === null
      ? null
      : (u.verejneRozliseni as string).trim() || null;

  return {
    ok: true,
    pole: { verejneCo, verejneRozliseni },
  };
}

/**
 * Deterministický klíč původního automatického nálezu.
 * Normalizace odpovídá současnému obsahovému dedupu (trim; název lower).
 */
export function vytvoritScanKlicAutomatickeUdalosti(args: {
  redakcniPolozkaId: string;
  datumOd: string;
  cas: string;
  nazev: string;
}): string {
  return [
    args.redakcniPolozkaId.trim(),
    args.datumOd.trim(),
    args.cas.trim(),
    args.nazev.trim().toLowerCase(),
  ].join("\0");
}

export type BranaRedakcniPoradiProKalendar = {
  priorita: number | null;
  subpriorita: number | null;
};

function parsujIsoDen(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatujIsoDen(datum: Date): string {
  const y = datum.getUTCFullYear();
  const m = String(datum.getUTCMonth() + 1).padStart(2, "0");
  const d = String(datum.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Poslední platný kalendářní den události (inclusive).
 * Shodná normalizace jako kontrolní blok: prázdné datumDo → datumOd;
 * datumDo < datumOd → opraví se na datumOd.
 */
export function posledniPlatnyDenUdalosti(udalost: {
  datumOd: string;
  datumDo?: string | null;
}): string {
  const od = udalost.datumOd.trim();
  const doSurove = udalost.datumDo?.trim() ?? "";
  const doDne = doSurove.length > 0 ? doSurove : od;
  return doDne < od ? od : doDne;
}

/** Dnešní ISO den (YYYY-MM-DD) v Europe/Prague. */
export function dnesIsoVPraze(okamzik: Date = new Date()): string {
  const dnes = dnesVPraze(okamzik);
  return `${dnes.rok}-${String(dnes.mesic).padStart(2, "0")}-${String(dnes.den).padStart(2, "0")}`;
}

/**
 * True, pokud celá událost skončila před dneškem (Europe/Prague).
 * Událost končící dnes ještě není minulá.
 */
export function jeUdalostCelaMinula(
  udalost: {
    datumOd: string;
    datumDo?: string | null;
  },
  dnesIso: string = dnesIsoVPraze(),
): boolean {
  return posledniPlatnyDenUdalosti(udalost) < dnesIso;
}

/** Dny trvání včetně koncového – jedna událost, více dnů v Kalendáři */
export function dnyTrvaniUdalosti(udalost: BranaKonkretniUdalost): string[] {
  const od = parsujIsoDen(udalost.datumOd);
  const doDne = parsujIsoDen(udalost.datumDo);
  if (doDne.getTime() < od.getTime()) {
    return [udalost.datumOd];
  }

  const dny: string[] = [];
  const kurzor = new Date(od.getTime());
  while (kurzor.getTime() <= doDne.getTime()) {
    dny.push(formatujIsoDen(kurzor));
    kurzor.setUTCDate(kurzor.getUTCDate() + 1);
  }
  return dny;
}

/** Formát Výhledu: 5.10. nebo 5.10.–8.10. – bez roku, času a dne v týdnu */
export function formatujDatumVyhled(udalost: {
  datumOd: string;
  datumDo: string;
}): string {
  const od = parsujIsoDen(udalost.datumOd);
  const doDne = parsujIsoDen(udalost.datumDo);
  const odText = `${od.getUTCDate()}.${od.getUTCMonth() + 1}.`;
  if (formatujIsoDen(od) === formatujIsoDen(doDne)) {
    return odText;
  }
  const doText = `${doDne.getUTCDate()}.${doDne.getUTCMonth() + 1}.`;
  return `${odText}–${doText}`;
}

export function rokUdalosti(udalost: BranaKonkretniUdalost): number {
  return parsujIsoDen(udalost.datumOd).getUTCFullYear();
}

const DNY_TYDNE = [
  "Neděle",
  "Pondělí",
  "Úterý",
  "Středa",
  "Čtvrtek",
  "Pátek",
  "Sobota",
] as const;

/** Popisek dne v Kalendáři: „Čtvrtek 5. 10.“ */
export function formatujDenKalendare(isoDen: string): string {
  const datum = parsujIsoDen(isoDen);
  return `${DNY_TYDNE[datum.getUTCDay()]} ${datum.getUTCDate()}. ${datum.getUTCMonth() + 1}.`;
}

export type BranaKalendarDen = {
  isoDen: string;
  datumLabel: string;
  udalosti: BranaKonkretniUdalost[];
  /**
   * Admin: den 21denního kontrolního bloku bez relevantního
   * persistovaného pokrytí (vizuální řádek / zvýraznění nuly).
   */
  jePrazdnyKontrolniDen?: boolean;
};

function cisloRazeni(hodnota: number | null): number {
  return hodnota === null ? Number.MAX_SAFE_INTEGER : hodnota;
}

/**
 * Seřadí události jednoho dne:
 * automatické podle Priorita → Subpriorita (čas se nepoužívá),
 * ruční vsunuté podle rucniPoziceVDni.
 */
export function seradUdalostiDne(
  udalosti: readonly BranaKonkretniUdalost[],
  poradiRedakcni?: (
    redakcniPolozkaId: string,
  ) => BranaRedakcniPoradiProKalendar | undefined,
): BranaKonkretniUdalost[] {
  const automaticke = udalosti
    .filter((u) => u.redakcniPolozkaId !== null)
    .slice()
    .sort((a, b) => {
      const pa = poradiRedakcni?.(a.redakcniPolozkaId as string);
      const pb = poradiRedakcni?.(b.redakcniPolozkaId as string);
      const cmpP =
        cisloRazeni(pa?.priorita ?? null) - cisloRazeni(pb?.priorita ?? null);
      if (cmpP !== 0) {
        return cmpP;
      }
      const cmpS =
        cisloRazeni(pa?.subpriorita ?? null) -
        cisloRazeni(pb?.subpriorita ?? null);
      if (cmpS !== 0) {
        return cmpS;
      }
      return a.id.localeCompare(b.id);
    });

  const podleSlotu = new Map<number, BranaKonkretniUdalost[]>();
  for (const udalost of udalosti) {
    if (udalost.redakcniPolozkaId !== null) {
      continue;
    }
    // 0 = na začátek dne – nesmí spadnout do fallbacku (žádné || / truthy kontroly).
    const surovaPozice = udalost.rucniPoziceVDni;
    const slot =
      surovaPozice === null || surovaPozice === undefined
        ? automaticke.length
        : Math.max(0, Math.min(surovaPozice, automaticke.length));
    const seznam = podleSlotu.get(slot) ?? [];
    seznam.push(udalost);
    podleSlotu.set(slot, seznam);
  }

  const vysledek: BranaKonkretniUdalost[] = [];
  for (let slot = 0; slot <= automaticke.length; slot++) {
    const rucniVeSlotu = (podleSlotu.get(slot) ?? [])
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));
    vysledek.push(...rucniVeSlotu);
    if (slot < automaticke.length) {
      vysledek.push(automaticke[slot]);
    }
  }
  return vysledek;
}

/**
 * Projekce událostí do dnů Kalendáře.
 * Vícedenní událost se objeví v každém dni rozsahu – stále stejný záznam (stejné id).
 * Čas se pro pořadí nepoužívá.
 */
export function projektujKalendarDny(
  udalosti: readonly BranaKonkretniUdalost[],
  poradiRedakcni?: (
    redakcniPolozkaId: string,
  ) => BranaRedakcniPoradiProKalendar | undefined,
): BranaKalendarDen[] {
  const podleDne = new Map<string, BranaKonkretniUdalost[]>();

  for (const udalost of udalosti) {
    if (udalost.stavSchvaleni === "VYRAZENO") {
      continue;
    }
    for (const den of dnyTrvaniUdalosti(udalost)) {
      const seznam = podleDne.get(den) ?? [];
      seznam.push(udalost);
      podleDne.set(den, seznam);
    }
  }

  return [...podleDne.keys()]
    .sort()
    .map((isoDen) => ({
      isoDen,
      datumLabel: formatujDenKalendare(isoDen),
      udalosti: seradUdalostiDne(podleDne.get(isoDen) ?? [], poradiRedakcni),
    }));
}

export type BranaVyhledRokSkupina = {
  rok: number;
  udalosti: BranaKonkretniUdalost[];
};

/**
 * Souhrnný řádek admin Výhledu – pouze projekce, ne persistovaná událost.
 * Více konkrétních událostí stejné redakční položky ve stejném roce → jeden řádek.
 */
export type BranaAdminVyhledSouhrn = {
  klic: string;
  redakcniPolozkaId: string;
  datumOd: string;
  datumDo: string;
  mistoNeboTyp: string;
  nazev: string;
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

export type BranaAdminVyhledRokSkupina = {
  rok: number;
  souhrny: BranaAdminVyhledSouhrn[];
};

/**
 * Projekce Výhledu: každá událost jednou, jen když redakční Výhled = ANO
 * a datumOd ještě není v období obdobi7DniVPraze ani v minulosti.
 * Ruční událost (redakcniPolozkaId = null) se ve Výhledu nezobrazuje.
 *
 * Zachováno pro Schválit kontrolu a další spotřebitele jednotlivých ID.
 */
export function projektujVyhledPodleRoku(
  udalosti: readonly BranaKonkretniUdalost[],
  maVyhledAno: (redakcniPolozkaId: string) => boolean,
): BranaVyhledRokSkupina[] {
  const vybrane = udalosti.filter(
    (u) =>
      u.stavSchvaleni !== "VYRAZENO" &&
      u.redakcniPolozkaId !== null &&
      maVyhledAno(u.redakcniPolozkaId) &&
      maDatumOdPatritDoVyhledu(u.datumOd),
  );
  const podleRoku = new Map<number, BranaKonkretniUdalost[]>();

  for (const udalost of vybrane) {
    const rok = rokUdalosti(udalost);
    const seznam = podleRoku.get(rok) ?? [];
    seznam.push(udalost);
    podleRoku.set(rok, seznam);
  }

  return [...podleRoku.keys()]
    .sort((a, b) => a - b)
    .map((rok) => ({
      rok,
      udalosti: (podleRoku.get(rok) ?? []).slice().sort((a, b) => {
        const cmp = a.datumOd.localeCompare(b.datumOd);
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
      }),
    }));
}

/**
 * Admin Výhled: stejný filtr jako projektujVyhledPodleRoku, ale uvnitř roku
 * seskupí události se stejným redakcniPolozkaId do jednoho souhrnného řádku.
 * Kalendář / Blob / veřejná projekce se nemění.
 */
export function projektujAdminVyhledSouhrnyPodleRoku(
  udalosti: readonly BranaKonkretniUdalost[],
  maVyhledAno: (redakcniPolozkaId: string) => boolean,
): BranaAdminVyhledRokSkupina[] {
  return projektujVyhledPodleRoku(udalosti, maVyhledAno).map(
    ({ rok, udalosti: udalostiRoku }) => {
      const podlePolozky = new Map<string, BranaKonkretniUdalost[]>();
      for (const udalost of udalostiRoku) {
        const id = udalost.redakcniPolozkaId as string;
        const seznam = podlePolozky.get(id) ?? [];
        seznam.push(udalost);
        podlePolozky.set(id, seznam);
      }

      const souhrny: BranaAdminVyhledSouhrn[] = [];
      for (const [redakcniPolozkaId, clenove] of podlePolozky) {
        const serazene = clenove.slice().sort((a, b) => {
          const cmp = a.datumOd.localeCompare(b.datumOd);
          return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
        });
        const reprezentant = serazene[0];
        let datumDo = posledniPlatnyDenUdalosti(reprezentant);
        for (const clen of serazene) {
          const konec = posledniPlatnyDenUdalosti(clen);
          if (konec > datumDo) {
            datumDo = konec;
          }
        }
        const jeSerie = serazene.length > 1;
        souhrny.push({
          klic: `${rok}:${redakcniPolozkaId}`,
          redakcniPolozkaId,
          datumOd: reprezentant.datumOd,
          datumDo,
          mistoNeboTyp: reprezentant.mistoNeboTyp,
          // Série: bez názvu jednotlivého koncertu – CO/KDE z jazyka položky.
          nazev: jeSerie ? "" : reprezentant.nazev,
          ...(reprezentant.verejneCo !== undefined
            ? {
                verejneCo: reprezentant.verejneCo,
                verejneRozliseni: reprezentant.verejneRozliseni ?? null,
              }
            : {}),
        });
      }

      souhrny.sort((a, b) => {
        const cmp = a.datumOd.localeCompare(b.datumOd);
        return cmp !== 0 ? cmp : a.klic.localeCompare(b.klic);
      });

      return { rok, souhrny };
    },
  );
}

/** Popisek pro volbu místa v dni (bez čísla pozice) */
export function popisekVolbyPozice(udalost: BranaKonkretniUdalost): string {
  const leva = udalost.mistoNeboTyp.trim();
  const nazev = udalost.nazev.trim();
  if (leva && nazev) {
    return `${leva} – ${nazev}`;
  }
  return leva || nazev || udalost.id;
}
