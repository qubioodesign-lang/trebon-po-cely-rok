import { NextResponse } from "next/server";

/** VAPID veřejný klíč pro push notifikace */
export async function GET() {
  const verejnyKlic = process.env.VAPID_VEREJNY_KLIC ?? "";
  return NextResponse.json({ verejnyKlic });
}
