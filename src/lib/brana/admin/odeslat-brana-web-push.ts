import "server-only";

import webpush from "web-push";
import type { BranaPushSubscription } from "@/lib/brana/admin/upozorneni-uloziste";

/** Payload shape pro BRÁNA SW push listener (title/body). */
export type BranaWebPushPayload = {
  title: string;
  body: string;
};

export type BranaWebPushVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string; statusCode?: number };

/**
 * Nastaví VAPID z existujících server env.
 * Private key zůstává pouze server-side.
 */
export function nastavitBranaVapid(): string | null {
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
 * Odešle jedno Web Push na danou BRÁNA PRIVATE subscription.
 * Nemění Blob. Nemění Třeboň pushOdbery. Bez retry.
 */
export async function odeslatBranaWebPush(
  subscription: BranaPushSubscription,
  payload: BranaWebPushPayload,
  logPrefix: string,
): Promise<BranaWebPushVysledek> {
  const chybaVapid = nastavitBranaVapid();
  if (chybaVapid) {
    return { uspech: false, chyba: chybaVapid };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
      }),
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
        statusCode,
      };
    }

    console.error(`[${logPrefix}] odeslání selhalo`, {
      statusCode: statusCode ?? null,
    });

    return {
      uspech: false,
      chyba: "Upozornění se nepodařilo odeslat.",
      statusCode,
    };
  }
}
