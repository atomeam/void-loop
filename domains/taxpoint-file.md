<!-- a2m-rank -->
**Board rank:** RESEARCH  
**Board index:** `A2M.ops.md`  
**Title:** Taxpoint File  
**Board rank + soft tag:** RESEARCH · rules/filings

**Shared parts:** see `A2M.ops.md#shared-parts` — uses: Shared intake (customs entries, mill papers, carbon-price receipts), gatekeeper packet (HMRC line file plus relief calc), licensed-partner bench (accredited verifiers; tax agents), consent record (importer authority; mill permission to pass emissions data to the verifier), readiness sprint, deadline calendar (1 Jan 2027; 30-day clock; 1 Jan 2028; 31 Jan 2028; 31 May 2028), jurisdiction rule set (UK annex codes, exclusions, qualifying carbon-price schemes), scope / exemption worksheet (threshold tests).

---
# Domain: Taxpoint File (private)

**Status:** RESEARCH — docs only. **No build. No outreach.** Does **not** steal PRIMARY (Handoff).  
**Public face:** blank. No a-to-mind.com copy, scoreboard, or CTA for this Domain.  
**Opened:** 2026-09-24 (Adam named this file).  
**Soft tag:** **rules/filings** — a record or filing a regulator or registry requires by a dated deadline (HMRC UK CBAM; 1 Jan 2027 records, 31 May 2028 first return). Decided 2026-09-24: Adam approved the fifth tag rules/filings for Control Ledger and Taxpoint; earlier provisional tag was resource/commons. No secondary tag.  
**Jurisdiction:** **United Kingdom**.  
**Sources:** all figures and dates below are **per writeup, sources named, not verified by Grok**.

---

## One-liner

Turn a UK importer's customs entries, mill papers, and foreign carbon-price receipts into the six-year record HMRC requires for the UK carbon border tax (UK CBAM), then hand the emissions opinion to an accredited verifier.

## The clock (per writeup, sources named, not verified by Grok)

- From **1 Jan 2027**, specified **aluminium, cement, fertiliser, hydrogen, iron and steel** imports carry the tax. Records start that day, **even for importers under the line** who must prove non-liability.
- **Liable person:** the importer on the customs declaration.
- **Registration threshold:** once goods hit **£50,000** on either test:
  1. expected value over the **next 30 days**, or
  2. value over the **preceding 12 months** (counted from 1 Jan 2027 only, in year one).
- **Registration opens 1 Jan 2028** (HMRC collection page); first-year registrants have until **31 Jan 2028** (policy summary).
- **First accounting period:** all of 2027. **First return and payment due 31 May 2028.**
- Sources: HM Treasury / HMRC "CBAM: Policy summary" (collection updated 9 Sep 2026); HMRC "Keeping records for CBAM" (16 Jul 2026).
- Rates and default values: still "guidance soon."

## Messy input

- C88 entries, invoices, bills of lading, packing lists with gross weight.
- Mill certificates and heat numbers **without tCO2e**.
- Supplier "we already pay carbon tax" notes **without a verifier form**.
- Mixed containers: covered goods, **scrap (out of scope from 1 Jan 2027)**, precursors.
- Commodity codes that don't match the annex.

## Gatekeeper

**HMRC.** Known failure rules (per writeup, sources named, not verified by Grok):
- Carbon-price relief claimed **without the HMRC verification form** by a suitable verifier.
- Actual emissions claimed **without a verification report** or good-specific summary.
- Weight **including packing**.
- Scrap coded **in scope**.

A **tax agent** may file the return but **cannot register the importer** and does not take the tax.

## Packet (one line per import)

| Field | Notes |
| --- | --- |
| 8-digit commodity code | Checked against the UK annex |
| Tax-point date | |
| Value | |
| Net weight | Packing excluded |
| In scope or not | Scrap / outward-processing exclusions applied |
| £50,000 test | Which test trips (30-day forward or 12-month back) and when |
| Emissions basis | Actual or default |
| Carbon-price relief (if claimed) | Qualifying scheme; verifier form; prior-quarter headline carbon price; HMRC exchange rate; sterling relief |

**Retention:** kept **six years** after the accounting period.

## Who signs

- **Not us.**
- Actual emissions are checked by an **independent verifier accredited to ISO/IEC 17029:2019 and ISO 14065:2020** by an eligible body.
- The **importer or a tax agent** files.
- Start **under a verification body or a customs tax agent**.

## Money (our fees, unverified)

- **Readiness sprint** before 1 Jan 2027: **£2,500–£6,000**.
- Then **£800–£2,000 a month** through 2027.
- Example: **Oct 2026**, a steel stockholder pays **£4,000** for 14 months of entries and mill certs.

## First 10 customers (no phone)

Adam has **no phone**; channels are written and email, with video only after email. **Outreach is paused** (listed for when Adam lifts it).

1. A forwardable one-page email for customs agents.
2. Search pages on "UK CBAM £50,000" and annex codes.
3. Notes to UK Steel, Aluminium Federation, Mineral Products Association, and Agricultural Industries Confederation bulletins.
4. Video clinics only from email.

## Shared parts used

| Shared part | How Taxpoint uses it |
| --- | --- |
| Shared intake | Customs entries, invoices, mill certs, carbon-price receipts; `meta.json` with `venture: taxpoint-file`, `jurisdiction: uk` |
| Gatekeeper packet template | HMRC line file plus relief calculation |
| Licensed-partner bench | Accredited verifiers (ISO/IEC 17029 / ISO 14065); customs tax agents |
| Consent and data-rights record | Importer authority; mill permission to pass emissions data to the verifier |
| Readiness sprint (paid prep) | Pre-1 Jan 2027 sprint |
| Deadline calendar | 1 Jan 2027 (records start); 30-day forward threshold clock; 1 Jan 2028 (registration opens); 31 Jan 2028 (first-year registration); 31 May 2028 (first return + payment) |
| Jurisdiction rule sets | UK annex codes; scrap and outward-processing exclusions; qualifying carbon-price scheme list |
| Scope / exemption worksheet | £50,000 threshold tests; in scope / out of scope per line |

## New to the company (not in other ventures yet)

- Running the **two threshold tests** with the 2027 look-back start.
- **Splitting one container** into covered goods, scrap, and precursors.
- The rule that a **default may cover a precursor when the finished good uses actual data, but not the reverse**.
- **Converting a foreign carbon price to sterling** at the prior-quarter HMRC rate, tied to the verification form.

## Risks

- Importers use **tolerable government defaults** and never chase mills.
- Customs software already holds code, value, date, weight.
- **A tolerable default plus a broker threshold sheet kills it.** The specialist file matters only for **actual emissions** and **carbon-price relief** where the mill's country runs an HMRC-accepted scheme.

> **Grok note:** the EU runs a larger carbon border mechanism (Grok's understanding: its definitive charging period began in 2026; **to verify**). If so, the EU is a **second jurisdiction rule set** for this venture, not a new venture. US-based Adam needs a **UK partner / entity answer first**.

## Attempts

| Date | Attempt | Result | Notes | Score |
| --- | --- | --- | --- | --- |
| 2026-09-24 | File opened (Adam named it); writeup filed as RESEARCH · resource/commons (provisional); United Kingdom jurisdiction | Filed, docs only | No build; no outreach; no phone; figures per writeup, not verified by Grok | |
