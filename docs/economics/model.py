#!/usr/bin/env python3
"""Bottom-up 12-month model for the UK public-contract copilot.
Run: python3 docs/economics/model.py  -> prints Markdown tables (also used to generate ECONOMICS.md numbers).
All inputs are explicit; sources/assumptions are documented in docs/economics/ECONOMICS.md."""
GBP_USD = 1.3256  # ECB reference rates 2026-11-12 (EUR/USD 1.1081, EUR/GBP 0.83595)
PRICES = {'radar': 29, 'desk': 149, 'plus': 349}   # GBP / month, ex VAT
PASS_PRICE = 99                                      # GBP, one-off bid pass (not MRR)

SCENARIOS = {
  # Adverse: the personalised page does not beat ordinary cold email, deliverability caps volume, organic stays tiny.
  'adverse': dict(
     mix=dict(radar=.72, desk=.25, plus=.03),
     emails=[300, 600, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
     visit=.03, claim=.25, activate=.40, pay=.10,
     linkedin=[0] + [.3]*11,
     organic_visits_m12=300, organic_signup=.02, organic_pay=.05,
     partners=[0]*12, churn=.07, pass_rate=.15),
  # Base: funnel ~1.5 paying per 1,000 emails (report B base 1.05; red team median 1.5), modest organic.
  'base': dict(
     mix=dict(radar=.62, desk=.32, plus=.06),
     emails=[400, 1000] + [1800]*10,
     visit=.07, claim=.30, activate=.48, pay=.15,
     linkedin=[0] + [.5]*11,
     organic_visits_m12=1000, organic_signup=.03, organic_pay=.07,
     partners=[0, 0, 0] + [.3]*9, churn=.05, pass_rate=.30),
  # Favourable: the hook works about 2.6x better than base, organic and partners contribute, more Bid Desk buyers.
  'favourable': dict(
     mix=dict(radar=.45, desk=.45, plus=.10),
     emails=[500, 1500] + [2000]*10,
     visit=.12, claim=.33, activate=.55, pay=.18,
     linkedin=[0] + [1.2]*11,
     organic_visits_m12=3000, organic_signup=.04, organic_pay=.09,
     partners=[0, 0, 0] + [1.0]*9, churn=.04, pass_rate=.35),
}
FIXED_USD = dict(vercel=20, neon=19, email_tx=20, domain=2, outbound_stack=180, uk_representative=50, ico_fee=6, misc=30)  # per month
# outbound_stack: sending domains + mailboxes + tooling ($110-250 per report P2); uk_representative: Art. 27 UK GDPR (EUR 35-100/month per P2); ico_fee: GBP 52/year
PADDLE_PCT, PADDLE_FIXED_USD = 0.05, 0.50
TAX_PCT = 0.06          # FOP group 3: 5% single tax + 1% military levy (assumption to confirm with accountant)
ESV_USD = 42            # unified social contribution per month (approx. 1,902 UAH)
LLM_USD = dict(radar=0.5, desk=4.0, plus=12.0)  # per paying customer per month

def arpa_gbp(mix): return sum(PRICES[k]*v for k, v in mix.items())

def run(name, s, overrides=None):
    s = dict(s); s.update(overrides or {})
    arpa = arpa_gbp(s['mix']); rows = []; cust = 0.0
    lag = [0.0]*14  # paid conversions land ~1 month after the email (trial + decision)
    for m in range(12):
        per_1000 = s['visit']*s['claim']*s['activate']*s['pay']*1000
        lag[m+1] += s['emails'][m]/1000*per_1000
        organic_visits = s['organic_visits_m12']*max(0, (m-2))/9 if m >= 3 else 0   # ramps from month 4 to month 12
        new_org = organic_visits*s['organic_signup']*s['organic_pay']
        new = lag[m] + s['linkedin'][m] + new_org + s['partners'][m]
        churned = cust*s['churn']
        cust = cust - churned + new
        mrr_gbp = cust*arpa; mrr_usd = mrr_gbp*GBP_USD
        passes_gbp = new*s['pass_rate']*PASS_PRICE
        gross_usd = mrr_usd + passes_gbp*GBP_USD
        paddle = gross_usd*PADDLE_PCT + (cust + new*s['pass_rate'])*PADDLE_FIXED_USD
        llm = cust*sum(LLM_USD[k]*v for k, v in s['mix'].items())
        fixed = sum(FIXED_USD.values())
        tax = (gross_usd - paddle)*TAX_PCT + ESV_USD
        net = gross_usd - paddle - llm - fixed - tax
        rows.append(dict(m=m+1, emails=s['emails'][m], new=new, churned=churned, cust=cust, mrr=mrr_usd,
                         oneoff=passes_gbp*GBP_USD, paddle=paddle, llm=llm, fixed=fixed, tax=tax, net=net))
    return arpa, rows

def table(name, s):
    arpa, rows = run(name, s)
    per_1000 = s['visit']*s['claim']*s['activate']*s['pay']*1000
    print(f"\n### {name}\n")
    print(f"ARPA £{arpa:.0f} (${arpa*GBP_USD:.0f}); award-email funnel {s['visit']:.0%} → {s['claim']:.0%} → {s['activate']:.0%} → {s['pay']:.0%} = {per_1000:.2f} paying per 1,000 emails; monthly churn {s['churn']:.1%}\n")
    print("| Month | Emails | New paying | Churned | Paying at end | MRR $ | One-off $ | Paddle $ | LLM $ | Fixed $ | Tax+ESV $ | Founder net $ |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        print(f"| {r['m']} | {r['emails']:,} | {r['new']:.1f} | {r['churned']:.1f} | {r['cust']:.0f} | {r['mrr']:,.0f} | {r['oneoff']:,.0f} | {r['paddle']:,.0f} | {r['llm']:,.0f} | {r['fixed']:,.0f} | {r['tax']:,.0f} | {r['net']:,.0f} |")
    return rows

if __name__ == '__main__':
    res = {}
    for n, s in SCENARIOS.items(): res[n] = table(n, s)
    print("\n### Summary at month 12\n\n| Scenario | Paying customers | MRR $ | Founder net $/month | Cumulative founder net $ (12 mo) |\n|---|---|---|---|---|")
    for n, rows in res.items():
        print(f"| {n} | {rows[-1]['cust']:.0f} | {rows[-1]['mrr']:,.0f} | {rows[-1]['net']:,.0f} | {sum(r['net'] for r in rows):,.0f} |")
    print("\n### Sensitivity (base scenario, one variable at a time) — MRR at month 12\n\n| Variable | Value | Paying customers | MRR $ |\n|---|---|---|---|")
    b = SCENARIOS['base']
    tests = [('Page-visit rate from award email', 'visit', [.03, .07, .12, .20]),
             ('Activated → paid', 'pay', [.08, .15, .25]),
             ('Monthly churn', 'churn', [.03, .05, .08]),
             ('Organic visits at month 12', 'organic_visits_m12', [300, 1000, 3000, 6000])]
    for label, key, vals in tests:
        for v in vals:
            _, rows = run('base', b, {key: v}); print(f"| {label} | {v} | {rows[-1]['cust']:.0f} | {rows[-1]['mrr']:,.0f} |")
    for label, mix in [('Plan mix 72/25/3 (mostly Radar)', dict(radar=.72, desk=.25, plus=.03)), ('Plan mix 62/32/6 (base)', b['mix']), ('Plan mix 30/55/15 (mostly Bid Desk)', dict(radar=.30, desk=.55, plus=.15))]:
        _, rows = run('base', b, {'mix': mix}); print(f"| {label} | ARPA £{arpa_gbp(mix):.0f} | {rows[-1]['cust']:.0f} | {rows[-1]['mrr']:,.0f} |")
    for label, em in [('Emails per month 1,000', 1000), ('Emails per month 1,800 (base)', 1800), ('Emails per month 3,000 (two senders/domains)', 3000)]:
        _, rows = run('base', b, {'emails': [400, 1000] + [em]*10}); print(f"| {label} | {em} | {rows[-1]['cust']:.0f} | {rows[-1]['mrr']:,.0f} |")
    # What does $10k MRR require?
    print("\n### What $10k MRR requires\n")
    for n, s in SCENARIOS.items():
        a = arpa_gbp(s['mix'])*GBP_USD; print(f"- {n} plan mix: ARPA ${a:.0f} → {10000/a:.0f} paying customers")
