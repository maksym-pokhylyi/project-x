"use client";

/**
 * Last-resort boundary that replaces the root layout when it fails to render.
 * The stylesheet and fonts may not be available here, so the page carries its own minimal
 * styles in the brand colours (paper, ink, deep green) and system fonts.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#FAF8F3",
          color: "#161A1D",
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <main id="main" style={{ maxWidth: 480, padding: 24 }}>
          <p style={{ margin: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, color: "#434A50" }}>Error</p>
          <h1 style={{ margin: "12px 0 0", fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 28, lineHeight: "34px", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ margin: "16px 0 0", fontSize: 18, lineHeight: "28px", color: "#434A50" }}>The page could not be shown. Please try again in a moment.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 32,
              height: 48,
              padding: "0 24px",
              border: 0,
              borderRadius: 4,
              background: "#0F5A47",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
