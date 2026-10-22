import "server-only";

import { nacistDataCerstve } from "./uloziste-dat";
import { souboryBezpecneKeSmazani } from "./prolnuti-vytvoreni";
import { smazatSoubory } from "./soubory";

/**
 * Smaže jen soubory, na které po čerstvém čtení metadat nikdo neukazuje.
 * Když metadata nelze načíst, nesmaže nic.
 */
export async function smazatNepouzivaneSoubory(
  cesty: readonly string[],
  oidcZHeaderu?: string | null
): Promise<string[]> {
  if (cesty.length === 0) return [];

  let uloziste: Awaited<ReturnType<typeof nacistDataCerstve>> | null = null;
  try {
    uloziste = await nacistDataCerstve(oidcZHeaderu, { bezVerejneCache: true });
  } catch {
    return [];
  }

  const volne = souboryBezpecneKeSmazani(uloziste, cesty);
  if (volne.length === 0) return [];

  await smazatSoubory(volne, oidcZHeaderu);
  return volne;
}
