#!/usr/bin/env python3
"""Recompute the numbers used in docs/gtm from a local Find a Tender OCDS harvest.

Usage:  python3 -I docs/gtm/tools/gtm_stats.py [file.jsonl.gz ...]
Default input: the six weekly files 2026-10-02 .. 2026-11-13 in /home/user/data/fts/raw/.
Output: counts only. No email address or contact name is ever printed or stored.
The Find a Tender API is not called.
"""
import collections, datetime, gzip, json, re, statistics, sys

RAW = '/home/user/data/fts/raw/%s.jsonl.gz'
WEEKS = ['2026-10-02_2026-10-09', '2026-10-09_2026-10-16', '2026-10-16_2026-10-23',
         '2026-10-23_2026-10-30', '2026-10-30_2026-11-06', '2026-11-06_2026-11-13']
FILES = sys.argv[1:] or [RAW % w for w in WEEKS]
UTC = datetime.timezone.utc

FREEMAIL = set('gmail.com googlemail.com outlook.com outlook.co.uk hotmail.com hotmail.co.uk live.com live.co.uk '
               'yahoo.com yahoo.co.uk ymail.com icloud.com me.com mac.com btinternet.com btopenworld.com aol.com '
               'aol.co.uk sky.com msn.com talktalk.net virginmedia.com ntlworld.com blueyonder.co.uk tiscali.co.uk '
               'mail.com protonmail.com proton.me gmx.com gmx.co.uk btconnect.com'.split())
ROLE_WORDS = set('info enquiries enquiry sales tenders tender bids bid admin office contact hello accounts mail post '
                 'reception contracts contract commercial procurement business support team general customerservices '
                 'customerservice customer.services service services orders marketing operations estimating estimates '
                 'estimator quotes quotations enq help newbusiness bd bdm businessdevelopment bidteam bid.team bids.team '
                 'tenderteam tender.team frameworks framework publicsector public.sector uk ukbids uksales salesuk '
                 'finance hq headoffice head.office projects management directors partnerships opportunities '
                 'submissions proposals proposal pqq estimatingteam care referrals customercare enquire inquiries hr '
                 'legal training bookings'.split())
ROLE_STEMS = ('info', 'enquir', 'sales', 'tender', 'bids', 'admin', 'office', 'contact', 'hello', 'accounts',
              'procurement', 'contracts', 'commercial', 'estimat', 'support', 'reception', 'mail', 'business',
              'frameworks', 'marketing', 'operations', 'customer', 'service', 'team')
COUNCIL = re.compile(r'\b(council|borough|cyngor|combined authority|county|corporation of london|city of london|'
                     r'greater london authority|comhairle)\b', re.I)
NOT_COUNCIL = re.compile(r'\b(college|university|school|academy|nhs|police|fire|housing|homes|trust)\b', re.I)
CH = re.compile(r'^(?:[0-9]{8}|[A-Z]{2}[0-9]{6}|R[0-9]{7})$')
NOT_CORPORATE_OR_MANUAL = ('LP', 'NL', 'FC', 'BR', 'NF', 'SF', 'OE')


def releases():
    for path in FILES:
        with gzip.open(path, 'rt') as fh:
            for line in fh:
                if line.strip():
                    yield json.loads(line)


def when(s):
    if not s:
        return None
    try:
        d = datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
        return d if d.tzinfo else d.replace(tzinfo=UTC)
    except ValueError:
        return None


def notice_type(r):
    t = r.get('tender') or {}
    docs = list(t.get('documents') or [])
    for key in ('awards', 'contracts'):
        for x in r.get(key) or []:
            docs += x.get('documents') or []
    for d in docs:
        if d.get('id') == r.get('id') and d.get('noticeType'):
            return d['noticeType']
    for d in docs:
        if d.get('noticeType'):
            return d['noticeType']
    tag = r.get('tag') or []
    return 'L-award' if ('award' in tag or 'contract' in tag) else 'L-other'


def cpvs(r):
    out = set()

    def take(items):
        for it in items or []:
            for c in [it.get('classification') or {}] + list(it.get('additionalClassifications') or []):
                if c.get('id'):
                    out.add(str(c['id'])[:8])
    t = r.get('tender') or {}
    take(t.get('items'))
    for c in [t.get('classification') or {}] + list(t.get('additionalClassifications') or []):
        if c.get('id'):
            out.add(str(c['id'])[:8])
    for key in ('awards', 'contracts'):
        for x in r.get(key) or []:
            take(x.get('items'))
    return {c for c in out if re.match(r'^\d{8}$', c)}


def trades(cp):
    out = set()
    for c in cp:
        if c[:2] in ('45', '50'):
            out.add('construction_maintenance')
        if c[:2] in ('90', '77') or c[:5] == '79993' or c[:3] == '797':
            out.add('cleaning_facilities')
        if c[:2] == '85':
            out.add('care')
    return out


