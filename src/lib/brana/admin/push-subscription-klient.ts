"use client";

import type { BranaPushSubscription } from "@/lib/brana/admin/upozorneni-uloziste";

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

function arrayBufferNaBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binarni = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binarni += String.fromCharCode(bytes[i]);
  }
  return window
    .btoa(binarni)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function podporujeBranaWebPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function jeIosZarizeni(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function jeStandalonePwa(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

/**
 * Vrátí existující BRÁNA ServiceWorkerRegistration.
 * Neregistruje nový SW – očekává registration z běžného PWA toku.
 */
async function ziskatExistujiciBranaServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service worker není v tomto prohlížeči podporován.");
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  const brana = registrations.find((registration) => {
    const skripty = [registration.active, registration.waiting, registration.installing]
      .filter((worker): worker is ServiceWorker => worker != null)
      .map((worker) => worker.scriptURL);
    return skripty.some((url) => url.includes("/brana/sw.js"));
  });

  if (!brana) {
    throw new Error(
      "Service worker BRÁNY není aktivní. Otevřete BRÁNU (nebo ji přidejte na plochu) a zkuste znovu.",
    );
  }

  return brana;
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

function serializovatSubscription(
  subscription: PushSubscription,
): BranaPushSubscription {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    const p256 = subscription.getKey("p256dh");
    const authKey = subscription.getKey("auth");
    if (!p256 || !authKey) {
      throw new Error("Push subscription neobsahuje potřebné klíče.");
    }
    return {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime,
      keys: {
        p256dh: arrayBufferNaBase64Url(p256),
        auth: arrayBufferNaBase64Url(authKey),
      },
    };
  }
  return {
    endpoint: json.endpoint,
    expirationTime:
      typeof json.expirationTime === "number" ? json.expirationTime : null,
    keys: {
      p256dh,
      auth,
    },
  };
}

/**
 * Vytvoří PushSubscription přes existující BRÁNA SW registration.
 * Neodesílá push; jen subscribe + serializace.
 */
export async function vytvoritBranaPushSubscription(): Promise<BranaPushSubscription> {
  if (!podporujeBranaWebPush()) {
    if (jeIosZarizeni() && !jeStandalonePwa()) {
      throw new Error(
        "Upozornění je nutné zapnout z BRÁNY přidané na plochu.",
      );
    }
    throw new Error("Tento prohlížeč Web Push nepodporuje.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Oprávnění k notifikacím nebylo uděleno.");
  }

  const registration = await ziskatExistujiciBranaServiceWorkerRegistration();
  const verejnyKlic = await nacistVapidVerejnyKlic();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64NaUint8Array(
      verejnyKlic,
    ) as BufferSource,
  });

  return serializovatSubscription(subscription);
}

/** Odhlásí browser subscription, pokud existuje. Chyby unsubscribe neblokují serverové vypnutí. */
export async function odhlasitBranaPushSubscriptionVProhlizeci(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return;
  }
  try {
    const registration = await ziskatExistujiciBranaServiceWorkerRegistration();
    const current = await registration.pushManager.getSubscription();
    if (current) {
      await current.unsubscribe();
    }
  } catch {
    // Browser unsubscribe je best-effort; serverový stav se vypne zvlášť.
  }
}
