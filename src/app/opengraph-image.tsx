import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { MARK_24 } from "@/components/logo-paths";
import { site } from "@/config/site";

/**
 * Default Open Graph image (1200 × 630) in the brand style: paper, ink, deep green, the display
 * serif — and the product's central idea, a requirement quoted with its file and page.
 * Statically generated at build time. Fonts are the OFL-licensed static files in
 * src/assets/og-fonts (next/og cannot use the woff2 files that next/font serves).
 */
export const alt = `${site.name} — know which public contracts are worth your time`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (file: string) => readFile(join(process.cwd(), "src/assets/og-fonts", file));

const colors = {
  paper: "#FAF8F3",
  surface: "#FFFFFF",
  sunken: "#F3F0E8",
  ink: "#161A1D",
  ink2: "#434A50",
  line: "#E3DED2",
  brand: "#0F5A47",
  success: "#1D6F43",
  successTint: "#E3F3E9",
};

export default async function OpenGraphImage() {
  const [serif, sans, sansMedium, mono] = await Promise.all([
    font("SourceSerif4-SemiBold.ttf"),
    font("Inter-Regular.ttf"),
    font("Inter-Medium.ttf"),
    font("IBMPlexMono-Medium.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-between",
          padding: 72,
          background: colors.paper,
          color: colors.ink,
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill={colors.brand}>
              <path d={MARK_24} />
            </svg>
            <div style={{ marginLeft: 12, fontFamily: "Source Serif 4", fontSize: 40, fontWeight: 600, letterSpacing: -0.4 }}>{site.name}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: 1.2, textTransform: "uppercase", color: colors.brand }}>
              For UK suppliers to the public sector
            </div>
            <div style={{ marginTop: 20, fontFamily: "Source Serif 4", fontSize: 66, fontWeight: 600, lineHeight: 1.06, letterSpacing: -1.3 }}>
              Know which public contracts are worth your time.
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 24, color: colors.ink2 }}>{site.domain} · Your first cited bid check is free</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", width: 404 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              padding: 28,
              background: colors.surface,
              border: `1px solid ${colors.line}`,
              borderRadius: 16,
              boxShadow: "0 12px 32px rgba(22, 26, 29, 0.14)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0.9, textTransform: "uppercase", color: colors.ink2 }}>Pass/fail requirement</div>
              <div style={{ display: "flex", padding: "4px 12px", borderRadius: 6, background: colors.successTint, color: colors.success, fontSize: 17, fontWeight: 500 }}>
                Met
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 23, fontWeight: 500, lineHeight: 1.3 }}>Public liability insurance of at least £10m</div>
            <div
              style={{
                display: "flex",
                marginTop: 18,
                padding: "16px 18px",
                background: colors.sunken,
                borderLeft: `4px solid ${colors.brand}`,
                borderRadius: 6,
                fontFamily: "Source Serif 4",
                fontSize: 23,
                lineHeight: 1.34,
              }}
            >
              “The Supplier shall maintain Public Liability insurance of not less than £10,000,000 for any one claim.”
            </div>
            <div style={{ display: "flex", marginTop: 16, fontFamily: "IBM Plex Mono", fontSize: 16, color: colors.ink2 }}>Terms and Conditions.pdf · page 14</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Source Serif 4", data: serif, style: "normal", weight: 600 },
        { name: "Inter", data: sans, style: "normal", weight: 400 },
        { name: "Inter", data: sansMedium, style: "normal", weight: 500 },
        { name: "IBM Plex Mono", data: mono, style: "normal", weight: 500 },
      ],
    },
  );
}