def is_council(name):
    name = name or ''
    return bool(COUNCIL.search(name)) and not NOT_COUNCIL.search(name)


def bucket(p):
    p = (p or '').lower()
    if 'without competition' in p or p == 'direct award':
        return 'no competition'
    if 'limited competition' in p:
        return 'invited quotes'
    if 'framework' in p:
        return 'framework call-off'
    if 'open' in p or 'competitive flexible' in p:
        return 'open tender'
    return 'not stated'


def mailbox_kind(addr):
    """generic | named | freemail | none - the address itself is discarded by the caller."""
    if not addr or '@' not in addr:
        return 'none'
    local, _, dom = addr.strip().lower().rpartition('@')
    if dom in FREEMAIL or dom.startswith(('hotmail.', 'yahoo.', 'live.')):
        return 'freemail'
    local = re.sub(r'[\d_\-]+$', '', local).replace('-', '.').replace('_', '.')
    parts = [x for x in local.split('.') if x]
    if local in ROLE_WORDS or local.replace('.', '') in ROLE_WORDS or (parts and all(x in ROLE_WORDS for x in parts)):
        return 'generic'
    return 'generic' if any(local.startswith(w) or local.endswith(w) for w in ROLE_STEMS) else 'named'


def ch_number(ident):
    if (ident or {}).get('scheme') != 'GB-COH':
        return None
    x = re.sub(r'[^0-9A-Za-z]', '', str(ident.get('id') or '')).upper()
    if x.isdigit() and len(x) < 8:
        x = x.zfill(8)
    return x if CH.match(x) else None


def pct(a, b):
    return '%.1f%%' % (100.0 * a / b) if b else 'n/a'


