/**
 * Vizuální nápověda prázdného NE slotu v Redakčním pořadí.
 * Není hodnota Položky. Neukládá se. Merge ani seed nemění.
 */

import { BRANA_REDAKCNI_VSECHNY_VYCHOZI } from "./redakcni-kostra";

export function placeholderPrazdneNePolozky(radek: {
  id: string;
  polozka: string;
  pouzivat: string;
}): string {
  if (radek.pouzivat !== "NE") {
    return "";
  }
  if (radek.polozka.trim() !== "") {
    return "";
  }
  const vychozi = BRANA_REDAKCNI_VSECHNY_VYCHOZI.find((p) => p.id === radek.id);
  return (vychozi?.polozka ?? "").trim();
}
