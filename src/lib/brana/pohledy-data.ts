import {
  branaZakladniCesta,
  BRANA_NAVIGACE_POLOZKY,
  jeBranaSubdomenaHost,
} from "./cesty";
import {
  opakovaniSeznamuAkci,
  type BranaVerejnaStranka,
} from "./navigace-stranky";

/** Veřejná položka akce v pohledu (projekce SCHVALENO). */
export type BranaReferencniAkce = {
  mistoNeboTyp: string;
  nazev: string;
  cas: string;
};

/**
 * Společný datový model všech pěti pohledů.
 * Jedna pravda – pohledy se odvozují konfigurací, ne kopií seznamu.
 * `bloky`: vlastní seznam akcí pro každý denní/roční blok (SCHVALENO projekce).
 * Bez `bloky` = legacy opakování `akce`.
 */
export type BranaSdilenaPohledovaData = {
  akce: BranaReferencniAkce[];
  vyhledDatumy: readonly string[];
  vyhledPredelIndex: number;
  /** Pokud nastaveno, každý blok má vlastní seznam – neopakuje se `akce`. */
  bloky?: readonly (readonly BranaReferencniAkce[])[];
  /** Výhled: datumy vpravo po blocích (stejná struktura jako `bloky`). */
  vyhledDatumyBloky?: readonly (readonly string[])[];
};

export type BranaKonfiguracePohledu = {
  id: BranaVerejnaStranka;
  opakovaniSeznamu: number;
};

/** Prázdná sdílená data – bez mocku (klientský shell, pokud chybí SSR props). */
export function nactiBranaSdilenaPohledovaData(): BranaSdilenaPohledovaData {
  return {
    akce: [],
    vyhledDatumy: [],
    vyhledPredelIndex: 0,
  };
}

export function branaKonfiguracePohledu(
  stranka: BranaVerejnaStranka,
): BranaKonfiguracePohledu {
  return {
    id: stranka,
    opakovaniSeznamu: opakovaniSeznamuAkci(stranka),
  };
}

export function branaKonfiguraceVsechPohledu(): BranaKonfiguracePohledu[] {
  return BRANA_NAVIGACE_POLOZKY.map((polozka) =>
    branaKonfiguracePohledu(polozka.id),
  );
}

export function indexBranaPohledu(stranka: BranaVerejnaStranka): number {
  return BRANA_NAVIGACE_POLOZKY.findIndex((polozka) => polozka.id === stranka);
}

/**
 * Mapuje veřejný pathname na jeden z pěti pohledů.
 * Neznámé cesty (vzkaz, admin, …) vrací null.
 */
export function branaPohledZPathname(
  pathname: string,
  host?: string | null,
): BranaVerejnaStranka | null {
  const bezQuery = pathname.split("?")[0] || "/";
  const path =
    bezQuery.length > 1 ? bezQuery.replace(/\/+$/, "") : bezQuery || "/";

  if (jeBranaSubdomenaHost(host)) {
    if (path === "/" || path === "") {
      return "dnes";
    }

    for (const polozka of BRANA_NAVIGACE_POLOZKY) {
      if (polozka.id === "dnes") {
        continue;
      }

      if (path === `/${polozka.id}`) {
        return polozka.id;
      }
    }

    return null;
  }

  const base = branaZakladniCesta(host);

  if (path === base) {
    return "dnes";
  }

  if (!path.startsWith(`${base}/`)) {
    return null;
  }

  const segment = path.slice(base.length);

  for (const polozka of BRANA_NAVIGACE_POLOZKY) {
    if (polozka.id === "dnes") {
      continue;
    }

    if (segment === `/${polozka.id}`) {
      return polozka.id;
    }
  }

  return null;
}
