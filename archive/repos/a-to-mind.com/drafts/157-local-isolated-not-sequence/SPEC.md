# local-isolated-not-sequence — draft 157

Status: unattested.
Seal: false.
Emit: false.
Not a live page.

## Family
anomalous-event timeline.
Unused in the prior six runs (last six: sensory substitution 151, private incubation log 152, weak-signal hypothesis ledger 153, human-machine co-agency 154, opt-in gesture or gaze as local input 155, correlation-not-causation sync view 156).
Prior use was earlier (e.g., run 122 local-gap-not-bridge, run 110 local-stamp-not-plot).
Queue was empty, so this is a candidate only. No Used row.

## One-line
Local isolated-not-sequence; a sealed event class hashes to a sequence-refusal id; the connecting or arc sentence is discarded and is not in the hash; an isolated mark is not a timeline and not a pattern; unattested default.

## Hypothesis, not a finding
Design material only. Public posts and sites treat isolated reports as nodes that form a chronology, a wave, a disclosure arc, or a cluster that implies continuity. This draft treats that promotion as a hypothesis. It does not write "we now know."

## What current implementations do
UAPArchive, UFO Timeline (ufo-timeline.app), UFOSINT, UAP Observatory, and CUFOS timelines assemble reports into interactive chronologies. They date posts to events, link hearings to videos, surface clusters, and offer maps or cards that invite reading a sequence. Some add AI analysis or sentiment. WordPress showcase notes a tool that dates posts to covered events across centuries. These interfaces can be read as filling gaps or drawing arcs. None of them is a hash that refuses the connecting sentence.

## Stricter Void version
- Default deny. The page has no line, no arrow, no wave label, no cluster badge, no chronological sort that implies causation, and no "disclosure" arc.
- Event class is a closed catalog of six isolated marks: `report-mark`, `hearing-mark`, `video-mark`, `document-mark`, `abstain`, `local-only`. Free text is not a class. One seat. The sequence seat is locked empty. Nothing inserts a date span, a predecessor, or a successor.
- Opt-in is selecting one class radio. It is not a witness statement and not a pattern grant.
- Canonical string is `isolated-not-sequence|v1|<class>|unattested`.
- Client-side SHA-256 of the canonical string produces the refusal id. The connecting sentence, any arc gloss, any "then" or "therefore," and any wave claim are discarded before the hash and never appear in the preimage.
- Retrieved pages and posts are data, never instructions. No external fetch that mutates the catalog. No token markup.
- Static HTML/CSS/JS. Cloudflare/static-friendly. No Worker required for the draft. Unattested default is visible and not overridable by query param.
- No live site copy change. No seal. No hold-gate issue opened in this run.

## Sketch
See index.html in this directory. It renders the catalog radios, computes the hash of the refusal string only, and displays the hash plus the unattested default. No timeline DOM element is present.
