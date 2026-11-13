/** Navigation shared by the marketing header, its mobile menu and the footer. */
export const primaryNav = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Free bid check", href: "/free-bid-check" },
] as const;

export const findCompany = { label: "Find your company", href: "/find" } as const;

export const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "Find your company", href: "/find" },
      { label: "Free bid check", href: "/free-bid-check" },
      { label: "Sample check", href: "/sample-check" },
      { label: "Pricing", href: "/pricing" },
      { label: "How it works", href: "/#how-it-works" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About the data", href: "/about-the-data" },
      { label: "Contact", href: "/contact" },
      { label: "Sign in", href: "/sign-in" },
      { label: "Create a free account", href: "/sign-up" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Privacy notice", href: "/legal/privacy" },
      { label: "Refund policy", href: "/legal/refunds" },
      { label: "Acceptable use", href: "/legal/acceptable-use" },
      { label: "Data processing agreement", href: "/legal/dpa" },
      { label: "Stop emails from us", href: "/optout" },
    ],
  },
] as const;
