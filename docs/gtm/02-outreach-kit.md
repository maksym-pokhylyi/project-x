# 02 — Набор для рассылки победителям тендеров

Дата: 2026-11-13. Для кого: основатель. Инструкции — по-русски; всё, что увидит получатель, — на британском английском.
Обязательная база: `docs/research/round2/P2-outreach-legal-deliverability.md` (далее P2). Это не юридическая консультация;
пункт 17 чек-листа P2 (час юриста) остаётся обязательным.

> **Три правила, которые нельзя нарушать ни при каком результате кампании**
> 1. Пишем **только зарегистрированным компаниям** с подтверждённым номером Companies House и адресом на собственном домене.
>    Нет подтверждения — нет письма.
> 2. **Одно письмо и максимум два напоминания** на компанию за всё время. Любой ответ или отказ завершает цепочку.
> 3. **Никаких телефонных звонков, SMS, WhatsApp, автоматизации LinkedIn, пикселей открытия, купленных списков.**

---

## 1. Кому можно писать: фильтр в простых шагах

Источник адреса — только контакт поставщика из уведомления Find a Tender о контракте этой же компании (типы UK6 и UK7).
Уведомления UK5 (намерение прямого присуждения), UK14/UK15 (списки участников динамических рынков) и старые шотландские
уведомления в первую кампанию не берём.

| Шаг | Проверка | Проходит, если | Иначе |
|---|---|---|---|
| 1 | Правовая форма | В уведомлении есть номер Companies House (`GB-COH`), живой запрос в реестр возвращает **Active** и тип с правосубъектностью: private limited (включая by guarantee и CIC), PLC, LLP (`OC`, `SO`, `NC`), registered society, royal charter, шотландская компания (`SC`), компания Северной Ирландии (`NI`), шотландское партнёрство (`SL`) | Не писать. `LP` и `NL` (limited partnerships Англии/Уэльса и Северной Ирландии) — не писать. Зарубежные (`FC`, `BR`, `OE`) — отложить |
| 2 | Совпадение названия | Название поставщика в уведомлении совпадает с зарегистрированным (допустимы Ltd/Limited, регистр, пунктуация) | Не писать |
| 3 | Домен | Адрес на домене самой компании (совпадает с сайтом из уведомления или с сайтом компании). Не Gmail/Googlemail, Outlook, Hotmail, Live, Yahoo, iCloud, BT Internet, AOL, Sky и подобные | Не писать — даже если компания зарегистрирована |
| 4 | Подавление | Ни адрес, ни домен, ни номер компании не в списке подавления; компании ещё ни разу не писали | Не писать |
| 5 | Тип адреса | Пометить `generic` (info@, tenders@, bids@, sales@, office@, enquiries@…) или `named` (всё остальное). В боевом фильтре `generic` — только точное совпадение со списком ролевых слов; всё сомнительное — `named`. Имя контактного лица из уведомления **не сохранять** | — |
| 6 | Свежесть | Адрес проверен сервисом верификации на этой неделе. Для `named`: первое письмо не позже чем через месяц после загрузки адреса в базу (цель — до 7 дней) | Старше месяца — удалить именной адрес, не писать |
| 7 | Сегмент | `scale = sme`, адрес в Великобритании, отрасль и заказчик из текущего сегмента (раздел 2) | Отложить до расширения сегмента |
| 8 | Ручной взгляд перед отправкой | Открыть страницу компании: контракты привязаны по номеру Companies House; название, заказчик и сумма в письме совпадают со страницей; сумма не «потолок» рамочного соглашения и не заглушка; предмет контракта не касается конкретного человека (например, размещение одного подопечного); для варианта C совпадение тендера правдоподобно по профилю и географии | Исправить письмо или пропустить компанию |

Измерено на локальной выгрузке (6 полных недель, 02.10–12.11.2026, 14 145 релизов; метод — в разделе 2): из 6 554 уникальных
МСП-поставщиков в уведомлениях о присуждении 2 929 (45%) не имеют номера Companies House — им писать нельзя; 113 компаний с
номером указали бесплатный почтовый адрес — тоже нельзя. Шаги 1–3 в части живого статуса, названия и домена локально
проверить нельзя: это делает админ-инструмент при формировании списка.

