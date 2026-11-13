import { ImageResponse } from "next/og";
import { MARK_24 } from "@/components/logo-paths";

/** Apple touch icon (180 × 180): the mark in paper on the brand green. iOS rounds the corners itself. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F5A47" }}>
        <svg width="116" height="116" viewBox="0 0 24 24" fill="#FAF8F3">
          <path d={MARK_24} />
        </svg>
      </div>
    ),
    size,
  );
}
