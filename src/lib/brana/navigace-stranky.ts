/** Veřejné navigační stránky BRÁNY – /brana a podcesty */
export type BranaVerejnaStranka = "dnes" | "zitra" | "vikend" | "7-dni" | "vyhled";

export const BRANA_NAVIGACE = [
  { id: "dnes", label: "Dnes", href: "/brana" },
  { id: "zitra", label: "Zítra", href: "/brana/zitra" },
  { id: "vikend", label: "Víkend", href: "/brana/vikend" },
  { id: "7-dni", label: "7 dní", href: "/brana/7-dni" },
  { id: "vyhled", label: "Výhled", href: "/brana/vyhled" },
] as const satisfies ReadonlyArray<{
  id: BranaVerejnaStranka;
  label: string;
  href: string;
}>;

export function opakovaniSeznamuAkci(stranka: BranaVerejnaStranka): number {
  switch (stranka) {
    case "dnes":
    case "zitra":
    case "vyhled":
      return 1;
    case "vikend":
      return 2;
    case "7-dni":
      return 7;
  }
}