---

## 2. Размер сегментов (посчитано по локальным данным)

**Метод.** Пересчёт: `python3 -I docs/gtm/tools/gtm_stats.py` (печатает только счётчики, адресов и имён не выводит).
Файлы `/home/user/data/fts/raw/2026-10-02_…` — `2026-11-06_2026-11-13.jsonl.gz`. Берутся релизы типов UK5/UK6/UK7 и
старые award-уведомления; стороны с ролью `supplier`, `details.scale = sme`, идентификатор `GB-COH`, приведённый к 8 знакам,
без префиксов `LP`/`NL`/зарубежных; страна `GB`; e-mail не на бесплатном домене. Компания считается один раз (по номеру).
«Общий ящик» — локальная часть адреса из списка ролевых слов или с ролевым началом/окончанием (эвристика для оценки
размера, не для отправки); всё остальное — «именной». Отрасль — по CPV контракта:
строительство и обслуживание = разделы 45 и 50; клининг и FM = разделы 90, 77, код 79993, группа 797; уход = раздел 85.
«Совет» — заказчик, в названии которого есть council / borough / county / cyngor / combined authority (без школ, NHS, полиции,
жилищных ассоциаций). Это верхняя оценка: живые проверки реестра и домена уберут ещё часть (доля неизвестна).
Ограничение «только UK6 и UK7» из раздела 1 уменьшает числа примерно на 2% (3 221 из 3 289 за 6 недель).

| Сегмент | За 6 недель | За 21 день | За 14 дней | За 7 дней |
|---|---|---|---|---|
| Все компании, прошедшие офлайн-часть фильтра | 3 289 (1 818 общих / 1 471 именных) | 1 674 (958 / 716) | 1 119 (648 / 471) | 507 (298 / 209) |
| **Первый сегмент: советы × три отрасли** | **1 022 (566 / 456)** | **595 (340 / 255)** | **471 (271 / 200)** | **204 (130 / 74)** |
| — строительство и обслуживание × совет | 583 (338 / 245) | 326 (201 / 125) | 265 (164 / 101) | 144 (98 / 46) |
| — уход × совет | 380 (193 / 187) | 234 (117 / 117) | 185 (93 / 92) | 53 (26 / 27) |
| — клининг и FM × совет | 94 (53 / 41) | 40 (25 / 15) | 26 (17 / 9) | 7 (6 / 1) |
| Три отрасли × любой местный/региональный заказчик (sub-central) | 1 413 (790 / 623) | 776 (439 / 337) | 565 (323 / 242) | 247 (151 / 96) |
| Три отрасли × любой заказчик | 1 730 (969 / 761) | 900 (510 / 390) | 640 (367 / 273) | 274 (167 / 107) |

Пополнение: в каждой из последних пяти недель появлялось 359–555 компаний, которых не было в предыдущих неделях окна
(из них 221–314 с общим ящиком).

**Что из этого следует для теста 400 писем (только общие ящики, как в DECISION.md §6):**

- За 14 дней в первом сегменте всего 271 общий ящик — на 400 писем не хватает. Берём окно **21 день** (340) и добираем
  до 400 из «три отрасли × sub-central» (439 за 21 день); если после живых проверок всё равно не хватает — из «три
  отрасли × любой заказчик» (510). Для общих ящиков правило «один месяц» не действует.
- После живых проверок список сократится. Формируй его с запасом ~20% (ДОПУЩЕНИЕ) и отправляй самые свежие уведомления первыми.
- Клининг и FM у советов — маленький поток (94 компании за 6 недель, около 16 в неделю; 7 за последнюю). Не жди от него
  отдельной статистики; считай его частью общего теста.
- Именные адреса — отдельная ветка со второй недели (раздел 9), до 100 писем, чтобы сравнить с общими ящиками (P2 §6.7).

