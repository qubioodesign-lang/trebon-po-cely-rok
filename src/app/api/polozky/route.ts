import { NextResponse } from "next/server";
import { ziskatAktivniPolozky } from "@/lib/polozky";

/** Veřejné API – seznam aktivních položek galerie */
export async function GET() {
  const polozky = ziskatAktivniPolozky();
  return NextResponse.json(polozky);
}
