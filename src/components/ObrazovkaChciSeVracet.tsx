"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  jeIOS,
  jePWA,
  podporujePushNotifikace,
} from "@/lib/uloziste";
import { useMetriky } from "@/hooks/useMetriky";

/**
 * Obrazovka „chci se vracet“ – klidná, centrovaná, teplé pozadí.
 * Android: žádost o push notifikace.
 * iPhone: návod pro přidání na plochu.
 */
export function ObrazovkaChciSeVracet() {
  const router = useRouter();
  const { odeslat } = useMetriky();
  const [zobrazitNavodIOS, setZobrazitNavodIOS] = useState(false);
  const [nacita, setNacita] = useState(false);

  const prejitNaDekujeme = () => {
    router.push("/dekujeme");
  };

  const handlePovolitUpozorneni = async () => {
    setNacita(true);

    // iPhone bez PWA – zobrazit návod
    if (jeIOS() && !jePWA()) {
      setZobrazitNavodIOS(true);
      setNacita(false);
      return;
    }

    // Android / PWA – standardní push notifikace
    if (podporujePushNotifikace()) {
      try {
        const permission = await Notification.requestPermission();

        if (permission === "granted") {
          const registrace = await navigator.serviceWorker.ready;
          const response = await fetch("/api/push/klic");
          const { verejnyKlic } = await response.json();

          if (verejnyKlic) {
            const subscription = await registrace.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(verejnyKlic),
            });

            await fetch("/api/push/odber", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscription: subscription.toJSON(),
                navstevnikId: localStorage.getItem("trebon_navstevnik_id"),
              }),
            });
          } else {
            odeslat("povoleno_upozorneni");
          }

          prejitNaDekujeme();
          return;
        }
      } catch {
        // Pokračovat i při chybě
      }
    }

    if (jeIOS()) {
      setZobrazitNavodIOS(true);
    }

    setNacita(false);
  };

  const handleHotovoIOS = () => {
    odeslat("povoleno_upozorneni");
    prejitNaDekujeme();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-krem px-8 py-16">
      <div className="max-w-sm space-y-8 text-center">
        <div className="space-y-6 text-sm font-light leading-relaxed tracking-wide text-text-jemny">
          <p className="text-pretty">
            Třeboň po celý rok je pro všechny, kterým se po Třeboni občas
            zasteskne.
          </p>
          <p>
            Pro chvíle mezi návštěvami.
            <br />
            Pro návraty ve vzpomínkách.
            <br />
            Pro místa, na která se člověk rád vrací.
          </p>
          <p>
            Jen malé kousky Třeboně
            <br />
            během celého roku.
          </p>
        </div>

        {!zobrazitNavodIOS ? (
          <>
            <p className="text-pretty text-sm font-light text-text-jemny">
              Chcete vědět, kdy přibude další malý kousek Třeboně?
            </p>
            <button
              type="button"
              onClick={handlePovolitUpozorneni}
              disabled={nacita}
              className="tlacitko-klidne"
            >
              {nacita ? "…" : "Povolit upozornění"}
            </button>
          </>
        ) : (
          <div className="space-y-6">
            <p className="text-sm font-light leading-relaxed text-text-jemny">
              Pro upozornění přidejte web na plochu:
            </p>
            <ol className="space-y-3 text-left text-sm font-light text-text-jemny">
              <li>1. Klepněte na ikonu sdílení</li>
              <li>2. Zvolte &bdquo;Přidat na plochu&ldquo;</li>
              <li>3. Potvrďte přidání</li>
            </ol>
            <button
              type="button"
              onClick={handleHotovoIOS}
              className="tlacitko-klidne"
            >
              Hotovo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Převod VAPID klíče z base64 na Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
