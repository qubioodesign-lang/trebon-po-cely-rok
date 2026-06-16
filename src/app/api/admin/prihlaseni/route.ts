import { NextRequest, NextResponse } from "next/server";
import {
  overitHeslo,
  vytvoritSessionToken,
  nastavitSessionCookie,
  smazatSessionCookie,
  jeAdminPrihlasen,
} from "@/lib/autentizace";

/** Přihlášení administrátora */
export async function POST(request: NextRequest) {
  const { heslo } = await request.json();

  if (!overitHeslo(heslo)) {
    return NextResponse.json({ chyba: "Neplatné heslo" }, { status: 401 });
  }

  const token = await vytvoritSessionToken();
  await nastavitSessionCookie(token);

  return NextResponse.json({ uspech: true });
}

/** Odhlášení administrátora */
export async function DELETE() {
  await smazatSessionCookie();
  return NextResponse.json({ uspech: true });
}

/** Kontrola přihlášení */
export async function GET() {
  const prihlasen = await jeAdminPrihlasen();
  return NextResponse.json({ prihlasen });
}
