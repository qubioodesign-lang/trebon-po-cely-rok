import { ImageResponse } from "next/og";
import { vykreslitPwaIkony } from "@/lib/pwa-ikony";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

/** Favicon a PWA ikona 192×192 – BRÁNA */
export default function IkonaBrana() {
  return new ImageResponse(vykreslitPwaIkony("brana", size.width), {
    ...size,
  });
}
