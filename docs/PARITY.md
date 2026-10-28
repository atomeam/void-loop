# Parity: what Verse took over, and what it did not

One page per thing Verse replaced, with what the old tool did, what Verse does instead, and the gaps, said plainly. Newest first.

## calculator.net's sitemap, Other → /calculators/ (2026-10-28)

**Before.** tools/rival-inventory.mjs read calculator.net/sitemap.html and found 19 calculators in its Other section that Verse did not have.

**Now.** 15 of them work on https://a-to-mind.com/calculators/ as 17 calculators, with known-answer tests in tools/calc-other.test.mjs (the NWS wind-chill and heat-index charts, the calendar, the ENERGY STAR room table, sums worked by hand). This change only adds; nothing was removed.

| calculator.net tool | On Verse | Where |
| --- | --- | --- |
| Wind chill | added | `?calc=wind-chill` (NWS 2001; says when it is outside the formula's range) |
| Heat index | added | `?calc=heat-index` (NWS Rothfusz with its adjustments, and the caution level) |
| Dew point | added | `?calc=dew-point` (Magnus) |
| Day of the week | added | `?calc=day-of-week` (and day of the year, ISO week, leap year) |
| Roman numeral converter | added | `?calc=roman-numerals` (both ways, 1 to 3999) |
| URL encode / decode | added | `?calc=url-encode` (RFC 3986) |
| Bandwidth | added | `?calc=download-time` (KB/MB and KiB/MiB, overhead) |
| Sleep | added | `?calc=sleep-cycles` (90-minute cycles, either way) |
| GDP | added | `?calc=gdp` (C + I + G + X − M, real by the deflator) |
| Horsepower | added | `?calc=horsepower` (torque × rpm) |
| Engine horsepower | added | `?calc=engine-horsepower` (from quarter-mile time or trap speed) |
| Golf handicap | added | `?calc=handicap-index` (the 3-to-20-score table) and `?calc=golf-differential` (and course handicap) |
| Time card | added | `?calc=time-card` (overtime past 40 hours) |
| Dice roller | added | `?calc=dice-roller` (crypto random; marked random) |
| Height | added | `?calc=adult-height` (mid-parental height and its ±8.5 cm range) |
| BTU | added | `?calc=room-ac-btu` (ENERGY STAR room air conditioner table) |
| Bra size | missing | sizing conventions differ by country and brand; not built rather than guessed |
| Shoe size conversion | missing | the size tables differ by brand; not built rather than guessed |
| Love | missing, on purpose | it is not a real calculation |

## calculator.net's sitemap, Maths → /calculators/ (2026-10-28)

**Before.** tools/rival-inventory.mjs read calculator.net/sitemap.html and found 16 Maths calculators that Verse did not have.

**Now.** All 16 work on https://a-to-mind.com/calculators/ and have known-answer tests in tools/calc-math.test.mjs. The answers were worked by hand or taken from the NIST t and chi-square tables. This change only adds to the page.

| calculator.net tool | On Verse | Where |
| --- | --- | --- |
| Volume | added | `?calc=solid-shapes` (cube, box, sphere, hemisphere, cylinder, cone, square pyramid, capsule) |
| Surface area | added | `?calc=solid-shapes` (the same calculator gives both answers) |
| Number sequence | added | `?calc=number-sequence` (arithmetic, geometric, Fibonacci) |
| Binary | added | `?calc=binary-math` (any size, plus AND, OR, XOR) and `?calc=base-convert` |
| Hex | added | `?calc=hex-math` and `?calc=base-convert` |
| Probability | added | `?calc=probability-two` (two independent events) |
| Ratio | added | `?calc=ratio` |
| Factor | added | `?calc=factors` |
| Rounding | added | `?calc=rounding` (on exact decimals: 1.005 → 1.01; five rules) |
| Matrix | added | `?calc=matrix` (determinant, inverse, transpose, A × B, A ± B, k × A) |
| Scientific notation | added | `?calc=scientific-notation` (and E and engineering notation) |
| Big number | added | `?calc=big-number` (exact whole numbers: + − × ÷, powers, gcd) |
| Prime factorization | added | `?calc=prime-factorization` |
| Common factor | added | `?calc=common-factors` (a list's GCF, common factors and LCM) |
| Long division | added | `?calc=long-division` (steps, and repeating decimals in brackets) |
| P-value | added | `?calc=p-value` (z, t, chi-square; one or two tails) |

**Still missing from calculator.net's sitemap:** the Health nutrition and cycle calculators and the Other weather and everyday ones (the list is in tools/rival-inventory.mjs's output). The Financial section has not been read yet. Skipped on purpose: a trademarked points calculator, and a "love" calculator, which has nothing real to calculate.

## calculator.net's home page → /calculators/ (2026-10-28)

**Before.** calculator.net's home page lists four groups of calculators (financial, fitness and health, math, other) and a keypad scientific
calculator. Its robots.txt (`User-agent: *` with no Disallow) lets robots read it.

**Now.** Every calculator on that page works on https://a-to-mind.com/calculators/, and each one has known-answer tests (tools/calc-net.test.mjs,
tools/keypad.test.mjs). This change only adds to /calculators/; the green-first rule kept it to gap-fills on a page that already exists.

