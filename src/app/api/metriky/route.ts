import { NextRequest, NextResponse } from "next/server";
import { zaznamenatMetrikyBatch } from "@/lib/metriky";
import { ziskatOidcZHlavicek } from "@/lib/env-blob";
import type { PayloadMetriky, PayloadMetrikyBatch, TypUdalostiMetriky } from "@/types";

export const dynamic = "force-dynamic";

const POVOLENE_TYPY: TypUdalostiMetriky[] = [
  "navsteva",
  "zobrazeni_fotografie",
  "posun_vpred",
  "navrat_zpet",
  "klik_chci_se_vracet",
  "povoleno_upozorneni",
];

function jePlatnaUdalost(payload: PayloadMetriky): boolean {
  return POVOLENE_TYPY.includes(payload.typ);
}

function normalizovatTeloo(body: PayloadMetriky | PayloadMetrikyBatch): PayloadMetriky[] {
  if ("udalosti" in body && Array.isArray(body.udalosti)) {
    return body.udalosti;
  }

  if ("typ" in body && typeof body.typ === "string") {
    return [body as PayloadMetriky];
  }

  return [];
}

/** API pro záznam metrik – podporuje jednotlivou událost i dávku */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PayloadMetriky | PayloadMetrikyBatch;
    const udalosti = normalizovatTeloo(body);

    if (udalosti.length === 0) {
      return NextResponse.json({ chyba: "Neplatný payload metrik" }, { status: 400 });
    }

    if (!udalosti.every(jePlatnaUdalost)) {
      return NextResponse.json({ chyba: "Neplatný typ události" }, { status: 400 });
    }

    const oidcHeader = await ziskatOidcZHlavicek();
    await zaznamenatMetrikyBatch(udalosti, oidcHeader);
    return NextResponse.json({ uspech: true });
  } catch (error) {
    const zprava =
      error instanceof Error ? error.message : "Chyba při záznamu metriky";
    return NextResponse.json({ chyba: zprava }, { status: 500 });
  }
}
