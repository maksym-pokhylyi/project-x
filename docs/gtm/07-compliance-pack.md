# 07 — Пакет соответствия: черновики для доработки с юристом

Дата: 2026-11-13. Основа — `docs/research/round2/P2-outreach-legal-deliverability.md` (P2). **Это черновики, не юридическая
консультация.** Их задача — чтобы британский юрист по защите данных подтвердил или исправил всё примерно за час
(пункт 17 чек-листа P2).

Язык: документы, которые читает юрист, регулятор, Paddle или получатель письма, — на английском. Внутренние процедуры
(разделы 3 и 4) — на русском, с английскими текстами ответов.

Обозначения: `[…]` — заполнить; `[SOLICITOR: …]` — вопрос юристу; `[PRECONDITION: …]` — должно стать правдой до использования текста.

| № | Документ | Где используется | Готов к использованию, когда |
|---|---|---|---|
| 1 | Legitimate-interests assessment | Папка записей; по запросу — Paddle, ICO, клиенту | Заполнены скобки, проверен юристом, подписан и датирован |
| 2 | Раздел уведомления о конфиденциальности по ст. 14 | `bidfolio.co.uk/privacy#outreach` | Назначен представитель, названы обработчики |
| 3 | Процедура подавления и хранения | Ежедневная работа | Работает список подавления и задача удаления |
| 4 | Процедура рассмотрения жалоб | Форма `/complaints`, общий ящик | Форма и ящик проверены от начала до конца |
| 5 | Подпись письма | Каждое холодное письмо | Заполнены реквизиты |
| 6 | Письмо в поддержку Paddle | До заявки на боевой аккаунт | Выполнены все предусловия из раздела 6 |
| 7 | Вопросы юристу | Часовая консультация | — |

---

## 1. Legitimate-interests assessment (draft)

```
LEGITIMATE INTERESTS ASSESSMENT
Processing: introductory business-to-business email to named supplier contacts taken from Find a Tender notices

Controller:        [Full legal name], sole proprietor registered in Ukraine ([register reference]),
                   trading as Bidfolio (bidfolio.co.uk). Contact: [email].
UK representative: [Name, UK address] (Article 27 UK GDPR). [PRECONDITION: appointed in writing]
Version / date:    v1.0 / [date]          Prepared by: [name]          Next review: [date + 6 months]
```

### 1.1 Scope

This assessment covers work email addresses that identify a person (for example `jane.smith@company.co.uk`) where the
address is published as the supplier contact of an **incorporated UK supplier** in a contract award notice or contract
details notice on the UK Government's Find a Tender service.

It does not cover, because we do not carry out, any marketing to sole traders, ordinary partnerships, English, Welsh or
Northern Irish limited partnerships, unverified entities, or anyone using a consumer webmail or ISP address. Those
recipients are individual subscribers under PECR, consent would be required, and legitimate interests is not available.

Generic mailboxes at companies (`info@`, `tenders@`, `bids@`) with no name stored are not personal data. We apply the
same safeguards to them as a matter of policy.

### 1.2 The processing

