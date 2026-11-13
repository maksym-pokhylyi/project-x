import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { MARK, MARK_VIEWBOX } from "@/components/logo-paths";
import { site } from "@/config/site";

/**
 * Default Open Graph image (1200 × 630), built to the designer's social artboard
 * (docs/design/handoff/Social-1200x630.dc.html): lockup, tagline and promise on paper,
 * the mark in white on a brand-green panel.
 * Statically generated at build time. Fonts are the OFL-licensed static files in
 * src/assets/og-fonts (next/og cannot use the woff2 files that next/font serves).
 */
export const alt = `${site.name}: the bid desk for small suppliers`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (file: string) => readFile(join(process.cwd(), "src/assets/og-fonts", file));

const colors = { paper: "#FAF8F3", ink: "#161A1D", brand: "#0F5A47", white: "#FFFFFF" };

export default async function OpenGraphImage() {
  const [serif, sans, mono] = await Promise.all([font("SourceSerif4-SemiBold.ttf"), font("Inter-Regular.ttf"), font("IBMPlexMono-Medium.ttf")]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: colors.paper, color: colors.ink, fontFamily: "Inter" }}>
        <div style={{ width: 770, display: "flex", flexDirection: "column", padding: "60px 40px 54px 72px" }}>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            {/* The mark stands on the baseline of the word (8 px above the bottom of its 52 px line). */}
            <svg width="36" height="48" viewBox={MARK_VIEWBOX} fill={colors.brand} style={{ marginBottom: 8 }}>
              <path d={MARK} />
            </svg>
            <div style={{ marginLeft: 13, fontFamily: "Source Serif 4", fontSize: 52, fontWeight: 600, lineHeight: 1, letterSpacing: -0.78 }}>{site.name}</div>
          </div>
          <div style={{ marginTop: 78, fontFamily: "Source Serif 4", fontSize: 78, fontWeight: 600, lineHeight: 1.02, letterSpacing: -1.56 }}>
            The bid desk for small suppliers.
          </div>
          <div style={{ marginTop: 26, maxWidth: 620, fontSize: 27, lineHeight: 1.36 }}>
            Know which public contracts are worth your time, and get a compliant first draft in hours, not days.
          </div>
          <div style={{ marginTop: "auto", fontFamily: "IBM Plex Mono", fontSize: 22, fontWeight: 500, color: colors.brand }}>{site.domain}</div>
        </div>
        <div style={{ width: 430, display: "flex", alignItems: "center", justifyContent: "center", background: colors.brand }}>
          <svg width="258" height="344" viewBox={MARK_VIEWBOX} fill={colors.white}>
            <path d={MARK} />
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Source Serif 4", data: serif, style: "normal", weight: 600 },
        { name: "Inter", data: sans, style: "normal", weight: 400 },
        { name: "IBM Plex Mono", data: mono, style: "normal", weight: 500 },
      ],
    },
  );
}
