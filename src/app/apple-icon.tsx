import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Velká ikona pro PWA (512×512) */
export default function IkonaVelka() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAF8F5",
        }}
      >
        <span
          style={{
            fontSize: 256,
            fontFamily: "Inter, sans-serif",
            fontWeight: 300,
            color: "#2F2F2F",
          }}
        >
          T
        </span>
      </div>
    ),
    { ...size }
  );
}
