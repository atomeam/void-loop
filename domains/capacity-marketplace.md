<!-- a2m-rank -->
**Board rank:** PIPELINE  
**Board index:** `A2M.ops.md`  
**Title:** Capacity marketplace (ERCOT) + AfterBell (parked)
**Board rank + soft tag:** PIPELINE · resource/commons (secondary: rules/filings)

**Shared parts:** see `A2M.ops.md#shared-parts` — uses: Shared intake (site sheet + LOAs — later), gatekeeper packet (QSE / ERID enrollment), partner bench (QSE, counsel), consent record (TDSP LOA; AfterBell FERPA), back office, deadline calendar (ERS terms, NJ BPU), data-center demand watch.

---
# Domain: capacity marketplace (private)

**Status:** living brief — A-to-Mind does this; public Void never markets it.  
**Opened:** 2026-09-23  
**Public face:** blank. No a-to-mind.com copy, scoreboard, or CTA for this Domain.

---

## One-liner

Hyperlocal **feeder / substation** aggregator. Package neighborhood flexibility (C&I HVAC/refrigeration, multifamily, batteries, EVSE) and sell it to the data center / utility stressing that exact pocket — not a national VPP.



## resource/commons siblings

| Product | File | Commons |
| --- | --- | --- |
| **Capacity** (+ AfterBell) | this file | Power flexibility / allowable electrons |
| **Grid Salvage** | `grid-salvage.md` | Iron / HV liquidity |
| **Aquifer Yield** | `aquifer-yield.md` | Water / allowable aquifer draw |

Same soft tag; different products. Do not merge cashpaths.

## AfterBell (parked product inside this Domain)

**Status:** PARKED inside Books (soft tag resource/commons) — does **not** steal PRIMARY (Handoff) or ERCOT Phase 0 cashpath.  
**Rank:** PARKED civic-compute product sharing the “allowable power / interruptible load” thesis with the capacity marketplace, but a different landlord (**school boards**, not C&I / utility pockets).  
**Do not** create `afterbell.md`. Detail lives here until Adam activates.

### Dual-use K-12 civic compute thesis

| Mode | What |
| --- | --- |
| **Day** | FERPA-locked local tutoring / admin AI on-prem for the district |
| **Night / weekend / summer** | Interruptible inference sold to AI companies (same hardware, allowable power window) |

- **Hardware:** quiet cabinet, roughly **20–80 kW** — sized to school facilities reality; **no new water fight** (no mega-campus cooling story).
- **Money split (illustrative only):** district / AfterBell / hardware reserve — exact % TBD when a district is live; do not quote as a promise.
- **Why it can work:** inference buyers need **allowable** interruptible power; schools are broke; schools need on-prem AI they control (FERPA). Same “pay for flexibility on constrained / allowable power” idea as the marketplace — different host class.
- **Go-to-market posture:** start as a **facilities + edtech vendor**, **not** a data-center fund. Wedge **3–5 districts**. Two contracts per site: **facilities** (power / cabinet / interruptibility) + **FERPA DPA** (daytime AI use).
- **Relation:** related civic-compute product to this Domain’s feeder/substation aggregator; do not merge cashpaths. ERCOT Phase 0 and NJ Fair Share research in this file stay primary Domain content.

### Kill list (AfterBell)

- Treat the school like a colo / wholesale data hall
- Train models on student data (or blur FERPA)
- Oversize kW past quiet-cabinet / facilities comfort
- Ignore school calendar, events, exams, sports, HVAC floors
- Pitch AfterBell as a “data center” to boards, parents, or press

### Activation gate

Leave parked until Adam says activate. When live: optional geography row in `A2M.ops.md` for K-12 civic sites; still no steal of Handoff PRIMARY or ERCOT ERS enrollment cashpath.

## Why now (claims to Prove)

- DC load ramps faster than wires; peaks matter more than annual MWh.
- NJ **Data Center Fair Share** (signed ~July 7, 2026 per intake brief) — retail path for large load to pay same-system customers for DR / BTM storage / efficiency / managed electrification. **Verify statute text + BPU rulemaking clock before legal spend.**
- Commercial template: hyperscaler-funded BYOC / VPP (e.g. Google–Voltus pattern).
- FERC Order 2222 / PJM DER aggregator = later wholesale path (capacity ~2028/29), not day-one.

## Wedge

Unit of value = **constrained feeder or substation**, not "the U.S. grid."

1. Map planned/operating DCs against constrained substations (NJ + one dense PJM county first).
2. Enroll flexible load on that pocket — small commercial first, then multifamily, then houses.
3. Sell packaged flexibility in order: utility DR -> DC Fair Share / BYOC -> wholesale later.