---

## 3. Техника отправки

| Параметр | Значение | Основание |
|---|---|---|
| Отправитель | `Имя Фамилия <имя@домен-рассылки>` — реальный человек, реальный ящик, который читается каждый день | P2 §7.4 |
| Домены | Отдельные домены рассылки (`getbidfolio.co.uk`, `bidfolio-mail.co.uk`), возраст ≥ 4 недель, SPF + DKIM + DMARC; с основного домена холодные письма не уходят никогда | P2 §6.5 |
| Формат | Простой текст, одна ссылка в теле (страница компании на `bidfolio.co.uk`), без картинок, вложений, сокращателей ссылок и **без пикселя открытия** | P2 §6.7 |
| Объём | Тестовая неделя: 4 ящика, 10 → 15 → 20 → 25 → 30 писем на ящик в день (40 + 60 + 80 + 100 + 120 = 400). Дальше 20–25 на ящик в день, включая напоминания | P2 §6.6–6.7 |
| Время | Вторник–четверг 08:30–11:30 и 13:30–16:00 по Лондону (Киев минус 2 часа); в понедельник — после 13:30, в пятницу — до 11:30; не слать 20 декабря — 3 января и в банковские праздники | P2 §6.8 |
| Ручная отправка | Каждое письмо открыть, сверить со страницей компании, отправить отдельно, с интервалом в несколько минут | P2 §6.7 |
| Заголовки | При отправке через инструмент рассылки: `List-Unsubscribe` (ссылка и mailto) и `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. При ручной отправке из веб-интерфейса почты добавить заголовки нельзя — работает ссылка в подписи и ответ «stop» | P2 §7.4, §8 п. 8 |
| Ссылка | `{{page_url}}` = `https://bidfolio.co.uk/suppliers/{slug}?c={код}`; код для общего ящика привязан к компании, не к человеку | P2 §1.2 |

---

## 4. Темы письма (5 честных вариантов)

Правила: без «Re:» и «Fwd:», без слов *notice, notification, official, action required*; из темы понятно, что пишет компания.

1. `{{company}}: your public contract awards on one page (from Bidfolio)`
2. `A page about {{company}}'s public contracts – Bidfolio`
3. `{{company}} and {{buyer}}: your award, and similar open tenders (Bidfolio)`
4. `Open tenders like the {{buyer}} contract – a free page from Bidfolio`
5. `{{live_buyer}} tender closing {{deadline_short}} – could {{company_short}} bid? (Bidfolio)` — только для варианта C

Тест на первой неделе: темы 1 и 3 поровну; метку темы писать в журнал.

---

## 5. Первое письмо — три варианта

Поля: `{{company}}` (зарегистрированное название), `{{company_short}}` (то же без Limited/Ltd/CIC — для второго упоминания),
`{{award_title}}`, `{{buyer}}`, `{{value}}`, `{{notice_date}}`, `{{page_url}}`, `{{live_buyer}}`, `{{live_tender_title}}`,
`{{deadline}}`, `{{sender_first_name}}`.

Правила подстановки:
- `{{value}}` — как в уведомлении, с пометкой: `£175,000 including VAT`, если указана только сумма с НДС; `£370,000`, если
  указана нетто-сумма. Если суммы нет, она меньше £1 000, больше £100 млн или это рамочное соглашение — убрать скобки целиком.
- `{{award_title}}` длиннее 12 слов — сократить до осмысленного начала и поставить «…».
- `{{notice_date}}` и `{{deadline}}` — в формате `3 November 2026`, `12:00 on 4 December 2026`.
- Формулировка «is named as the supplier» верна и для решения о присуждении (UK6), и для подписанного контракта (UK7).
  Не писать «you won», «congratulations», «your contract is at risk» и ничего, чего нет в уведомлении.

### Вариант A — общий ящик (91 слово с полями)

