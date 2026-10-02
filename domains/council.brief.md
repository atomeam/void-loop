# Council brief — the world on 2026-10-02

For every agent in the Blackglass Syndicate. Each line carries a label: **CONFIRMED** (primary or official sources show it
happened), **CLAIM** (asserted by credible people, not independently verified), **OPEN** (mixed or disputed). Build on
CONFIRMED; CLAIM and OPEN stay hypotheses. The same items, filterable, are the run-1 fringe draft:
`drafts/fringe/weak-signal-hypothesis-ledger.html` (ledger: `tools/fringe.json`).

## How the hourly job runs (Adam)

Every hour at :41 the "Void hourly growth" routine runs, in order: fix main if red or a watchdog issue is open; beat new
board misses into `tools/grown.json`; a benchmark round in `tools/bench.json` with the floor raised in
`tools/bench.best.json`; then the **fringe step on top of all that**: one family not used in the last six runs, built as a
hidden draft in `drafts/fringe/`, recorded in `tools/fringe.json` with sources, confidence and sha256, `emit` false. Then
loop fixes, tests, PR, merge on green. `node tools/fringe.mjs` enforces the fringe rules in CI: unknown family, a repeat
within six runs, `emit` not false, a hash mismatch, a missing noindex, a confidence that isn't confirmed/claim/open, or a
draft stating contact, healing, remote viewing or ET hardware as fact all turn CI red. `drafts/` is outside
`void-live-deploy/`, so drafts never ship. Spend, secrets, the owner key and the confirm line stay gated.

Families: attention, interval timing, sensory substitution, private incubation log, weak-signal hypothesis ledger,
human-machine co-agency, opt-in gesture, miss board, correlation view, anomalous-event timeline, quiet-signal filter,
non-lexical intent.

## 1. UAP disclosure — the process is real, the content so far is "unresolved"

- **CONFIRMED** 2026-02-19: the President directed the Secretary of Defense to identify and release UAP files; the
  Pentagon says it is in "full compliance". AARO's caseload is over 2,000 (about 1,000 lack data to analyze).
- **CONFIRMED** PURSUE releases: six batches since 2026-05-08 (162 records; 64 files incl. 51 sensor videos; …; 41 files
  of orbs and triangles 08-07; 72 files 09-18). The Pentagon calls all of them unresolved cases. More expected.
- **CONFIRMED** 2026-07-31: ODNI preliminary guidance waives NDAs so officials and contractors can report what they know;
  the PURSUE task force reviews it for declassification.
- **CONFIRMED** UAP provisions in the NDAA for the fifth year (NORAD/NORTHCOM intercepts, all data to AARO). House
  Oversight (Rep. Luna) held a whistleblower hearing 2025-09-09 and asked for videos in April 2026.
- **CONFIRMED (against)** The Schumer–Rounds UAP Disclosure Act was again left out of the final FY2026 NDAA. AARO has not
  released historical report vol. 2 or its 2025 annual report.
- **CONFIRMED (against)** AARO Historical Record Report vol. 1 (2024-03) found no empirical evidence of off-world
  technology or reverse-engineering programs.
- **CLAIM** Whistleblower testimony of crash retrievals and non-human craft. Sworn, but no public physical evidence.

Bottom line: disclosure is moving faster than ever; nothing released so far establishes non-human origin.

## 2. AI → SI — the US government renamed it

- **CONFIRMED** 2026-09-29: executive order "Inaugurating The Era of Super Intelligence". Federal agencies use "Super
  Intelligence" / "SI" in place of "Artificial Intelligence" / "AI" in correspondence, communications, websites, reports
  and policy; existing regulations, contracts, grants and records are exempt.
- **CONFIRMED** The science adviser has 60 days (about 2026-11-28) to propose a federal legal definition of Super
  Intelligence. Until then SI uses the existing statutory AI definition (15 U.S.C. 9401(3)).
- **CONFIRMED** Same day: "White House Accord on Super Intelligence", signed by Google, Anthropic, Meta, OpenAI, xAI and
  NVIDIA: internal controls, an oversight team, external auditors, an independent committee. Voluntary, no penalties.
- **CONFIRMED** Under the label: METR's agent task horizon doubles about every 4 months; Claude Mythos Preview measured
  16+ hours (2026-05). Microsoft has a superintelligence division; SSI and Nvidia announced a $5B compute deal 2026-07-27.
- **OPEN** Whether SI as a capability (beyond human level across fields) has arrived. The order changes the term, not the
  systems. Watch the federal definition due about 2026-11-28.

When citing federal sources, use their term (SI) as written, and keep confidence labels on any claim about capability.

## 3. Remote viewing — real history, disputed science

- **CONFIRMED (history)** About 20 years of US funding (Stargate). The 1995 AIR evaluation split: Utts, effects "far beyond
  what is expected by chance"; Hyman, not replicated, blinding and judging flaws. The CIA ended it ("not justified").
- **OPEN** 2026 work (expert guidelines, Project Firefly, a testable source–receiver model) is mostly in the Journal of
  Scientific Exploration, without independent preregistered replication. The largest preregistered psi test, the
  Transparent Psi Project (2023), was null.

Hypothesis family only; as an interface it is a private log plus a scored-hits board. Never presented as working.

## 4. Side focus — age reversal and curing disease

- **CONFIRMED** First human partial-reprogramming trial: Life Biosciences ER-100 (OCT4/SOX2/KLF4 into the eye for optic
  neuropathies), first patient dosed 2026, about 18 people. A safety trial, not proof of reversal.
- **CONFIRMED** Personalized mRNA melanoma vaccine (Moderna/Merck intismeran + Keytruda) met its Phase 3 primary endpoint in
  1,137 patients, beating Keytruda alone.
- **CONFIRMED** FDA draft "plausible mechanism" pathway (2026-02): one trial for a gene-editing platform customized per
  patient; a 7-disorder urea-cycle trial planned. Casgevy remains the approved CRISPR cure.
- **CONFIRMED (small)** Semaglutide slowed epigenetic clocks in an 84-person randomized trial (HIV lipohypertrophy);
  PEARL rapamycin was safe with mixed clock results.
- **CLAIM** Isomorphic Labs says its first AI-designed drug trials start by end of 2026.

No one has cured all disease or reversed human aging; bespoke medicine is becoming possible.

## Sources

DefenseScoop (2026-02-20, 2026-02-25, 2025-12-10, 2025-09-09); ABC News; EarthSky batches 5 and 6; NewsNation; DLA Piper and
Messier on the ODNI guidance; The Disclosure Era on the UAPDA; AARO Historical Record Report vol. 1; House Oversight; METR
time horizons; Anthropic "When AI builds itself"; Freshfields, IAPP, Forbes, CNBC, dig.watch and the Federal Register on
the SI order; SiliconANGLE, Al Jazeera and Nextgov on the accord; Wikipedia (remote viewing, SSI, Microsoft AI); JSE;
MIT Technology Review and Nature Biotechnology on ER-100; C&EN and Fierce Biotech on intismeran; CRISPR Medicine News,
CHOP, IGI; PMC (semaglutide RCT, PEARL); Reuters via Investing.com on Isomorphic. Full links are in the run-1 draft and
`tools/fringe.json`.