Do **not** manufacture batteries. Enroll what exists; finance incremental gear only when offtake pays.

## Phase 0 (30–60 days) — checklist

- [ ] Territory lock: New Jersey + one PJM DC county (name it).
- [ ] Verify Fair Share statute / BPU docket; note what is live vs pending rulemaking.
- [ ] Pull interconnection queues + siting news; list **10** substations where large load is proposed and bill anger is high.
- [ ] Talk to **20** facility managers (grocery, QSR, gym, cold storage, garden apartments): what EMS / thermostats / gens / forklift batteries / EV fleet exist.
- [ ] First product = **C&I demand response enrollment**, not a custom AI dashboard.
- [ ] Dual-enrollment / tariff read for chosen utility before promising stacked VPP money.

## Phase 1 — cheap aggregator path

- Utility-approved DR aggregator / CSP in **one** utility (agreement, credit/deposit, auth forms, interval metering).
- Orchestration: partner (EnergyHub-class / Leap / white-label) or originate for incumbent, keep customer book.
- Do **not** chase full PJM membership on day one.

## Phase 2 — first 1 MW

- 15–25 small C&I @ 20–80 kW curtailable each + 1–2 multifamily.
- Comfort / food-safety floors hard-coded; "utility said no" clause; performance shortfall risk owned.
- Metering: AMI intervals + device telemetry designed for "quantifiable, additional, coincident."

## Phase 3 — offtake stack

| Buyer | Timing | What we sell |
| --- | --- | --- |
| Utility DR / capacity bidding | Months | Enrolled kW, event performance |
| DC / developer Fair Share / BYOC | After contracts exist | Locational reduction + optional BTM storage on *their* pocket |
| Wholesale PJM 2222 | Capacity ~2028/29+ | Accredited aggregation |

## Phase 4 — raise when financing hardware

Capital when financing batteries/controls on host sites. Until then: small team + deposits + commissions.

Team seed: power-markets (DR registration), sales (kitchen/boiler room), software (API + settlement glue), counsel (utility + customer auth).

## Kill list

- Dual enrollment forbidden by tariff
- EDC override of dispatch
- Performance penalties on under-delivery
- Spoiled walk-in / comfort failure
- Competing with national OEMs on density (stay locational)
- Betting Phase 1 revenue on unfinished Fair Share rulemaking

## Attempts

| Date | Attempt | Result | Notes |
| --- | --- | --- | --- |
| 2026-09-23 | Domain file created from intake brief | Pass | Phase 0 research next; Void face untouched |

Score: _(human)_

## Relation to Void

Parallel track. `void.html` / a-to-mind.com stay blank stage + chat skills. This Domain never ships as marketing on the public face. Chooser may note "Domain active" in agent log only — not in public UI.

## Phase 0 research notes

_Appended 2026-09-23 ~15:45 America/New_York. Sources linked; unverified items marked. Public Void / a-to-mind.com untouched._

### 1. NJ Data Center Fair Share — verified YES (partially operative)

**Verdict: YES — enacted; retail demand-reduction trade path exists in statute; BPU standards + utility tariffs not yet live.**

| Item | Fact | Source |
| --- | --- | --- |
| Short name | Commonly "Data Center Fair Share" / "Data Center Fair Share Act" (governor + DCA use this; bill synopsis is longer) | https://www.nj.gov/governor/news/2026/20260707a.shtml |
| Bill numbers | A796 / S731 (4th reprint enacted) | https://pub.njleg.state.nj.us/Bills/2026/A1000/796_R4.HTM ; https://pub.njleg.state.nj.us/Bills/2026/A1000/796_R4.PDF |
| Chapter law | **P.L. 2026, c.32** (supplements Title 48) | DCA LFN 2026-13: https://www.nj.gov/dca/dlgs/lfns/2026/2026-13.pdf |
| Governor sign | **July 7, 2026**, Gov. Mikie Sherrill | Governor release 2026-07-07; LFN 2026-13. *(NJLM newsflash once said July 6 — treat July 7 as authoritative.)* |
| Effective | Act takes effect immediately (section 2) | Enacted text section 2 |
| Capacity-offset mechanism | Utilities must develop a **voluntary demand-reduction trade program** so data center customers may **contract directly with a third party** (or otherwise fund) **verified demand flexibility by other customers on the same electric public utility system**; capacity benefit allocated to the paying DC (PLC / LSE credit). Eligible categories named in standards include **incremental EE, demand response enrollment, BTM storage, managed electrification**. Reductions must be quantifiable, additional, coincident, AMI-interval settled. Explicitly designed to feed **PJM Peak Shaving Adjustment / load forecast**, not clear as PJM supply. | Enacted section 1.b(9), section 1.d(4); governor summary |
| Interim path (important) | If RTO capacity/backstop deadlines precede BPU standards, **bilateral/multilateral demand-reduction contracts** in substantially the statutory form may be **entered and filed with the Board**; Board accepts unless inconsistent; credited like the trade program including as Peak Shaving Adjustment. | Enacted section 1.h |
| BPU clock | Board must establish standards **by order within 12 months** of effective date -> **~July 7, 2027**. Then each utility has **180 days** to file rate class/tariff petition. | Enacted section 1.b, section 1.c |
| Threshold | Board defines "large data center"; **minimum MW designation shall not be greater than 50 MW** (aggregation rules for common ownership/contiguous sites). | Enacted section 1.b(1) |
| Other guardrails | Separate rate class / anti-subsidy; 85%/10-year take-or-pay style guarantees for new; priority firm load shed of DCs before residential (excl. critical load); BYOC clean gen/storage incentives; Large Load + Peak Shaving Adjustments to RTO. | Enacted section 1.b–section 1.d; LFN 2026-13 |

