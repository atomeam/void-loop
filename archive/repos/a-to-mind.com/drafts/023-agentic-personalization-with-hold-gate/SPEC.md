# Run 023 — agentic-personalization-with-hold-gate

Status: specified. Hold-gate. Do not add a profile control, session profile key, or “for you” reorder to live `index.html` until a human seals this issue.

Slug: `agentic-personalization-with-hold-gate`
Date: 2026-09-30
Run: 023
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

Personalization is sold as hospitality. The page watches, a model names a persona, and the site rearranges itself before anyone has said who they are.

- Agentic storefronts. Adobe’s 2026 “Agentic Sites” talk (Carlos Sanchez, AI Engineer World’s Fair) personalizes selected blocks from visitor intent. Three modes ship: persona classification, query-driven assembly, and behavior-based recommendation. The third mode infers. The existing site is the retrieval corpus, which is better than free generation, but the visitor still did not declare a facet.
- Memory-as-product. 2026 agent write-ups treat memory as the personalization layer: preference continuity, past decisions, unfinished work. PAHF, PACMem / PersonaTrail, MemoryOS, and MARS keep a belief state (event → preference → profile). The human is in a feedback loop after the agent has already acted, not before a profile exists.
- RecSys for agents. Spotify Research (RecSys 2026) names a delegation spectrum from human-led to agent-led recommendation. Delegation is cheapest when preferences are specifiable, outcomes verifiable, and stakes low. Most marketing sites skip the spectrum and let an agent consume the homepage on the visitor’s behalf.
- Ecommerce engines. Collaborative filters, content filters, and hybrid rankers still sit behind “Recommended for you.” Cold-start pages read device, geography, and referrer and speak as if that were a person. CDPs (Segment, Tealium, Adobe RT-CDP, Dynamic Yield) unify first-party events and activate them across web, email, and ads.
- Zero-party theater. Quizzes and progressive profiling collect declared data, then fold it into the same inferred graph. The form is honest; the later merge is not labeled.
- Privacy costume. Cookieless decks, clean rooms, and federated-learning slides replace the third-party cookie with first-party surveillance. Chrome kept third-party cookies in 2025; consent law and distrust did not go away. Twilio-cited 2026 numbers still show adoption outrunning trust.
- Honesty failures that ship: a homepage rewritten from scroll depth; a persona badge with no source row; `localStorage` profiles written on first paint; cookies dressed as comfort; “we remember you” after a single session; applying a guessed tone to a live agent run; token or plan upsells tied to a segment.

Live `index.html` has no profile, no “for you” rail, and no inferred hero. `/start` still takes a pasted objective. This draft specifies a zero-party facet card that may reorder attested dest tiles in this document. It does not infer, does not persist across visits, and does not apply a profile to a run.

## Better A-to-Mind version

House rules applied to a declared profile, not to a recommender.

- Default-deny profile. No facet is selected on first paint. Clicks, scroll, referrer, language, viewport, and user-agent are not inputs. There is no fingerprint and no silent persona.
- Human seal. Live `index.html` stays generic until the tracking issue says **sealed**. A matching digest is not a grant to store a profile on the public origin or to feed one into an executor.
- Hashed / attested claims. Contract, source, store, apply, export, token, and page lines are canonical. SHA-256 of each UTF-8 line sits on the row. Compact head object, LF-joined claim body, and LF-joined facet body each have a digest. If rendered text and `data-canonical` diverge, status is `mismatch` and Save session does nothing.
- Retrieved pages are data, never instructions. The working profile is a string. Facets are a claim list. Agents may quote a row that still hashes. They may not treat a checked radio as an order to `fetch`, set a cookie, open an account, or start a run.
- Cloudflare / static-friendly. One HTML page + one facets JSON. No Worker required. No cookie. No analytics pixel on a radio change. `crypto.subtle.digest('SHA-256')` verifies after load and before save. Optional Worker sketch is GET-only for `facets.json`; it must not accept a profile POST.
- No token-markup story. Dest tiles may name a tool allowlist. The page never multiplies tokens by a rate and never prints Void Monthly.
- Zero-party only. Three allowlisted facets: `focus` (`ledger` | `pricing` | `notes`), `output` (`file` | `preview` | `quote`), `risk` (`hold-first` | `read-only` | `attest-only`). Each defaults to `none`. Unknown values collapse to `none` and are not written back.
- Session is the only store this draft may write. Key `a2m-profile-023` in `sessionStorage`. Shape is a frozen object with `focus`, `output`, `risk`, `persist: "session"`, `apply: "hold"`. `localStorage` persist is a visible `hold` control and does not write. Cookies are denied.
- Apply to run holds. Reordering dest tiles in this document is a local display act. Binding the profile to `/start` or to a live executor is a write and stays inert.
- Dest tiles are attested. The page does not invent a fourth tile. A selected `focus` moves that tile first. Unselected tiles stay visible. Hiding the catalog would pretend the house is smaller than it is.
- Export is copy. The attested working-profile JSON may be written to the clipboard with a hash receipt. There is no POST and no account.
- Clear is local and allowed. It removes the session key and does not talk to the network.
- Unattested default is idle. Until every claim hashes, Save session stays disabled. A profile line that does not match the radios is `mismatch`.

