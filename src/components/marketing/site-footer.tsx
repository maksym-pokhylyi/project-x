import Link from "next/link";
import { Logo } from "@/components/logo";
import { site } from "@/config/site";

const groups = [
  {
    title: "Product",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Sign in", href: "/sign-in" },
      { label: "Start free", href: "/sign-up" },
    ],
  },
  {
    title: "Company",
    links: [{ label: "Contact", href: "/contact" }],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Refund Policy", href: "/legal/refunds" },
      { label: "Data Processing Agreement", href: "/legal/dpa" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{site.tagline}</p>
        </div>
        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title} className="space-y-3">
            <h2 className="text-sm font-semibold">{group.title}</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {site.company.legalName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
