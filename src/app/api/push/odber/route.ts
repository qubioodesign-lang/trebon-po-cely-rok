import { NextRequest, NextResponse } from "next/server";
import { ulozitPushOdber, zaznamenatMetriku } from "@/lib/metriky";

/** Uloží push subscription od klienta */
export async function POST(request: NextRequest) {
  try {
    const { subscription, navstevnikId } = await request.json();

    if (!subscription?.endpoint) {
      return NextResponse.json({ chyba: "Neplatná subscription" }, { status: 400 });
    }

    ulozitPushOdber({
      endpoint: subscription.endpoint,
      klicP256dh: subscription.keys.p256dh,
      klicAuth: subscription.keys.auth,
    });

    zaznamenatMetriku({
      typ: "povoleno_upozorneni",
      navstevnikId,
    });

    return NextResponse.json({ uspech: true });
  } catch {
    return NextResponse.json({ chyba: "Chyba při ukládání subscription" }, { status: 500 });
  }
}
