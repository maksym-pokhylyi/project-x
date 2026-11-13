import { ImageResponse } from "next/og";
import { site } from "@/config/site";

/** Default Open Graph image, generated from src/config/site.ts (no design assets needed). */
export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#ffffff",
          color: "#171717",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "#171717",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 20,
            }}
          >
            {site.name.charAt(0)}
          </div>
          {site.name}
        </div>
        <div style={{ marginTop: 40, fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 960 }}>{site.tagline}</div>
        <div style={{ marginTop: 28, fontSize: 28, color: "#525252" }}>{site.domain}</div>
      </div>
    ),
    size,
  );
}
