import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Cta = { label: string; href: string };

/** Closing call to action on a brand-coloured band. `.on-brand` switches focus ring and selection to white. */
export function CtaBand({ id, title, lead, primary, secondary, footnote }: { id: string; title: string; lead: ReactNode; primary: Cta; secondary?: Cta; footnote?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="on-brand bg-brand text-paper">
      <div className="container-content grid gap-8 py-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16 lg:py-20">
        <div className="max-w-2xl">
          <h2 id={id} className="type-h2 text-paper lg:text-3xl">
            {title}
          </h2>
          <p className="mt-4 text-lg leading-7 text-brand-on-dark">{lead}</p>
        </div>
        <div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="inverse">
              <Link href={primary.href}>
                {primary.label} <ArrowRight aria-hidden />
              </Link>
            </Button>
            {secondary ? (
              <Button asChild size="lg" variant="inverse-outline">
                <Link href={secondary.href}>{secondary.label}</Link>
              </Button>
            ) : null}
          </div>
          {footnote ? <p className="mt-3 text-13 text-brand-on-dark">{footnote}</p> : null}
        </div>
      </div>
    </section>
  );
}
