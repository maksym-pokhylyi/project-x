import type { Metadata } from "next";
import { SystemPage } from "@/components/system-page";

export const metadata: Metadata = { title: "This page is not here", robots: { index: false } };

/** 404, as in the NotFound artboards: say what may have happened and offer the company search. */
export default function NotFound() {
  return (
    <SystemPage
      code="404"
      title="This page is not here"
      search
      links={[
        { label: "Go to the home page", href: "/" },
        { label: "See a sample check", href: "/sample-check" },
      ]}
    >
      <p>The link may be old, or the page may have been hidden at a company’s request.</p>
    </SystemPage>
  );
}
