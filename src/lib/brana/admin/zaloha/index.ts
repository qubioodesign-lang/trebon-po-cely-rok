import "server-only";

import { nacistDokumentyProZalohu } from "./dokumenty";
import {
  nacistBranaZalohuZip,
  seznamBranaZaloh,
  ulozitBranaZalohuZip,
} from "./uloziste";
import { sestavitBranaZalohuZip } from "./zip";
import type { BranaZalohaInfo, BranaZalohaTyp } from "./typy";

export type { BranaZalohaInfo, BranaZalohaTyp } from "./typy";
export { formatovatVelikost, jePlatnaCestaBranaZalohy, nazevZalohyZPathname } from "./pomocne";
export { seznamBranaZaloh, nacistBranaZalohuZip };

export async function vytvoritBranaZalohu(
  typ: BranaZalohaTyp = "manual",
): Promise<BranaZalohaInfo> {
  const dokumenty = await nacistDokumentyProZalohu();
  const zip = sestavitBranaZalohuZip({ typ, dokumenty });
  return ulozitBranaZalohuZip(zip, typ);
}
