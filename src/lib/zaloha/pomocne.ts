import { ZALOHA_PREFIX, ZALOHA_SCHEMA, ZALOHA_VERZE, type ManifestZalohy } from "./typy";

/** Extrahuje název souboru z Blob URL nebo lokální cesty */
export function extrahovatUploadCestu(soubor: string): string | null {
  if (soubor.startsWith("http://") || soubor.startsWith("https://")) {
    try {
      const url = new URL(soubor);
      const shoda = url.pathname.match(/\/uploads\/(.+)$/);
      return shoda?.[1] ?? null;
    } catch {
      return null;
    }
  }

  const casti = soubor.replace(/\\/g, "/").split("/");
  const uploadsIndex = casti.lastIndexOf("uploads");
  if (uploadsIndex >= 0 && uploadsIndex < casti.length - 1) {
    return casti.slice(uploadsIndex + 1).join("/");
  }

  return casti.at(-1) ?? null;
}

/** Cesta souboru uvnitř ZIP */
export function cestaSouboruVZip(uploadCesta: string): string {
  return `files/uploads/${uploadCesta}`;
}

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

export function jePlatnaCestaZalohy(pathname: string): boolean {
  return (
    pathname.startsWith(ZALOHA_PREFIX) &&
    pathname.endsWith(".zip") &&
    !pathname.includes("..")
  );
}

export function parsovatManifest(raw: string): ManifestZalohy {
  const data = JSON.parse(raw) as ManifestZalohy;

  if (data.schema !== ZALOHA_SCHEMA) {
    throw new Error("Neplatná záloha – neznámé schéma souboru.");
  }

  if (data.version !== ZALOHA_VERZE) {
    throw new Error(
      `Neplatná záloha – verze ${data.version} není podporovaná (očekáváno ${ZALOHA_VERZE}).`
    );
  }

  return data;
}

/** Dekóduje UTF-8 text z ZIP položky */
export function prectiTextZZip(
  polozky: Record<string, Uint8Array>,
  cesta: string
): string {
  const data = polozky[cesta];
  if (!data) {
    throw new Error(`Záloha neobsahuje soubor ${cesta}.`);
  }
  return new TextDecoder().decode(data);
}