```
Hello,

{{company}} is named as the supplier on "{{award_title}}" for {{buyer}} ({{value}}), in a contract notice
published on Find a Tender on {{notice_date}}.

I run Bidfolio, a paid software service for small firms that bid for public contracts. I have put
{{company_short}}'s published awards, similar open tenders and the buyers who award this kind of work without
a tender on one page – free to read, no sign-in:

{{page_url}}

Is it useful to whoever handles tenders at {{company_short}}? If not, a one-word reply is enough and I will
not write again.

{{sender_first_name}}
```

### Вариант B — именной адрес, со строкой по статье 14 (107 слов с полями)

Обращение по имени не используется: имя не хранится. Под письмом — подпись с полным абзацем о данных (раздел 7, блок D).

```
Hello,

I am writing to this address because the public notice for "{{award_title}}" ({{buyer}}, {{value}};
Find a Tender, {{notice_date}}) gives it as the supplier contact for {{company}}.

I run Bidfolio, a paid software service for small firms that bid for public contracts. I have put
{{company_short}}'s published awards, similar open tenders and the buyers who award this kind of work without
a tender on one page – free to read, no sign-in:

{{page_url}}

That notice is my only source for your address. I use it for this message and at most two reminders. You can
object at any time: reply "stop" and I will not write again.

{{sender_first_name}}
```

### Вариант C — есть подходящий открытый тендер (94 слова с полями)

Использовать, только если до дедлайна осталось не меньше 10 дней на момент отправки и совпадение проверено глазами (шаг 8).

```
Hello,

{{live_buyer}} has an open tender, "{{live_tender_title}}", closing {{deadline}}. It looks close to
"{{award_title}}", the {{buyer}} contract on which {{company}} is named as supplier (Find a Tender,
{{notice_date}}).

I run Bidfolio, a paid software service for small firms that bid for public contracts. This page lists that
tender, similar ones and {{company_short}}'s published awards – free to read, no sign-in:

{{page_url}}

If you download the tender pack, the first check is free: every pass/fail requirement, deadline and scored
question, quoted from the buyer's documents with file and page.

Worth a look before the deadline?

{{sender_first_name}}
```

Число слов посчитано по шаблонам (`wc -w`). С реальными названиями письма выходят на 113–122 слова (раздел 10) —
в пределах «около 80–120» из P2 §6.7; для этого и нужны `{{company_short}}` и сокращение длинных заголовков.

---

## 6. Два напоминания

Оба — ответом в той же цепочке, с той же подписью (блоки A–C и E из раздела 7; блок D повторять не обязательно).

### Напоминание 1 — через 3–4 рабочих дня (50 слов)

```
Hello again,

A short reminder about the page I built from {{company}}'s published contract awards: {{page_url}}

It shows similar open tenders and which buyers award this kind of work without a tender. It is free and needs
no sign-in. If someone else looks after tenders, please pass it on.

{{sender_first_name}}
```

### Напоминание 2 — через 7–10 рабочих дней после первого письма, последнее (58 слов)

```
Hello,

This is my last note. {{company}}'s page stays free at {{page_url}} and updates as new notices are published.

If a tender pack lands on your desk, the first check of it is free: what would get a bid rejected, quoted from
the buyer's documents with file and page. I will not email again unless you reply.

{{sender_first_name}}
```

По умолчанию отправляется только напоминание 1 (рекомендация P2 §6.4). Напоминание 2 — тест на половине первой когорты;
оставить, только если оно даёт заявки на страницу и не поднимает долю отказов выше порога из раздела 12.

---

## 7. Обязательная подпись

Вставляется под каждым письмом. Квадратные скобки заполняются один раз; блок D — только для именных адресов.

