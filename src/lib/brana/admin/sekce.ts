import { branaZakladniCesta } from "../cesty";
import { BRANA_ADMIN_CESTA } from "./konstanty";

/** Hlavní části administrace BRÁNY */
export type BranaAdminHlavniCast = "sprava" | "analytika";

/** Sekce uvnitř Správy – připravené pro budoucí funkce */
export type BranaAdminSpravaSekce =
  | "kalendar"
  | "vyhled"
  | "redakcni-poradi"
  | "nezarazene"
  | "zdroje"
  | "upozorneni"
  | "zaloha";

export type BranaAdminNavPolozka<T extends string> = {
  id: T;
  label: string;
  /** Relativní segment pod /admin */
  segment: string;
};

/** Dvě hlavní části administrace */
export const BRANA_ADMIN_HLAVNI_CASTI = [
  { id: "sprava", label: "Správa", segment: "sprava" },
  { id: "analytika", label: "Analytika", segment: "analytika" },
] as const satisfies ReadonlyArray<BranaAdminNavPolozka<BranaAdminHlavniCast>>;

/**
 * Sekce Správy.
 * Kalendář, Výhled, Redakční pořadí, Nezařazené a Zdroje tvoří základní redakční strukturu;
 * Záloha zůstává připravená pro pozdější napojení.
 */
export const BRANA_ADMIN_SPRAVA_SEKCE = [
  { id: "kalendar", label: "Kalendář", segment: "kalendar" },
  { id: "vyhled", label: "Výhled", segment: "vyhled" },
  {
    id: "redakcni-poradi",
    label: "Redakční pořadí",
    segment: "redakcni-poradi",
  },
  { id: "nezarazene", label: "Nezařazené", segment: "nezarazene" },
  { id: "zdroje", label: "Zdroje", segment: "zdroje" },
  { id: "upozorneni", label: "Upozornění", segment: "upozorneni" },
  { id: "zaloha", label: "Záloha", segment: "zaloha" },
] as const satisfies ReadonlyArray<BranaAdminNavPolozka<BranaAdminSpravaSekce>>;

/** Výchozí vstup do Správy (hlavní budoucí pracovní plocha) */
export const BRANA_ADMIN_SPRAVA_VYCHOZI: BranaAdminSpravaSekce = "kalendar";

/**
 * Cesta administrace podle hostitele.
 * Subdoména → `/admin/...`, jinak `/brana/admin/...`.
 */
export function branaAdminCesta(
  host: string | null | undefined,
  ...segmenty: string[]
): string {
  const zaklad = branaZakladniCesta(host);
  const koren = zaklad ? `${zaklad}/admin` : "/admin";

  if (segmenty.length === 0) {
    return koren;
  }

  return `${koren}/${segmenty.join("/")}`;
}

/** Cesta výchozí sekce Správy */
export function branaAdminSpravaVychoziCesta(
  host: string | null | undefined,
): string {
  return branaAdminCesta(host, "sprava", BRANA_ADMIN_SPRAVA_VYCHOZI);
}

/** Interní cesta App Routeru (vždy pod /brana/admin) – pro redirecty v page.tsx */
export function branaAdminInterniCesta(...segmenty: string[]): string {
  if (segmenty.length === 0) {
    return BRANA_ADMIN_CESTA;
  }

  return `${BRANA_ADMIN_CESTA}/${segmenty.join("/")}`;
}
