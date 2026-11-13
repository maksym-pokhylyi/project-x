#!/usr/bin/env python3
"""Re-renders the scenario tables (section 5) of ECONOMICS.md from model.py. Run from the repo root:
   python3 docs/economics/render_tables.py"""
import subprocess, re, pathlib
out = subprocess.run(["python3", "docs/economics/model.py"], capture_output=True, text=True, check=True).stdout
TR = {
 "### adverse": "### Неблагоприятный сценарий", "### base": "### Базовый сценарий", "### favourable": "### Благоприятный сценарий",
 "### Summary at month 12": "### Итог на 12-й месяц",
 "### Sensitivity (base scenario, one variable at a time) — MRR at month 12": "### Чувствительность (базовый сценарий, меняется одна переменная) — MRR на 12-й месяц",
 "### What $10k MRR requires": "### Сколько клиентов нужно для $10k MRR",
 "| Month | Emails | New paying | Churned | Paying at end | MRR $ | One-off $ | Paddle $ | LLM $ | Fixed $ | Tax+ESV $ | Founder net $ |": "| Месяц | Писем | Новых платящих | Ушло | Платящих на конец | MRR $ | Разовые $ | Paddle $ | LLM $ | Пост. расходы $ | Налог+ЕСВ $ | Остаётся основателю $ |",
 "| Scenario | Paying customers | MRR $ | Founder net $/month | Cumulative founder net $ (12 mo) |": "| Сценарий | Платящих клиентов | MRR $ | Основателю $/мес | Основателю накопленно $ (12 мес) |",
 "| Variable | Value | Paying customers | MRR $ |": "| Переменная | Значение | Платящих клиентов | MRR $ |",
 "award-email funnel": "воронка писем победителям", "paying per 1,000 emails": "платящих на 1 000 писем", "monthly churn": "месячный отток",
 "Page-visit rate from award email": "Доля открывших страницу из письма", "Activated → paid": "Активированный → платящий", "Monthly churn": "Месячный отток",
 "Organic visits at month 12": "Органических визитов на 12-й месяц", "Plan mix 72/25/3 (mostly Radar)": "Микс тарифов 72/25/3 (в основном Radar)",
 "Plan mix 62/32/6 (base)": "Микс тарифов 62/32/6 (база)", "Plan mix 30/55/15 (mostly Bid Desk)": "Микс тарифов 30/55/15 (в основном Bid Desk)",
 "Emails per month 1,000": "Писем в месяц 1 000", "Emails per month 1,800 (base)": "Писем в месяц 1 800 (база)", "Emails per month 3,000 (two senders/domains)": "Писем в месяц 3 000 (два домена отправки)",
 "| adverse |": "| Неблагоприятный |", "| base |": "| Базовый |", "| favourable |": "| Благоприятный |",
 "- adverse plan mix": "- микс неблагоприятного сценария", "- base plan mix": "- микс базового сценария", "- favourable plan mix": "- микс благоприятного сценария",
 "paying customers": "платящих клиентов",
}
for k, v in TR.items(): out = out.replace(k, v)
path = pathlib.Path("docs/economics/ECONOMICS.md"); doc = path.read_text()
a = doc.index("### Неблагоприятный сценарий"); b = doc.index("## 6. Маршрут к $10k MRR")
path.write_text(doc[:a] + out.strip().split("### Неблагоприятный сценарий", 1)[1].join(["### Неблагоприятный сценарий", ""]) + "\n\n" + doc[b:])
print("tables re-rendered")
