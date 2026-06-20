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

function zkratiEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const token = url.pathname.split("/").pop() ?? "";
    const nahled =
      token.length > 12 ? `${token.slice(0, 8)}…${token.slice(-4)}` : token;
    return `${url.host}/…${nahled}`;
  } catch {
    return endpoint.length > 24
      ? `${endpoint.slice(0, 16)}…${endpoint.slice(-4)}`
      : endpoint;
  }
}

function extrahovatPushOdpoved(chyba: unknown): {
  statusCode: number | null;
  body: string | null;
} {
  if (!chyba || typeof chyba !== "object") {
    return {
      statusCode: null,
      body: chyba instanceof Error ? chyba.message : String(chyba),
    };
  }

  const pushChyba = chyba as { statusCode?: number; body?: string };
  const body =
    typeof pushChyba.body === "string"
      ? pushChyba.body
      : chyba instanceof Error
        ? chyba.message
        : null;

  return {
    statusCode: pushChyba.statusCode ?? null,
    body,
  };
}

/** Odešle push notifikaci všem uloženým odběratelům */
export async function odeslatPushNotifikaceVsem(
  oidcZHeaderu?: string | null
): Promise<VysledekOdeslaniPush> {
  const chybaVapid = nastavitVapid();
  if (chybaVapid) return { chyba: chybaVapid };

  const { pushOdbery } = await nacistData(oidcZHeaderu);
  if (pushOdbery.length === 0) {
    console.info("[push] odesílání přeskočeno – žádní odběratelé");
    return { zadniOdberatele: true };
  }

  console.info("[push] start odesílání", { pocetOdberu: pushOdbery.length });

  const payload = JSON.stringify({
    titulek: PUSH_TITULEK,
    text: PUSH_TEXT,
  });

  const neplatneEndpointy: string[] = [];
  let pocetOdeslano = 0;
  let pocetSelhalo = 0;

  await Promise.all(
    pushOdbery.map(async (odber, index) => {
      const endpointZkraceny = zkratiEndpoint(odber.endpoint);

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
        console.info("[push] odběr", {
          poradi: index + 1,
          endpoint: endpointZkraceny,
          vysledek: "success",
          status: 201,
          body: null,
        });
      } catch (error) {
        const { statusCode, body } = extrahovatPushOdpoved(error);
        const neplatny = jeNeplatnyOdber(error);

        if (neplatny) {
          neplatneEndpointy.push(odber.endpoint);
        } else {
          pocetSelhalo += 1;
        }

        console.error("[push] odběr", {
          poradi: index + 1,
          endpoint: endpointZkraceny,
          vysledek: "fail",
          status: statusCode,
          body,
          neplatnyOdber: neplatny,
        });
      }
    })
  );

  if (neplatneEndpointy.length > 0) {
    try {
      await upravitData((uloziste) => {
        uloziste.pushOdbery = uloziste.pushOdbery.filter(
          (odber) => !neplatneEndpointy.includes(odber.endpoint)
        );
      }, oidcZHeaderu);
      console.info("[push] odstraněny neplatné odběry", {
        pocet: neplatneEndpointy.length,
        endpointy: neplatneEndpointy.map(zkratiEndpoint),
      });
    } catch {
      // Úklid mrtvých odběrů nesmí shodit odeslání ostatním
    }
  }

  console.info("[push] souhrn odesílání", {
    celkem: pushOdbery.length,
    uspech: pocetOdeslano,
    neuspech: pocetSelhalo,
    odstranenoNeplatnych: neplatneEndpointy.length,
  });

  return { uspech: true, pocetOdeslano, pocetSelhalo };
}
