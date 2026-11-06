import {
  okamzikVPraze,
  okamzikZPrahy,
  pridatDny,
  type BranaDatum,
} from "./cas";

/** Veřejné věty. Bez tečky. */
export const VETA_ZAMECKY_PARK_BRZY = "Zámecký park se za chvíli zavře";
export const VETA_ZAMECKY_PARK_ZAVRENO = "Zámecký park je zavřený";

const OTEVRENI_HODINA = 7;
const MINUT_PRED_ZAVRENIM = 45;

/** Hodina zavření podle měsíce 1–12. Otevření je vždy 7:00. */
const HODINA_ZAVRENI: Record<number, number> = {
  1: 16,
  2: 17,
  3: 18,
  4: 19,
  5: 20,
  6: 21,
  7: 21,
  8: 20,
  9: 19,
  10: 18,
  11: 17,
  12: 16,
};

export type StavZameckehoParku = "nic" | "brzy" | "zavreno";

type HraniceDne = {
  otevreni: Date;
  upozorneni: Date;
  zavreni: Date;
};

function datumPrahy(okamzik: Date): BranaDatum {
  const praha = okamzikVPraze(okamzik);
  return { rok: praha.rok, mesic: praha.mesic, den: praha.den };
}

function hodinaZavreni(mesic: number): number {
  const hodina = HODINA_ZAVRENI[mesic];
  if (hodina === undefined) {
    throw new Error(`Neznámý měsíc pro zámecký park: ${mesic}.`);
  }
  return hodina;
}

/** Pražské hranice jednoho kalendářního dne. Zavření je vždy v celou. */
function hraniceDne(datum: BranaDatum): HraniceDne {
  const zavreniHodina = hodinaZavreni(datum.mesic);
  return {
    otevreni: okamzikZPrahy(
      datum.rok,
      datum.mesic,
      datum.den,
      OTEVRENI_HODINA,
      0,
    ),
    upozorneni: okamzikZPrahy(
      datum.rok,
      datum.mesic,
      datum.den,
      zavreniHodina - 1,
      60 - MINUT_PRED_ZAVRENIM,
    ),
    zavreni: okamzikZPrahy(
      datum.rok,
      datum.mesic,
      datum.den,
      zavreniHodina,
      0,
    ),
  };
}

/**
 * nic: od otevření do upozornění (bez něj).
 * brzy: od upozornění do zavření (bez něj).
 * zavreno: od zavření do příštího otevření.
 */
export function stavZameckehoParku(okamzik: Date): StavZameckehoParku {
  const { otevreni, upozorneni, zavreni } = hraniceDne(datumPrahy(okamzik));
  const cas = okamzik.getTime();
  if (cas >= otevreni.getTime() && cas < upozorneni.getTime()) {
    return "nic";
  }
  if (cas >= upozorneni.getTime() && cas < zavreni.getTime()) {
    return "brzy";
  }
  return "zavreno";
}

/** Nejbližší budoucí přechod nic / brzy / zavreno. V daný okamžik už ne. */
export function dalsiZmenaStavuZameckehoParku(okamzik: Date): Date {
  const datum = datumPrahy(okamzik);
  const { otevreni, upozorneni, zavreni } = hraniceDne(datum);
  const cas = okamzik.getTime();
  if (cas < otevreni.getTime()) {
    return otevreni;
  }
  if (cas < upozorneni.getTime()) {
    return upozorneni;
  }
  if (cas < zavreni.getTime()) {
    return zavreni;
  }
  return hraniceDne(pridatDny(datum, 1)).otevreni;
}

export function jePlatneSkrytiZameckehoParku(hodnota: unknown): hodnota is string {
  return typeof hodnota === "string" && Number.isFinite(Date.parse(hodnota));
}

/** Poškozený dokument není skrytí. Chybějící čas znamená, že skrytí neplatí. */
export function parsovatDokumentSkrytiZameckehoParku(
  surovy: unknown,
): { ok: true; skrytoDo: string | null } | { ok: false } {
  if (!surovy || typeof surovy !== "object") {
    return { ok: false };
  }
  const root = surovy as Record<string, unknown>;
  if (root.verze !== 1) {
    return { ok: false };
  }
  if (root.skrytoDo === null || root.skrytoDo === undefined) {
    return { ok: true, skrytoDo: null };
  }
  if (!jePlatneSkrytiZameckehoParku(root.skrytoDo)) {
    return { ok: false };
  }
  return { ok: true, skrytoDo: root.skrytoDo };
}

/** Skrytí platí přesně do uloženého okamžiku, v něm už ne. */
export function jeZameckyParkRucneSkryty(
  okamzik: Date,
  skrytoDo: string | null,
): boolean {
  if (!jePlatneSkrytiZameckehoParku(skrytoDo)) {
    return false;
  }
  return okamzik.getTime() < Date.parse(skrytoDo);
}

/** null = nevykreslovat. Neplatné skrytí se ignoruje. */
export function verejnaVetaZameckehoParku(
  okamzik: Date,
  skrytoDo: string | null,
): string | null {
  if (jeZameckyParkRucneSkryty(okamzik, skrytoDo)) {
    return null;
  }
  const stav = stavZameckehoParku(okamzik);
  if (stav === "brzy") {
    return VETA_ZAMECKY_PARK_BRZY;
  }
  if (stav === "zavreno") {
    return VETA_ZAMECKY_PARK_ZAVRENO;
  }
  return null;
}

/**
 * Další okamžik, kdy se může změnit veřejný text.
 * Během skrytí je to dřívější z konce skrytí a změny stavu.
 */
export function dalsiZmenaVerejnehoTextuParku(
  okamzik: Date,
  skrytoDo: string | null,
): Date {
  const zmenaStavu = dalsiZmenaStavuZameckehoParku(okamzik);
  if (!jePlatneSkrytiZameckehoParku(skrytoDo)) {
    return zmenaStavu;
  }
  const konec = Date.parse(skrytoDo);
  if (konec <= okamzik.getTime() || konec >= zmenaStavu.getTime()) {
    return zmenaStavu;
  }
  return new Date(konec);
}