**BPU rulemaking / dockets (as of 2026-09-23 research):**
- **No dedicated "Fair Share standards" docket number found** in public search results as a standalone Fair Share case. Treat as **UNVERIFIED / not yet opened or not indexed under that name**.
- Closely related active proceeding: **VPP Straw Proposal, Docket No. QO26030099** (Staff straw dated July 15, 2026; interim VPP ~2027–2029; open-access aggregator tariff later). Stakeholder comments explicitly tie Fair Share implementation (negative PLC, Peak Shaving Adjustments, demand-reduction trades) to this docket. Straw PDF: https://nj.gov/bpu/pdf/publicnotice/VPP%20Straw%20Proposal%20Final.pdf
- Related: GridFlex QO26030059; GSESP Phase 2 QO26040116; Order 2222 / DER wholesale QO24020116; PSUP QO24030199.
- DCA LFN 2026-13 (Aug 25, 2026): BPU "will work to implement… seeking stakeholder feedback as it develops the tariff."

**Do not invent N.J.S.A. section numbers** beyond "P.L. 2026, c.32 / Title 48 supplement" until official compiled statutes cite appears.

### 2. Recommended first territories (2–3)

#### Territory #1 (primary): **PSE&G (Public Service Electric and Gas) — New Jersey**
- **Why:** Fair Share is NJ-only retail statute; PSE&G is largest NJ EDC; documented DC load ramp in PS Zone.
- **Constraint evidence:** PSE&G Jan 2026 PJM load-forecast adjustment — 39 DC sites, 394 MW summer 2025 peak -> **785 MW (2026)** -> **3,084 MW (2031)** projected under completion-rate methodology; plus ~2,000 MW Capacity Review + ~3,600 MW leads **not** in the PJM adjustment. Source: https://www.pjm.com/-/media/DotCom/planning/res-adeq/load-forecast/pseg-documentation.pdf
- **Pipeline color (older earnings color):** PSEG management cited **~9.4 GW** large-load inquiry pipeline (~mid-2025), mostly DCs, expecting only ~10–20% to fruition — Utility Dive Aug 6, 2025: https://www.utilitydive.com/news/pseg-data-centers-pjm-earnings/756911/ *(note date; treat as pipeline chatter, not firm MW)*.
- **Where to find queue / siting:**
  - PSE&G -> PJM large-load forecast adjustments (above PDF) + TEAC supplemental projects for PS Zone.
  - Municipal land-use / planning boards for DC + substation cases (e.g. Somerset/Middlesex corridor coverage in local filings).
  - NJBPU Public Document Search for utility petitions touching large-load tariffs once Fair Share petitions land.
  - PSE&G data-center commercial page (marketing, not queue): https://nj.pseg.com/businessandcontractorservices/constructionandrenovationservices/datacenters

#### Territory #2: **Loudoun County, VA — Dominion Energy Virginia (PJM DOM zone)**
- **Why:** Densest PJM "Data Center Alley"; extreme large-load interconnection backlog vs zone peak.
- **Constraint evidence:** Dominion SCC Case **PUR-2026-00011** (large-load connection queue process standards, filed ~Feb 2, 2026). Secondary reporting of filing: ~**70 GW** in large-load queue vs Dominion all-time peak ~24.6 GW; ~25 GW with connection dates through 2031, ~45 GW under study. SCC search: https://www.scc.virginia.gov/ (case PUR-2026-00011). Context: https://computelaw.blog/power/dominion-pjm-power-ai-data-centers-virginia/
- **Local siting:** Loudoun Board temporary pause on certain legislative DC/substation applications (Phase 2 standards; staff to return Oct 20, 2026) — https://www.loudoun.gov/DocumentCenter/View/222331/Statement---Loudoun-Board-Enacts-Pause-on-Data-Centers
- **Where to find queue / siting:** SCC docket PUR-2026-00011 filings; PJM TEAC Dominion supplemental projects; Loudoun planning / legislative applications; County pause statements.