```
--
[First name Last name], Bidfolio – bidfolio.co.uk

A. Bidfolio is operated by [Full legal name], a sole proprietor registered in Ukraine
   ([state register entry / tax number]). [Postal address where post is received].
   Contact: [monitored email address].
   UK data-protection representative: [Representative's name, UK address].
   [ICO registration number: ZB…]

B. To stop these emails, reply "stop" or use this link: {{optout_url}}
   You have the right to object to marketing from us at any time. We will not contact {{company}} again.

C. Privacy notice: https://bidfolio.co.uk/privacy#outreach

D. Where we got your details: this address appears as the supplier contact in the public contract notice
   mentioned above (Find a Tender, published under the Open Government Licence v3.0). We use it only to send
   this message and at most two follow-ups, on the basis of our legitimate interest in telling suppliers about
   our service, and delete it after 90 days if you do not reply. Your rights and how to complain are in the
   privacy notice linked above.

E. Bidfolio is an independent commercial service. It is not affiliated with the UK Government, the Cabinet
   Office or Find a Tender. Contains public sector information licensed under the Open Government Licence v3.0.
```

Буквы A–E — только разметка для тебя, в письме их нет. Что обязательно и почему (P2 §7.1–7.2):

| Блок | Обязателен | Основание |
|---|---|---|
| A: настоящее имя, статус, страна, контакт | Да | PECR reg. 23(a): личность отправителя не скрыта; ст. 14(1)(a) |
| A: почтовый адрес | Прямо не требуется в письме, но ставим | Ответ на «кто это?»; обязателен в США и Канаде, если пойдём туда |
| A: представитель в Великобритании | Да — в уведомлении о конфиденциальности; в письме желательно | Ст. 14(1)(a), ст. 27 UK GDPR |
| A: номер ICO | По желанию | Знак доверия |
| B: отказ ответом и по ссылке, отдельным абзацем | Да | PECR reg. 23(b); ст. 21(4) UK GDPR |
| C: ссылка на уведомление | Для именных — да; для общих безвредна | Ст. 14 |
| D: источник, цель, основание, срок хранения | Для именных — да | Ст. 14(1)–(2) |
| E: независимость и атрибуция OGL | Да | OGL v3.0; условия Find a Tender |

**Пока не заполнены настоящие реквизиты, представитель не назначен и страница `/privacy#outreach` не опубликована —
ни одно письмо не отправляется.**

---

## 8. Ответы на входящие (готовые тексты)

Правило: ответить в течение одного рабочего дня. Любой ответ останавливает напоминания этой компании. На ответ отвечаем из
того же ящика, по-человечески, без шаблонного тона. Телефон не предлагаем и сами не звоним; разговор — только видеовстреча,
которую человек бронирует сам по ссылке.

**«Интересно» / «расскажите подробнее»**

```
Thanks for coming back to me.

The quickest way to judge it is on a real tender. If you have a tender pack you are considering, upload it at
https://bidfolio.co.uk/free-bid-check and in a few minutes you get a list of every pass/fail requirement,
deadline and scored question, each quoted from the buyer's documents with file and page. The first check is
free and needs no card. A public sample is at https://bidfolio.co.uk/sample-check if you would rather look
before uploading anything.

If you would like me to walk through it with you, pick a 20-minute slot here: {{booking_link}}

{{sender_first_name}}
```

**«Кто вы такие?» / «Это официальное письмо?» / «Откуда у вас наш адрес?»**

```
Fair question.

I am {{sender_full_name}}, a software developer based in Ukraine, and Bidfolio is my own product. It is a
commercial service and has no connection with the Government or with Find a Tender. I found {{company}} in
the contract notice for "{{award_title}}", which {{buyer}} published on Find a Tender; the notice gives this
address as the supplier contact. The data is published under the Open Government Licence.

The legal details are in the signature below. Payments, if you ever make one, go through Paddle, a company
registered in England, and you can cancel in two clicks.

If you would rather not hear from me, say so and I will remove {{company}} today.

{{sender_first_name}}
```

**«Удалите нас» / «stop» / «unsubscribe»**

```
Done. I have removed {{company}} from my list and will not contact you again.

Would you also like the public page about {{company}} taken down? Reply "remove the page" and it will be gone
within five working days.

{{sender_first_name}}
```

После этого: адрес и весь домен — в список подавления в тот же день; для именного адреса — удалить адрес из таблицы адресатов,
оставить запись подавления. Больше этой компании не писать, включая «уточняющие» письма.

