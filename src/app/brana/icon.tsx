import { ImageResponse } from "next/og";
import { vykreslitPwaIkony } from "@/lib/pwa-ikony";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

/** Favicon 192×192 – stejná kompozice jako /brana/apple-icon, proporcionálně zmenšená */
export default function IkonaBrana() {
  return new ImageResponse(vykreslitPwaIkony("brana", size.width), {
    ...size,
  });
}