#### Territory #3 (optional watch): **JCP&L or ACE (NJ)** — only after PSE&G wedge proves enrollment + dual-enrollment rules; Fair Share applies to all NJ electric public utilities, but PSE&G has the clearest published DC MW ramp today.

### 3. Cheaper path to become DR aggregator / CSP — **PSE&G focus**

**Recommended cheapest Phase 0–1 stack (not "full PJM member day one"):**

1. **Fair Share interim bilateral (section 1.h)** — While waiting for BPU standards (~July 2027) and utility tariffs (+180 days), structure **demand-reduction contracts** (DC <-> aggregator <-> host C&I on same EDC) and **file with NJBPU** for acceptance/credit as Peak Shaving Adjustment. This is the statute's explicit bridge. No public "aggregator agreement" form found yet — **UNVERIFIED whether EDCs have published Fair Share trade program docs** (expected after standards order).
2. **Partner / white-label under an existing PJM CSP** — Originate C&I flex on constrained feeders; incumbent CSP holds registration, credit, settlement. Avoids full membership cost/time. PJM CSP list/overview: https://www.pjm.com/markets-and-operations/demand-response/csps ; Manual 33 (Demand Response): https://www.pjm.com/-/media/DotCom/documents/manuals/m33.pdf
3. **Own PJM CSP registration when ready** — Membership + CSP path docs: https://pjm.my.site.com/publicknowledge/s/article/How-to-Become-a-Curtailment-Service-Provider-CSP and https://pjm.my.site.com/publicknowledge/s/article/PJM-s-Membership-Process ; membership checklist PDF: https://www.pjm.com/-/media/DotCom/about-pjm/member-services/information-requirement-checklist-for-pjm-membership-application.pdf *(approval often cited up to ~90 days after complete docs/fees — confirm current timing with PJM Member Services)*.
4. **Utility retail DR / VPP aggregator lane** — Watch **QO26030099** for EDC MFRs (Staff aimed ~Oct 2026) and DER Aggregator licensing (section 6.3 of VPP straw). PSE&G **FlexPower / SmartFlex** (https://flexpower.pseg.com/) appears **direct-to-customer** for SMB; **no public NJ PSE&G third-party "aggregator agreement" found** analogous to PSEG Long Island CSRP aggregator docs. Treat retail aggregator MSA as **not yet public / TBD under VPP MFR**.
5. **Do not** bet Phase 1 revenue solely on unfinished Fair Share tariffs; use PJM CSP/partner DR + interim section 1.h bilaterals as cashpath while rulemaking runs.

### 4. Five concrete public data sources (map planned DCs vs substations)

1. **PJM Queue Scope (generation/storage interconnection — public)** — https://queuescope.pjm.com/queuescope (and evaluator UI). Useful for nearby gen/storage nodes; **not** a full retail large-load DC queue.
2. **PSE&G -> PJM Load Forecast Adjustments (data-center MW by summer year)** — https://www.pjm.com/-/media/DotCom/planning/res-adeq/load-forecast/pseg-documentation.pdf
3. **PJM TEAC supplemental projects** (utility substation/transmission need statements for PS / DOM zones) — committee materials under https://www.pjm.com/committees-and-groups/committees/teac (search PSE&G / Dominion supplemental PDFs).
4. **Virginia SCC Case PUR-2026-00011** — Dominion large-load connection queue process standards + intervenor filings — https://www.scc.virginia.gov/ (docket search). Companion large-load tariff history often cited: PUR-2025-00058 *(verify before relying)*.
5. **Municipal / county siting news & applications** — Loudoun County Board statements + legislative land-use apps; NJ municipal planning board dockets / local news for DC + Class H substation cases (example pattern: Montgomery Twp PSE&G Harlingen Class H materials on municipal document centers). Cross-check NJBPU Public Document Search: https://publicaccess.bpu.state.nj.us/

**Bonus:** PJM 2026 Long-Term Load Forecast report — https://www.pjm.com/-/media/DotCom/library/reports-notices/load-forecast/2026-load-report.pdf

### 5. Research gaps / kill triggers for Phase 0
- Dedicated Fair Share BPU standards docket number still missing from public index -> monitor Public Document Search weekly.
- PSE&G third-party aggregator contract text not found publicly -> ask utility account / BPU staff after MFR Order.
- Dual-enrollment conflicts (Triennium DR vs VPP vs Fair Share trade vs PJM CSP) — read chosen EDC tariff + VPP straw anti-double-counting before stacking promises.
- Loudoun legislative pause may slow *new* legislative DC apps; by-right/admin paths may still move — confirm per parcel.

### Top 3 next human Phase 0 actions
1. **Calendar + monitor** NJBPU for Fair Share standards notice + continue commenting/watch QO26030099; pull any section 1.h contract template language if Staff publishes guidance.
2. **Lock PSE&G pocket map:** from PSE&G forecast PDF + TEAC + 10 municipal DC/substation cases, list **10 candidate substations/feeders**; start 20 C&I facility-manager calls on those pockets only.
3. **Pick aggregator vehicle:** shortlist 2–3 incumbent PJM CSPs for white-label vs start CSP membership application; in parallel request PSE&G/BPU contacts for interim Fair Share trade / VPP aggregator enrollment once MFRs drop.

---

## Territory lock (active) — ERCOT

**Updated:** 2026-09-23  
**Proving ground:** ERCOT (Texas). Transaction first: enroll C&I flexibility into an existing paid program and settle.  
**Local pivot (if footprint must stay near Lakeland):** Duke Energy Florida — parked until ERCOT book proves.  
**Parked (not abandoned):** NJ Fair Share / PSE&G research above — premium offtake later, not Phase 1 cash.

**First product:** ERCOT **Emergency Response Service (ERS)** enrollment for small/mid C&I via an existing QSE (white-label / channel), not a custom platform and not full QSE membership on day one.  
**Later:** own QSE / Load Resource / ADER only after sites settle.

Key public refs (forms next pass):
- Load Resource / RE + QSE path: https://www.ercot.com/services/programs/load/laar
- ADER pilot (later): https://www.ercot.com/mktrules/pilots/ader
- PUCT ADER registration (Project 54311): https://ftp.puc.texas.gov/public/puct-info/industry/electric/forms/ader/ADERRegistrationForm.pdf

---

## Phase 0 checklist — ERCOT transaction only

Subtraction rule: no infrastructure build, no customer app, no public marketing. Paperwork + calls + enrollment.

### Lock
- [x] Territory = ERCOT
- [ ] Name first metro pocket (e.g. Dallas–Fort Worth, Houston, Austin, San Antonio) — one only
- [ ] Confirm REP/TDSP mix for that pocket (who the facility already buys power from)

### Aggregator vehicle (pick one before promising $)
- [ ] Shortlist 2–3 incumbent ERS QSEs / CSPs who already settle C&I in ERCOT (channel / white-label first)
- [ ] Ask each: customer split, dual-enrollment rules, metering needs, next Standard Contract Term deadline
- [ ] Choose vehicle: **originate under their QSE** (default) vs start own QSE (deferred)
- [ ] Park ADER / full Resource Entity registration until ≥5 sites want it

### Book building
- [ ] Build list of **40** C&I targets in the pocket: grocery, QSR, gym, cold storage, light warehouse, garden apartments with central plant
- [ ] Complete **20** facility-manager conversations using the script below
- [ ] Qualify **10** sites with: interval meter (or path to one), named decision-maker, curtailable kW guess, hard floors (food safety / comfort / production)
- [ ] Dual-enrollment check: what DR / 4CP / other programs they are already in — do not stack illegally

### Transaction ready
- [ ] Customer authorization / LOA template from chosen QSE
- [ ] One-page site intake (meter #, ESI ID, HVAC/refrigeration notes, floors, contacts)
- [ ] Calendar next ERS Standard Contract Term + ERID / offer deadlines
- [ ] First **5** signed authorizations → hand to QSE for ERID
- [ ] Do **not** build software; use QSE portal + spreadsheet

### Explicitly parked this phase
- [ ] Battery financing
- [ ] Data-center Fair Share / BYOC pitches
- [ ] Void / public website work for this Domain
- [ ] Duke Energy Florida (unless ERCOT stalls)

---

## Facility call script — ERCOT C&I enrollment

**Audience:** facility manager, GM, or ops lead at a grocery, restaurant group, gym, cold storage, or small warehouse.  
**Length:** ~90 seconds spoken, then listen.  
**Voice:** quiet ops partner who handles utility/program paperwork. Not a software pitch.

### Opener
"Hi — I’m with a small outfit that enrolls commercial sites into the Texas grid’s paid demand-response programs. We don’t sell you equipment and we don’t install a platform. If your building can briefly cut or shift load when the grid is tight — HVAC, refrigeration hold, lighting, chargers — the program pays for that. We handle the enrollment paperwork with the scheduling entity. Got two minutes?"

### If yes — qualify
"Quick check so I don’t waste your time:
1) Do you already have interval or smart metering on the account?
2) Roughly how big is the building — and what’s the biggest flexible load: HVAC, walk-ins, process, EV chargers?
3) Are you already in any demand-response or peak program with your retailer or someone else?
4) Who signs utility authorizations — you, owner, or corporate?"

