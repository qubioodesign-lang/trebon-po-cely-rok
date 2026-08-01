import { ImageResponse } from "next/og";
import { vykreslitPwaIkony } from "@/lib/pwa-ikony";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Launcher ikona 512×512 – BRÁNA */
export default function IkonaVelkaBrana() {
  return new ImageResponse(vykreslitPwaIkony("brana", size.width), {
    ...size,
  });
}
