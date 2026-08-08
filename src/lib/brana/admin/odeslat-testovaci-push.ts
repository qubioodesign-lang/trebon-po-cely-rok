import "server-only";

import { jeAdminPrihlasen } from "@/lib/autentizace";
import { maBranaAdminBlobKonfiguraci } from "@/lib/brana/admin/env-blob-brana-admin";
import { odeslatBranaWebPush } from "@/lib/brana/admin/odeslat-brana-web-push";
import {
  nacistUpozorneniNastaveni,
  validovatPushSubscriptionVstup,
} from "@/lib/brana/admin/upozorneni-uloziste";

/** Payload pro ruční test – neměnit na produkční text. */
export const BRANA_TESTOVACI_PUSH_PAYLOAD = {
  title: "BRÁNA",
  body: "Testovací upozornění funguje.",
} as const;

export type BranaTestovaciPushVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string };

/**
 * Odešle jedno ruční testovací Web Push na PRIVATE BRÁNA subscription.
 * Nemění Třeboň pushOdbery, nemění Blob při chybě 404/410.
 */
export async function odeslatBranaTestovaciPush(): Promise<BranaTestovaciPushVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    return {
      uspech: false,
      chyba: "Nastavení upozornění není dostupné.",
    };
  }

  const nacist = await nacistUpozorneniNastaveni();
  if (!nacist.ok) {
    return {
      uspech: false,
      chyba: "Nastavení upozornění se nepodařilo načíst.",
    };
  }

  const { dokument } = nacist;

  if (!dokument.upozorneniAktivni) {
    return {
      uspech: false,
      chyba: "Upozornění jsou vypnutá. Nejdřív je zapněte na tomto telefonu.",
    };
  }

  if (!dokument.pushSubscription) {
    return {
      uspech: false,
      chyba: "Chybí platná push subscription. Zapněte upozornění na tomto telefonu.",
    };
  }

  const validace = validovatPushSubscriptionVstup(dokument.pushSubscription);
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  const vysledek = await odeslatBranaWebPush(
    validace.pushSubscription,
    BRANA_TESTOVACI_PUSH_PAYLOAD,
    "brana-testovaci-push",
  );

  if (!vysledek.uspech) {
    if (vysledek.statusCode === 404 || vysledek.statusCode === 410) {
      return { uspech: false, chyba: vysledek.chyba };
    }
    return {
      uspech: false,
      chyba: "Testovací upozornění se nepodařilo odeslat.",
    };
  }

  return { uspech: true };
}
