import { NextResponse } from "next/server";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { nacistUceniJsonProStazeni } from "@/lib/brana/admin/uceni-uloziste";

export const dynamic = "force-dynamic";

/** Stažení archivu Učení (pouze přihlášený admin). Jen data/brana-uceni.json. */
export async function GET() {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  try {
    const json = await nacistUceniJsonProStazeni();
    const telo = Buffer.from(json, "utf8");
    const nazev = `brana-uceni-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(telo, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nazev}"`,
        "Content-Length": String(telo.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const zprava =
      error instanceof Error ? error.message : "Chyba při stahování Učení";
    return NextResponse.json({ chyba: zprava }, { status: 500 });
  }
}
