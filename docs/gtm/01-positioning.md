# 01 — Позиционирование Bidfolio

Дата: 2026-11-13. Пояснения для основателя — по-русски; всё, что читает или слышит британский клиент, — по-английски
(блоки с пометкой **EN**). Источники: P1 (`round2/P1-uk-tender-tools-competitors-voc.md`), P2, DECISION.md, SPEC.md,
ECONOMICS.md, локальная выгрузка Find a Tender за 02.10–12.11.2026.

> **Суть в трёх строках.** Ведём проверкой пакета с цитатами («Can we bid, and what would get us thrown out?»), а не
> «AI пишет заявки». Второе отличие — открытая страница компании с заказчиками, которые покупают без тендера.
> Главное возражение — доверие; на него отвечает каждый материал. Побед не обещаем нигде.

---

## 1. Идеальный клиент (ICP)

**Первый сегмент.** Зарегистрированная британская компания на 5–250 человек, которая поставляет **советам** (councils)
в одной из трёх отраслей: строительство и обслуживание зданий, клининг и facilities, социальный уход. Недавно названа
поставщиком в уведомлении Find a Tender. Заявки готовит владелец, директор или один координатор, без отдела.

**Второй сегмент и реферальный канал.** Фрилансеры и небольшие бюро по написанию заявок (сообщество APMP UK).

| Признак | Подходит | Откуда видно |
|---|---|---|
| Правовая форма | Ltd, PLC, LLP, CIC с активным статусом в Companies House | Номер `GB-COH` в уведомлении + реестр |
| Размер | Флаг `sme` в уведомлении | Данные Find a Tender |
| Заказчик | Совет (county, district, borough, unitary, town/parish) | Название заказчика |
| Отрасль | CPV 45, 50 (строительство и обслуживание); 90, 77, 79993, 797 (клининг, территории, FM, охрана); 85 (уход) | CPV контракта |
| Способ победы | Открытый конкурс или приглашение к котировке — значит, компания умеет и готова писать заявки | Поле процедуры |
| Частота | От 4 заявок в год (для подписки); 1–3 в год — покупатель Bid Pass | Вопрос на звонке (в данных этого нет) |
| Триггер | Открытый тендер с дедлайном через 2–4 недели; проигранная заявка; у конкурента заканчивается контракт | Радар; разговор |
| Сумма контракта | £30k–£1m (медиана контрактов МСП у советов: строительство ~£107k, клининг/FM ~£101k, уход ~£220k) | Локальные данные, UK7 |

**Не подходит (не тратить время):**

| Признак | Почему |
|---|---|
| ИП, партнёрство, нет номера Companies House | Писать им нельзя (PECR); страницу не создаём |
| Адрес на Gmail/Outlook/Yahoo и т.п. | Писать нельзя, даже если это Ltd |
| Крупная компания (`scale = large`) или своя команда заявок 5+ человек | Им нужны совместная работа, интеграции, ISO 27001 — у mytender.io, AutogenAI, Stotles |
| Контракты только как вызовы из рамочных соглашений по цене (call-off без письменной части) | Нечего проверять и писать |
| Только прямые присуждения, заявок не пишут и не хотят | Им полезна бесплатная страница, но платить не за что |
| Школы, NHS-трасты, центральное правительство как единственные заказчики | Не первый сегмент; вернуться после 3 месяцев |
| Шотландские закупки (Public Contracts Scotland) | Вне данных v1 |
| Хотят, чтобы заявку написали за них | Это услуга консультанта; мы её не продаём (и Paddle запрещает) |
| Тендерный пакет под обязательством о неразглашении, запрещающим сторонние инструменты | Честно советуем не загружать |

**Сколько их.** За 6 недель в уведомлениях о присуждении — 1 022 компании первого сегмента, прошедшие офлайн-часть фильтра
(566 с общим ящиком, 456 с именным); в среднем ~170 новых в неделю. Советы за те же 6 недель опубликовали 508 новых
тендеров в трёх отраслях (~85 в неделю): строительство и обслуживание 267, уход 160, клининг и FM 103. Метод —
`02-outreach-kit.md`, раздел 2.

---

## 2. Пять главных задач и болей — словами клиентов

Цитаты дословные (с опечатками оригинала), из открытых источников, собранных в P1 §3.

