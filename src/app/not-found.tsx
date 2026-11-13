import type { Metadata } from "next";
import Link from "next/link";
import { SystemPage } from "@/components/system-page";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <SystemPage
      code="404"
      title="Page not found"
      actions={
        <>
          <Button asChild size="lg">
            <Link href="/">Back to the homepage</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/find">Find your company</Link>
          </Button>
        </>
      }
    >
      <p>The page you are looking for does not exist or has moved. If you followed a link in an email from us, the page may have been removed at the company’s request.</p>
    </SystemPage>
  );
}
