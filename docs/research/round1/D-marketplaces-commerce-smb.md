# D — Commerce & SMB platform marketplaces as a distribution channel

Research date: 2026-11-13. Analyst scope: Shopify, Wix, WordPress/WooCommerce (+Freemius), BigCommerce, Squarespace, Webflow, Framer, GoHighLevel, QuickBooks, Xero, Procore, Clio, Square/Toast/Clover, Jobber/ServiceTitan/Housecall Pro, Amazon SP-API, Etsy, eBay, TikTok Shop, Chrome Web Store extensions on top of commerce/SMB platforms.

STATUS: WORK IN PROGRESS — this file is saved progressively; sections below are filled in as research completes.

Evidence labels used throughout: **FACT** (seen in a primary source on the date given), **INFERENCE** (my reasoning from facts), **ASSUMPTION** (unverified premise), **UNKNOWN** (could not verify).

Method note: pages were fetched live on 2026-11-13 (official docs, live app-store listings and search results, developer-forum threads via their public JSON). Shopify App Store does not publish install counts; review counts are used as the public proxy.

## Running log of verified facts (raw, to be organised)

### Shopify
- FACT (shopify.dev/docs/apps/launch/distribution/revenue-share, fetched 2026-11-13): "You keep 100% of your first $1,000,000 USD in lifetime gross app revenue, and 85% of earnings above that. Only revenue earned on or after January 1, 2025 counts toward this threshold. All billing is subject to a 2.9% processing fee and applicable sales tax." One-time $19 App Store registration fee per Partner account.
- FACT (shopify.dev/changelog/update-to-shopifys-app-developer-revenue-share, 2025-04-24): annual $1M exemption reset sunset; lifetime exemption; terms effective 2025-06-16; "more than 16,000 apps", ">$1B paid to developers last year".
- FACT (help.shopify.com/en/partners/getting-started/getting-paid, fetched 2026-11-13): min payout $25; paid twice monthly; "Payments are delivered through Hyperwallet".
- FACT (help.shopify.com/en/partners/manage-account/manage-payouts-invoices/payout-method, fetched 2026-11-13): "Partners can receive payouts by PayPal or Bank Account. Access to specific payout methods depends on your country or region and the currency"; "Virtual bank accounts, such as Payoneer, aren't supported for Partner payouts."
- FACT (shopify.com/partners/blog/payout-methods, 2021-11-17): "With our new payout methods, we can issue payouts in many more regions, now including countries such as Ukraine, Turkey, Bangladesh, Nigeria, and Pakistan."
- FACT (community.shopify.dev/t/.../39596, Shopify staff, 2026-11-10): new submission rules — at least 10 installs from full-priced stores on existing app before listing another; escalating cooldowns after rejection; identity verification soon required; apps with no installs after six months auto-removed.
- FACT (community.shopify.dev/t/.../39016 post #17, Shopify staff "Blair", 2026-10-29): "Today we unpublished hundreds of apps from the App Store. They came from a small group of high-volume submitters and had no merchant installs."
- FACT (community.shopify.dev/t/.../39176, 2026-10-29, quoting P. Jakubik's crawl of 2026-10-28): 29,245 apps from 18,376 partners; half released in 2026; 80% of apps launched in 2026 have no review.
- FACT (community.shopify.dev/t/.../38390, 2026-10-08, Letsmetrix data): ~30,800 active apps; new launches +10% m/m; new reviews −4% m/m to ~22,900.
- FACT (community.shopify.dev/t/.../39104, 2026-10-28): new reviews store-wide ~24.9k/month Mar–Sep 2026 vs ~21.7k/month same months 2025; Sidekick surfaces "up to three relevant app cards".
- FACT (apps.shopify.com search "widerrufsbutton", 2026-11-13): 92 apps; leader "EW: EU Withdrawal Button & Form" (401layers UG, launched 2026-01-09) 2,325 reviews, 4.9; #2 Revoq 583 reviews; #3 Anviara 108; long tail 0–75.

### Progress log, part 2 (saved 2026-11-13, mid-research)

Tooling limits hit: the session's WebSearch budget was exhausted after 9 queries (shared limit), so everything after that was done by fetching known primary URLs directly (official docs, live store listings and the stores' own search, forum JSON). Cloudflare blocked: Indie Hackers, Clio, Jobber (docs + marketplace), Square marketplace, Tipalti support. JS-only (no text): Xero developer docs, Intuit developer docs, Procore developer docs, GoHighLevel marketplace listings, Letsmetrix dashboards.

#### Wix
- FACT (dev.wix.com .../about-monetizing-your-app, fetched 2026-11-13): "In your first year, you receive 100% of all sales revenue. After that, you keep 80%. Revenue is calculated after a 2.5% transaction fee and applicable sales tax." "We pay out your revenue share on a net 30 EOM basis."
- FACT (dev.wix.com .../payments-and-billing-faqs, last updated 2026-09-09): minimum payout threshold $200; "revenue earned in March would arrive at the beginning of May"; 45-day dunning grace period.
- FACT (dev.wix.com .../set-up-your-payout-account, last updated 2026-09-09): "you must become a Wix partner and then set up a Tipalti account to receive payouts."
- FACT (support.wix.com/en/article/wix-studio-receiving-revenue-share, fetched 2026-11-13): "Currently, revenue share payments are not issued to banks located in Russia and Pakistan."
- FACT (dev.wix.com .../about-app-distribution, fetched 2026-11-13): "The review is an automated AI process that runs when you submit and publish your app, so your app can go from submission to published in minutes."
- FACT (wix.com/app-market search "withdrawal", 2026-11-13): 15 apps; best has 4 reviews. eCommerce category: 594 apps. "Newest apps" list is dominated by multi-app publishers with 0 reviews (e.g. 10+ apps from one publisher prefix, 15+ from another).

#### GoHighLevel
- FACT (help.gohighlevel.com article 155000001217, modified 2026-06-23): in-platform billing recommended; "We currently do not deduct any commission. You receive the entire payment from our customers."; "We've partnered with Tipalti to facilitate developer payouts"; "payments sent on the 15th of each month for all earnings accrued in the previous month"; agencies can resell with markup; 30-day failed-payment grace.
- FACT (gohighlevel.com/landing-marketplace, fetched 2026-11-13): "HighLevel will not charge any commission on developers' revenue until December 31, 2026."
- FACT (marketplace.gohighlevel.com page meta, 2026-11-13): "Browse 1500+ apps".
- FACT (marketplace.gohighlevel.com/docs/oauth/AppReviewGuidelines, 2026-11-13): Loom demo required at submission; whitelabel rules (no HighLevel/GHL branding in whitelabel apps).
- FACT (ideas.gohighlevel.com/marketplace-new-app-request?sort=top, 2026-11-13): top-voted app requests have only 4-15 votes (Smart Tag automation 15, international phone validation 8, MS Teams 7, Google Docs 7).
- UNKNOWN: per-app install counts, review lead time, commission after 2026-12-31.

#### Freemius / WordPress.org
- FACT (freemius.com/pricing, fetched 2026-11-13): "3.8% + 50c + gateway fees", merchant of record included, "Supported payouts through Wire, Wise, Payoneer, and PayPal".
- FACT (freemius.com/help/documentation/selling-with-freemius/supported-countries, fetched 2026-11-13): payout countries list includes "Ukraine (non-sanctioned regions)"; payout methods PayPal, Payoneer, wire (SWIFT/IBAN), Wise.
- FACT (make.wordpress.org/plugins, post of 2026-06-13): review queue went from a mid-April 2026 peak of roughly 1,050 plugins back to nearly zero "even as submissions hit new records".
- FACT (api.wordpress.org plugin search, 2026-11-13): withdrawal-button plugins: vendidero "EU Order Withdrawal Button for WooCommerce" 6,000+ active installs (added 2026-03-26); Tellado 2,000+; WebToffee 1,000+; all free. Germanized 70,000+ installs.

#### Payments rails for non-billing ecosystems
- FACT (paddle.com help "Which countries are supported by Paddle?", fetched 2026-11-13): works with software businesses anywhere except listed countries; the unsupported list includes Crimea, Donetsk, Kherson, Luhansk and Zaporizhzhia regions of Ukraine (rest of Ukraine supported).
- FACT (docs.lemonsqueezy.com supported countries, fetched 2026-11-13): Ukraine is not in the bank-payout country list (PayPal payouts only) -> effectively unusable for this founder.

#### Cross-platform natural experiment: EU withdrawal button (Directive (EU) 2023/2673, applies 2026-06-19)
- Shopify: 92 apps; leader 2,325 reviews (launched 2026-01-09; Free / $9.99 / $29.99), #2 583 reviews (launched 2026-03-11), #3 108 (2026-05-06), #4 74 (2026-06-03).
- WooCommerce (WP.org): leader 6,000+ active installs, free.
- Wix: 15 apps, leader 4 reviews.