| Item | Description |
|---|---|
| Data subjects | Employees, directors or other staff of incorporated UK suppliers whose work address the supplier gave as its contact in a public procurement notice |
| Personal data held | Work email address; employer's registered name and Companies House number; ID and date of the source notice; date we took the address into our database; dates and template version of emails sent; reply, opt-out or bounce status; visits to the supplier page made through the link code in the email; the text of any reply. **No name, telephone number, job title or other profile data is stored.** No special-category data |
| Source | Find a Tender open-data API (OCDS), a publicly accessible source. Notice data is published under the Open Government Licence v3.0, which does not cover personal data; we rely on this assessment, not on the licence, for the address |
| What we do | Check the supplier is an active incorporated entity at Companies House and that the address is on the supplier's own domain; send one plain-text email that names the supplier's own contract notice and links to a page about that supplier's published awards and similar open tenders; send at most two reminders; stop on any reply; honour every objection |
| Volume | In a six-week sample of notices (2 October to 12 November 2026) between 138 and 264 new named addresses a week passed our offline filters. The first batch using named addresses is capped at 100 |
| Timing | First email within one month of taking the address into the database (Article 14(3)); in practice within seven days |
| Processors | Mailbox host: [Google Workspace]. Sending tool: [name, from week 2]. Address-verification service: [name]. Hosting and database: Vercel and Neon, EU (Frankfurt). Written processor terms held for each [PRECONDITION] |
| Sharing | None. Addresses are never sold, published or passed to third parties. Public supplier pages show company-level data only |
| Transfers | The controller is established in Ukraine. [SOLICITOR: transfer mechanism, if any is needed, for the controller's own access from Ukraine and for processors outside the UK] |
| Automated decisions | None about individuals |

### 1.3 Part 1 — purpose test

| Question | Answer |
|---|---|
| What is the interest? | Winning customers for a software service by telling a supplier that a free page about its own public contract awards, similar open tenders and relevant buyers exists. This is direct marketing. UK GDPR Article 6(11)(a) lists processing necessary for direct marketing as an example of processing that may be necessary for a legitimate interest |
| Who benefits? | The controller (commercially). The recipient's employer may benefit from information about open tenders and buyers in its trade. We do not rely on any wider public benefit |
| Is it lawful apart from data protection? | PECR regulation 22 applies only to individual subscribers; our recipients are corporate subscribers verified against Companies House. Regulation 23 is met: the sender is identified and a valid opt-out address is given in every message. The email is identifiable as commercial on receipt. Paddle's seller terms prohibit telephone marketing; no calls are made |
| Would the interest still stand if the processing did not happen? | The service could be marketed by other means, but none tells a specific supplier that a page about it exists (see necessity) |

### 1.4 Part 2 — necessity test

| Question | Answer |
|---|---|
| Does the processing help achieve the purpose? | Yes: the message is specific to the supplier's own contract and leads to a page built for that supplier |
| Is there a less intrusive way? | (a) Generic mailboxes only: used first and by default. Named addresses are used only where the supplier itself published a named address as its contact, and will be dropped if a comparison batch shows no clear benefit over generic mailboxes. (b) Advertising or search: cannot reach a specific supplier with its own page; supplier pages are not indexed at launch. (c) Post: avoids PECR but is slower, cannot be clicked and costs more; kept as a fallback. (d) Telephone: excluded |
| Is the data minimised? | Yes. Only the address, the employer and the source notice are held. The contact name that some notices carry is discarded at ingestion |
| Is the volume proportionate? | One email and at most two reminders per supplier, ever. No re-contact after the sequence ends without a reply |

### 1.5 Part 3 — balancing test

| Factor | Assessment |
|---|---|
| Nature of the data | Business contact detail only; low sensitivity; no children or vulnerable people by design |
| Reasonable expectations | **Against us:** the address was published by a contracting authority in a statutory transparency notice, not for marketing, and the person did not give it to us. **For us:** the person acts in a business capacity; the address is the one the supplier chose for contract matters; the message concerns the supplier's own published contracts and its line of work; the ICO's business-to-business guidance says business contacts are more likely to expect contact in a business context and that such use is less likely to affect them personally |
| Likely impact | A short, relevant email and up to two reminders. Possible annoyance or surprise at the source. No financial, reputational or other material effect. The person is not displayed publicly and is not profiled |
| Ability to object | Stated clearly and separately in the first email; by reply or one click; absolute; applied to the whole company domain |
| Transparency | The first email says where the address came from, why it is used, how long it is kept and links to the full notice. A layered notice is used because a website notice alone is not enough |
| Would we be comfortable explaining this to the person? | Yes; the email itself does so |

### 1.6 Safeguards

1. Corporate-subscriber gate: Companies House number present, live status active, entity type with legal personality,
   registered name matches; limited partnerships (`LP`, `NL`) excluded. [SOLICITOR: confirm the limited-partnership point]
2. Consumer webmail and ISP domains blocked, even for limited companies.
3. Contact names not stored; no telephone numbers stored or used.
4. Article 14 information in the first email and one click away; UK representative named.
5. Right to object presented separately; opt-out by reply or link; processed the same day; whole domain suppressed.
6. Suppression list checked before every send and never purged.
7. Named addresses of non-responders deleted 90 days after the last email; a non-reversible hash is kept in the send log
   for 24 months as evidence of compliance. [SOLICITOR: confirm the hash approach]
8. No open-tracking pixels. Link codes record a visit to the supplier page only. [SOLICITOR: PECR regulation 6 and link codes]
9. Public pages carry no names, email addresses or telephone numbers, and no pages are generated for sole traders.
10. Low volume from identifiable mailboxes on domains that are obvious variants of the brand; every reply read within
    one working day.
11. Complaints procedure with a web form and 30-day acknowledgement (Data Protection Act 2018, section 164A).

### 1.7 Outcome

The legitimate interest is real and lawful, the processing is necessary for it in the limited form described, and with
the safeguards above the interests of the individuals do not override it. **Legitimate interests (Article 6(1)(f)) is
relied on for named work addresses at verified incorporated suppliers only.**

Review early if: opt-outs plus hostile replies exceed 5% of emails sent in any week; any complaint mentions the
Information Commission or Paddle; the source data or its terms change; the message type, volume or follow-up count
changes; named addresses show no clear benefit over generic mailboxes (in which case this processing stops).

```
Signed: ____________________   Name: [Full legal name]   Date: [date]
Reviewed by solicitor: [name, firm, date] [PRECONDITION]
```

---

## 2. Privacy notice — section for people we email (Article 14)

Размещается на `https://bidfolio.co.uk/privacy#outreach`. Короткая версия уже стоит в письме (блок D подписи,
`02-outreach-kit.md`, раздел 7).

```
If we emailed you about a public contract notice

Who we are
Bidfolio is operated by [Full legal name], a sole proprietor registered in Ukraine ([register reference]),
[postal address]. Email: [privacy@…]. Our representative in the United Kingdom under Article 27 of the UK GDPR
is [name], [UK address], [email].

What we hold about you
Your work email address, the company you work for, and the public contract notice your address appeared in.
We also record the emails we sent you, whether you replied or opted out, and whether the page linked in our
email was visited. We do not store your name, telephone number or job title, even where the notice shows them.

Where we got it
From the UK Government's Find a Tender service, a publicly accessible source. A contracting authority
published a contract notice that names your company as the supplier and gives your address as its contact.

Why we use it and our legal basis
To send one introductory message about our software service and at most two reminders. Our legal basis is
legitimate interests (Article 6(1)(f) UK GDPR): our interest in telling suppliers about a service that is
relevant to their public-sector work. We have carried out an assessment of that interest against yours; ask
us for a summary.

Who receives it
Our service providers, acting on our instructions: [mailbox host], [sending tool], [address-verification
service], and our hosting providers Vercel and Neon (data stored in the EU). We do not sell or share your
address and we do not publish it. Pages on our website show company information only.

Transfers outside the UK
[SOLICITOR: wording for the controller's location in Ukraine and for any processor outside the UK, with the
safeguard relied on.]

How long we keep it
If you do not reply, we delete your address 90 days after our last email. If you reply or become a customer,
we keep it for as long as we are in contact and for 12 months afterwards. If you opt out or your address
bounces, we keep the minimum needed to make sure we never email you again. We keep a record that an email
was sent (without your address in readable form) for 24 months.

Your right to object
You can object to marketing from us at any time and we will stop. Reply "stop" to any email, use the link in
the email, or write to [privacy@…]. This right is absolute. We apply your objection to your whole company
unless you tell us otherwise.

Your other rights
You can ask for a copy of the information we hold about you, ask us to correct or delete it, or ask us to
restrict its use. We answer without undue delay and within the time limit set by law.

Complaints
You can complain to us using the form at https://bidfolio.co.uk/complaints or by email to [privacy@…]. We
acknowledge complaints within 30 days and reply without undue delay. You can also complain to the Information
Commission (ICO): https://ico.org.uk/make-a-complaint/

Automated decisions
We make no automated decisions about you.
```

`[SOLICITOR: confirm the statutory time limit wording — UK GDPR Article 12(3) now refers to "the applicable time period
(see Article 12A)"; internal target is five working days.]`

---

## 3. Процедура: список подавления и сроки хранения

**Policy statement for the solicitor (English summary).** We keep one suppression list at address, domain and company-number
level. It is checked automatically before every send and before any list is exported, and it is never purged. Opt-outs
and hard bounces are added on the day they are received. An opt-out from any person at a company suppresses the whole
company domain. Named addresses of non-responders are deleted 90 days after the last email; the send log then holds a
hash of the address, not the address.

### 3.1 Что попадает в подавление и когда

| Событие | Что добавить | Срок | Кто и когда |
|---|---|---|---|
| Ответ «stop», «remove», «unsubscribe», любой отказ; клик по ссылке отказа; письмо на `unsubscribe@` | Адрес (или его хеш), **весь домен**, № Companies House, дата, причина `optout` | Бессрочно | Основатель, в тот же день, до следующей отправки |
| Жалоба или враждебный ответ | То же, причина `complaint` | Бессрочно | Сразу |
| Жёсткий возврат (5xx, user unknown, domain invalid) | Адрес, причина `hard_bounce` | Бессрочно | Сразу |
| Мягкий возврат (4xx, mailbox full) | Одна повторная попытка через 48 часов; при повторе — адрес, причина `soft_bounce` | Бессрочно | Автоматически или вручную |
| Блокирующий возврат (5.7.x, «spam», «blocked») | Адрес; ящик-отправитель остановить на день | Бессрочно | Сразу; это сигнал репутации, а не плохой адрес |
| Запрос на удаление страницы компании | Домен и № компании — в подавление и в список «не создавать страницу заново»; страница отдаёт HTTP 410 | Бессрочно | В течение 5 рабочих дней |
| Компания стала клиентом | Исключить из холодных цепочек (причина `customer`) | Пока клиент + 12 месяцев | Автоматически по вебхуку оплаты |
| Адрес оказался личным, компания — ИП или партнёрством | Адрес и домен, причина `not_corporate`; запись в журнал инцидентов | Бессрочно | Сразу; остановить отправку до исправления фильтра |

### 3.2 Сроки хранения

| Запись | Хранить | Как исполняется |
|---|---|---|
| Именной адрес, ответа нет | 90 дней после последнего отправленного письма, затем удалить адрес | Ежедневная задача; в журнале остаётся хеш |
| Именной адрес, человек ответил или стал лидом | Пока идёт общение + 12 месяцев | Ежемесячный просмотр |
| Именной адрес загружен, но письмо не отправлено | Не дольше 1 месяца с момента загрузки (ст. 14(3)); цель — 7 дней | Ежедневная задача: всё старше 30 дней без отправки — удалить |
| Общий ящик компании (без имени) | Не персональные данные; хранить, пока актуален, но не писать повторно после завершённой цепочки | — |
| Список подавления | Бессрочно, минимум данных: адрес или хеш, домен, дата, причина | Никогда не очищать |
| Журнал отправок (компания, № уведомления, ящик, время, версия шаблона, результат) | 24 месяца | После 90 дней — без читаемого именного адреса |
| Журнал жалоб и запросов субъектов данных | 24 месяца после закрытия | — |
| LIA, мандат представителя, договоры с обработчиками, ответ Paddle, заметка юриста | Пока идёт обработка + 6 лет (ДОПУЩЕНИЕ — уточнить у юриста) | Папка `compliance/` вне репозитория |

### 3.3 Ежедневный порядок (10 минут, до первой отправки дня)

1. Прочитать все ответы за вчера; отказы и жалобы — в подавление.
2. Обработать возвраты по таблице 3.1.
3. Проверить ящик `unsubscribe@` и журнал кликов по ссылке отказа.
4. Сформировать список на сегодня **после** обновления подавления; убедиться, что экспорт сверен со списком.
5. Отправить тестовое письмо на собственные ящики Microsoft 365 и Google Workspace; если оно в спаме — день без отправки.
6. Раз в неделю: проверить, что задача удаления отработала (нет именных адресов старше порогов).

Проверка перед запуском (пункты 7, 8, 11, 12 чек-листа P2): добавить тестовый адрес в подавление и убедиться, что он не
попадает в экспорт; кликнуть ссылку отказа из тестового письма и увидеть запись; ответить «stop» и пройти порядок вручную.

---

## 4. Процедура: жалобы, возражения, запросы на удаление

Один ящик `privacy@bidfolio.co.uk` и одна форма `https://bidfolio.co.uk/complaints` принимают всё: возражения против
рассылки, запросы субъектов данных, сообщения об ошибках на страницах, запросы на удаление страниц, жалобы.

| Тип обращения | Срок | Действие |
|---|---|---|
| Возражение против рассылки (ст. 21) | В день получения | Подавление адреса и домена; короткое подтверждение; без уговоров |
| Запрос копии данных, исправления, удаления, ограничения | Подтвердить за 2 рабочих дня; исполнить за 5 рабочих дней (внутренняя цель); законный срок — уточнить у юриста | Удостовериться, что пишет владелец адреса (ответом с того же адреса); исполнить; ответить, что сделано |
| Ошибка на странице компании | 5 рабочих дней | Сверить с исходным уведомлением; исправить привязку или скрыть запись; ответить со ссылкой на источник |
| Удаление страницы компании | 5 рабочих дней | Удалить (HTTP 410), домен в подавление и в «не создавать заново» — даже при том, что у компании нет такого права по закону о защите данных |
| Жалоба (в том числе по s. 164A Data Protection Act 2018) | **Подтвердить получение не позже 30 дней** (цель — 2 рабочих дня); ответить по существу без неоправданной задержки (цель — 10 рабочих дней) | См. шаги ниже |

**Шаги по жалобе**

1. Остановить отправку этой компании немедленно. Если упомянуты ICO, Information Commission или Paddle — остановить
   **всю** рассылку до завершения шага 4.
2. Записать в журнал жалоб: дата, компания, тип адреса, № уведомления-источника, текст жалобы, какое письмо получено.
3. Отправить подтверждение (текст ниже).
4. Разобрать: прошёл ли адрес все шаги фильтра; было ли письмо первым или напоминанием; сработал ли отказ. Причину и
   исправление записать.
5. Ответить по существу: что произошло, что сделано, как пожаловаться регулятору.
6. Если жалоба показала ошибку фильтра (ИП, личный адрес) — проверить весь список этой недели, а не один адрес.
7. Раз в месяц: число жалоб на 1 000 писем — в отчёт; более 2 жалоб за тест 400 писем — критерий DECISION.md не выполнен.

**Поля формы `/complaints`:** your name (optional); email address we should reply to; company (optional); what happened;
what you would like us to do; a checkbox «I am making a complaint about how my personal data was used».

**Acknowledgement (English)**

```
Subject: Your complaint to Bidfolio – received

Thank you for writing. I have received your complaint dated {{date}} and logged it under reference {{ref}}.

I have already stopped all emails to {{company}}. I will look into what happened and reply in full by
{{date + 10 working days}}.

You also have the right to complain to the Information Commission (ICO): https://ico.org.uk/make-a-complaint/

[Full name], Bidfolio
[Identity block as in the email signature]
```

**Substantive reply (English, skeleton)**

```
Subject: Your complaint to Bidfolio – reference {{ref}}

What happened: on {{date}} I sent one email to {{address type: "your company's general mailbox" / "your work
address"}} because {{company}} is named, with that address, as the supplier in contract notice {{notice id}}
on Find a Tender. {{If a reminder was sent: one reminder followed on {{date}}.}}

What I checked: {{result of the review, in plain words, including any mistake on our side}}.

What I have done: {{company}} and its email domain are on our do-not-contact list; {{for a named address:
your address has been deleted from our prospect list}}; {{if requested: the page about {{company}} has been
removed}}.

If you are not satisfied you can complain to the Information Commission (ICO):
https://ico.org.uk/make-a-complaint/ or contact our UK representative, [name, address, email].

[Full name], Bidfolio
```

---

## 5. Подпись письма (блок идентификации)

Полный текст и таблица «что обязательно» — в `02-outreach-kit.md`, раздел 7. Что заполнить и чем подтвердить:

| Поле | Что вписать | Замечание |
|---|---|---|
| `[Full legal name]` | ФИО как в реестре ФОП, латиницей | Только бренд без человека — риск «скрытой личности» (PECR reg. 23(a)) |
| `[state register entry / tax number]` | Номер записи в ЕГР или РНОКПП — что именно показывать, решить с юристом и бухгалтером | На сайте — обязательно (E-Commerce Regs reg. 6(1)(d)), в письме — желательно |
| `[Postal address]` | Адрес, куда реально приходит почта; не домашний, если есть альтернатива | Закон Великобритании прямо не требует адреса в письме; на сайте — требовать |
| `[monitored email address]` | Ящик, который читается каждый день | PECR reg. 23(b) |
| `UK data-protection representative` | Имя и британский адрес представителя | `[PRECONDITION: назначен письменно]` |
| `ICO registration number` | Номер после оплаты сбора £52 | По желанию; если ICO письменно подтвердит, что сбор не нужен, строку убрать |

Те же данные должны стоять на сайте «легко, прямо и постоянно доступно»: страницы `/about`, `/privacy`, `/terms`.

---

## 6. Письмо в поддержку Paddle (до заявки на боевой аккаунт)

Адаптация P2 §5.3 под итоговый продукт и цены. **Отправлять только когда каждое утверждение стало правдой**: Paddle может
считать письмо заверением по пункту 11 договора продавца. Ответ сохранить в папке `compliance/`.

**Предусловия (отметить каждое):**

- [ ] `[PRECONDITION 1]` Представитель в Великобритании назначен письменно; имя вписано ниже.
- [ ] `[PRECONDITION 2]` Юрист по защите данных Великобритании посмотрел фильтр, LIA и уведомление (иначе убрать фразу «I have taken advice…»).
- [ ] `[PRECONDITION 3]` Фильтр «только зарегистрированные компании» реализован и проверен на выборке 100 записей.
- [ ] `[PRECONDITION 4]` Уведомление о конфиденциальности опубликовано; ссылка отказа работает.
- [ ] `[PRECONDITION 5]` Описание продукта совпадает с тем, что реально доступно на сайте в день отправки (тарифы, AI-функции, открытые страницы).
- [ ] `[PRECONDITION 6]` Решено, будет ли реферальная программа; если нет — убрать вопрос 6.
- [ ] `[PRECONDITION 7]` Сбор ICO оплачен (если упоминается номер).

```
Subject: Pre-launch AUP confirmation – B2B SaaS for UK public-sector suppliers, email outreach

Hello,

I am a sole proprietor registered in Ukraine ([full legal name], [registration number]; Paddle seller ID
[ID, if any]). Before I apply for a live account I would like written confirmation that my product and my
marketing method are within the Acceptable Use Policy (last updated 13 April 2026) and the seller terms (last
updated 6 October 2026).

Product. Bidfolio (https://bidfolio.co.uk) is software for UK companies that bid for public-sector contracts.

- It reads contract notices published by the UK Government's Find a Tender service under the Open Government
  Licence v3.0, through the official open-data API, and gives each customer a radar of matching tenders,
  alerts and analytics on contract awards.
- It publishes one free public page per supplier company, built from that open data. Pages show company-level
  information only: no names, email addresses or telephone numbers. Links to the official notices are free.
- Customers can upload a tender pack. The software produces an AI-assisted checklist of the requirements,
  deadlines and scored questions, each quoted from the customer's own documents; first-draft answers written
  only from documents the customer has uploaded; and a score of each answer against the tender's published
  criteria. Customers remain responsible for what they submit.
- It does not generate content using any person's likeness, and it does not categorise or score individuals.
  Scoring applies to tender answers and to companies' fit with tenders.
- It is independent software. It is not a government service, it does not sell access to any government
  process, and it makes no claims about winning contracts or income.
- No human services are sold: I do not write bids or give consultancy. Support is limited to helping customers
  use the software. There are no paid listings and no advertising.

Pricing (GBP, excluding VAT): a one-off Bid Pass at £99 for one bid; subscriptions at £29, £149 and £349 a
month, with annual plans; a 14-day card-required trial on the £149 plan; pause or cancel at any time.

Marketing. I intend to send one short introductory email, with at most two follow-ups, to incorporated UK
companies only (limited companies, LLPs and similar bodies verified against Companies House), using the
business contact address those companies gave in their own published contract award notices. Each email
identifies me, links to my privacy notice and offers a one-click opt-out. Volume is at most 400 to 500
companies a week. Sole traders, partnerships and personal email addresses are excluded. I will make no
outbound telephone calls of any kind; a prospect who wants to talk can book an online meeting. I have taken
advice that this is lawful under UK PECR (regulation 22 applies only to individual subscribers) and UK GDPR
(legitimate interests, with an Article 14 notice), and I have appointed a UK representative, [name].
[PRECONDITIONS 1–4]

Questions.
1. Does this product fall within any prohibited or restricted category – in particular "Government Services",
   "Business or investment opportunities", "Advertising Services" or "Content generation"?
2. Is lawful business-to-business email outreach of this kind compatible with the AUP and with clause 11.1 of
   the seller terms? I understand "Outbound Telemarketing" to mean telephone calls only – please confirm.
3. Does the AUP line about "the requirements for the provision of consent under the EU GDPR" apply to
   marketing that relies on legitimate interests rather than consent?
4. Is there a complaint rate, or any other marketing-related signal, at which Paddle would review or suspend
   an account, and how would I be notified?
5. Is there anything in my domain approval or website review that you would want changed before I start?
6. I may pay a referral commission (20% of subscription revenue) to independent bid consultants who introduce
   customers. Is that compatible with your terms? [PRECONDITION 6]

I am happy to share my privacy notice, legitimate-interests assessment and a sample email.

Thank you,
[Full name]
[Email] · [Postal address]
```

Что изменено относительно черновика P2 и почему:

| Изменение | Причина |
|---|---|
| Описаны открытые страницы компаний, проверка пакета с цитатами, черновики и оценка | Paddle должен одобрить реальный продукт, а не обобщённое «search, alerts and analytics» |
| Добавлены цены и разовый Bid Pass | Тип списаний влияет на проверку |
| «no outbound telephone calls… a prospect … can book an online meeting» вместо «no telephone calls» | Чтобы утверждение осталось правдой при видеовстречах по инициативе клиента |
| «No human services are sold… Support is limited to helping customers use the software» | Сопровождение первых клиентов (`04-conversation-scripts.md`) не должно выглядеть продажей услуг |
| «makes no claims about winning contracts or income» | Снимает категорию «Business or investment opportunities» |
| Вопрос 6 о реферальной комиссии | Партнёрская программа для бид-консультантов (`03-linkedin-and-communities.md`) |

Пока ответа нет — считать одобрение Paddle условием запуска рассылки (пункт 1 чек-листа P2) и держать запасной
платёжный вариант (R3 §6: ссылка на оплату plata by mono, иностранные карты под 2% — как временная мера).

---

## 7. Вопросы юристу (один час)

Первые девять — из P2 §10; 10–15 появились при подготовке материалов.

1. Применяется ли UK GDPR Art. 3(2)(a) и недоступно ли исключение Art. 27(2)(a); проверить мандат представителя.
2. Подтвердить фильтр корпоративных абонентов: `LP`/`NL`, благотворительные организации и общества без номера Companies
   House, зарубежные компании, сотрудники компаний с адресами на бесплатной почте.
3. Проверить LIA (раздел 1) и текст по ст. 14 (раздел 2), включая достаточность короткого уведомления в письме плюс ссылки.
4. Обязан ли контролёр без присутствия в Великобритании платить сбор ICO и как пройти регистрацию с неанглийским адресом.
5. Нужно ли разрешение Cabinet Office, если ссылки на уведомления Find a Tender окажутся внутри платного продукта.
6. Есть ли вопрос права на базу данных при извлечении полей с персональными данными, которые OGL не покрывает.
7. Механизм передачи данных обработчикам вне Великобритании; условия договоров с обработчиками.
8. Требует ли какое-либо правило раскрытия торговой информации почтового адреса в самом письме для не-британского ИП.
9. Распространяется ли PECR reg. 6 (хранение и доступ) на коды в ссылках.
10. **LinkedIn.** ICO считает личные сообщения в соцсетях «электронной почтой», а пользователей профессиональных сетей —
    действующими в личном качестве (руководство B2B marketing, прочитано 13.11.2026). Является ли «прямым маркетингом»
    приглашение без упоминания продукта и вопрос исследовательского характера? Где граница с «sugging»?
11. **Формы обратной связи на сайтах компаний.** Подпадают ли сообщения через форму зарегистрированной компании под
    PECR reg. 22–23; достаточно ли идентификации и строки отказа.
12. Допустимо ли хранить в журнале отправок хеш удалённого именного адреса 24 месяца.
13. Достаточно ли ссылки отказа и ответа «stop» при ручной отправке без заголовков `List-Unsubscribe`.
14. Точный срок ответа на запросы субъектов (UK GDPR Art. 12(3) и 12A в текущей редакции).
15. Реферальная комиссия бид-консультантам: какое раскрытие клиенту консультанта требуется по правилам о вводящей в
    заблуждение рекламе между предприятиями (Regulations 2008).