### The offer (plain)
"What we’d do: put your site into the next Emergency Response Service term through a qualified scheduling partner we already work with. When ERCOT calls an event, you get notice and drop load within the window you agree to — usually on the order of tens of minutes, not hours of shutdown. You set hard floors up front: food safety, guest comfort, production. If a call would break those, you don’t take it, or we carve that load out. You get paid for what you actually deliver; we take a cut for enrollment and coordination. No app you have to live in."

### Objection — "We tried DR / got burned"
"Fair. Most of the pain is bad notice or someone promising money without reading your floors. We write the floors into the enrollment notes and keep events optional where the program allows. If your last provider stacked you into two programs on the same meter, we won’t repeat that — I’ll check dual-enrollment before anything is filed."

### Objection — "How much money?"
"Depends on your curtailable kW and which contract term clears. I won’t quote a fake number on this call. After we see your meter ID and a week of interval shape, I’ll give you a range from the partner’s last settlements for similar sites — before you sign anything."

### Objection — "Is this a startup pitch / AI thing?"
"No. It’s program enrollment. Same ERCOT programs facilities already use; we just do the paperwork and the event coordination so you don’t have to staff it."

### Close
"If you’re open to it, I’ll send a one-page authorization and a short site sheet. You fill meter / ESI ID and floors; we submit for the next term. No commitment to buy hardware. Can I send that to your email today?"

