import { ziskatSouboryPolozky } from "@/lib/polozka-soubory";
import { FACEBOOK_NAHLED_ZAKLAD } from "@/lib/sdileni";
import type { Polozka } from "@/types";

/** Široká karta ověřená testem ?fbtest=1. */
export const FACEBOOK_KARTA_SIRKA = 1200;
export const FACEBOOK_KARTA_VYSKA = 630;
export const FACEBOOK_KARTA_POZADI = "#FAF8F5";

export type SnimekFacebookKarty = 1 | 2 | 3;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HOST_BLOB = ".public.blob.vercel-storage.com";
const PRIPONY = new Set(["jpg", "jpeg", "png", "webp", "avif"]);

export function jeUuid(hodnota: string): boolean {
  return UUID.test(hodnota);
}

export function parsovatSnimekFacebookKarty(
  hodnota: string | undefined
): SnimekFacebookKarty | null {
  if (hodnota === "1" || hodnota === "2" || hodnota === "3") {
    return Number(hodnota) as SnimekFacebookKarty;
  }
  return null;
}

/** Snímek A/B/C prolnutí. U dvou fotografií třetí chybí. */
export function souborSnimkuProlnuti(
  polozka: Pick<Polozka, "typ" | "soubor" | "soubory"> | null | undefined,
  snimek: SnimekFacebookKarty
): string | null {
  if (!polozka || polozka.typ !== "prolnuti") return null;
  const soubory = ziskatSouboryPolozky(polozka);
  const cesta = soubory[snimek - 1];
  return cesta && cesta.trim().length > 0 ? cesta : null;
}

/**
 * Verze je jméno uloženého souboru.
 * Po výměně fotografie se změní a stará adresa se už nespáruje.
 */
export function verzeUlozenehoSouboru(soubor: string): string | null {
  const jmeno = jmenoUlozenehoSouboru(soubor);
  if (!jmeno) return null;
  const tecka = jmeno.lastIndexOf(".");
  if (tecka <= 0) return null;
  const kmen = jmeno.slice(0, tecka).toLowerCase();
  const pripona = jmeno.slice(tecka + 1).toLowerCase();
  if (!jeUuid(kmen) || !PRIPONY.has(pripona)) return null;
  return kmen;
}

/** Jen náš Blob nebo lokální soubor v public/uploads. Cizí adresu nebere. */
export function jePovolenaCestaUlozenehoSouboru(soubor: string): boolean {
  const jmeno = jmenoUlozenehoSouboru(soubor);
  if (!jmeno || !verzeUlozenehoSouboru(soubor)) return false;

  if (!soubor.startsWith("https://")) {
    return soubor === jmeno;
  }

  try {
    const url = new URL(soubor);
    if (url.username || url.password || url.search || url.hash) return false;
    if (url.port && url.port !== "443") return false;
    if (!url.hostname.endsWith(HOST_BLOB)) return false;
    if (url.hostname === HOST_BLOB.slice(1)) return false;
    const casti = url.pathname.split("/");
    return casti.length === 3 && casti[1] === "uploads" && casti[2] === jmeno;
  } catch {
    return false;
  }
}

export function sestavitUrlFacebookKarty(
  id: string,
  snimek: SnimekFacebookKarty,
  verze: string
): string {
  const parametry = new URLSearchParams({
    fbk: id,
    s: String(snimek),
    v: verze,
  });
  return `${FACEBOOK_NAHLED_ZAKLAD}/?${parametry.toString()}`;
}

export function cestaObrazkuFacebookKarty(
  id: string,
  snimek: SnimekFacebookKarty,
  verze: string
): string {
  return `/fb-karta/${id}/${snimek}/${verze}`;
}

/** Odkaz pro tlačítko. Bez platné fotografie nevrací nic. */
export function sestavitOdkazFacebookKarty(
  polozka: Pick<Polozka, "id" | "typ" | "soubor" | "soubory">,
  snimek: SnimekFacebookKarty
): string | null {
  if (!jeUuid(polozka.id)) return null;
  const soubor = souborSnimkuProlnuti(polozka, snimek);
  if (!soubor || !jePovolenaCestaUlozenehoSouboru(soubor)) return null;
  const verze = verzeUlozenehoSouboru(soubor);
  if (!verze) return null;
  return sestavitUrlFacebookKarty(polozka.id, snimek, verze);
}

/** Stejná fotografie, která je v adrese. Po výměně souboru už nesedí. */
export function souborOdpovidaVerzi(soubor: string, verze: string): boolean {
  const aktualni = verzeUlozenehoSouboru(soubor);
  return aktualni !== null && aktualni === verze.toLowerCase();
}

function jmenoUlozenehoSouboru(soubor: string): string | null {
  const bezQuery = soubor.split("?")[0]?.split("#")[0] ?? "";
  if (!bezQuery || bezQuery.includes("\\")) return null;

  if (bezQuery.startsWith("https://") || bezQuery.startsWith("http://")) {
    try {
      const jmeno = new URL(bezQuery).pathname.split("/").pop() ?? "";
      return jmeno.length > 0 ? jmeno : null;
    } catch {
      return null;
    }
  }

  if (bezQuery.includes("/")) return null;
  return bezQuery;
}
