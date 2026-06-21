import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { nacistZalohuZip } from "@/lib/zaloha";
import { jePlatnaCestaZalohy, nazevZalohyZPathname } from "@/lib/zaloha/pomocne";

export const dynamic = "force-dynamic";

async function ziskatOidcZHeaderu(): Promise<string | null> {
  const hlavicky = await headers();
  return hlavicky.get("x-vercel-oidc-token");
}

/** Stažení ZIP zálohy (pouze pro přihlášeného admina) */
export async function GET(request: NextRequest) {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  const pathname = request.nextUrl.searchParams.get("pathname");

  if (!pathname || !jePlatnaCestaZalohy(pathname)) {
    return NextResponse.json({ chyba: "Neplatná cesta zálohy" }, { status: 400 });
  }

  const oidcHeader = await ziskatOidcZHeaderu();

  try {
    const zip = await nacistZalohuZip(pathname, oidcHeader);
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
