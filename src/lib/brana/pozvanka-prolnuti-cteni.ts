import "server-only";

import { ziskatAktivniPolozky } from "@/lib/polozky";
import { sPevnymStropem } from "@/lib/signal-cteni";
import {
  LIMIT_CTENI_POZVANKY_MS,
  pozvankaZVerejnychPolozek,
  type PozvankaProlnuti,
} from "./pozvanka-prolnuti";

/**
 * Popis a id prvního veřejného prolnutí.
 * Celé čtení včetně náhradní cesty má strop 800 ms a při jakémkoli selhání vrací null.
 */
export async function nacistPozvankuPrvnihoProlnuti(): Promise<PozvankaProlnuti | null> {
  try {
    return await sPevnymStropem(LIMIT_CTENI_POZVANKY_MS, async (signal) => {
      const polozky = await ziskatAktivniPolozky(undefined, { signal });
      return pozvankaZVerejnychPolozek(polozky);
    });
  } catch {
    return null;
  }
}
