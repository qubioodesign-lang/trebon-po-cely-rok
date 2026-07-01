import { NextRequest, NextResponse } from "next/server";
import { ziskatOidcZHlavicek } from "@/lib/env-blob";
import { MAX_DELKA_VZKAZU, pridatVzkaz } from "@/lib/vzkaz-treboni";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Veřejné odeslání vzkazu Třeboni – bez jména a e-mailu */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text : "";

    if (!text.trim()) {
      return NextResponse.json({ chyba: "Vzkaz je prázdný" }, { status: 400 });
    }

    if (text.trim().length > MAX_DELKA_VZKAZU) {
      return NextResponse.json(
        { chyba: `Vzkaz může mít nejvýše ${MAX_DELKA_VZKAZU} znaků` },
        { status: 400 }
      );
    }

    const oidcHeader = await ziskatOidcZHlavicek();
    await pridatVzkaz(text, oidcHeader);

    return NextResponse.json({ uspech: true });
  } catch (error) {
    const zprava =
      error instanceof Error ? error.message : "Chyba při odeslání vzkazu";
    return NextResponse.json({ chyba: zprava }, { status: 500 });
  }
}
