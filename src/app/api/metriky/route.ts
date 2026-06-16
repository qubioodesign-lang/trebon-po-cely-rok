import { NextRequest, NextResponse } from "next/server";
import { zaznamenatMetriku } from "@/lib/metriky";
import type { PayloadMetriky } from "@/types";

/** API pro záznam metrik – návštěvy, posuny, návraty */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as PayloadMetriky;

    const povoleneTypy = [
      "navsteva",
      "zobrazeni_fotografie",
      "posun_vpred",
      "navrat_zpet",
      "klik_chci_se_vracet",
      "povoleno_upozorneni",
    ];

    if (!povoleneTypy.includes(payload.typ)) {
      return NextResponse.json({ chyba: "Neplatný typ události" }, { status: 400 });
    }

    zaznamenatMetriku(payload);
    return NextResponse.json({ uspech: true });
  } catch {
    return NextResponse.json({ chyba: "Chyba při záznamu metriky" }, { status: 500 });
  }
}
