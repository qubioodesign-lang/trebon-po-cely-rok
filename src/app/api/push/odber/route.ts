import { NextRequest, NextResponse } from "next/server";
import { ulozitPushOdber } from "@/lib/metriky";
import { ziskatOidcZHlavicek } from "@/lib/env-blob";

export const dynamic = "force-dynamic";

/** Uloží push subscription od klienta včetně metriky povolení */
export async function POST(request: NextRequest) {
  try {
    const { subscription, navstevnikId } = await request.json();

    if (!subscription?.endpoint) {
      return NextResponse.json({ chyba: "Neplatná subscription" }, { status: 400 });
    }

    const oidcHeader = await ziskatOidcZHlavicek();

    await ulozitPushOdber(
      {
        endpoint: subscription.endpoint,
        klicP256dh: subscription.keys.p256dh,
        klicAuth: subscription.keys.auth,
      },
      oidcHeader,
      { zaznamenatPovoleni: true, navstevnikId }
    );

    return NextResponse.json({ uspech: true });
  } catch (error) {
    const zprava =
      error instanceof Error ? error.message : "Chyba při ukládání subscription";
    return NextResponse.json({ chyba: zprava }, { status: 500 });
  }
}
