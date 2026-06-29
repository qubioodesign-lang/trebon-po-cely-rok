import "server-only";

import { nacistData, upravitData } from "./uloziste-dat";
import {
  DESKTOP_POZVANKA_VYCHOZI_FOTOGRAFIE,
} from "./desktop-pozvanka";
import { sestavitUrlPolozky } from "./url-polozky";

export function sestavitUrlDesktopPozvankaFotografie(
  cesta: string | null | undefined
): string {
  if (cesta) {
    return sestavitUrlPolozky(cesta);
  }
  return DESKTOP_POZVANKA_VYCHOZI_FOTOGRAFIE;
}

export async function ziskatDesktopPozvankaFotografii(
  oidcZHeaderu?: string | null
): Promise<string> {
  const uloziste = await nacistData(oidcZHeaderu);
  return sestavitUrlDesktopPozvankaFotografie(uloziste.desktopPozvankaFotografie);
}

export async function ulozitDesktopPozvankaFotografii(
  cestaSouboru: string,
  oidcZHeaderu?: string | null
): Promise<void> {
  await upravitData(
    (uloziste) => {
      uloziste.desktopPozvankaFotografie = cestaSouboru;
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        uloziste.desktopPozvankaFotografie === cestaSouboru,
    }
  );
}

export async function ziskatCestuDesktopPozvankaFotografie(
  oidcZHeaderu?: string | null
): Promise<string | null> {
  const uloziste = await nacistData(oidcZHeaderu);
  return uloziste.desktopPozvankaFotografie ?? null;
}