| № | Задача / боль | Слова клиента | Источник |
|---|---|---|---|
| 1 | **«Можем ли мы вообще участвовать и за что нас выкинут?»** Пороги и формальные требования pass/fail | "… the number I have seen, even from large companies, that were incomplete, did not enclose crucial documents, were badly laid out etc was alarming. We never went looking for information or made assumptions, if it was not there they were rejected." — бывший оценщик местного совета, июнь 2010 | https://www.ukbusinessforums.co.uk/threads/how-easy-is-it-to-win-public-sector-contracts.158136/ |
| | | 43% малых фирм называют требования к участникам необоснованными (опрос FSB, декабрь 2025, в пересказе FMJ) | https://www.fmj.co.uk/bids-from-small-firms-keep-disappearing-into-a-black-hole-says-fsb/ |
| 2 | **Дни работы на одну заявку — и тишина в ответ** | "I'm no neanderthal when it comes to paperwork but the sheer amount needed to submit seems immense. I can either spend a good few days on this or seek out the services of someone who specialises in this and can break down the jargon for me!" — небольшой строительный подрядчик, июль 2021 | https://www.ukbusinessforums.co.uk/threads/tender-quote-for-local-authority-works.413972/ |
| | | "Instead of feeling like an open opportunity, it can feel like a soul-destroying maze of portals, forms, and silence." — Tina McKenzie, FSB policy chair, декабрь 2025. По тому же опросу заявка занимает в среднем пять дней, 31% участников ничего не выиграли за три года | https://www.fmj.co.uk/bids-from-small-firms-keep-disappearing-into-a-black-hole-says-fsb/ |
| 3 | **Каждый раз заново собирать одно и то же** | "Compulsory diversity questionnaires, filling in infinite bits of info that are just not quickly at hand for a small company" — поставщик ПО, январь 2022 | https://www.ukbusinessforums.co.uk/threads/have-you-ever-bid-for-a-government-contract.416529/ |
| 4 | **Найти своё среди невнятных объявлений** | "Bidding takes time, which needs to be priced into the work … Tenders are often poorly written, with errors and missing info, which can cause indexing problems and difficulty for potential bidders to identify tenders that are relevant to them." — консультант, январь 2022 | https://www.ukbusinessforums.co.uk/threads/have-you-ever-bid-for-a-government-contract.416529/ |
| | | "Forget all that website stuff they are just lists. Get a strategy together to approach your target organisations directly" — владелец курьерской компании, май 2025 | https://www.ukbusinessforums.co.uk/threads/does-anyone-know-how-to-bid-for-contracts.429259/ |
| 5 | **Не платить «ни за что»: недоверие к платным сервисам и цена помощи** | "There is a huge diffeence between paying th costs of tendering for a real contract and paying some conman a monthly fee for nothing." — модератор форума, май 2025 | https://www.ukbusinessforums.co.uk/threads/does-anyone-know-how-to-bid-for-contracts.429259/ |
| | | "For anyone interested I had a rough estimate to prepare the tender. I had already decided not to tender at this point but asked one of the companies out of interest for a ballpark. 4.5k." — тот же подрядчик, август 2021 | https://www.ukbusinessforums.co.uk/threads/tender-quote-for-local-authority-works.413972/ |

Оговорки, которые надо помнить: (а) отчёт FSB в оригинале открыть не удалось — цифры по двум отраслевым публикациям (P1 §1);
(б) форумные цитаты 2010–2016 годов — иллюстрация, не измерение; (в) свежих высказываний МСП об AI-инструментах для заявок
P1 не нашёл — это главный вопрос для звонков (`04-conversation-scripts.md`); (г) неизвестно, сколько заявок в год подаёт
активный малый поставщик — спросить первым.

---

## 3. Позиционирование

**EN — positioning statement (внутренняя формула, из неё пишутся все тексты)**

> For small UK firms that bid for council contracts – builders and maintenance contractors, cleaning and facilities
> firms, care providers – Bidfolio is a bid desk that answers one question before you spend days on a tender:
> **can we bid, and what would get us thrown out?** Every pass/fail requirement, deadline and scored question is
> quoted from the buyer's own documents, with the file and page, so you can check it in minutes. Unlike tender-alert
> services and AI bid writers, the check shows its sources, your company's page is open without signing in, and you
> can pay £99 for one bid instead of taking a subscription. We do not promise wins; we cut wasted bids and missed
> requirements.

**EN — one-liner:** *Bidfolio checks a tender pack against the buyer's own words: can you bid, and what would get you thrown out.*