| Group | Calculator | On Verse | Where |
| --- | --- | --- | --- |
| Financial | Mortgage | added | `?calc=mortgage` (with the monthly schedule) |
| Financial | Loan | present | `?calc=loan-payment` |
| Financial | Auto loan | added | `?calc=auto-loan` (with the monthly schedule) |
| Financial | Interest | present | `?calc=simple-interest`, `?calc=compound-interest` |
| Financial | Payment | added | `?calc=payoff-time` (months to pay off, from a payment) |
| Financial | Retirement | added | `?calc=retirement` |
| Financial | Amortization | added | `?calc=amortization` (with the schedule) |
| Financial | Investment | added | `?calc=investment` (year by year) |
| Financial | Inflation | present | `?calc=inflation` |
| Financial | Finance (TVM) | added | `?calc=finance-tvm` (solves N, I/Y, PV, PMT or FV) |
| Financial | Income tax | added | `?calc=income-tax-us` (US federal 2026 and 2025 brackets; state tax, FICA, AMT and capital gains left out, and said so) |
| Financial | Compound interest | present | `?calc=compound-interest` |
| Financial | Salary | present | `?calc=salary` |
| Financial | Interest rate | added | `?calc=interest-rate` |
| Financial | Sales tax | present | `?calc=sales-tax` |
| Fitness and health | BMI | present | `?calc=bmi` |
| Fitness and health | Calorie | present | `?calc=bmr` (calories a day) |
| Fitness and health | Body fat | present | `?calc=body-fat-navy-men`, `?calc=body-fat-navy-women` |
| Fitness and health | BMR | present | `?calc=bmr`, `?calc=bmr-harris-benedict-men`, `?calc=bmr-katch-mcardle` |
| Fitness and health | Ideal weight | present | `?calc=ideal-weight` |
| Fitness and health | Pace | present | `?calc=pace` |
| Fitness and health | Pregnancy | added | `?calc=pregnancy` |
| Fitness and health | Pregnancy conception | added | `?calc=conception` |
| Fitness and health | Due date | added | `?calc=due-date` |
| Math | Scientific | added | the keypad on /calculators/ (`#keypad`): digits, + − × ÷, Back, Ans, M+, M−, MR, MC, EXP, ±, RND, AC, =, trig in degrees or radians, xʸ, √, ln, log, n!, π, e |
| Math | Fraction | added | `?calc=fraction-math` |
| Math | Percentage | present | `?calc=percent-of`, `?calc=what-percent`, `?calc=percent-change` |
| Math | Random number | added | `?calc=random-number` |
| Math | Triangle | added | `?calc=triangle-solve` (any three parts) |
| Math | Standard deviation | present | `?calc=descriptive` |
| Other | Age | present | `?calc=age` |
| Other | Date | present | `?calc=add-days`, `?calc=days-between` |
| Other | Time | added | `?calc=time-add` |
| Other | Hours | added | `?calc=hours-worked` |
| Other | GPA | added | `?calc=gpa` |
| Other | Grade | added | `?calc=final-grade` (and `?calc=weighted-average`, present) |
| Other | Concrete | present | `?calc=concrete` |
| Other | IP subnet | added | `?calc=ip-subnet` |
| Other | Password generator | added | `?calc=password-generator` |
| Other | Conversion | present | /convert/ and `?calc=convert` |

