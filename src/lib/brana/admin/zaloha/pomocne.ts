import {
  BRANA_ZALOHA_PREFIX,
  BRANA_ZALOHA_SCHEMA,
  BRANA_ZALOHA_VERZE,
  type BranaZalohaManifest,
  type BranaZalohaTyp,
} from "./typy";

export function formatovatCasZalohy(datum = new Date()): string {
  return datum.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function formatovatVelikost(bajty: number): string {
  if (bajty < 1024) return `${bajty} B`;
  if (bajty < 1024 * 1024) return `${(bajty / 1024).toFixed(1)} KB`;
  return `${(bajty / (1024 * 1024)).toFixed(1)} MB`;
}

export function nazevZalohyZPathname(pathname: string): string {
  const soubor = pathname.split("/").pop() ?? pathname;
  return soubor.replace(/\.zip$/i, "");
}

export function typZalohyZNazvu(nazev: string): BranaZalohaTyp {
  return nazev.includes("-zachrana-") ? "zachrana" : "manual";
}

/**
 * Jen ZIP pod backups/brana/manual/, bez vnořených cest a bez ...
 */
export function jePlatnaCestaBranaZalohy(pathname: string): boolean {
  if (typeof pathname !== "string" || pathname.length === 0) {
    return false;
  }
  if (
    pathname.includes("..") ||
    pathname.includes("\\") ||
    pathname.includes("\0")
  ) {
    return false;
  }
  if (!pathname.startsWith(BRANA_ZALOHA_PREFIX)) {
    return false;
  }
  if (!pathname.endsWith(".zip")) {
    return false;
  }
  const rest = pathname.slice(BRANA_ZALOHA_PREFIX.length);
  if (!rest || rest.includes("/") || rest.includes("\\")) {
    return false;
  }
  return true;
}

export function parsovatBranaZalohaManifest(raw: string): BranaZalohaManifest {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Neplatná záloha – manifest.json není platný JSON.");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Neplatná záloha – neplatný manifest.");
  }

  const manifest = data as Record<string, unknown>;

  if (manifest.schema === "trebon-backup") {
    throw new Error(
      "Neplatná záloha – schéma trebon-backup sem nepatří. Očekáváno brana-backup.",
    );
  }

  if (manifest.schema !== BRANA_ZALOHA_SCHEMA) {
    throw new Error("Neplatná záloha – neznámé schéma souboru.");
  }

  if (manifest.version !== BRANA_ZALOHA_VERZE) {
    throw new Error(
      `Neplatná záloha – verze ${String(manifest.version)} není podporovaná (očekáváno ${BRANA_ZALOHA_VERZE}).`,
    );
  }

  if (manifest.typ !== "manual" && manifest.typ !== "zachrana") {
    throw new Error("Neplatná záloha – neplatný typ zálohy.");
  }

  if (typeof manifest.vytvoreno !== "string" || manifest.vytvoreno.length === 0) {
    throw new Error("Neplatná záloha – chybí čas vytvoření.");
  }

  return {
    schema: BRANA_ZALOHA_SCHEMA,
    version: BRANA_ZALOHA_VERZE,
    vytvoreno: manifest.vytvoreno,
    typ: manifest.typ,
  };
}

export function prectiTextZZip(
  polozky: Record<string, Uint8Array>,
  cesta: string,
): string {
  const data = polozky[cesta];
  if (!data) {
    throw new Error(`Záloha neobsahuje soubor ${cesta}.`);
  }
  return new TextDecoder().decode(data);
}