**EN — landing hero (вариант для главной страницы и `/free-bid-check`)**

```
Can we bid – and what would get us thrown out?

Upload the tender pack. In a few minutes Bidfolio lists every pass/fail requirement, deadline and scored
question, each quoted from the buyer's documents with the file and page. Your first check is free.

[Check a tender pack – free]     [See a sample check]

No card for the free check · Files stored in the EU · Deleted when you ask · Not a government service
```

**EN — три подзаголовка под hero**

1. **Every line shows its source.** Each requirement comes with the exact quote, file and page. Anything we could not
   confirm is marked "verify in documents".
2. **Your company's page is already built – and open.** Your published awards, open tenders like them, and the councils
   that buy your kind of work without a tender. No sign-in.
3. **Pay for one bid, or subscribe – your choice.** £99 for one full bid. £149 a month if you bid regularly: three bids,
   unused ones roll over, pause or cancel in two clicks.

**Чего не говорим первым:** черновики ответов и «оценку глазами оценщика». Они есть и упоминаются, но это ожидаемый минимум:
их заявляют минимум семь продуктов (P1 §6.1).

---

## 4. Ценность по персонам

### Владелец / директор (решает и платит)

**EN**
- *Before you give up a week:* see in minutes whether you meet the insurance, turnover, accreditation and experience
  thresholds – each one quoted from the pack.
- *Know where the work is:* the councils that award your kind of work without a tender, and competitors' contracts
  with their published end dates.
- *No monthly fee for nothing:* the page and first check are free; one bid is £99; there is no minimum term.
- *You stay in control:* drafts use only your own documents; anything unproven is marked `[EVIDENCE NEEDED]`, not made up.

Чем измеряет: сэкономленные дни, отсутствие дисквалификации, понятный счёт. Чего боится: мошенников, автопродления, утечки пакета.

### Координатор заявок / BD-менеджер (делает руками)

**EN**
- *A compliance matrix in minutes, not an afternoon:* every scored question with its weight, word or page limit and
  instructions; every pass/fail item with file and page.
- *First drafts from your evidence library:* policies, case studies, past bids and certificates you upload once.
- *A marking pass before you submit:* each answer scored on the tender's own scale, with what is missing.
- *Word export* that drops into the buyer's template.

Чем измеряет: ничего не пропущено, успели к дедлайну. Чего боится: что инструмент пропустит обязательное требование.
Честный ответ: непроверенные цитаты помечены; итоговая сверка с документами остаётся за человеком.

### Фрилансер или бюро по написанию заявок (второй сегмент, партнёр)

**EN**
- *Day one of every job, done faster:* the cited requirements list and question matrix for a new client's pack.
- *One workspace per client* on Bid Desk Plus (ten bids a month, ten seats), so evidence never mixes.
- *Your judgement stays the product:* Bidfolio does the reading and the first pass; you do the strategy and the writing.
- *Refer a client and earn 20%* of what they pay, for as long as they stay. (Подробности — `03-linkedin-and-communities.md`.)

Чем измеряет: качество первого разбора на сложном пакете. Самый строгий судья — показывать только после технической
проверки точности.

---

## 5. Что можно утверждать сегодня, а что нельзя

Правило: утверждение публикуется, только когда оно буквально верно и это можно показать. Колонка «Проверить» — что
основатель должен подтвердить до публикации.

| Можно утверждать | Проверить перед публикацией |
|---|---|
| Built on the UK Government's open Find a Tender data (Open Government Licence v3.0); independent, not a government service | Строка атрибуции и независимости на каждой странице |
| Every requirement is shown with a quote, the file and the page; unverified quotes are flagged "verify in documents" | Критерий приёмки 3 в SPEC.md выполнен на реальном пакете |
| First check free, no card; public sample at `/sample-check` | Страница образца опубликована |
| Drafts use only the documents you upload; missing facts are marked `[EVIDENCE NEEDED]` | Критерий приёмки 4 |
| Public prices; £99 one-off Bid Pass; pause or cancel in two clicks; reminder before annual renewal | Работает в боевом Paddle; письмо-напоминание настроено |
| Files stored in the EU (Frankfurt); deleted on request | Регион Neon и хранилища файлов — ЕС; удаление по запросу проверено |
| We do not use your files to train AI models | Подтвердить условия провайдера моделей (режим без хранения/обучения) письменно; иначе формулировку не публиковать |
| Payments handled by Paddle (Paddle.com Market Limited, registered in England and Wales, no. 8172165) | Проверено 13.11.2026 по условиям Paddle для покупателей |
| Run by a named solo founder based in Ukraine; UK data-protection representative: [name]; ICO registration [number] | После назначения представителя и оплаты сбора |
| Факты из данных: «about 4 in 10 published contract notices were placed without competition (2 Oct–12 Nov 2026)» — с методом | Метод рядом с цифрой (`03-linkedin-and-communities.md`, раздел 3) |
| Результаты технической проверки точности на реальных пакетах | Только после появления отчёта `/home/user/spikes/bid-pack/REPORT.md`; до этого — никаких чисел точности |

