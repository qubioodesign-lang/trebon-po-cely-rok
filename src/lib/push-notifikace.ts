import "server-only";

import webpush from "web-push";
import { nacistData, upravitData } from "./uloziste-dat";

export const PUSH_TITULEK = "Třeboň po celý rok";
export const PUSH_TEXT = "Na chvíli zpátky do Třeboně.";

export type VysledekOdeslaniPush =
  | { uspech: true; pocetOdeslano: number; pocetSelhalo: number }
  | { zadniOdberatele: true }
  | { chyba: string };

function nastavitVapid(): string | null {
  const verejnyKlic = process.env.VAPID_VEREJNY_KLIC;
  const soukromyKlic = process.env.VAPID_SOUKROMY_KLIC;
  const email =
    process.env.VAPID_EMAIL ?? "mailto:admin@trebon-po-cely-rok.cz";

  if (!verejnyKlic || !soukromyKlic) {
    return "VAPID klíče nejsou nakonfigurované – nastavte VAPID_VEREJNY_KLIC a VAPID_SOUKROMY_KLIC";
  }

  webpush.setVapidDetails(email, verejnyKlic, soukromyKlic);
  return null;
}

function jeNeplatnyOdber(chyba: unknown): boolean {
  if (!chyba || typeof chyba !== "object") return false;
  const statusCode = (chyba as { statusCode?: number }).statusCode;
  return statusCode === 404 || statusCode === 410;
}

/** Odešle push notifikaci všem uloženým odběratelům */
export async function odeslatPushNotifikaceVsem(
  oidcZHeaderu?: string | null
): Promise<VysledekOdeslaniPush> {
  const chybaVapid = nastavitVapid();
  if (chybaVapid) return { chyba: chybaVapid };

  const { pushOdbery } = await nacistData(oidcZHeaderu);
  if (pushOdbery.length === 0) {
    return { zadniOdberatele: true };
  }

  const payload = JSON.stringify({
    titulek: PUSH_TITULEK,
    text: PUSH_TEXT,
  });

  const neplatneEndpointy: string[] = [];
  let pocetOdeslano = 0;
  let pocetSelhalo = 0;

  await Promise.all(
    pushOdbery.map(async (odber) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: odber.endpoint,
            keys: {
              p256dh: odber.klicP256dh,
              auth: odber.klicAuth,
            },
          },
          payload
        );
        pocetOdeslano += 1;
      } catch (error) {
        if (jeNeplatnyOdber(error)) {
          neplatneEndpointy.push(odber.endpoint);
          return;
        }
        pocetSelhalo += 1;
      }
    })
  );

  if (neplatneEndpointy.length > 0) {
    await upravitData((uloziste) => {
      uloziste.pushOdbery = uloziste.pushOdbery.filter(
        (odber) => !neplatneEndpointy.includes(odber.endpoint)
      );
    }, oidcZHeaderu);
  }

  return { uspech: true, pocetOdeslano, pocetSelhalo };
}
