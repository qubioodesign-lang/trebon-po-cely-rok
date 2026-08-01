import { NextRequest, NextResponse } from "next/server";
import {
  BRANA_MAX_DELKA_VZKAZU,
  pridatBranaVzkaz,
} from "@/lib/brana/vzkaz";
import { ziskatOidcZHlavicek } from "@/lib/env-blob";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Veřejné odeslání vzkazu BRÁNĚ – bez jména a e-mailu */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text : "";

    if (!text.trim()) {
      return NextResponse.json({ chyba: "Vzkaz je prázdný" }, { status: 400 });
    }

    if (text.trim().length > BRANA_MAX_DELKA_VZKAZU) {
      return NextResponse.json(
        {
          chyba: `Vzkaz může mít nejvýše ${BRANA_MAX_DELKA_VZKAZU} znaků`,
        },
        { status: 400 },
      );
    }

    const oidcHeader = await ziskatOidcZHlavicek();
    await pridatBranaVzkaz(text, oidcHeader);

    return NextResponse.json({ uspech: true });
  } catch (error) {
    const zprava =
      error instanceof Error ? error.message : "Chyba při odeslání vzkazu";
    return NextResponse.json({ chyba: zprava }, { status: 500 });
  }
}
