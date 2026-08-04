import {
  branaZakladniCesta,
  BRANA_NAVIGACE_POLOZKY,
  jeBranaSubdomenaHost,
} from "./cesty";
import {
  opakovaniSeznamuAkci,
  type BranaVerejnaStranka,
} from "./navigace-stranky";
import {
  BRANA_REFERENCNI_AKCE,
  type BranaReferencniAkce,
} from "./referencni-akce";
import {
  BRANA_VYHLED_DATUMY,
  BRANA_VYHLED_PREDEL_INDEX,
} from "./referencni-vyhled-datumy";

/**
 * Společný datový model všech pěti pohledů.
 * Jedna pravda – pohledy se odvozují konfigurací, ne kopií seznamu.
 * Později nahraditelné jedním redakčním načtením na serveru.
 */
export type BranaSdilenaPohledovaData = {
  akce: BranaReferencniAkce[];
  vyhledDatumy: readonly string[];
  vyhledPredelIndex: number;
};

export type BranaKonfiguracePohledu = {
  id: BranaVerejnaStranka;
  opakovaniSeznamu: number;
};

/** Jedno načtení společných dat pro klientský shell. */
export function nactiBranaSdilenaPohledovaData(): BranaSdilenaPohledovaData {
  return {
    akce: BRANA_REFERENCNI_AKCE,
    vyhledDatumy: BRANA_VYHLED_DATUMY,
    vyhledPredelIndex: BRANA_VYHLED_PREDEL_INDEX,
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
