import { ImageResponse } from "next/og";
import { vykreslitPwaSplashIkony } from "@/lib/pwa-ikony";

/** Splash/launch screen ikona 512×512 – Třeboň po celý rok */
export function GET() {
  const velikost = 512;

  return new ImageResponse(vykreslitPwaSplashIkony(velikost), {
    width: velikost,
    height: velikost,
  });
}
