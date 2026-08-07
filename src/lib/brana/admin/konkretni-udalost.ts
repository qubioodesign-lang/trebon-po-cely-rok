/**
 * Jedna konkrétní událost v administraci BRÁNY.
 * Kalendář a Výhled jsou dva pohledy na stejná data – bez duplikace záznamů.
 */

export type BranaKonkretniUdalost = {
  /** Identita konkrétní události (ne redakční katalog) */
  id: string;
  /** Stabilní ID položky Redakčního pořadí */
  redakcniPolozkaId: string;
  /** ISO datum YYYY-MM-DD */
  datumOd: string;
  /** ISO datum YYYY-MM-DD (stejné jako od = jednodenní) */
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  nazev: string;
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
export function formatujDatumVyhled(udalost: BranaKonkretniUdalost): string {
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
};

/**
 * Projekce událostí do dnů Kalendáře.
 * Vícedenní událost se objeví v každém dni rozsahu – stále stejný záznam (stejné id).
 */
export function projektujKalendarDny(
  udalosti: readonly BranaKonkretniUdalost[],
): BranaKalendarDen[] {
  const podleDne = new Map<string, BranaKonkretniUdalost[]>();

  for (const udalost of udalosti) {
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
      udalosti: podleDne.get(isoDen) ?? [],
    }));
}

export type BranaVyhledRokSkupina = {
  rok: number;
  udalosti: BranaKonkretniUdalost[];
};

/**
 * Projekce Výhledu: každá událost jednou, jen když redakční Výhled = ANO.
 * Skupiny podle roku data začátku.
 */
export function projektujVyhledPodleRoku(
  udalosti: readonly BranaKonkretniUdalost[],
  maVyhledAno: (redakcniPolozkaId: string) => boolean,
): BranaVyhledRokSkupina[] {
  const vybrane = udalosti.filter((u) => maVyhledAno(u.redakcniPolozkaId));
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