| Нельзя утверждать | Почему |
|---|---|
| "Win more contracts", рост win rate, вероятность победы числом | Нечем доказать; в конкурсе в среднем ~4 участника; формулировка «business opportunity» рискованна для Paddle |
| "100% compliant", "submission-ready", "never miss a requirement" | Одно пропущенное требование опровергает |
| "Predicts your score" | Нет калибровки на реально оценённых заявках |
| "Buyers can't tell it's AI" и любой намёк на обход проверки | Заказчик вправе спросить об использовании AI (PPN 017); отвечает поставщик |
| "Official", "Find a Tender partner", гербы, стиль GOV.UK | Вводит в заблуждение; нарушает OGL и условия Find a Tender; риск для Paddle |
| "UK-based", "UK-hosted", "GDPR compliant", "ISO 27001" | Неправда или недоказуемо |
| Число клиентов, отзывы, логотипы, истории успеха | Их ещё нет. Первый отзыв — только с письменного согласия клиента |
| "Every UK tender", "all portals" | Данные v1 — Find a Tender; документы лежат на 15+ порталах, пакет загружает клиент |
| "Trusted by…", "used by X suppliers" | См. выше |
| Сравнения «мы точнее, чем BidScout» | Конкурентов не тестировали |

---

## 6. Возражения и ответы (EN — готовые тексты для сайта, писем и звонков)

Доверие — главное возражение: рынок ждёт мошенников и ловушек автопродления, а продавец — соло-основатель не из
Великобритании, который после холодного письма просит загрузить конфиденциальный пакет. Отвечаем прямо и первыми.
Фразы о хранении в ЕС, удалении, необучении моделей, представителе и напоминании о продлении публикуются только после
проверок из раздела 5; пока проверка не пройдена — соответствующее предложение из ответа убрать.

**"I just use ChatGPT."**
> Keep using it for drafting if it works for you. The gap is the reading, not the writing. A chatbot will summarise a
> 90-page pack; it will not show you, line by line, which file and page each pass/fail requirement comes from, or tell
> you plainly what it could not find. That is the part that gets bids rejected. Run your next pack through one free
> check and compare the two lists. It takes ten minutes.

**"Is this official? Are you part of Find a Tender?"**
> No. Bidfolio is an independent commercial service. It uses the contract notices that the Government publishes as open
> data on Find a Tender, under the Open Government Licence. It is not affiliated with or endorsed by the Government,
> the Cabinet Office or Find a Tender, and every notice we show links to the official original, free.

**"Is my tender pack safe with you?"**
> Your files are stored in the EU (Frankfurt), are visible only to your account, and are deleted when you ask or when
> you close your workspace. We do not use them to train AI models. To analyse a pack we send its text to our AI
> provider for processing only. Two honest caveats: read the confidentiality terms of your pack first – if they ban
> third-party tools, do not upload it; and look at the public sample check before you upload anything.

**"Are AI-assisted bids even allowed?"**
> Government guidance (PPN 017, February 2025) says: "Suppliers' use of AI is not prohibited during the commercial
> process." Buyers may ask whether you used AI and may ask you to confirm you checked the content; the guidance says
> those disclosure questions are for information and are not scored. It is written for central government and
> councils may follow it, so read each tender's own instructions. Our rule is simple: Bidfolio drafts only from your
> own documents, marks anything it cannot evidence, and you check and own what you submit. If a buyer asks, say yes.

*Абзац о раскрытии, который клиент может адаптировать, если заказчик спрашивает об AI (последнее предложение — только
после письменного подтверждения условий провайдера моделей, см. раздел 5):*