**Gaps.** None on the home page. The full sitemap (about 200 tools) is tracked by tools/rival-inventory.mjs.

## The two Zapier Zaps that logged void-loop's issues and pull requests → /ledger/ (2026-10-28)

**Before.** Two Zaps on a Zapier trial that ran out around 2026-11-10. One fired on each new GitHub pull request of atomeam/void-loop, the other on each
new issue (it filtered on `html_url` containing `/issues/`, because GitHub's issue trigger also returns pull requests). Both wrote a row to the Zapier
table "void-loop Activity Ledger".

**Now.** https://a-to-mind.com/ledger/ ("Repo activity ledger"). The browser reads GitHub's public REST API
(`/repos/{owner}/{repo}/issues?state=all`), which lists both kinds; a pull request is the item with a `pull_request` field, so no URL filter is
needed. No server, no token, no account, no KV writes.

| | Zapier (two Zaps + table) | /ledger/ |
|---|---|---|
| Issues and pull requests | two Zaps, one table | one list, two tabs (Issues, Pull requests) |
| Columns | title, number, URL, author, state, created | the same, plus merged and closed time, labels, comments, updated |
| History | only what happened while the Zaps were on | everything GitHub has (the first look reads the 2,000 newest; Load older reads on) |
| State | the state at the moment the row was written (an issue closed later stays "open" in the table) | the state now: a refresh re-reads every item changed since the last read |
| Merged vs closed | not told apart | told apart (`pull_request.merged_at`) |
| Search and filters | the table's own | search over title, number, author and labels; state, author, label, dates, sort, bots |
| Export | Zapier table export | CSV (opens in any spreadsheet, formula-safe) and JSON, copy as CSV |
| Sharing | share the table inside Zapier | a link that opens the exact repo, tab and filters |
| Other repos | one Zap per repo | any public repo, six kept on the device |
| Offline | no | the last copy opens offline |
| Cost | a paid plan after the trial | free |

**What it does not do, honestly.**

- **No push.** The Zaps ran on their own when something happened. The ledger reads when you open it or press Refresh; "N new since your last look"
  stands in for the trigger. Nothing is sent to another app on a new item (that is the part of Zapier this does not replace).
- **No server-side copy.** The table lived in Zapier's cloud. The ledger keeps the last copy on each device (localStorage), and GitHub itself is the
  record. For an archive, Download CSV or JSON.
- **Private repos.** Without a token only public repos can be read. void-loop is public, so this does not bite here.
- **The rate limit.** 60 requests an hour per network without a login. A first look at void-loop takes about 14 requests; a refresh is usually 1,
  and an unchanged answer (304, sent with the saved ETag) does not count. When the limit is used up the page says when it resets and keeps the saved copy.
- **Deleted or transferred items** stay in the device copy until it is cleared (GitHub's list no longer returns them, so a refresh cannot see them go).

**Why there is no scheduled GitHub Action.** A daily snapshot as an artifact was considered and left out: GitHub already keeps the full history, the
page reads it live, the device copy and the CSV/JSON export cover keeping one, and a daily job would only add CI minutes for a copy nobody reads.
If a dated archive is ever wanted, the export button is the archive.

**On the tower.** The Zapier floor (`automation` in `lib/tower.js`, probe in `tools/tower-probes.mjs`) is deferred like the other giants: one of
Zapier's thousands of jobs is done; triggers into other apps are not.
