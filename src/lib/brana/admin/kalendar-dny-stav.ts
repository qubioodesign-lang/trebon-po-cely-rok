/**
 * Klientská synchronizace Admin Kalendáře: výsledek úspěšné action
 * je novější než následné props.dny, dokud props stejnou kartu nedohoní.
 */

import {
  dnyTrvaniUdalosti,
  type BranaKalendarDen,
  type BranaKonkretniUdalost,
} from "./konkretni-udalost";

export type BranaKalendarPotvrzenaZmena =
  | { typ: "upsert"; udalost: BranaKonkretniUdalost }
  | { typ: "odstranit"; id: string };

function idPotvrzeneZmeny(zmena: BranaKalendarPotvrzenaZmena): string {
  return zmena.typ === "odstranit" ? zmena.id : zmena.udalost.id;
}

function indexUdalostiVDnech(
  dny: readonly BranaKalendarDen[],
): Map<string, BranaKonkretniUdalost> {
  const index = new Map<string, BranaKonkretniUdalost>();
  for (const den of dny) {
    for (const udalost of den.udalosti) {
      if (!index.has(udalost.id)) {
        index.set(udalost.id, udalost);
      }
    }
  }
  return index;
}

function propsDohnalyUpsert(
  props: BranaKonkretniUdalost,
  potvrzena: BranaKonkretniUdalost,
): boolean {
  return (
    props.stavSchvaleni === potvrzena.stavSchvaleni &&
    props.nazev === potvrzena.nazev &&
    props.cas === potvrzena.cas &&
    props.datumOd === potvrzena.datumOd &&
    props.datumDo === potvrzena.datumDo &&
    props.mistoNeboTyp === potvrzena.mistoNeboTyp &&
    props.verejneCo === potvrzena.verejneCo &&
    props.verejneRozliseni === potvrzena.verejneRozliseni &&
    props.rucniPoziceVDni === potvrzena.rucniPoziceVDni
  );
}

function klonovatDny(dny: readonly BranaKalendarDen[]): BranaKalendarDen[] {
  return dny.map((den) => ({
    ...den,
    udalosti: [...den.udalosti],
  }));
}

function odstranitIdZDnu(
  dny: BranaKalendarDen[],
  id: string,
): BranaKalendarDen[] {
  return dny.map((den) => ({
    ...den,
    udalosti: den.udalosti.filter((udalost) => udalost.id !== id),
  }));
}

/**
 * Stejné id v dni → náhrada na stejném indexu.
 * Do dne už nepatří → pryč.
 * Do dne nově patří a ještě tam není → na konec (nová karta / posun data).
 */
function nahraditNeboVlozitUdalostDoDnu(
  dny: BranaKalendarDen[],
  udalost: BranaKonkretniUdalost,
): BranaKalendarDen[] {
  const cile = new Set(dnyTrvaniUdalosti(udalost));
  return dny.map((den) => {
    const index = den.udalosti.findIndex((karta) => karta.id === udalost.id);
    const patriDoDne = cile.has(den.isoDen);
    if (index >= 0 && patriDoDne) {
      const dalsi = [...den.udalosti];
      dalsi[index] = udalost;
      return { ...den, udalosti: dalsi };
    }
    if (index >= 0) {
      return {
        ...den,
        udalosti: den.udalosti.filter((karta) => karta.id !== udalost.id),
      };
    }
    if (patriDoDne) {
      return {
        ...den,
        udalosti: [...den.udalosti, udalost],
      };
    }
    return den;
  });
}

/** Nahradí dřívější potvrzení stejného id. Poslední zmena vyhrává. */
export function pridatPotvrzenouZmenuKalendare(
  predchozi: readonly BranaKalendarPotvrzenaZmena[],
  zmena: BranaKalendarPotvrzenaZmena,
): BranaKalendarPotvrzenaZmena[] {
  const id = idPotvrzeneZmeny(zmena);
  return [
    ...predchozi.filter((stara) => idPotvrzeneZmeny(stara) !== id),
    zmena,
  ];
}

/**
 * Potvrzení drží, dokud props stejnou kartu nedohoní.
 * Odstranění padá, až id v props chybí (stale props ho nesmí vrátit).
 */
export function zariditPotvrzeneZmenyKalendare(
  potvrzene: readonly BranaKalendarPotvrzenaZmena[],
  propsDny: readonly BranaKalendarDen[],
): BranaKalendarPotvrzenaZmena[] {
  if (potvrzene.length === 0) {
    return potvrzene as BranaKalendarPotvrzenaZmena[];
  }

  const propsPodleId = indexUdalostiVDnech(propsDny);
  const dalsi = potvrzene.filter((zmena) => {
    if (zmena.typ === "odstranit") {
      return propsPodleId.has(zmena.id);
    }
    const propsUdalost = propsPodleId.get(zmena.udalost.id);
    if (!propsUdalost) {
      return true;
    }
    return !propsDohnalyUpsert(propsUdalost, zmena.udalost);
  });

  if (dalsi.length === potvrzene.length) {
    return potvrzene as BranaKalendarPotvrzenaZmena[];
  }
  return dalsi;
}

/**
 * Základ = props (nové karty ze serveru zůstanou).
 * Potvrzené zmeny podle id je přepíšou nebo odstraní.
 */
export function sloucitKalendarDnySPotvrzenymi(
  propsDny: readonly BranaKalendarDen[],
  potvrzene: readonly BranaKalendarPotvrzenaZmena[],
): BranaKalendarDen[] {
  let dny = klonovatDny(propsDny);
  for (const zmena of potvrzene) {
    if (zmena.typ === "odstranit") {
      dny = odstranitIdZDnu(dny, zmena.id);
      continue;
    }
    dny = nahraditNeboVlozitUdalostDoDnu(dny, zmena.udalost);
  }
  return dny;
}

export function najitUdalostVKalendari(
  dny: readonly BranaKalendarDen[],
  id: string,
): BranaKonkretniUdalost | null {
  return indexUdalostiVDnech(dny).get(id) ?? null;
}

/** Stav po příchodu props: zahodit dohoněná potvrzení, zbytek sloučit. */
export function sladitKalendarDnySProps(
  propsDny: readonly BranaKalendarDen[],
  potvrzene: readonly BranaKalendarPotvrzenaZmena[],
): {
  dny: BranaKalendarDen[];
  potvrzene: BranaKalendarPotvrzenaZmena[];
} {
  const zive = zariditPotvrzeneZmenyKalendare(potvrzene, propsDny);
  return {
    potvrzene: zive,
    dny: sloucitKalendarDnySPotvrzenymi(propsDny, zive),
  };
}
