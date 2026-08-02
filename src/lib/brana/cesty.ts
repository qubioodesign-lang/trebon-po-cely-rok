import type { BranaVerejnaStranka } from "./navigace-stranky";

/** Hostname produkční subdomény BRÁNY */
export const BRANA_SUBDOMENA_HOST = "brana.trebonpocelyrok.cz";

/** Absolutní URL hlavního webu Třeboň po celý rok */
export const TREBON_PRODUKCNI_URL = "https://www.trebonpocelyrok.cz";

export type BranaInterniStranka = BranaVerejnaStranka | "vzkaz" | "admin";

const STRANKA_SEGMENT: Record<BranaInterniStranka, string> = {
  dnes: "",
  zitra: "/zitra",
  vikend: "/vikend",
  "7-dni": "/7-dni",
  vyhled: "/vyhled",
  vzkaz: "/vzkaz",
  admin: "/admin",
};

/** Veřejné navigační položky bez href – cesty se dopočítají podle hostitele. */
export const BRANA_NAVIGACE_POLOZKY = [
  { id: "dnes", label: "Dnes" },
  { id: "zitra", label: "Zítra" },
  { id: "vikend", label: "Víkend" },
  { id: "7-dni", label: "7 dní" },
  { id: "vyhled", label: "Výhled" },
] as const satisfies ReadonlyArray<{
  id: BranaVerejnaStranka;
  label: string;
}>;

export type BranaNavPolozka = {
  id: BranaVerejnaStranka;
  label: string;
  href: string;
};

export function jeBranaSubdomenaHost(host: string | null | undefined): boolean {
  if (!host) {
    return false;
  }

  return host.split(":")[0].toLowerCase() === BRANA_SUBDOMENA_HOST;
}

/** Prefix veřejných stránek BRÁNY – prázdný na subdoméně, jinak /brana. */
export function branaZakladniCesta(host?: string | null): string {
  if (jeBranaSubdomenaHost(host)) {
    return "";
  }

  return "/brana";
}

/** Veřejná nebo interní cesta BRÁNY podle hostitele. */
export function branaVerejnaCesta(
  stranka: BranaInterniStranka,
  host?: string | null,
): string {
  const segment = STRANKA_SEGMENT[stranka];
  const base = branaZakladniCesta(host);

  if (!base) {
    return segment || "/";
  }

  return `${base}${segment}`;
}

/** Odkaz v patě – na subdoméně absolutně na Třeboň, jinak relativně na /. */
export function branaOdkazNaTrebon(host?: string | null): string {
  if (jeBranaSubdomenaHost(host)) {
    return TREBON_PRODUKCNI_URL;
  }

  return "/";
}

/** Navigační položky s href podle hostitele. */
export function branaNavigace(host?: string | null): BranaNavPolozka[] {
  return BRANA_NAVIGACE_POLOZKY.map((polozka) => ({
    ...polozka,
    href: branaVerejnaCesta(polozka.id, host),
  }));
}