### Do not say on this call
- AI, Void, nodes, VPP platform, marketplace, Fair Share, data center, climate, next-gen, disrupt
- Guaranteed dollar amounts
- "We’ll install controls" (unless they ask and a later phase pays for it)

### After the call (internal)
- Log site, contact, meter status, existing programs, curtailable guess, next step
- Dual-enrollment flag before any LOA
- Append Attempt row in this Domain file

---

## Attempts (append)

| Date | Attempt | Result | Notes |
| --- | --- | --- | --- |
| 2026-09-23 | ERCOT territory lock + Phase 0 checklist + call script | Pass | Transaction-only; forms pull next |
| 2026-09-23 | AfterBell thesis folded in (parked section) | Pass | Dual-use K-12 civic compute; no afterbell.md; ERCOT/NJ unchanged |

---

## ERCOT registration pack (Phase 0→1)

_Appended 2026-09-23 ~15:50 America/New_York. Verified public links only. Prior ERCOT checklist + facility call script above are unchanged._

**Goal:** enroll C&I sites into **Emergency Response Service (ERS)** as a channel under an existing QSE. Do not register as QSE / Resource Entity / ADER until a book exists.

### 1. Lean path A (preferred) — channel under an existing ERS QSE

**What it is:** Site hosts authorize a QSE (or CSP that works through a QSE) to put their ESI ID(s) into ERS. The QSE files ERCOT paperwork and settles. You originate sites; you do not become a Market Participant on day one.

**Public program hub:** https://www.ercot.com/services/programs/load/eils  
**Rule:** 16 TAC §25.507 — https://www.law.cornell.edu/regulations/texas/16-Tex-Admin-Code-SS-25-507  
**Overview (ERS vs Load Resource vs Voluntary Load Response):** https://www.ercot.com/files/docs/2025/12/22/ERCOT-Grid-Insights-Demand-Response.pdf

#### What the site host typically signs (commercial + data auth)
ERCOT does not publish a universal “host LOA for ERS.” In practice the host signs paperwork supplied by the QSE/CSP:
1. **Customer participation / authorization agreement** — authorizes the QSE (or its CSP) to enroll named ESI ID(s) / meters into ERS for specified Standard Contract Terms, sets curtailable kW, hard floors, notice method, and revenue split. *Get the QSE’s template; do not invent one.*
2. **TDSP Letter of Authorization for historical usage** (interval / smart-meter data) — standard retail LOA to the host’s Transmission & Distribution Service Provider so baseline / interval history can be pulled. Example Oncor instructions (form is TDSP-specific): https://www.oncor.com/content/dam/oncorwww/documents/about-us/advanced-metering-service/commercial-metering/Instructions%20for%20Standard%20Letter%20of%20Authorization.pdf.coredownload.inline.pdf
3. **If the site is in a NOIE (muni/coop) territory:** ERCOT **NOIE Authorization Form for QSEs Representing ERS & LR** (posted on the Load Resource page Key Documents): https://www.ercot.com/services/programs/load/laar

