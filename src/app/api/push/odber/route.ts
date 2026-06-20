import { NextRequest, NextResponse } from "next/server";
import { ulozitPushOdber } from "@/lib/metriky";
import { ziskatOidcZHlavicek, maBlobAutentizaci } from "@/lib/env-blob";

export const dynamic = "force-dynamic";

function normalizovatChybuPush(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Push odběr se nepodařilo uložit – neznámá chyba serveru.";
  }

  const zprava = error.message;

  if (zprava.includes("Push odběr se nepodařilo uložit")) {
    return zprava;
  }

  if (zprava.includes("chybí autentizace") || zprava.includes("BLOB_READ_WRITE_TOKEN")) {
    return "Push odběr se nepodařilo uložit – chybí autentizace k Blob úložišti.";
  }

  if (zprava.includes("Metadata Blob") || zprava.includes("Blob úložiště")) {
    return `Push odběr se nepodařilo uložit – ${zprava}`;
  }

  if (zprava.includes("Nepodařilo se uložit data")) {
    return "Push odběr se nepodařilo uložit – kolize při zápisu do úložiště. Zkuste registraci znovu.";
  }

  return zprava;
}

/** Uloží push subscription od klienta; metrika povolení je best-effort */
export async function POST(request: NextRequest) {
  try {
    const { subscription, navstevnikId, zaznamenatPovoleni = true } =
      await request.json();

    if (!subscription?.endpoint) {
      return NextResponse.json(
        { chyba: "Neplatná subscription – chybí endpoint." },
        { status: 400 }
      );
    }

    const klicP256dh = subscription.keys?.p256dh;
    const klicAuth = subscription.keys?.auth;

    if (!klicP256dh || !klicAuth) {
      return NextResponse.json(
        { chyba: "Neplatná subscription – chybí šifrovací klíče (p256dh/auth)." },
        { status: 400 }
      );
    }

    const oidcHeader = await ziskatOidcZHlavicek();

    if (!maBlobAutentizaci(oidcHeader)) {
      return NextResponse.json(
        {
          chyba:
            "Push odběr se nepodařilo uložit – server nemá autentizaci k Blob úložišti.",
        },
        { status: 503 }
      );
    }

    await ulozitPushOdber(
      {
        endpoint: subscription.endpoint,
        klicP256dh,
        klicAuth,
      },
      oidcHeader,
      {
        zaznamenatPovoleni: zaznamenatPovoleni !== false,
        navstevnikId,
      }
    );

    return NextResponse.json({ uspech: true });
  } catch (error) {
    return NextResponse.json(
      { chyba: normalizovatChybuPush(error) },
      { status: 500 }
    );
  }
}