> We used an AI-assisted software tool (Bidfolio) to help analyse the tender documents and to prepare first drafts of
> some responses from our own company documents. All content was reviewed, corrected and approved by [name, role], who
> confirms that it is accurate. The tender documents were not used to train any AI model.

**"We rarely bid – a subscription makes no sense."**
> Agreed, so don't take one. Your company page and weekly digest are free. When a tender does come up, the first check
> is free and a full bid is £99, one-off. A subscription only makes sense if you bid most months.

**"You're not UK-based. Why should we trust you?"**
> I am a solo founder based in Ukraine and I say so on the site. What protects you is not my postcode: you can see a
> sample check before uploading anything; the first check on your own pack is free with no card; payment goes through
> Paddle, a company registered in England, which issues your VAT invoice and handles refunds; you can pause or cancel
> in two clicks; I have a data-protection representative in the UK, [name]; and my name and address are on every email.

**"£149 a month is a lot."**
> It is, if you bid twice a year – take the £99 Bid Pass instead. For a firm that bids monthly, compare it with what a
> bid costs you now: the FSB's 2025 survey put an average bid at five days of work, and a consultant's one-day review
> is priced at about £750. Three bids a month are included and unused ones roll over.

**"How accurate is it? What if it misses something?"**
> It can miss things, which is why every line shows its source and anything unconfirmed is marked "verify in
> documents". Treat it as a fast first read and a checklist, then check the pack yourself. You remain responsible for
> your submission. [После технической проверки: добавить измеренный результат на N реальных пакетах.]

**"Will you auto-renew me?"**
> Monthly plans renew monthly until you pause or cancel, which takes two clicks in your account. Annual plans get a
> reminder email seven days before renewal. The Bid Pass is a single payment with nothing to cancel.

**"Where did you get our details?"** — текст в `02-outreach-kit.md`, раздел 8.

---

## 7. Конкуренты одной строкой — где мы честно выигрываем и проигрываем

Всё о конкурентах — по их собственным страницам, прочитанным 13.11.2026 (P1 §2). **Продукты не тестировались**:
сравнивать можно заявленное, а не качество. В разговоре с клиентом конкурентов не ругаем.

| Конкурент | Что это (по их сайту) | Где мы честно выигрываем | Где честно проигрываем |
|---|---|---|---|
| **Stotles** | Рыночная аналитика для продаж госсектору: Free / Basic от £99 / Growth от £475; Bid Studio через демо | Понятная цена без демо; фокус на малой фирме; разовая заявка за £99; проверка с цитатами | Глубина данных (профили заказчиков, контакты, рамочные соглашения), бренд, команда, 12 отзывов на Capterra |
| **BidScout** | £49 / £149 / £499 с кредитами; поиск по «50+ источникам», AI-райтер, оценка, каталог 48 141 поставщика (детали за входом) | Страница открыта без входа; цитата и страница на каждое требование (у них не заявлено); нет кредитов; £99 за заявку | Интеграции (Slack, Teams, CRM), число источников, триал без карты, широта функций |
| **BidWriter (WinAContract)** | Free / £49 / £149 / £279; бесплатный поиск и оповещения, разбор пакета, черновики, оценка; заявляет хранение данных в UK | Проверка с цитатами как главный продукт; страница, собранная из ваших побед; перенос заявок | Вход дешевле (£49 «около одной заявки в месяц»); бесплатный поиск по 160 000+ возможностей; трекер рамочных соглашений |
| **mytender.io** | Для команд заявок; цена через демо; интеграции, ISO 27001, «240+ bid writers» | Самообслуживание и публичная цена; подходит фирме без отдела заявок | Сертификация безопасности, совместная работа, интеграции, отзывы (G2 4.6 из 11) |
| **SupplierVerse** | £199/мес при обязательстве на 12 месяцев | Нет обязательства по сроку; £99 за заявку | Ежедневный подбор с оценкой соответствия; «спроси тендер» |
| **SwiftBid** | Заявка «под ключ» за £149 / £349 / £749 (с проверкой человеком), результат через 12–24 часа | Минуты вместо суток; дешевле; вы видите источники | Вариант с проверкой человеком; готовый документ без вашей работы |
| **Наборы промптов для ChatGPT/Claude** (Bidwin £299 разово; Build My Bid Manager £600 + VAT) | Работают в аккаунте клиента; файлы остаются у него | Не нужно настраивать; цитаты проверяются программно; радар и страница | Разовая цена; файлы не покидают аккаунт клиента — сильный довод о конфиденциальности |
| **Сервисы оповещений** (Find a Tender — бесплатно; Supply2Gov — бесплатно локально, далее £25–95; Tenderbase £25–55; Tenders Direct от £1 359/год) | Поиск и уведомления | Мы не продаём оповещения как главный продукт: радар бесплатно, Pro £29; взгляд «кто покупает без тендера» | Охват (Contracts Finder, шотландские, уэльские и североирландские порталы), проверка людьми, гарантия охвата |
| **Бид-консультанты** (ревью около £750 в день; контракторы около £500 в день; заявляют win rate 81–87%) | Пишут и проверяют заявки | Цена и скорость первого разбора; доступно в день публикации тендера | Суждение, качество текста, отраслевой опыт, ответственность. Мы их не заменяем — мы их инструмент (тариф Plus) |

