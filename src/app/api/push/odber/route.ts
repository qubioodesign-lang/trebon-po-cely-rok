import { NextRequest, NextResponse } from "next/server";
import { ulozitPushOdber } from "@/lib/metriky";

/** Uloží push subscription od klienta včetně metriky povolení */
export async function POST(request: NextRequest) {
  try {
    const { subscription, navstevnikId } = await request.json();

    if (!subscription?.endpoint) {
      return NextResponse.json({ chyba: "Neplatná subscription" }, { status: 400 });
    }

    await ulozitPushOdber(
      {
        endpoint: subscription.endpoint,
        klicP256dh: subscription.keys.p256dh,
        klicAuth: subscription.keys.auth,
      },
      undefined,
      { zaznamenatPovoleni: true, navstevnikId }
    );

    return NextResponse.json({ uspech: true });
  } catch {
    return NextResponse.json({ chyba: "Chyba při ukládání subscription" }, { status: 500 });
  }
}
