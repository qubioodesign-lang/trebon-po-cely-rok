import "server-only";

import { isoDenPripravyAsistovanychZdroju } from "@/lib/brana/admin/casovy-motor";
import { maBranaAdminBlobKonfiguraci } from "@/lib/brana/admin/env-blob-brana-admin";
import { odeslatBranaWebPush } from "@/lib/brana/admin/odeslat-brana-web-push";
import {
  nacistUpozorneniNastaveniProScheduler,
  ulozitPosledniUpozorneniAsistovaneKotvuProScheduler,
  validovatPushSubscriptionVstup,
} from "@/lib/brana/admin/upozorneni-uloziste";

/** Uzamčený produkční payload připomínky asistovaných zdrojů. */
export const BRANA_ASISTOVANE_UPOZORNENI_PAYLOAD = {
  title: "BRÁNA",
  body: "Připrav asistované zdroje pro příští kontrolu BRÁNY.",
} as const;

export type BranaAsistovanyPushStav = "neposlan" | "odeslan" | "preskocen";

export type BranaAsistovanyPushVysledek = {
  stav: BranaAsistovanyPushStav;
};

/**
 * Připomínka 3 dny před kotvou dlouhého scanu. Nespouští scan.
 * Dedup: posledniUpozorneniAsistovaneKotva === pristiDlouhodobaKontrola.
 */
export async function vyhodnotitAOdeslatAsistovaneUpozorneniPredKotvou(args: {
  datumVPraze: string;
}): Promise<BranaAsistovanyPushVysledek> {
  if (!maBranaAdminBlobKonfiguraci()) {
    console.error(
      "[brana-asistovane-push] chybí BLOB_BRANA_ADMIN konfigurace – push neodeslán",
    );
    return { stav: "neposlan" };
  }

  const nacist = await nacistUpozorneniNastaveniProScheduler();
  if (!nacist.ok) {
    console.error("[brana-asistovane-push] nastavení se nepodařilo načíst");
    return { stav: "neposlan" };
  }

  const { dokument } = nacist;
  const kotva = dokument.pristiDlouhodobaKontrola;
  if (isoDenPripravyAsistovanychZdroju(kotva) !== args.datumVPraze) {
    return { stav: "neposlan" };
  }
  if (kotva === null) {
    return { stav: "neposlan" };
  }

  if (dokument.posledniUpozorneniAsistovaneKotva === kotva) {
    return { stav: "preskocen" };
  }

  if (!dokument.upozorneniAktivni) {
    return { stav: "neposlan" };
  }

  if (!dokument.pushSubscription) {
    return { stav: "neposlan" };
  }

  const validace = validovatPushSubscriptionVstup(dokument.pushSubscription);
  if (!validace.ok) {
    console.error("[brana-asistovane-push] neplatná subscription");
    return { stav: "neposlan" };
  }

  const odeslani = await odeslatBranaWebPush(
    validace.pushSubscription,
    BRANA_ASISTOVANE_UPOZORNENI_PAYLOAD,
    "brana-asistovane-push",
  );

  if (!odeslani.uspech) {
    return { stav: "neposlan" };
  }

  await ulozitPosledniUpozorneniAsistovaneKotvuProScheduler(kotva);
  return { stav: "odeslan" };
}