Ask the QSE for: (a) their host auth/LOA, (b) site intake fields (ESI ID, meter ID, TDSP, REP, curtailable kW, floors), (c) next ERID / offer deadlines.

#### What the QSE files with ERCOT
1. **ERID (ERS Resource Identification)** — mandatory first step each Standard Contract Term. QSE submits prospective ERS Sites via the current **ERS Submission Form** on the ERS page (see Key Documents). ERID must include stable meter identifiers (e.g. ESI ID / unique meter ID) consistent through offer submission.
2. **Competitive (or self-provision) offers** — due on the dates in that SCT’s **ERS Procurement Schedule** (same ERS page). Only QSEs that can receive XML messaging and Verbal Dispatch Instructions may offer (see ERS Technical Requirements & Scope of Work for the SCT).
3. **Awards / settlement** — ERCOT notifies awarded QSEs; **ERS Procurement Summary** posts to MIS before SCT start; **ERS Offer Disclosure** posts ~60–65 days after SCT start. Capacity payments go to the QSE; QSE pays hosts under the commercial agreement. Non-performance / availability can reduce payments (rule + Technical Requirements).

#### Quarterly Standard Contract Terms (overview)
ERCOT procures ERS **four times** per ERS year (Dec→Nov). Standing SCT windows:
| SCT | Months |
| --- | --- |
| Winter | December–March |
| Spring | April–May |
| Summer | June–September |
| Fall | October–November |

For each SCT, ERCOT procures **ERS-30** and **ERS-10** (and weather-sensitive variants where offered). Hosts pick Time Periods (TP1–TP8) with the QSE. **Always use the live Procurement Schedule / Technical Requirements / Reinstatement Schedule** posted under the matching SCT on https://www.ercot.com/services/programs/load/eils — do not rely on stale partner one-pagers for deadlines.

**As of 2026-09-23 research:** Oct–Nov 2026 ERID/offer window had already closed (ERCOT market notice M-A073126-01: ERID due 2026-09-11, offers due 2026-09-14). Next planning focus = **December 2026 – March 2027** SCT docs on the same page (Procurement Schedule_DecMar27 posted). Confirm exact ERID/offer dates from that schedule before promising hosts a term.

**Client Services (questions):** ClientServices@ercot.com / (512) 248-3900

### 2. Lean path B (later) — register Resource Entity + designate QSE for Load Resources

Use only after Path A is settling and you need Ancillary Services / SCED Load Resource participation (RRS, ECRS, Non-Spin, Reg, etc.) — not for first ERS dollars.

**Hub:** https://www.ercot.com/services/programs/load/laar  
**Resource Entity registration:** https://www.ercot.com/services/rq/re  
**QSE registration (if ever self-representing):** https://www.ercot.com/services/rq/qse  
**RIOO / Resource Integration (account + user guides):** https://www.ercot.com/services/rq/integration

