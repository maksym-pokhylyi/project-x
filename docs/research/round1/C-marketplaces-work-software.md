# C — Work-software app marketplaces as a distribution channel (Round 1)

Status: WORK IN PROGRESS (progressive save #1, 2026-11-13). Final version replaces this file.

## Method notes (read first)

- Date of research: 2026-11-13.
- The shared WebSearch budget for this session was exhausted after 3 queries (limit shared by all agents). All remaining evidence was collected by **direct fetches of primary sources** (official docs, marketplace listing pages, public marketplace APIs, vendor pages, developer-community threads at their canonical URLs). No general web search engine was queried after the budget ran out.
- Atlassian Marketplace numbers come from the public Marketplace REST API v2 (`https://marketplace.atlassian.com/rest/2/addons...`), queried on 2026-11-13. A full dump of all 7,293 cloud-hosted app listings was taken, and for the 3,000 newest listings the first cloud version release date was retrieved.

## Preliminary findings captured so far

### Atlassian (FACTS, primary)
- Revenue share (developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/, page last updated Jun 17 2025 but containing 2026 rates): Forge 84% / Connect 80% / DC 75% effective 1 Apr 2026; from 1 Oct 2026 Forge 83% / Connect 75% / DC 75%. As of 1 Jan 2026 partners receive **100% of gross revenue on Forge apps up to $1M lifetime Forge revenue**.
- Payout: >= $500 accrued; paid within 30 days after the end of the month; EFT/wire in USD to "a valid bank account in your name" (Marketplace Partner Agreement s.4.4); remittance 17th-20th of the payment month.
- Approval: "10-15 business days, but approval times vary"; partner verification ticket + privacy & security tab ticket; valid company email domain required for paid-via-Atlassian.
- Connect: no new Connect apps since Sep 2025, no updates to Connect-descriptor apps since Mar 2026, end of support 31 Jan 2027; "over 95% of paid app seats have been migrated to Forge" (Atlassian blog, 3 Aug 2026).
- Forge platform pricing: consumption-based since Jan 2026 with free monthly allowances (200,000 GB-seconds of function time etc.). Rovo agent AI usage is billed to the customer, not the partner.

### Atlassian Marketplace cohort data (FACT, API 2026-11-13)
- 7,293 cloud listings; 4,827 paid-via-Atlassian, 2,123 free, 343 paid-via-vendor; 925 listings still flagged Connect.
- New listings per month (first cloud version date): 2025-06: 37 ... 2026-01: 90, 2026-03: 200, 2026-08: 321, 2026-09: 453, 2026-10: 543.
- Median installs of apps launched 10-17 months ago: 2-6. Share reaching >=100 installs: ~6.5%; >=500 installs: ~0.6%.

### monday.com (FACTS, primary)
- 0% until $200k lifetime revenue, then 85/15; monthly payouts via Payoneer in USD after invoice approval (payment within up to 60 days after approval).
- "New apps built primarily using no-code platforms or AI-generated 'vibe code' are not eligible for marketplace approval." (developer.monday.com/apps/docs/submit-your-app)

### Microsoft (FACTS, primary)
- 3% store service fee on transactable offers; Ukraine listed as supported for Microsoft Marketplace payouts (wire), threshold $50.

(Full report follows in later saves.)