def main():
    rows, uk7, uk4_first, uk4_last, n = [], {}, {}, {}, 0
    for r in releases():
        n += 1
        nt, d = notice_type(r), when(r.get('date'))
        t = r.get('tender') or {}
        buyer = (r.get('buyer') or {}).get('name')
        if nt == 'UK7' and (r['ocid'] not in uk7 or when(uk7[r['ocid']]['date']) < d):
            uk7[r['ocid']] = r
        if nt == 'UK4':
            tag = r.get('tag') or []
            if 'tender' in tag and (r['ocid'] not in uk4_first or when(uk4_first[r['ocid']]['date']) > d):
                uk4_first[r['ocid']] = r
            if r['ocid'] not in uk4_last or when(uk4_last[r['ocid']]['date']) < d:
                uk4_last[r['ocid']] = r
        if nt in ('UK5', 'UK6', 'UK7', 'L-award'):
            tr, council = trades(cpvs(r)), is_council(buyer)
            for p in r.get('parties') or []:
                if 'supplier' not in (p.get('roles') or []):
                    continue
                det = p.get('details') or {}
                ch = ch_number(p.get('identifier'))
                kind = mailbox_kind((p.get('contactPoint') or {}).get('email'))
                ok = (det.get('scale') == 'sme' and ch and ch[:2] not in NOT_CORPORATE_OR_MANUAL
                      and (p.get('address') or {}).get('country') in ('GB', None) and kind in ('generic', 'named'))
                rows.append((d, ch or 'N:' + (p.get('name') or '').upper().strip(), det.get('scale'), bool(ch),
                             kind, ok, tr, council))
    last = max(when(r['date']) for r in uk7.values())
    print('releases: %d | award-stage supplier rows: %d | latest release: %s' % (n, len(rows), last.date()))

    sme = {}
    for d, key, scale, has_ch, kind, ok, tr, council in rows:
        if scale == 'sme':
            sme[key] = (has_ch, kind, ok)
    print('distinct SME suppliers: %d | no Companies House number: %d | free-mail: %d | pass offline gate: %d' % (
        len(sme), sum(1 for v in sme.values() if not v[0]), sum(1 for v in sme.values() if v[0] and v[1] == 'freemail'),
        len({k for d, k, s, h, kind, ok, tr, c in rows if ok})))

    print('\nSEGMENTS (companies passing the offline gate; generic / named mailbox)')
    for days in (42, 21, 14, 7):
        since = datetime.datetime.combine(last.date() - datetime.timedelta(days=days - 1), datetime.time(0), UTC)
        for label, test in (('all', lambda tr, c: True), ('council x 3 trades', lambda tr, c: c and tr),
                            ('council x construction', lambda tr, c: c and 'construction_maintenance' in tr),
                            ('council x care', lambda tr, c: c and 'care' in tr),
                            ('council x cleaning/FM', lambda tr, c: c and 'cleaning_facilities' in tr),
                            ('any buyer x 3 trades', lambda tr, c: bool(tr))):
            best = {}
            for d, key, scale, has_ch, kind, ok, tr, council in rows:
                if ok and d >= since and test(tr, council) and (key not in best or best[key][0] < d):
                    best[key] = (d, kind)
            k = collections.Counter(v[1] for v in best.values())
            print('  last %2d days | %-24s total %5d  generic %5d  named %5d' % (days, label, len(best), k['generic'], k['named']))

    print('\nCONTRACT DETAILS NOTICES (UK7), one per procurement: %d' % len(uk7))
    b = collections.Counter(bucket((r.get('tender') or {}).get('procurementMethodDetails')) for r in uk7.values())
    for k, v in b.most_common():
        print('  %-20s %5d  %s' % (k, v, pct(v, len(uk7))))
    share = collections.defaultdict(collections.Counter)
    for r in uk7.values():
        sup = [p for p in r.get('parties') or [] if 'supplier' in (p.get('roles') or [])]
        if len(sup) == 1:
            share[bucket((r.get('tender') or {}).get('procurementMethodDetails'))][(sup[0].get('details') or {}).get('scale')] += 1
    for k, c in share.items():
        print('  SME share, single-supplier notices, %-20s n=%5d  %s' % (k, c['sme'] + c['large'], pct(c['sme'], c['sme'] + c['large'])))

    print('\nTENDER NOTICES (UK4), first publication: %d' % len(uk4_first))
    groups = collections.defaultdict(list)
    for r in uk4_first.values():
        t = r.get('tender') or {}
        dl = when((t.get('tenderPeriod') or {}).get('endDate')) or when(t.get('expressionOfInterestDeadline'))
        if dl and 0 <= (dl - when(r['date'])).total_seconds() / 86400 <= 365:
            days = (dl - when(r['date'])).total_seconds() / 86400
            groups['all'].append(days)
            groups['above threshold' if t.get('aboveThreshold') else 'below threshold'].append(days)
    for k, xs in groups.items():
        print('  %-16s n=%5d  median %.1f days  <=21 days %s  <=14 days %s' % (
            k, len(xs), statistics.median(xs), pct(sum(x <= 21 for x in xs), len(xs)), pct(sum(x <= 14 for x in xs), len(xs))))

    print('\nCOUNCIL CONTRACTS BY TRADE (UK7)')
    for trade in ('construction_maintenance', 'cleaning_facilities', 'care'):
        by, mix, vals, total, smes = collections.Counter(), collections.Counter(), [], 0, 0
        for r in uk7.values():
            buyer = (r.get('buyer') or {}).get('name')
            sup = [p for p in r.get('parties') or [] if 'supplier' in (p.get('roles') or [])]
            if trade not in trades(cpvs(r)) or not is_council(buyer) or not sup:
                continue
            total += 1
            if all((p.get('details') or {}).get('scale') == 'sme' for p in sup):
                smes += 1
                by[re.sub(r'\s+', ' ', buyer.strip())] += 1
                mix[bucket((r.get('tender') or {}).get('procurementMethodDetails'))] += 1
                if not ((r.get('tender') or {}).get('techniques') or {}).get('hasFrameworkAgreement'):
                    for c in r.get('contracts') or []:
                        v = (c.get('value') or {}).get('amountGross') or (c.get('value') or {}).get('amount')
                        if v and 1000 < v < 1e8:
                            vals.append(v)
        print('  %s: %d notices, all-SME %d (%s), median SME contract value GBP %s' % (
            trade, total, smes, pct(smes, total), format(int(statistics.median(vals)), ',') if vals else 'n/a'))
        print('     procedure, SME-won: ' + ', '.join('%s %s' % (k, pct(v, smes)) for k, v in mix.most_common()))
        print('     top councils by SME contracts: ' + '; '.join('%s %d' % kv for kv in by.most_common(5)))

    lots, social, total = [], 0, 0
    for r in uk4_last.values():
        t = r.get('tender') or {}
        if not trades(cpvs(r)) or not is_council((r.get('buyer') or {}).get('name')):
            continue
        total += 1
        crit = (((t.get('lots') or [{}])[0].get('awardCriteria') or {}).get('criteria')) or []
        q = p = 0.0
        weighted = False
        for c in crit:
            w = next((x.get('number') for x in c.get('numbers') or [] if x.get('weight') == 'percentageExact'), None)
            if w is not None:
                weighted = True
                if c.get('type') == 'quality':
                    q += w
                elif c.get('type') in ('price', 'cost'):
                    p += w
        if any('social' in ((c.get('name') or '') + ' ' + (c.get('description') or '')).lower() for c in crit):
            social += 1
        if weighted and abs(q + p - 100) < 0.5:
            lots.append(q)
    print('\nCOUNCIL TENDERS IN THE THREE TRADES (UK4, latest version): %d; social value named in %d (%s)' % (total, social, pct(social, total)))
    if lots:
        print('  first lots with numeric weights summing to 100: %d; median quality weight %.0f; quality >= 50%%: %s; price only: %s' % (
            len(lots), statistics.median(lots), pct(sum(x >= 50 for x in lots), len(lots)), pct(sum(x < 0.5 for x in lots), len(lots))))


if __name__ == '__main__':
    main()