**«У нас уже есть X» (Stotles, BidScout, Tenders Direct, консультант, ChatGPT)**

```
That makes sense, and I would not suggest dropping something that works.

Two things cost nothing alongside it. The page stays free and shows which buyers award your kind of work
without a tender. And the first check of a tender pack is free: use it as a second pair of eyes on your next
bid. If it finds nothing {{their_tool}} missed, you have lost ten minutes.

{{sender_first_name}}
```

**«Сколько это стоит?»**

```
The page, the weekly digest and your first tender-pack check are free.

After that:
- Bid Pass: £99, one-off, for one full bid (check, question matrix, first drafts from your own documents,
  scoring against the tender's criteria, Word export). No subscription.
- Radar Pro: £29 a month for the full radar, daily alerts, watchlists and one check a month.
- Bid Desk: £149 a month for three full bids a month. Unused bids roll over for one month, there are three
  seats, a 14-day trial, and you can pause or cancel in two clicks.
- Bid Desk Plus: £349 a month for ten bids, ten seats and separate client workspaces.

Prices exclude VAT. Paddle takes the payment and sends the VAT invoice. If you bid a few times a year, the
Bid Pass is the sensible one.

{{sender_first_name}}
```

**«Это не ко мне»**

```
Thank you. Could you forward my note to whoever handles tenders at {{company}}? I will not write to you again.

{{sender_first_name}}
```

Новый адрес, который человек назвал сам, использовать нельзя, пока этот человек не написал первым: это уже не адрес из
уведомления. Жди пересланного письма.

**Враждебный ответ или жалоба** (обвинение в спаме, угроза пожаловаться, упоминание ICO или Paddle)

```
I am sorry this was unwelcome. I have removed {{company}} and you will not hear from me again.

For the record: I wrote because {{company}} is named, with this address, in a public contract notice on
Find a Tender, and UK rules allow business-to-business email to companies. If you would like to make a formal
complaint, the form is at https://bidfolio.co.uk/complaints and I will acknowledge it within 30 days.

{{sender_first_name}}
```

Затем: остановить **всю** отправку до разбора (раздел 12), записать случай в журнал жалоб (`07-compliance-pack.md`, раздел 4).

**Автоответ / «в отпуске»:** не отвечать, напоминание 1 сдвинуть на дату возвращения + 2 рабочих дня.

---

## 9. Порядок кампании

| Этап | Кому | Вариант письма | Объём |
|---|---|---|---|
| Тестовая неделя | Общие ящики, первый сегмент, окно 21 день | A; там, где есть проверенное совпадение с открытым тендером (дедлайн ≥ 10 дней), — C | 400 |
| Неделя 2 | Напоминание 1 первой когорте; новые общие ящики | A/C | ~360 напоминаний + ~140 новых |
| Неделя 2–3 | Ветка именных адресов (только после назначения представителя, LIA и проверки юриста) | B | до 100, с меткой `named` |
| Неделя 3 | Напоминание 2 — половине первой когорты (тест) | — | ~170 |
| Дальше | Сравнить `generic` и `named` по заявкам на страницу и отказам. Если именные не дают явно больше — отказаться от них (P2 §6.7): это снимает основную нагрузку по UK GDPR | — | — |

---

## 10. Три разобранных примера на реальных победителях

Факты взяты из локальной выгрузки (уведомления о подписанных контрактах, UK7). Статус в Companies House проверен прямым
запросом 13.11.2026: все три — **Active, private limited company**. Адреса и имена контактных лиц здесь не приводятся:
реальный список с адресами формирует админ-инструмент. К моменту первой отправки окно сдвинется, поэтому это образцы,
а не готовые к отправке письма. Ссылка на страницу показана условно (`{slug}` и код задаёт приложение).

### Пример 1 — вариант A (общий ящик): строительство и обслуживание, совет