Plain steps (from laar + re pages):
1. Register as a **Resource Entity** via the **Section 23** Resource Entity Application for Registration (linked from https://www.ercot.com/services/rq/re). Complete RE registration to get the ERCOT digital certificate needed for RIOO.
2. Designate a **QSE** (level 3 or 4; level 4 required for AS). Have the QSE submit **Section 23 Form H: QSE Acknowledgement** to ERCOT **before** starting LR registration in RIOO (late Form H can delay Production Load Date).
3. For Controllable Load Resources that will be SCED-qualified: designate a Decision Making Entity via **Section 23 Form C: Managed Capacity Declaration** ≥45 days before requested PLD.
4. Coordinate mapping / interconnection data with the host **TDSP / Meter Reading Entity** (Load Resource Registration Data Request Form on laar Key Documents).
5. Optionally coordinate PLD + Dispatch Asset Code with ERCOT Demand Integration: ERCOTLRandSODG@ercot.com.
6. Register the Load Resource in **RIOO** (RIOO–RS). PLD must be ≥45 days after accurate RIOO submission and align with the Production Load Schedule. New LR fee = **$500** (Fee Schedule in Protocols; collected in RIOO).
7. QSE sets up **ICCP** telemetry per Nodal ICCP Handbook; then schedule AS qualification testing with Demand Integration after PLD activation.

**RIOO notes:** RIOO replaced RARFs for Load Resource registration. User guides (Creating / Updating Load Resource) are linked from the laar Key Documents and Resource Integration pages. RE User Security Administrator manages digital-certificate roles (e.g. RIOORS_M_Operator) and MFA. Do not start this path for Phase 0 ERS cash.

### 3. ADER pilot (parked)

**Ignore until you have a settling ERS book and a reason to chase wholesale ADER / ALR-style aggregation.**

| Item | Link |
| --- | --- |
| ERCOT ADER pilot hub | https://www.ercot.com/mktrules/pilots/ader |
| PUCT Project **53911** (pilot project docket / materials) | https://interchange.puc.texas.gov/ (search Control Number 53911) |
| PUCT Project **54311** (ADER registration / forms filings) | https://interchange.puc.texas.gov/search/filings/?ControlNumber=54311&DocumentType=ALL&ItemMatch=Equal&SortBy=FilingParty&SortOrder=Ascending&UtilityType=E |
| ADERRegistrationForm.pdf | https://ftp.puc.texas.gov/public/puct-info/industry/electric/forms/ader/ADERRegistrationForm.pdf |

**When to ignore:** Phase 0–1 is ERS-via-QSE. ADER requires ERCOT pilot steps **plus** PUCT 54311 registration, DSP/LSE acknowledgments, Details of Aggregation filings, and telemetry/qualification procedures. Revisit only after ≥5 sites settle and a partner QSE says ADER is the right next product.

### 4. Shortlist criteria — find 2–3 current ERS QSEs/CSPs (do not invent)

**How to verify who still offers ERS (public):**
1. **Primary — ERCOT “QSE Services Available on Short Notice”** (self-declared capability table with an **ERS** column): https://www.ercot.com/services/programs/qse  
   Note on that page: ERCOT does **not** verify ability; still the cleanest public ERS flag.
2. **ERS Offer Disclosure / Procurement Results** on https://www.ercot.com/services/programs/load/eils (and MIS postings named on that page) — shows who actually offered/cleared for recent SCTs (MIS access may be needed for full detail).
3. **Public QSE list** (EMIL NP16-474-M): https://www.ercot.com/mp/data-products/data-product-details?id=NP16-474-M
4. Then email / call: confirm they take **third-party originated C&I**, revenue share, dual-enrollment rules, metering, and **next SCT ERID deadline**.

**Named firms verified as offering / declaring ERS (sources; not endorsements — re-check before emailing):**
| Firm | Why listed | Source |
| --- | --- | --- |
| GridBeyond LLC | ERS ✓ on ERCOT short-notice QSE table | https://www.ercot.com/services/programs/qse |
| Priority Power Management LLC | ERS ✓ on same table | https://www.ercot.com/services/programs/qse |
| VIOTAS Texas LLC | ERS ✓ (+ LR) on same table | https://www.ercot.com/services/programs/qse |
| ENTERWISE GLOBAL TECHNOLOGIES LLC (CPower contact on list) | ERS ✓ on same table; CPower publishes ERS-30 parameters | https://www.ercot.com/services/programs/qse ; https://cpowerenergy.com/wp-content/uploads/2024/10/ERCOT-ERS30-2025.pdf |
| Enel North America | Public Texas page documents **ERS** (plus RRS/ECRS) | https://www.enelnorthamerica.com/solutions/energy-solutions/demand-response/texas-demand-response |
| Also ERS ✓ on short-notice table (optional outreach): AMA QSE, Engie Energy Marketing NA, Galt Power, Guidepost Energy, Tenaska Power Services, APX Inc, EDF Trading North America, MP2 Mesquite Creek Wind | Same ERCOT table | https://www.ercot.com/services/programs/qse |

**Email shortlist pick 2–3 using:** (1) ERS ✓ or explicit ERS marketing, (2) willing to white-label / pay an originator, (3) C&I small/mid site appetite, (4) clear next-SCT calendar, (5) written dual-enrollment / 4CP policy. Drop any firm that cannot confirm current ERS offers for the next SCT.

### 5. Dual-enrollment / 4CP caution (one paragraph)

Do **not** stack the same curtailable kW into ERS and another obligation without written QSE confirmation. ERCOT’s own Demand Response overview separates **ERS**, **Load Resource** (AS/SCED), and **Voluntary Load Response** (https://www.ercot.com/files/docs/2025/12/22/ERCOT-Grid-Insights-Demand-Response.pdf); Ancillary Service Load Resource paths (laar) have different telemetry and day-ahead commitment rules than ERS. Separately, **4CP** (four coincident peaks) transmission-cost avoidance is a TDSP/REP billing behavior, not an ERCOT ERS award — curtailing for a suspected 4CP interval can conflict with an ERS availability window or with an LR AS commitment. Before any LOA: ask the host what DR / peak / aggregator programs they are already in; ask the QSE whether that ESI ID can join ERS for the target Time Periods; put hard floors and “no illegal stack” in the enrollment notes. If unclear, enroll ERS-only for Phase 1.



