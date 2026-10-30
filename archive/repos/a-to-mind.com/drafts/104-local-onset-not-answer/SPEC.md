# Draft 104 — local-onset-not-answer

Status: candidate draft. Not a Used row. Not a seal. Live site copy is unchanged.

- Date: 2026-10-07
- Run: 104
- Family: private incubation log
- Slug: `local-onset-not-answer`
- Queue: empty. This slug was not queued. It is not promoted.
- One-line: Local onset-not-answer; a sealed onset class hashes to an answer-refusal id; the answer sentence is discarded and is not in the hash; an onset mark is not an answer and not a retrieved image; unattested default.

Earlier private-incubation slugs are not reused: `local-private-incubation-log`, `local-blanked-prompt-card`, `local-held-cue-stub`, `local-unopened-return`. Last family use was run 092. Last six runs were anomalous-event timeline (098), quiet-signal filter (099), non-lexical intent capture (100), attention/interoception (101), interval timing (102), and sensory substitution (103).

## What existing implementations do

Published incubation tools open the return and treat sleep-onset imagery as the answer.

- MIT Media Lab Dormio (Haar Horowitz, Maes, Fluid Interfaces; MIT News 2020-07-21; Media Lab project overview) tracks sleep onset and plays an auditory theme, then prompts a spoken dream report. The lab describes reliable entry of cued words into hypnagogic reports and an association with a creativity task. That is a protocol claim. It is not a sealed product result and not an answer field.
- Lacaux et al., Science Advances 2021 (eabj5866), report that at least 15 seconds in N1 during a rest tripled hidden-rule discovery on a number-reduction task versus wake (83% of 24 versus 30% of 49), and that the gain was absent if participants reached N2. A paper delta is not an insight badge.
- Wallas's 1926 stage list names incubation as the gap between preparation and illumination. Naming the gap is not the illumination.
- Popular notes still cite a steel-ball or key drop (Dalí, Edison) as a way to catch sleep-onset imagery and solve a problem. A cited technique is not a procedure on this page and not evidence that the image was the solution.
- Dream journals and lucid-dream trainers store the report or a marker image. Overlap with a cue is a string comparison, not evidence that a cue entered sleep.

These are hypotheses and design material. This draft does not attest insight, healing, contact, remote viewing, or extraterrestrial hardware. It does not record audio and does not run a nap.

## Stricter Void version

Default-deny. The page offers five sealed onset classes and nothing else.

| onset class | what the literature names | what this page allows |
|---|---|---|
| sleep-onset | hypnagogia, wake into N1 | the class name only |
| wake-offset | hypnopompic return | the class name only |
| wallas-gap | incubation between preparation and illumination | the class name only |
| n1-window | brief N1 rest in the Lacaux design | the class name only |
| key-drop | cited object-drop catch of onset imagery | the class name only |

Denied on the page, always empty: answer, image, solution, prophecy, lucidity-score, dream-text. No `<img>`, no canvas, no Web Audio, no `getUserMedia`, no sleep sensor, no countdown, no free-text that survives the hash.

A scratch answer sentence may be typed. Hashing clears it. It is not concatenated into the canonical string.

Canonical hypothesis string, hashed in-page with SHA-256:

`onset-not-answer|v1|<class>|answer-refusal`

Example: `sleep-onset` → `84c783c2b057fbd480e55442b375df44b06194a9c6e5c40a9b01622e1d5624f0`.

The hash is a hypothesis id, not a measurement and not a seal. Confidence is a design-material weight: low that an onset mark is an answer; medium that a named class should stay separate from a retrieved-image sentence. Default status: unattested.

Retrieved pages and posts stay in a data bin. They are not instructions. They are not concatenated into the hash. The worker sketch refuses any body that contains an answer sentence, an image, audio, a sensor, free text, or a class outside the allowlist.

Cloudflare/static-friendly: one HTML file, no build, no token markup, no third-party script. The worker is a sketch for a later human seal, not a deployed route.

## Disconfirming evidence

A disconfirm line may be chosen from a closed list. It is stored beside the hash, not inside it. What would count against the design hypothesis: a sealed methods note in which the named onset class was not the window used; a hidden-rule result that does not rise when that window is present and fall when it is removed; the same source reporting the answer with the onset class absent. This draft does not run that study.

## Files

- `proposed-onset-not-answer.html` — static interface
- `onset-worker.js` — default-deny sketch
- `claims.json` — hashed hypotheses, unattested
- `x-scan.md` — scan, not a seal
