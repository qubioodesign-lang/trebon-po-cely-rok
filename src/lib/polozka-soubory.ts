import type { Polozka, PolozkaVerejna } from "@/types";
import type { UlozisteDat } from "./uloziste-dat";
import {
  jePlatnyPocetSnimkuProlnuti,
  normalizovatCestySnimkuProlnuti,
} from "./prolnuti-snimky";
import { sestavitUrlPolozky } from "./url-polozky";

/** Ověří, že prolnutí v metadatech má kompletní sadu snímků */
export function overitProlnutiPolozkuVMetadatech(
  uloziste: UlozisteDat,
  id: string,
  ocekavaneSoubory: string[]
): boolean {
  const polozka = uloziste.polozky.find((p) => p.id === id);
  if (!polozka || polozka.typ !== "prolnuti") {
    return false;
  }

  const ulozene = normalizovatSouboryProlnuti(polozka.soubory ?? []);
  if (!jePlatnyPocetSnimkuProlnuti(ulozene.length)) {
    return false;
  }
  if (ulozene.length !== ocekavaneSoubory.length) {
    return false;
  }

  return ocekavaneSoubory.every((url, index) => ulozene[index] === url);
}

/** Všechny soubory položky (1 u fotografie/videa, 2+ u prolnutí) */
export function ziskatSouboryPolozky(
  polozka: Pick<Polozka, "typ" | "soubor" | "soubory">
): string[] {
  if (polozka.typ === "prolnuti") {
    return normalizovatSouboryProlnuti(polozka.soubory ?? []);
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
  const pocet = normalizovatSouboryProlnuti(polozka.soubory ?? []).length;
  return jePlatnyPocetSnimkuProlnuti(pocet);
}

/** Omezí soubory prolnutí na podporovaný rozsah (2–3) */
export function normalizovatSouboryProlnuti(soubory: string[]): string[] {
  return normalizovatCestySnimkuProlnuti(soubory);
}

/** URL snímků prolnutí pro galerii – 2 nebo 3 podle uložených souborů */
export function ziskatUrlsProlnuti(
  polozka: Pick<PolozkaVerejna, "typ" | "urls">
): string[] {
  if (polozka.typ !== "prolnuti") return [];
  const urls = (polozka.urls ?? []).filter(
    (url) => typeof url === "string" && url.trim().length > 0
  );
  if (!jePlatnyPocetSnimkuProlnuti(urls.length)) return [];
  return urls.slice(0, 3);
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
