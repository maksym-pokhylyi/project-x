import { site } from "./site";

/**
 * ALL copy of the placeholder landing page ("/"). Replace the strings here to launch a
 * new product page without touching components. Icons are lucide-react icon names
 * mapped in src/components/marketing/icons.tsx.
 */
export const landing = {
  hero: {
    eyebrow: "Placeholder headline category",
    title: "Describe the outcome your customer gets, in one line",
    subtitle:
      "One or two sentences on who it is for and what painful job it removes. Keep it concrete: a number, a time saved, a risk avoided.",
    primaryCta: { label: "Start free", href: "/sign-up" },
    secondaryCta: { label: "See pricing", href: "/pricing" },
    note: "No credit card required · Cancel anytime",
  },
  problem: {
    title: "The problem, in your customer's words",
    points: [
      { title: "It takes too long", body: "Describe the manual, repetitive work your customer does today." },
      { title: "It is error-prone", body: "Describe what goes wrong, and what that costs them." },
      { title: "It does not scale", body: "Describe why hiring or spreadsheets stop working as they grow." },
    ],
  },
  howItWorks: {
    title: "How it works",
    steps: [
      { title: "Connect", body: "First step the customer takes. Should take minutes, not days." },
      { title: "Configure", body: "What they set up once so the product fits their workflow." },
      { title: "Get results", body: "The repeatable value they get every week from then on." },
    ],
  },
  features: {
    title: "Everything a team needs",
    subtitle: "Replace these with the three to six capabilities that matter most.",
    items: [
      { icon: "zap", title: "Fast by default", body: "Explain the capability and the benefit it unlocks." },
      { icon: "users", title: "Built for teams", body: "Workspaces, roles and invitations are included from day one." },
      { icon: "shield", title: "Secure", body: "Role-based access, audit log and data isolation between workspaces." },
      { icon: "chart", title: "Measurable", body: "Usage and limits are visible to you and your team at any time." },
      { icon: "plug", title: "Fits your stack", body: "Describe integrations or exports your customers rely on." },
      { icon: "life-buoy", title: "Real support", body: "Describe how customers get help when they need it." },
    ],
  },
  pricingTeaser: {
    title: "Simple pricing that grows with you",
    subtitle: "Start free. Upgrade when your team needs more seats or volume.",
    cta: { label: "Compare plans", href: "/pricing" },
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      { question: "Is there a free plan?", answer: "Yes. The Free plan lets you try the product with a small workspace, no credit card required." },
      { question: "Can I change or cancel my plan?", answer: "Yes. You can upgrade, downgrade or cancel at any time from the billing settings of your workspace." },
      { question: "How does billing work?", answer: "Payments are processed by Paddle, our merchant of record, which also handles invoices and sales tax/VAT." },
      { question: "Who owns my data?", answer: "You do. See the Privacy Policy and the Data Processing Agreement for details." },
      { question: "How do I get support?", answer: `Write to ${site.supportEmail} and a human will reply.` },
    ],
  },
  finalCta: {
    title: "Ready to try it?",
    subtitle: "Create a workspace in under a minute.",
    cta: { label: "Start free", href: "/sign-up" },
  },
} as const;

export type LandingIcon = (typeof landing.features.items)[number]["icon"];
