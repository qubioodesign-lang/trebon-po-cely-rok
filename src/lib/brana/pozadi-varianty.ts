/** Dočasné varianty procedurálního pozadí pro výběr principu hladiny */
export type BranaPozadiVarianta = 1 | 2 | 3 | 4;

export function parseBranaPozadiVarianta(
  pozadi?: string,
): BranaPozadiVarianta | undefined {
  if (pozadi === "1" || pozadi === "2" || pozadi === "3" || pozadi === "4") {
    return Number(pozadi) as BranaPozadiVarianta;
  }
  return undefined;
}
