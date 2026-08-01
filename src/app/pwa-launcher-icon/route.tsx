import { ImageResponse } from "next/og";
import { vykreslitPwaIkony } from "@/lib/pwa-ikony";

/** Launcher ikona 512×512 – Třeboň po celý rok (PWA, iOS) */
export function GET() {
  const velikost = 512;

  return new ImageResponse(vykreslitPwaIkony("trebon", velikost), {
    width: velikost,
    height: velikost,
  });
}
