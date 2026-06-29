import "server-only";

/** Strukturované logy pro diagnostiku nahrávání prolnutí ve Vercel → Logs */
export type ProlnutiLogKontext = Record<
  string,
  string | number | boolean | null | undefined
>;

function formatovatKontext(kontext?: ProlnutiLogKontext): string {
  if (!kontext) {
    return "";
  }

  const filtr = Object.fromEntries(
    Object.entries(kontext).filter(([, hodnota]) => hodnota !== undefined)
  );

  if (Object.keys(filtr).length === 0) {
    return "";
  }

  return ` ${JSON.stringify(filtr)}`;
}

export function logProlnuti(
  udalost: string,
  kontext?: ProlnutiLogKontext
): void {
  console.log(`[prolnuti] ${udalost}${formatovatKontext(kontext)}`);
}

export function logProlnutiVarovani(
  udalost: string,
  kontext?: ProlnutiLogKontext
): void {
  console.warn(`[prolnuti] ${udalost}${formatovatKontext(kontext)}`);
}

export function logProlnutiChyba(
  udalost: string,
  duvod: unknown,
  kontext?: ProlnutiLogKontext
): void {
  const zprava =
    duvod instanceof Error ? duvod.message : String(duvod ?? "neznámá chyba");

  console.error(
    `[prolnuti] ${udalost}${formatovatKontext({ ...kontext, duvod: zprava })}`
  );
}

/** Zkrátí Blob URL pro logy – stačí název souboru */
export function zkratitUrlProLog(url: string): string {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return url;
  }

  try {
    const pathname = new URL(url).pathname;
    const casti = pathname.split("/").filter(Boolean);
    return casti[casti.length - 1] ?? url;
  } catch {
    return url.slice(-48);
  }
}
