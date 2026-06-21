import "server-only";

import { sestavitZalohuZip } from "./sestavit-zalohu";
import { ulozitZalohu, seznamZaloh, nacistZalohuZip } from "./uloziste-zaloh";
import { obnovitZeZalohy } from "./obnovit-zalohu";
import type { ZalohaInfo } from "./typy";

export type { ZalohaInfo, ManifestZalohy, NastaveniProjektuZalohy } from "./typy";
export type { VysledekObnovyZalohy } from "./obnovit-zalohu";
export { formatovatVelikost } from "./pomocne";

/** Vytvoří ZIP zálohu a uloží ji do úložiště záloh */
export async function vytvoritZalohu(
  oidcZHeaderu?: string | null
): Promise<ZalohaInfo> {
  const zip = await sestavitZalohuZip(oidcZHeaderu);
  return ulozitZalohu(zip, oidcZHeaderu);
}

export { seznamZaloh, nacistZalohuZip, obnovitZeZalohy };
