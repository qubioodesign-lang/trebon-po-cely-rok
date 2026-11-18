import { NextResponse } from "next/server";
import { pricistVztah } from "@/lib/brana/vztah-uloziste";

export const dynamic = "force-dynamic";

/** Jedno přičtení společného počítadla. Bez údajů o návštěvníkovi. */
export async function POST() {
  const vysledek = await pricistVztah();
  if (!vysledek.ok) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true, pocet: vysledek.pocet });
}
