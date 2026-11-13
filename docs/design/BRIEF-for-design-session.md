# Бриф для отдельной дизайн-сессии (по желанию, не блокирует сборку)

Основной интерфейс проектируется и собирается в рабочей сессии по `docs/design/DESIGN.md`. Отдельная сессия полезна для айдентики и
визуалов лендинга, которые можно делать параллельно. Ниже — текст брифа, его можно вставить в дизайн-сессию целиком.

---

**Product.** Bidfolio (bidfolio.co.uk) — "the bid desk for small suppliers". A web app for UK small and medium businesses that bid for
public-sector contracts. Free: a personalised page per supplier built from open procurement data (their own contract wins, similar
open tenders with deadlines, competitor contracts ending soon, buyers in their trade). Paid: upload a tender pack → a bid brief with
every requirement quoted and cited, a list of scored questions, first-draft answers grounded only in the company's own documents, and an
evaluator-style marking of each answer.

**Audience.** Owners, bid coordinators and freelance bid writers at UK firms of 5–250 people: builders, cleaning and facilities
companies, care providers, IT and training suppliers. Practical, time-poor, sceptical of hype. First contact is an email opened on a
phone; real work happens at a desk.

**Personality.** A sharp bid manager who has read every page: calm, exact, on your side. Document-like authority, not a start-up toy and
not a government site (it must look clearly independent of GOV.UK).

**Fixed foundations (please keep).**
- Palette: paper `#FAF8F3`, surface `#FFFFFF`, ink `#161A1D`, line `#E3DED2`, brand deep green `#0F5A47`, amber `#B4690E` (deadlines),
  danger `#A3271C`, success `#1D6F43`, info `#1F4F8F`.
- Type: Source Serif 4 for headings, Inter for UI/body, IBM Plex Mono for references.
- No stock illustration, no emoji, no purple gradients, no "AI sparkle" iconography.

**Deliverables wanted.**
1. **Logo and wordmark**: a mark based on a folio sheet whose folded corner forms a tick; one colour; legible at 16 px. SVG: mark,
   horizontal lockup, favicon, and a 1200×630 social image.
2. **Landing page design** (desktop 1440 and mobile 390): hero that shows a realistic supplier page as the product visual; "how it
   works" in three steps; a close-up of a cited requirement (quote + file + page); pricing (Free, Radar Pro £49, Bid Desk £149,
   Bid Desk Plus £349); FAQ; independence note. Headline direction: "Know which public contracts are worth your time — and get a
   compliant first draft in hours, not days."
3. **Three product screens** at 1440 and 390: (a) public supplier page; (b) bid brief with requirements, citations and verdict banner;
   (c) answer editor with word limit, evidence markers and evaluator panel.
4. A short note on any change you recommend to the foundations, with the reason.

**Format.** HTML/CSS or a published design page I can open by link; SVG files for the logo. Real UK-sounding sample content (company
names clearly fictional), British spelling, pounds sterling, dates like "22 Nov 2026".