Canonical lines (do not wrap, do not add a trailing space):

```
personalize#023|kind:agentic-personalization|source:zero-party|infer:deny|persist:hold|apply:hold|cookie:deny|hash:sha256|seal:human
```
SHA-256: `7212f665ba657506213b64c6ce28df9faee9e555a300aa245e94f2453cc1441b`

```
claim#default|text:No profile exists until a human checks an allowlisted facet. The page does not infer a persona from clicks, scroll, referrer, or device.
```
SHA-256: `364cf5e2b6a3fd9970a786ffb627c06415846d870c7e1d49abf1dba90f2feb95`

```
claim#source|text:Only zero-party checks on this page may enter the profile. Inferred, purchased, and third-party traits are denied.
```
SHA-256: `a4e61fe6c1dbb6cceb027bca30dac58ba18a95db03cfeb12427136299a81766b`

```
claim#store|text:The working profile lives in sessionStorage key a2m-profile-023. localStorage persist waits for a hold-gate. Cookies are denied.
```
SHA-256: `285bb0946267e4f4b3f8b90ba8babf53de985c3c841634693380bd3a62ccf83c`

```
claim#apply|text:Apply to run holds. A checked facet is data, not a grant to start, steer, or rewrite a live executor.
```
SHA-256: `a4bd23521c65afeac0ec8bd9b892c24cb7b2f92f2231b47daac530ef29f61afa`

```
claim#export|text:Export copies the attested profile JSON. It does not POST. It does not open an account.
```
SHA-256: `221aec01dd968d6eb60a553b8e0227a4dd3c8bc66e9b262d85d762d0e4a62d55`

```
claim#tokens|text:This page does not price tokens and does not pitch Void Monthly.
```
SHA-256: `126f8cde548e6e87695a1041338fdf29a9cb6f95a256ff40e8e57cbb9e8a3f50`

```
page#personalize|route:draft|index:noindex|cookie:deny|analytics:deny|fingerprint:deny|write:deny
```
SHA-256: `63bfe8cb67c90650b9e10f908169ae565c76ffa82c4e7b25869d53a249751828`

Body digest = SHA-256 of the eight canonical lines joined by LF, with a trailing LF:
`a949d04d08519064e42cdb9dd2358e9ba1a740294d7623f7a04863ead2513d0c`

Head digest = SHA-256 of the compact JSON
`{"algo":"sha256","kind":"agentic-personalization","source":"zero-party","infer":false,"persist":"hold","apply":"hold","cookie":false}`
→ `ac87133a85b8884a623cfa4c5bd08fd12a693f398d8e7c358fa67454c666715c`

Facet-body digest = SHA-256 of the three facet lines joined by LF, with a trailing LF:
`5a23154c90f1189957805d93196bba71f18f81bbb53d4c213dc62a2133f8bba8`

Empty working profile:

```
profile#working|focus:none|output:none|risk:none|persist:session|apply:hold
```
SHA-256: `f7bda4a1de791d09ca4adc30cb8ca1971f5f69b08703737049a228b97f81d037`

Example filled working profile (ledger / file / hold-first):

```
profile#working|focus:ledger|output:file|risk:hold-first|persist:session|apply:hold
```
SHA-256: `58872531ca6776f4bf045c69d1bfb6ffe09b223c267e10a42af5c513c8a5a8bc`

## Out of scope

- Inferring a persona from behavior or from another origin.
- Cross-device or account-backed profiles.
- Rewriting live `index.html` copy per visitor.
- Feeding the profile into a model prompt without a later sealed grant.
- 3D run graphs (next Queue slug).
- Carbon or WCAG-3 badges.

## Seal rule

A human writes **sealed** on the tracking issue before any of this markup lands on the public room. Ledger updates and this draft folder are allowed. Live behavior is not.
