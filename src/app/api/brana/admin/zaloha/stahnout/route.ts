import { NextRequest, NextResponse } from "next/server";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  jePlatnaCestaBranaZalohy,
  nacistBranaZalohuZip,
  nazevZalohyZPathname,
} from "@/lib/brana/admin/zaloha";

export const dynamic = "force-dynamic";

/** Stažení ZIP zálohy BRÁNY z PRIVATE store (pouze přihlášený admin). */
export async function GET(request: NextRequest) {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  const pathname = request.nextUrl.searchParams.get("pathname");

  if (!pathname || !jePlatnaCestaBranaZalohy(pathname)) {
    return NextResponse.json({ chyba: "Neplatná cesta zálohy" }, { status: 400 });
  }

  try {
    const zip = await nacistBranaZalohuZip(pathname);
    const nazev = `${nazevZalohyZPathname(pathname)}.zip`;
    const telo = Buffer.from(zip);

    return new NextResponse(telo, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${nazev}"`,
        "Content-Length": String(telo.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const zprava =
      error instanceof Error ? error.message : "Chyba při stahování zálohy";
    return NextResponse.json({ chyba: zprava }, { status: 500 });
  }
}