| Факт | Значение |
|---|---|
| Компания | HINCKLEY PLUMBING AND HEATING SERVICES LIMITED, № 05595153, Хинкли (Лестершир), МСП |
| Уведомление | 103985-2026, опубликовано 3 ноября 2026 |
| Заказчик | Bassetlaw District Council |
| Контракт | «Larwood House - Pre-Packaged Gas Boiler Plant Room», £175 000 с НДС (нетто не указано), 17.10.2026–16.10.2027 |
| Процедура | Below threshold – open competition (компания подавала заявку в открытом конкурсе — целевой профиль) |
| Адрес в уведомлении | Общий ящик на домене сайта компании (не приводится) |

```
Subject: Hinckley Plumbing and Heating Services Limited: your public contract awards on one page (from Bidfolio)

Hello,

Hinckley Plumbing and Heating Services Limited is named as the supplier on "Larwood House - Pre-Packaged Gas
Boiler Plant Room" for Bassetlaw District Council (£175,000 including VAT), in a contract notice published on
Find a Tender on 3 November 2026.

I run Bidfolio, a paid software service for small firms that bid for public contracts. I have put Hinckley
Plumbing's published awards, similar open tenders and the buyers who award this kind of work without a tender
on one page – free to read, no sign-in:

https://bidfolio.co.uk/suppliers/{slug}?c={code}

Is it useful to whoever handles tenders at Hinckley Plumbing? If not, a one-word reply is enough and I will
not write again.

[Sender first name]

[Signature: blocks A, B, C, E]
```

113 слов. Перед отправкой: убедиться, что на странице есть хотя бы один похожий открытый тендер или истекающий контракт
(критерий приёмки 1 в SPEC.md); если блок пуст — убрать из письма слова «similar open tenders».

### Пример 2 — вариант B (именной адрес): уход, совет

| Факт | Значение |
|---|---|
| Компания | HOME SUPPORT MATTERS CIC, № 06879295, Норидж, МСП (community interest company — юридическое лицо) |
| Уведомление | 106891-2026, опубликовано 10 ноября 2026 |
| Заказчик | Norfolk County Council |
| Контракт | «Unplanned Rapid Response Night Sitting Service», £370 000, 01.11.2026–31.10.2027 |
| Процедура | Below threshold – without competition |
| Адрес в уведомлении | Именной, на домене сайта компании (не приводится; имя не сохраняется) |

```
Subject: A page about Home Support Matters CIC's public contracts – Bidfolio

Hello,

I am writing to this address because the public notice for "Unplanned Rapid Response Night Sitting Service"
(Norfolk County Council, £370,000; Find a Tender, 10 November 2026) gives it as the supplier contact for
Home Support Matters CIC.

I run Bidfolio, a paid software service for small firms that bid for public contracts. I have put Home Support
Matters' published awards, similar open tenders and the buyers who award this kind of work without a tender on
one page – free to read, no sign-in:

https://bidfolio.co.uk/suppliers/{slug}?c={code}

That notice is my only source for your address. I use it for this message and at most two reminders. You can
object at any time: reply "stop" and I will not write again.

[Sender first name]

[Signature: blocks A, B, C, D, E]
```

123 слова. Отправлять только после назначения представителя и подписания LIA. Правило одного месяца: этот адрес попал в
выгрузку 10–13 ноября 2026; если ветка именных писем стартует позже 10 декабря, это уведомление в неё не берётся, а адрес
удаляется — пример остаётся образцом текста.

### Пример 3 — вариант C (открытый тендер): кровельные работы

| Факт | Значение |
|---|---|
| Компания | JOHN FLOWERS LIMITED, № 01633007, Вашингтон (Тайн-энд-Уир), МСП |
| Уведомление о контракте | 107582-2026, опубликовано 12 ноября 2026; Newcastle City Council; «Yelverton Crescent New Build Roofing Works»; £52 459,55 с НДС; 13.11.2026–13.05.2027 |
| Открытый тендер | 102929-2026, опубликован 30 октября 2026; Lancaster City Council; «Re Roofing of Council Owned Properties 2026/27 Program»; оценка £540 000 с НДС; below threshold – open competition; дедлайн 4 декабря 2026, 12:00; документы на портале ProContract |
| Как найдено совпадение | Общий код CPV 45261210 (кровельные работы). География: северо-восток против северо-запада Англии — около 100 миль; это надо оценить глазами перед отправкой |
| Адрес в уведомлении | Общий ящик на домене сайта компании (не приводится) |

