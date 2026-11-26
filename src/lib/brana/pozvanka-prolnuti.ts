/** Pozvánka do galerie: první viditelné prolnutí a odkaz na něj. Bez vlastního čtení. */

export const LIMIT_CTENI_POZVANKY_MS = 800;

export const TEXT_POZVANKY_TREBON = "Nakouknout do Třeboně";

export type PozvankaProlnuti = {
  popis: string;
  id: string;
};

type PolozkaPozvanky = {
  id: string;
  typ: string;
  popis: string;
};

/** První viditelné platné prolnutí v už sestaveném veřejném pořadí. Prázdný popis se nebere. */
export function pozvankaZVerejnychPolozek(
  polozky: readonly PolozkaPozvanky[],
): PozvankaProlnuti | null {
  const prvni = polozky.find((polozka) => polozka.typ === "prolnuti");
  if (!prvni) return null;
  if (prvni.popis.trim() === "") return null;
  return { popis: prvni.popis, id: prvni.id };
}

/** Původní adresa, nebo tatáž adresa s existujícím ?polozka=. */
export function odkazNaTrebonSPolozkou(
  zaklad: string,
  id: string | null | undefined,
): string {
  if (!id) return zaklad;
  const spojka = zaklad.includes("?") ? "&" : "?";
  return `${zaklad}${spojka}polozka=${encodeURIComponent(id)}`;
}
