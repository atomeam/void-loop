# calculator.net: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: calculator.net (https://www.calculator.net/)
- Verse: /calculator/ (calculator, tower gate 12 of 14)
- Live scan: 2026-10-28, HTTP 200, page title "Calculator.net: Free Online Calculators - Math, Fitness, Finance, Science"
- History: [docs/HISTORY/calculator.net.md](../HISTORY/calculator.net.md)

**Match: 69%**: 5 have, 1 partial, 0 missing, 2 unreviewed, of 8 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| A basic and scientific calculator | Maths | have | its live page (2026-10-28): "Calculator.net: Free Online Calculators - Math, Fitness, Finance, Science Calculator.net sign in 0 sin cos ta" | void-live-deploy/calculator/index.html:59 `<h1>Scientific calculator</h1>` |
| Mortgage, loan and finance calculators | Calculators | have | its live page (2026-10-28): "ncial Calculators Financial Calculators Mortgage Calculator Loan Calculator Auto Loan Calculator Interest Calc" | void-live-deploy/calculator/index.html:82 `<details id="c-loan"><summary>Loan, with an amortization schedule and chart</summary><` |
| BMI, calorie and fitness calculators | Calculators | have | its live page (2026-10-28): "alculators Fitness & Health Calculators BMI Calculator Calorie Calculator Body Fat Calculator BMR Calculator I" | void-live-deploy/calculator/index.html:92 `<details id="c-bmi"><summary>BMI and calories a day</summary><div class="form">` |
| Fraction, percentage and statistics calculators | Calculators | have | its live page (2026-10-28): "Math Calculators Scientific Calculator Fraction Calculator Percentage Calculator Random Number Generator Tria" | void-live-deploy/calculator/index.html:66 `utton" class="fn" aria-label="percent">%</button><button type="button">7</button><button t` |
| Date, age and time calculators | Calculators | have | its live page (2026-10-28): "Calculators Financial Calculators Mortgage Calculator Loan Calculator Auto Loan Calculator Interest Calculato" | void-live-deploy/calculator/index.html:84 `<details id="c-mortgage"><summary>Mortgage, with taxes, insurance and fees</summary><d` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "itness, Finance, Science Calculator.net sign in 0 sin cos tan Deg Rad sin -1 cos -1 tan -1 &#960; e x y x 3 x" | void-live-deploy/calculator/index.html:116 `=> { try { return JSON.parse(localStorage.getItem(KEY) // 'null') // {}; } catch (_) { re` |
| Random Number Generator | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Password Generator | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