```
Subject: Lancaster City Council tender closing 4 December – could John Flowers bid? (Bidfolio)

Hello,

Lancaster City Council has an open tender, "Re Roofing of Council Owned Properties 2026/27 Program", closing
at 12:00 on 4 December 2026. It looks close to "Yelverton Crescent New Build Roofing Works", the Newcastle City
Council contract on which John Flowers Limited is named as supplier (Find a Tender, 12 November 2026).

I run Bidfolio, a paid software service for small firms that bid for public contracts. This page lists that
tender, similar ones and John Flowers' published awards – free to read, no sign-in:

https://bidfolio.co.uk/suppliers/{slug}?c={code}

If you download the tender pack, the first check is free: every pass/fail requirement, deadline and scored
question, quoted from the buyer's documents with file and page.

Worth a look before the deadline?

[Sender first name]

[Signature: blocks A, B, C, E]
```

122 слова. Перед отправкой проверить по живым данным, что тендер не отменён и не продлён (в выгрузке на 13.11 отмены нет).

---

## 11. Что записывать по каждому письму

Одна строка на письмо (таблица `outreach_prospects` или Google Sheet, пока инструмент не готов):

| Поле | Пример |
|---|---|
| Дата и время отправки (Лондон) | 2026-12-15 09:42 |
| Компания, № Companies House | … LIMITED, 05595153 |
| № уведомления-источника | 103985-2026 |
| Отрасль / тип заказчика / процедура | construction_maintenance / council / open |
| Тип адреса | generic / named |
| Ящик-отправитель | ящик 2, домен 1 |
| Версия шаблона и темы | A-v1 / S1 |
| Код ссылки | из приложения |
| Результат проверки фильтра | CH active 2026-12-14; domain match; verified 2026-12-14 |
| Затем дописывается | bounce (hard / soft / block + текст); ответ (positive / neutral / negative / auto); отказ; жалоба; визит страницы (дата); заявка на страницу; загруженный пакет; оплата |

Адрес именного получателя через 90 дней после последнего письма без ответа удаляется; в журнале остаются компания,
№ уведомления, хеш адреса, даты и версия шаблона (см. `07-compliance-pack.md`, раздел 3).

---

## 12. Правила остановки

| Сигнал | Порог | Действие |
|---|---|---|
| Жёсткие возвраты (hard bounce) | больше 3% за любой день | Остановить отправку; перепроверить список верификатором; старые уведомления исключить |
| Отказы + враждебные ответы | больше 5% от отправленных | Остановить; пересмотреть сегмент и текст до продолжения |
| Текст возврата «reported as spam», «blocked», 5.7.x; тестовое письмо на свои ящики Microsoft 365 / Google Workspace попало в спам | один раз | Остановить этот ящик на день; найти причину; не повышать объём |
| Жалоба с упоминанием ICO, Information Commission или Paddle | одна | **Остановить всё.** Разбор по `07-compliance-pack.md`, раздел 4; возобновлять только после записи о причинах |
| Жалобы за тест 400 писем | больше 2 | Критерий успеха DECISION.md §6 не выполнен — пауза и разбор |
| Письмо ушло ИП, партнёрству или на личный адрес | одно | Остановить; исправить фильтр; запись в журнал инцидентов; адрес в подавление |
| Ответ любого содержания | — | Цепочка для компании закончена |
| «Удалите нас» | — | Подавление всего домена в тот же день |
| Письма без ответа после напоминания 2 | — | Больше никогда не писать этой компании холодные письма |

Что считается хорошим результатом тестовой недели и что делать при каждом исходе — `05-first-30-days.md`, раздел 6.
