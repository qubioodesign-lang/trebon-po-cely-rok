/**
 * Jazyk a pure logika Nezařazených (inbox nespárovaných scan nálezů).
 * Odděleně od scanKlic automatických událostí.
 */

export const BRANA_NEZARAZENE_VERZE_ULOZISTE = 1;

export type BranaNezarazenyNalez = {
  id: string;
  /** zdrojId + datumOd + cas + nazev (normalizovaný) */
  klic: string;
  zdrojId: string;
  zdrojNazev: string;
  datumOd: string;
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  nazev: string;
};

export type BranaNezarazeneDokument = {
  verzeUloziste: number;
  otevrene: BranaNezarazenyNalez[];
  /** Paměť Smazat – jen filtrování budoucího NO-MATCH inboxu */
  odmitnuteKlice: string[];
};

export type BranaNezarazenyScanKandidat = {
  nazev: string;
  datumOd: string;
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
};

/** Stabilní obsahový klíč BEZ redakcniPolozkaId (≠ scanKlic). */
export function vytvoritNezarazenyKlic(args: {
  zdrojId: string;
  datumOd: string;
  cas: string;
  nazev: string;
}): string {
  return [
    args.zdrojId.trim(),
    args.datumOd.trim(),
    args.cas.trim(),
    args.nazev.replace(/\s+/g, " ").trim().toLowerCase(),
  ].join("\0");
}

export function vychoziNezarazeneDokument(): BranaNezarazeneDokument {
  return {
    verzeUloziste: BRANA_NEZARAZENE_VERZE_ULOZISTE,
    otevrene: [],
    odmitnuteKlice: [],
  };
}

/** Údaj vpravo: čas, jinak datum / rozsah jako ve Výhledu. */
export function formatujUdajVpravoNezarazene(nalez: {
  datumOd: string;
  datumDo: string;
  cas: string;
}): string {
  const cas = nalez.cas.trim();
  if (cas) {
    return cas;
  }
  const od = nalez.datumOd.trim();
  const doDne = (nalez.datumDo.trim() || od);
  const odCasti = od.split("-");
  if (odCasti.length !== 3) {
    return od;
  }
  const odText = `${Number(odCasti[2])}.${Number(odCasti[1])}.`;
  if (doDne === od) {
    return odText;
  }
  const doCasti = doDne.split("-");
  if (doCasti.length !== 3) {
    return odText;
  }
  return `${odText}–${Number(doCasti[2])}.${Number(doCasti[1])}.`;
}

/**
 * Přidej nové NO-MATCH do otevřených (dedup + filtr odmítnutých).
 * Nemění resolve matched klíčů.
 */
export function pridatNesparovaneDoNezarazenych(
  dokument: BranaNezarazeneDokument,
  args: {
    zdrojId: string;
    zdrojNazev: string;
    nesparovane: readonly BranaNezarazenyScanKandidat[];
    noveId: () => string;
  },
): BranaNezarazeneDokument {
  const odmitnute = new Set(dokument.odmitnuteKlice);
  let otevrene = dokument.otevrene.slice();
  const otevreneKlice = new Set(otevrene.map((n) => n.klic));

  const zdrojId = args.zdrojId.trim();
  const zdrojNazev = args.zdrojNazev.trim();

  for (const kandidat of args.nesparovane) {
    const nazev = kandidat.nazev.trim();
    const datumOd = kandidat.datumOd.trim();
    if (!nazev || !datumOd || !zdrojId) {
      continue;
    }
    const klic = vytvoritNezarazenyKlic({
      zdrojId,
      datumOd,
      cas: kandidat.cas,
      nazev,
    });
    if (odmitnute.has(klic) || otevreneKlice.has(klic)) {
      continue;
    }
    otevrene = [
      ...otevrene,
      {
        id: args.noveId(),
        klic,
        zdrojId,
        zdrojNazev,
        datumOd,
        datumDo: kandidat.datumDo.trim() || datumOd,
        cas: kandidat.cas.trim(),
        mistoNeboTyp: kandidat.mistoNeboTyp.trim(),
        nazev,
      },
    ];
    otevreneKlice.add(klic);
  }

  return {
    verzeUloziste: BRANA_NEZARAZENE_VERZE_ULOZISTE,
    otevrene,
    odmitnuteKlice: [...odmitnute],
  };
}

/**
 * Po úspěšném CEKA writeru: odstraň z otevřených klíče úspěšně zpracovaných MATCH.
 * Nemění odmitnuteKlice ani nepřidává NO-MATCH.
 */
export function vyresitOtevreneNezarazenePodleKlicu(
  dokument: BranaNezarazeneDokument,
  uspesneZpracovaneKlice: readonly string[],
): BranaNezarazeneDokument {
  const vyresene = new Set(
    uspesneZpracovaneKlice.filter((k) => k.length > 0),
  );
  if (vyresene.size === 0) {
    return dokument;
  }
  return {
    verzeUloziste: BRANA_NEZARAZENE_VERZE_ULOZISTE,
    otevrene: dokument.otevrene.filter((n) => !vyresene.has(n.klic)),
    odmitnuteKlice: dokument.odmitnuteKlice.slice(),
  };
}

/** Smazat z otevřených + zapamatovat klíč (NO-MATCH filtr). */
export function smazatNezarazenyNalezVDokumentu(
  dokument: BranaNezarazeneDokument,
  id: string,
): BranaNezarazeneDokument | { chyba: string } {
  const idTrim = id.trim();
  if (!idTrim) {
    return { chyba: "Chybí id nálezu." };
  }
  const nalez = dokument.otevrene.find((n) => n.id === idTrim);
  if (!nalez) {
    return { chyba: "Nález už není v otevřených Nezařazených." };
  }
  const odmitnute = new Set(dokument.odmitnuteKlice);
  odmitnute.add(nalez.klic);
  return {
    verzeUloziste: BRANA_NEZARAZENE_VERZE_ULOZISTE,
    otevrene: dokument.otevrene.filter((n) => n.id !== idTrim),
    odmitnuteKlice: [...odmitnute],
  };
}
