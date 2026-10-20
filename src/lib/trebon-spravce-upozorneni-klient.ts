"use client";

import {
  TREBON_SPRAVCE_SW_CESTA,
  TREBON_SPRAVCE_SW_SCOPE,
  type TrebonSpravcePushSubscription,
} from "@/lib/trebon-spravce-upozorneni";

function urlBase64NaUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const vystup = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    vystup[i] = raw.charCodeAt(i);
  }
  return vystup;
}

async function nacistVapidVerejnyKlic(): Promise<string> {
  const odpoved = await fetch("/api/push/klic", { method: "GET" });
  if (!odpoved.ok) {
    throw new Error("Veřejný VAPID klíč se nepodařilo načíst.");
  }
  const data = (await odpoved.json()) as { verejnyKlic?: unknown };
  if (typeof data.verejnyKlic !== "string" || !data.verejnyKlic.trim()) {
    throw new Error("Veřejný VAPID klíč není nakonfigurovaný.");
  }
  return data.verejnyKlic.trim();
}

/** Jen správcovský worker se scope /admin/. Galerijní /sw.js neregistruje. */
export async function prihlasitTrebonSpravcePush(): Promise<TrebonSpravcePushSubscription> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("Tento prohlížeč Web Push nepodporuje.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Oprávnění k notifikacím nebylo uděleno.");
  }

  const registration = await navigator.serviceWorker.register(
    TREBON_SPRAVCE_SW_CESTA,
    { scope: TREBON_SPRAVCE_SW_SCOPE },
  );
  const verejnyKlic = await nacistVapidVerejnyKlic();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64NaUint8Array(verejnyKlic) as BufferSource,
  });
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("Push subscription neobsahuje potřebné klíče.");
  }
  return {
    endpoint: json.endpoint,
    expirationTime: subscription.expirationTime,
    keys: { p256dh, auth },
  };
}

export async function odhlasitTrebonSpravcePushVProhlizeci(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration(
      TREBON_SPRAVCE_SW_SCOPE,
    );
    const current = await registration?.pushManager.getSubscription();
    if (current) {
      await current.unsubscribe();
    }
  } catch {
    // Vypnutí na serveru platí i když prohlížeč odběr nesmaže.
  }
}
