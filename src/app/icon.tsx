import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

/**
 * Ikona aplikace – písmeno T na krémovém pozadí.
 * Bez stínů, rámečků a efektů.
 */
export default function Ikona() {
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
            fontSize: 96,
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
