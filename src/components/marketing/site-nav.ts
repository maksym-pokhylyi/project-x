/** Navigation shared by the public header, its phone menu and the footer. */
export const primaryNav = [
  { label: "How it works", href: "/#how" },
  { label: "Pricing", href: "/pricing" },
  { label: "Questions", href: "/#questions" },
] as const;

/** The one call to action of the public site. */
export const findCompany = { label: "Find your page", href: "/find" } as const;

export const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Pricing", href: "/pricing" },
      { label: "Free bid check", href: "/free-bid-check" },
      { label: "Sample bid check", href: "/sample-check" },
      { label: "Find your page", href: "/find" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Independence", href: "/#independence" },
      { label: "Questions", href: "/#questions" },
      { label: "Contact", href: "/contact" },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy notice", href: "/legal/privacy" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Refund policy", href: "/legal/refunds" },
      { label: "Acceptable use", href: "/legal/acceptable-use" },
      { label: "Data processing agreement", href: "/legal/dpa" },
      { label: "Data sources", href: "/about-the-data" },
      { label: "Stop emails from us", href: "/optout" },
    ],
  },
] as const;
