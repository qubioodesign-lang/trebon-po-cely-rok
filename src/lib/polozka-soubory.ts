import type { Polozka, PolozkaVerejna } from "@/types";
import {
  jePlatnyPocetSnimkuProlnuti,
  PROLNUTI_MAX_SNIMKU,
} from "./prolnuti-snimky";
import { sestavitUrlPolozky } from "./url-polozky";
/** Všechny soubory položky (1 u fotografie/videa, 2+ u prolnutí) */
export function ziskatSouboryPolozky(
  polozka: Pick<Polozka, "typ" | "soubor" | "soubory">
): string[] {
  if (polozka.typ === "prolnuti") {
    return polozka.soubory ?? [];
  }
  return polozka.soubor ? [polozka.soubor] : [];
}

/** První soubor – náhled, OG image, záloha */
export function ziskatHlavniSouborPolozky(
  polozka: Pick<Polozka, "typ" | "soubor" | "soubory">
): string | null {
  const soubory = ziskatSouboryPolozky(polozka);
  return soubory[0] ?? null;
}

export function jePlatneProlnuti(
  polozka: Pick<Polozka, "typ" | "soubory">
): boolean {
  if (polozka.typ !== "prolnuti") return false;
  const pocet = polozka.soubory?.length ?? 0;
  return jePlatnyPocetSnimkuProlnuti(pocet);
}

/** Omezí soubory prolnutí na podporovaný rozsah (2–3) */
export function normalizovatSouboryProlnuti(soubory: string[]): string[] {
  return soubory.slice(0, PROLNUTI_MAX_SNIMKU);
}
export function jePlatnaPolozkaGalerie(polozka: Polozka): boolean {
  if (!polozka.aktivni) return false;
  if (polozka.typ === "prolnuti") {
    return jePlatneProlnuti(polozka);
  }
  return Boolean(polozka.soubor);
}

/** Interní položka → veřejná reprezentace pro frontend */
export function mapovatPolozkuVerejnou(polozka: Polozka): PolozkaVerejna {
  if (polozka.typ === "prolnuti") {
    const soubory = normalizovatSouboryProlnuti(polozka.soubory ?? []);
    return {
      id: polozka.id,
      typ: "prolnuti",
      urls: soubory.map(sestavitUrlPolozky),
      popis: polozka.popis,
    };
  }

  return {
    id: polozka.id,
    typ: polozka.typ,
    url: sestavitUrlPolozky(polozka.soubor!),
    popis: polozka.popis,
  };
}
