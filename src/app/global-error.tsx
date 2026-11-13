"use client";

/** Last-resort boundary that replaces the root layout when it fails to render. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
          <p style={{ color: "#555" }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 6, border: "1px solid #ccc", cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
