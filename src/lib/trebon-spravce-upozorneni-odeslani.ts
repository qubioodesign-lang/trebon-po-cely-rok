import "server-only";

import webpush from "web-push";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { nacistTrebonSpravceUpozorneni } from "@/lib/trebon-spravce-upozorneni-uloziste";
import {
  odeslatTrebonSpravceUpozorneniS,
  odeslatTrebonTestovaciUpozorneniS,
  type TrebonSpravcePushSubscription,
  type TrebonTestovaciPushVysledek,
} from "@/lib/trebon-spravce-upozorneni";

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

async function odeslatNaSubscription(
  subscription: TrebonSpravcePushSubscription,
  payload: { title: string; body: string },
): Promise<{ uspech: boolean }> {
  const chybaVapid = nastavitVapid();
  if (chybaVapid) {
    console.error("[trebon-vzkaz-push]", chybaVapid);
    return { uspech: false };
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
      JSON.stringify({ title: payload.title, body: payload.body }),
    );
    return { uspech: true };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;
    console.error("[trebon-vzkaz-push] odeslání selhalo", {
      statusCode: statusCode ?? null,
    });
    return { uspech: false };
  }
}

/** Po úspěšně uloženém vzkazu. Nemění návštěvnické odběry ani BRÁNU. */
export async function odeslatTrebonSpravceUpozorneniNaVzkaz(): Promise<void> {
  await odeslatTrebonSpravceUpozorneniS({
    nacist: nacistTrebonSpravceUpozorneni,
    odeslat: odeslatNaSubscription,
  });
}

async function odeslatTestNaSubscription(
  subscription: TrebonSpravcePushSubscription,
  payload: { title: string; body: string },
): Promise<{ uspech: boolean; statusCode?: number }> {
  const chybaVapid = nastavitVapid();
  if (chybaVapid) {
    console.error("[trebon-testovaci-push]", chybaVapid);
    return { uspech: false };
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
      JSON.stringify({ title: payload.title, body: payload.body }),
    );
    return { uspech: true };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;
    console.error("[trebon-testovaci-push] odeslání selhalo", {
      statusCode: statusCode ?? null,
    });
    return { uspech: false, statusCode };
  }
}

/** Jeden ruční test. Nevytváří vzkaz a uloženou subscription nemaže. */
export async function odeslatTrebonTestovaciUpozorneni(): Promise<TrebonTestovaciPushVysledek> {
  return odeslatTrebonTestovaciUpozorneniS({
    prihlasen: await jeAdminPrihlasen(),
    nacist: nacistTrebonSpravceUpozorneni,
    odeslat: odeslatTestNaSubscription,
  });
}
