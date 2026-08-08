import "server-only";

import { maBranaAdminBlobKonfiguraci } from "@/lib/brana/admin/env-blob-brana-admin";
import { odeslatBranaWebPush } from "@/lib/brana/admin/odeslat-brana-web-push";
import {
  nacistUpozorneniNastaveniProScheduler,
  ulozitPosledniUpozorneniDlouhodobeProScheduler,
  validovatPushSubscriptionVstup,
} from "@/lib/brana/admin/upozorneni-uloziste";

/** Uzamčený produkční Pravidelný payload. */
export const BRANA_PRAVIDELNE_UPOZORNENI_PAYLOAD = {
  title: "BRÁNA",
  body: "Pravidelná kontrola ke schválení",
} as const;

export type BranaPravidelnyPushStav = "neposlan" | "odeslan" | "preskocen";

export type BranaPravidelnyPushVysledek = {
  stav: BranaPravidelnyPushStav;
};

/**
 * Po úspěšném stavovém dokončení 21denního checkpointu: max jeden Pravidelný push.
 * Nezávislé na pridanoDoKalendare. Dedup: posledniUpozorneniDlouhodobe === datumCheckpointu.
 * Selhání push nemění již dokončený checkpoint / +21.
 */
export async function vyhodnotitAOdeslatPravidelneUpozorneniPoCheckpointu(args: {
  datumCheckpointu: string;
}): Promise<BranaPravidelnyPushVysledek> {
  if (!maBranaAdminBlobKonfiguraci()) {
    console.error(
      "[brana-pravidelny-push] chybí BLOB_BRANA_ADMIN konfigurace – push neodeslán",
    );
    return { stav: "neposlan" };
  }

  const nacist = await nacistUpozorneniNastaveniProScheduler();
  if (!nacist.ok) {
    console.error("[brana-pravidelny-push] nastavení se nepodařilo načíst");
    return { stav: "neposlan" };
  }

  const { dokument } = nacist;

  if (dokument.posledniUpozorneniDlouhodobe === args.datumCheckpointu) {
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
    console.error("[brana-pravidelny-push] neplatná subscription");
    return { stav: "neposlan" };
  }

  const odeslani = await odeslatBranaWebPush(
    validace.pushSubscription,
    BRANA_PRAVIDELNE_UPOZORNENI_PAYLOAD,
    "brana-pravidelny-push",
  );

  if (!odeslani.uspech) {
    return { stav: "neposlan" };
  }

  await ulozitPosledniUpozorneniDlouhodobeProScheduler(args.datumCheckpointu);
  return { stav: "odeslan" };
}
