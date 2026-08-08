import "server-only";

import webpush from "web-push";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { maBranaAdminBlobKonfiguraci } from "@/lib/brana/admin/env-blob-brana-admin";
import {
  nacistUpozorneniNastaveni,
  validovatPushSubscriptionVstup,
} from "@/lib/brana/admin/upozorneni-uloziste";

/** Payload pro BRÁNA SW push listener – title/body (ne titulek/text Třeboně). */
export const BRANA_TESTOVACI_PUSH_PAYLOAD = {
  title: "BRÁNA",
  body: "Testovací upozornění funguje.",
} as const;

export type BranaTestovaciPushVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string };

function nastavitVapid(): string | null {
  const verejnyKlic = process.env.VAPID_VEREJNY_KLIC;
  const soukromyKlic = process.env.VAPID_SOUKROMY_KLIC;
  const email =
    process.env.VAPID_EMAIL ?? "mailto:admin@trebon-po-cely-rok.cz";

  if (!verejnyKlic || !soukromyKlic) {
    return "VAPID klíče nejsou nakonfigurované.";
  }

  webpush.setVapidDetails(email, verejnyKlic, soukromyKlic);
  return null;
}

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

  const chybaVapid = nastavitVapid();
  if (chybaVapid) {
    return { uspech: false, chyba: chybaVapid };
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

  const subscription = validace.pushSubscription;
  const payload = JSON.stringify(BRANA_TESTOVACI_PUSH_PAYLOAD);

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      payload,
    );
    return { uspech: true };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;

    if (statusCode === 404 || statusCode === 410) {
      return {
        uspech: false,
        chyba:
          "Subscription už není platná. Vypněte a znovu zapněte upozornění na tomto telefonu.",
      };
    }

    console.error("[brana-testovaci-push] odeslání selhalo", {
      statusCode: statusCode ?? null,
    });

    return {
      uspech: false,
      chyba: "Testovací upozornění se nepodařilo odeslat.",
    };
  }
}