**EN — if a prospect asks "how are you different from BidScout / BidWriter?"**
> They cover more ground than I do – more sources, more features. I do one thing they don't put first: every
> requirement in the check is quoted from your pack with the file and page, so you can verify it instead of trusting
> it. And you can buy one bid for £99 without a subscription. Try the free check next to whatever you use now.

---

## 8. Цены: обоснование и предложение первым клиентам

| Тариф | Цена | Что входит | Почему так |
|---|---|---|---|
| Free | £0 | Страница компании, радар (топ-10), еженедельная сводка, 1 проверка пакета с цитатами | Это и есть привлечение: ценность видна до регистрации; у BidScout аналог закрыт входом |
| **Bid Pass** | £99 разово | Одна полная заявка: проверка, матрица вопросов, черновики, оценка, экспорт | Только 30% малых фирм подавали заявку совету за три года (FSB) — редким участникам подписка не нужна. Якоря: SwiftBid от £149 за заявку; ревью консультанта ~£750 в день |
| Radar Pro | £29/мес (£290/год) | Весь радар, ежедневные оповещения, списки наблюдения, экспорт, 1 проверка в месяц | Оповещения бесплатны у Find a Tender, Stotles, BidSonar и стоят от £25 у Tenderbase — £49 за них не заплатят (P1) |
| **Bid Desk** | £149/мес (£1 490/год) | 3 полные заявки в месяц, перенос неиспользованных на месяц, 3 места, пауза/отмена в два клика, триал 14 дней с картой | Та же цена, что у BidScout и BidWriter за сопоставимый уровень; отличаемся переносом, паузой и цитатами |
| Bid Desk Plus | £349/мес (£3 490/год) | 10 заявок, 10 мест, рабочие пространства клиентов | Для консультантов и компаний с отделом заявок; один сэкономленный день (~£500) окупает месяц |

Цены без НДС; НДС начисляет Paddle. Что должно подтвердиться первыми 20 продажами: доля Bid Desk (допущение базы — около трети),
доля покупателей Bid Pass, переходящих на подписку (неизвестно).

### Предложение первым клиентам (founding customers)

Без скидок: нам нужно узнать, платят ли настоящую цену. Вместо скидки — снятие риска и внимание основателя.

**EN — текст для сайта и писем**

```
Founding customers – the first 20 firms

1. Your first Bid Pass comes with a refund promise: if the full bid pack is not useful, tell me within
   14 days and you get your £99 back.
2. If you move to Bid Desk within 30 days, the £99 you paid is taken off your first month.
3. Your price is fixed for 24 months for as long as you stay subscribed.
4. A 30-minute set-up session with me, online, at a time you choose: we load your evidence and go through
   your first check together.
5. A direct line to me, and a say in which trade gets its own question pack next.

No lock-in. Pause or cancel in two clicks.
```

Что основатель должен решить и сделать, прежде чем публиковать (иначе пункт убрать):

| Пункт | Условие правдивости |
|---|---|
| 1. Возврат £99 | Прописать в Refund policy; проверить, как оформить возврат в Paddle; заложить в бюджет до 2–3 возвратов из первых 20 (ДОПУЩЕНИЕ) |
| 2. Зачёт £99 | Купон или ручная корректировка в Paddle; проверить в sandbox |
| 3. Фиксация цены | Вести список 20 клиентов; не менять им цену 24 месяца |
| 4. Сессия | Бесплатная помощь в использовании ПО, не написание заявки (иначе это «human services» для Paddle) |
| «First 20» | Счётчик настоящий; после 20-го клиента блок снять |
