/** Navigation shared by the public header, its phone menu and the footer. */
export const primaryNav = [
  { label: "How it works", href: "/#how" },
  { label: "Pricing", href: "/pricing" },
  { label: "Questions", href: "/#questions" },
] as const;

/** On /pricing, "Questions" means the billing questions of that page, as in the pricing artboard. */
export function navHref(href: string, pathname: string | null): string {
  return pathname === "/pricing" && href === "/#questions" ? "#questions" : href;
}

/** The one call to action of the public site. */
export const findCompany = { label: "Find your company", href: "/find" } as const;

/**
 * Footer columns, as in the artboards (Product / Service / Legal). The artboards draw three
 * links a column; the others are pages that must stay one click away from every public
 * page: the refund policy and the terms that go with it (Paddle asks for them), and the
 * opt-out page (anyone we e-mailed must be able to stop it from anywhere).
 */
export const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Pricing", href: "/pricing" },
      { label: "Sample check", href: "/sample-check" },
      { label: "Free bid check", href: "/free-bid-check" },
    ],
  },
  {
    title: "Service",
    links: [
      { label: "Independence", href: "/#independence" },
      { label: "Questions", href: "/#questions" },
      { label: "Contact", href: "/contact" },
      { label: "Stop emails from us", href: "/optout" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
      { label: "Refunds", href: "/legal/refunds" },
      { label: "Acceptable use", href: "/legal/acceptable-use" },
      { label: "Data processing", href: "/legal/dpa" },
      { label: "Data sources", href: "/about-the-data" },
    ],
  },
] as const;

/** Phones: one wrapping row of links, as in the 390 px artboards, plus the two that must not be dropped. */
export const footerPhoneLinks = [
  { label: "How it works", href: "/#how" },
  { label: "Pricing", href: "/pricing" },
  { label: "Sample check", href: "/sample-check" },
  { label: "Sign in", href: "/sign-in" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Refunds", href: "/legal/refunds" },
  { label: "Data sources", href: "/about-the-data" },
  { label: "Stop emails from us", href: "/optout" },
] as const;
