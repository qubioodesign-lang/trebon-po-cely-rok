import "server-only";

import { createHash } from "node:crypto";

/** Interní stavy Atmosféry — AI nesmí tvořit veřejnou větu. */
export const BRANA_ATMOSFERA_STAVY = [
  "KLIDNE",
  "ZIVO",
  "RUSNE",
  "CHYSTA_SE",
  "OZIVA",
  "ZKLIDNUJE",
  "ZTICHLO",
  "NIC",
] as const;

export type BranaAtmosferaStav = (typeof BRANA_ATMOSFERA_STAVY)[number];

export const BRANA_ATMOSFERA_STATICKE_STAVY = [
  "KLIDNE",
  "ZIVO",
  "RUSNE",
  "CHYSTA_SE",
  "NIC",
] as const;

export type BranaAtmosferaStatickyStav =
  (typeof BRANA_ATMOSFERA_STATICKE_STAVY)[number];

export const BRANA_ATMOSFERA_DYNAMICKE_STAVY = [
  "OZIVA",
  "ZKLIDNUJE",
  "ZTICHLO",
] as const;

export type BranaAtmosferaDynamickyStav =
  (typeof BRANA_ATMOSFERA_DYNAMICKE_STAVY)[number];

export type BranaAtmosferaDuvodStavu =
  | "STATICKY"
  | "DYNAMICKY"
  | "CHYBA"
  | "NIC";

export type BranaAtmosferaDokument = {
  verze: 1;
  stav: BranaAtmosferaStav;
  zkontrolovanoAt: string;
  /** Čas snímku právě této kontroly; null pokud kontrola neměla platný snímek. */
  snimekAt: string | null;
  /** Čas snímku očekávaného v data/brana-atmosfera-predchozi.jpg. */
  pracovniJpegAt: string | null;
  /** SHA-256 hex bajtů očekávaného pracovního JPEG. */
  pracovniJpegSha256: string | null;
  /** Timestamp previous použitého při této kontrole (audit); null = nepoužit. */
  predchoziSnimekAt: string | null;
  model: string | null;
  duvodStavu: BranaAtmosferaDuvodStavu;
};

export const BRANA_ATMOSFERA_VERZE = 1 as const;

/** Aktuální JPEG starší než toto → NIC. */
export const BRANA_ATMOSFERA_MAX_STARI_SNIMKU_MS = 30 * 60 * 1000;

/** Předchozí JPEG starší než toto vůči aktuálnímu → nepoužít pro dynamiku. */
export const BRANA_ATMOSFERA_MAX_STARI_PREDCHOZIHO_MS = 12 * 60 * 60 * 1000;

const MAPOVANI_VETY: Record<BranaAtmosferaStav, string | null> = {
  KLIDNE: "Náměstí je klidné.",
  ZIVO: "Na náměstí je živo.",
  RUSNE: "Náměstí je rušné.",
  CHYSTA_SE: "Náměstí se chystá.",
  OZIVA: "Náměstí pomalu ožívá.",
  ZKLIDNUJE: "Náměstí se zklidňuje.",
  ZTICHLO: "Náměstí už ztichlo.",
  NIC: null,
};

export function verejnaVetaAtmosfery(
  stav: BranaAtmosferaStav,
): string | null {
  return MAPOVANI_VETY[stav];
}

export function otiskJpegSha256(bajty: Buffer): string {
  return createHash("sha256").update(bajty).digest("hex");
}

export function jeAtmosferaStav(hodnota: unknown): hodnota is BranaAtmosferaStav {
  return (
    typeof hodnota === "string" &&
    (BRANA_ATMOSFERA_STAVY as readonly string[]).includes(hodnota)
  );
}

export function jeAtmosferaStatickyStav(
  hodnota: unknown,
): hodnota is BranaAtmosferaStatickyStav {
  return (
    typeof hodnota === "string" &&
    (BRANA_ATMOSFERA_STATICKE_STAVY as readonly string[]).includes(hodnota)
  );
}

export function jeAtmosferaDynamickyStav(
  hodnota: unknown,
): hodnota is BranaAtmosferaDynamickyStav {
  return (
    typeof hodnota === "string" &&
    (BRANA_ATMOSFERA_DYNAMICKE_STAVY as readonly string[]).includes(hodnota)
  );
}

export function vychoziAtmosferaDokument(
  tedIso: string = new Date().toISOString(),
): BranaAtmosferaDokument {
  return {
    verze: BRANA_ATMOSFERA_VERZE,
    stav: "NIC",
    zkontrolovanoAt: tedIso,
    snimekAt: null,
    pracovniJpegAt: null,
    pracovniJpegSha256: null,
    predchoziSnimekAt: null,
    model: null,
    duvodStavu: "NIC",
  };
}

function jeIso(hodnota: unknown): hodnota is string {
  if (typeof hodnota !== "string" || !hodnota.trim()) return false;
  const t = Date.parse(hodnota);
  return Number.isFinite(t);
}

function jeSha256Hex(hodnota: unknown): hodnota is string {
  return typeof hodnota === "string" && /^[a-f0-9]{64}$/i.test(hodnota);
}

export function parsovatAtmosferaDokument(
  surovy: unknown,
): BranaAtmosferaDokument | null {
  if (!surovy || typeof surovy !== "object") return null;
  const root = surovy as Record<string, unknown>;
  if (root.verze !== 1) return null;
  if (!jeAtmosferaStav(root.stav)) return null;
  if (!jeIso(root.zkontrolovanoAt)) return null;

  const duvod = root.duvodStavu;
  if (
    duvod !== "STATICKY" &&
    duvod !== "DYNAMICKY" &&
    duvod !== "CHYBA" &&
    duvod !== "NIC"
  ) {
    return null;
  }

  const snimekAt =
    root.snimekAt === null || root.snimekAt === undefined
      ? null
      : jeIso(root.snimekAt)
        ? root.snimekAt
        : null;
  if (root.snimekAt != null && snimekAt === null) return null;

  // Zpětná kompatibilita: chybějící nová pole → null (previous se nepoužije).
  const pracovniJpegAt =
    root.pracovniJpegAt === null || root.pracovniJpegAt === undefined
      ? null
      : jeIso(root.pracovniJpegAt)
        ? root.pracovniJpegAt
        : null;
  if (root.pracovniJpegAt != null && pracovniJpegAt === null) return null;

  const pracovniJpegSha256 =
    root.pracovniJpegSha256 === null || root.pracovniJpegSha256 === undefined
      ? null
      : jeSha256Hex(root.pracovniJpegSha256)
        ? root.pracovniJpegSha256.toLowerCase()
        : null;
  if (root.pracovniJpegSha256 != null && pracovniJpegSha256 === null) {
    return null;
  }

  const predchoziSnimekAt =
    root.predchoziSnimekAt === null || root.predchoziSnimekAt === undefined
      ? null
      : jeIso(root.predchoziSnimekAt)
        ? root.predchoziSnimekAt
        : null;
  if (root.predchoziSnimekAt != null && predchoziSnimekAt === null) {
    return null;
  }

  const model =
    root.model === null || root.model === undefined
      ? null
      : typeof root.model === "string" && root.model.trim()
        ? root.model.trim()
        : null;
  if (root.model != null && model === null) return null;

  return {
    verze: 1,
    stav: root.stav,
    zkontrolovanoAt: root.zkontrolovanoAt,
    snimekAt,
    pracovniJpegAt,
    pracovniJpegSha256,
    predchoziSnimekAt,
    model,
    duvodStavu: duvod,
  };
}
