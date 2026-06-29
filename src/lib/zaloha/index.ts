import "server-only";

import { pouzivatBlobProZalohu, maBlobAutentizaciProZapis } from "@/lib/env-blob";
import { sestavitZalohuZip } from "./sestavit-zalohu";
import {
  ulozitZalohuDoBlobu,
  ulozitZalohuLokalne,
  seznamZaloh,
  nacistZalohuZip,
} from "./uloziste-zaloh";
import { obnovitZeZalohy } from "./obnovit-zalohu";
import type { ZalohaInfo } from "./typy";

export type { ZalohaInfo, ManifestZalohy, NastaveniProjektuZalohy } from "./typy";
export type { VysledekObnovyZalohy } from "./obnovit-zalohu";
export { formatovatVelikost } from "./pomocne";

/** Vytvoří ZIP zálohu – v dev lokálně, na Vercelu v produkci do Blobu */
export async function vytvoritZalohu(
  oidcZHeaderu?: string | null
): Promise<ZalohaInfo> {
  const zip = await sestavitZalohuZip(oidcZHeaderu);

  if (pouzivatBlobProZalohu() && maBlobAutentizaciProZapis(oidcZHeaderu)) {
    return ulozitZalohuDoBlobu(zip, oidcZHeaderu);
  }

  return ulozitZalohuLokalne(zip);
}

export { seznamZaloh, nacistZalohuZip, obnovitZeZalohy };
