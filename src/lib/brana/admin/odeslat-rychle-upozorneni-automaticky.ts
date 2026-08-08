import "server-only";

import { maBranaAdminBlobKonfiguraci } from "@/lib/brana/admin/env-blob-brana-admin";
import { odeslatBranaWebPush } from "@/lib/brana/admin/odeslat-brana-web-push";
import {
  nacistUpozorneniNastaveniProScheduler,
  ulozitPosledniUpozorneniRychleProScheduler,
  validovatPushSubscriptionVstup,
} from "@/lib/brana/admin/upozorneni-uloziste";

/** Uzamčený produkční Rychlý payload – jediný text tohoto kroku. */
export const BRANA_RYCHLE_UPOZORNENI_PAYLOAD = {
  title: "BRÁNA",
  body: "Rychlá kontrola ke schválení",
} as const;

export type BranaRychlyPushStav = "neposlan" | "odeslan" | "preskocen";

export type BranaRychlyPushVysledek = {
  stav: BranaRychlyPushStav;
};

/**
 * Po dokončeném Rychlém batch: max jedno souhrnné Web Push upozornění.
 * Pouze při pridanoDoKalendare > 0 a platném termínu (volající filtruje).
 * Dedup: posledniUpozorneniRychle === datumVPraze → přeskočeno.
 * posledniUpozorneniRychle se mění jen po úspěšném sendNotification.
 * Bez Dlouhodobého push, bez retry, bez mazání subscription.
 */
export async function vyhodnotitAOdeslatRychleUpozorneniPoScanu(args: {
  datumVPraze: string;
  pridanoDoKalendare: number;
}): Promise<BranaRychlyPushVysledek> {
  if (args.pridanoDoKalendare <= 0) {
    return { stav: "neposlan" };
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    console.error(
      "[brana-rychly-push] chybí BLOB_BRANA_ADMIN konfigurace – push neodeslán",
    );
    return { stav: "neposlan" };
  }

  const nacist = await nacistUpozorneniNastaveniProScheduler();
  if (!nacist.ok) {
    console.error("[brana-rychly-push] nastavení se nepodařilo načíst");
    return { stav: "neposlan" };
  }

  const { dokument } = nacist;

  if (dokument.posledniUpozorneniRychle === args.datumVPraze) {
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
    console.error("[brana-rychly-push] neplatná subscription");
    return { stav: "neposlan" };
  }

  const odeslani = await odeslatBranaWebPush(
    validace.pushSubscription,
    BRANA_RYCHLE_UPOZORNENI_PAYLOAD,
    "brana-rychly-push",
  );

  if (!odeslani.uspech) {
    // 404/410 i ostatní chyby: neměnit posledniUpozorneniRychle, nemazat subscription.
    return { stav: "neposlan" };
  }

  // Push uspěl → teprve teď zápis. Selhání putu propadne volajícímu (vědomý edge case).
  await ulozitPosledniUpozorneniRychleProScheduler(args.datumVPraze);
  return { stav: "odeslan" };
}
