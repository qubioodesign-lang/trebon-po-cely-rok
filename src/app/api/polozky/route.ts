import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { ziskatAktivniPolozky } from "@/lib/polozky";

export const dynamic = "force-dynamic";

/** Veřejné API – seznam aktivních položek galerie */
export async function GET() {
  const hlavicky = await headers();
  const oidcHeader = hlavicky.get("x-vercel-oidc-token");
  const polozky = await ziskatAktivniPolozky(oidcHeader);
  return NextResponse.json(polozky);
}
