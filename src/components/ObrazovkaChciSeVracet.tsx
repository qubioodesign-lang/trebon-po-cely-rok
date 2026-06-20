"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  jeIOS,
  jePWA,
  maUlozeneUpozorneniAktivni,
  podporujePushNotifikace,
  ulozitUpozorneniAktivni,
  vymazatUpozorneniAktivni,
  ziskatNavstevnikId,
} from "@/lib/uloziste";
import { ziskatNeboRegistrovatServiceWorker } from "@/lib/service-worker";
import { useMetriky } from "@/hooks/useMetriky";

/**
 * Obrazovka „chci se vracet“ – klidná, centrovaná, teplé pozadí.
 * Android: okamžitá systémová žádost o push, pak Děkujeme.
 * iPhone bez PWA: krátký návod, pak Děkujeme.
 */
export function ObrazovkaChciSeVracet() {
  const router = useRouter();
  const { odeslat } = useMetriky();
  const [zobrazitNavodIOS, setZobrazitNavodIOS] = useState(false);
  const [nacita, setNacita] = useState(false);
  const [jeUpozorneniAktivni, setJeUpozorneniAktivni] = useState(false);
  const [chybaRegistrace, setChybaRegistrace] = useState("");

  useEffect(() => {
    void overitAktivniPush().then(setJeUpozorneniAktivni);
  }, []);

  const prejitNaDekujeme = () => {
    router.replace("/dekujeme");
  };

  const handleDostavatUpozorneni = async () => {
    setNacita(true);
    setChybaRegistrace("");

    if (podporujePushNotifikace()) {
      try {
        const permission = await Notification.requestPermission();

        if (permission === "granted") {
          try {
            await zaregistrovatPush();
            ulozitUpozorneniAktivni();
            setJeUpozorneniAktivni(true);
            prejitNaDekujeme();
          } catch (error) {
            const zprava =
              error instanceof Error
                ? error.message
                : "Nepodařilo se uložit push odběr na server";
            setChybaRegistrace(zprava);
            await odeslatMetrikuOkamzite("povoleno_upozorneni");
          } finally {
            setNacita(false);
          }
          return;
        }

        if (permission === "denied") {
          setChybaRegistrace(
            "Upozornění jsou v prohlížeči zablokovaná. Povolte je v nastavení stránky."
          );
          setNacita(false);
          return;
        }
      } catch {
        // Pokračovat – na iPhonu zobrazíme návod
      }
    }

    if (jeIOS() && !jePWA()) {
      setZobrazitNavodIOS(true);
      setNacita(false);
      return;
    }

    setNacita(false);
  };

  const handleHotovoIOS = async () => {
    setNacita(true);
    await odeslatMetrikuOkamzite("povoleno_upozorneni");
    odeslat("povoleno_upozorneni");
    ulozitUpozorneniAktivni();
    setJeUpozorneniAktivni(true);
    setNacita(false);
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
            <p className="text-pretty px-2 py-8 text-[1.125rem] font-light leading-relaxed tracking-wide text-text/80">
              Chcete vědět, kdy přibude další malý kousek Třeboně?
            </p>
            {jeUpozorneniAktivni ? (
              <p className="text-xs font-light tracking-wide text-text-velmiJemny">
                upozornění aktivní
              </p>
            ) : (
              <button
                type="button"
                onClick={handleDostavatUpozorneni}
                disabled={nacita}
                className="tlacitko-klidne !px-6 !py-2.5 !text-xs"
              >
                {nacita ? "…" : "Dostávat upozornění"}
              </button>
            )}
            {chybaRegistrace && (
              <p className="text-xs font-light leading-relaxed text-red-500/90">
                {chybaRegistrace}
              </p>
            )}
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
              disabled={nacita}
              className="tlacitko-klidne !px-6 !py-2.5 !text-xs"
            >
              {nacita ? "…" : "Hotovo"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Ověří skutečnou push subscription; zruší zastaralý localStorage příznak */
async function overitAktivniPush(): Promise<boolean> {
  if (!podporujePushNotifikace()) {
    return maUlozeneUpozorneniAktivni();
  }

  try {
    const registrace = await ziskatNeboRegistrovatServiceWorker();
    const subscription = await registrace.pushManager.getSubscription();
    if (subscription) {
      return true;
    }
  } catch {
    // SW nedostupný – spadni na localStorage
    return maUlozeneUpozorneniAktivni();
  }

  if (maUlozeneUpozorneniAktivni()) {
    vymazatUpozorneniAktivni();
  }

  return false;
}

/** Zaregistruje push odběr a uloží ho na server */
async function zaregistrovatPush(): Promise<void> {
  const registrace = await ziskatNeboRegistrovatServiceWorker();

  const klicResponse = await fetch("/api/push/klic");
  if (!klicResponse.ok) {
    throw new Error("Nepodařilo se načíst VAPID klíč pro push");
  }

  const { verejnyKlic } = (await klicResponse.json()) as {
    verejnyKlic?: string;
  };

  if (!verejnyKlic) {
    throw new Error("VAPID klíč není na serveru nakonfigurovaný");
  }

  let subscription = await registrace.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registrace.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(verejnyKlic),
    });
  }

  const odberResponse = await fetch("/api/push/odber", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      navstevnikId: ziskatNavstevnikId(),
    }),
  });

  if (!odberResponse.ok) {
    const telo = (await odberResponse.json().catch(() => ({}))) as {
      chyba?: string;
    };
    throw new Error(
      telo.chyba ?? `Server odmítl uložení push odběru (HTTP ${odberResponse.status})`
    );
  }
}

async function odeslatMetrikuOkamzite(
  typ: "povoleno_upozorneni"
): Promise<void> {
  try {
    await fetch("/api/metriky", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        udalosti: [{ typ, navstevnikId: ziskatNavstevnikId() }],
      }),
    });
  } catch {
    // Metriky nesmí blokovat UI
  }
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
