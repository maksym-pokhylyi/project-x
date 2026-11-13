import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { site } from "@/config/site";

/** Shared shell for all transactional e-mails. Inline styles only (e-mail clients). */
export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f5f5f4", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 8, maxWidth: 520, padding: "32px 32px 24px" }}>
          <Text style={{ fontSize: 16, fontWeight: 700, color: "#1c1917", margin: "0 0 24px" }}>{site.name}</Text>
          <Section>{children}</Section>
          <Hr style={{ borderColor: "#e7e5e4", margin: "28px 0 16px" }} />
          <Text style={{ fontSize: 12, color: "#78716c", margin: 0, lineHeight: "18px" }}>
            {site.name} · {site.domain}
            <br />
            Questions? Reply to this e-mail or write to {site.supportEmail}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  heading: { fontSize: 20, fontWeight: 700, color: "#1c1917", margin: "0 0 12px" },
  paragraph: { fontSize: 14, color: "#44403c", lineHeight: "22px", margin: "0 0 16px" },
  button: {
    backgroundColor: "#1c1917",
    borderRadius: 6,
    color: "#ffffff",
    display: "inline-block",
    fontSize: 14,
    fontWeight: 600,
    padding: "10px 18px",
    textDecoration: "none",
  },
  muted: { fontSize: 12, color: "#78716c", lineHeight: "18px", margin: "16px 0 0", wordBreak: "break-all" as const },
} as const;
