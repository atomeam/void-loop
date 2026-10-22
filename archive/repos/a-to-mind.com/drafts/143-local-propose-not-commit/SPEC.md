# Run 143 — local-propose-not-commit

Status: draft only. Halt. Not promoted. Not sealed.
Family: human-machine co-agency
Slug: local-propose-not-commit
Date: 2026-10-10
Run: 143
Repo: atomeam/a-to-mind.com

## One-line
Local propose-not-commit; a sealed human proposal class hashes to a machine-execution-refusal id; the execution sentence is discarded and is not in the hash; a proposal mark is not an execution and not a co-authored action; unattested default.

## What existing sites do
Many AI interfaces (chat, agent tools, orchestration UIs) treat a human message or "approve" click as an implicit grant for the machine to continue, plan, or execute side effects. Some expose "human in the loop" but still allow the model to propose and then act on its own next step unless explicitly stopped. Retrieved context or tool results can be treated as instructions.

## Better A-to-Mind / Void version
Default-deny. A proposal is a sealed local class. Client-side SHA-256 of (proposal text + unattested flag + refusal marker) produces a refusal id. The execution sentence (any "run this", "commit", "act", tool call) is stripped and is not part of the hash. The resulting mark is data only: it is not an execution, not a co-authored action, not a shared timeline edit. Retrieved pages and posts remain data, never instructions. No token markup, no spend, no external write. Static-friendly; Cloudflare Pages compatible. No camera, microphone, or sensor. Confidence is design-material weight only.

## Sketch
See proposed-propose.html (single file, no external deps beyond native crypto.subtle).
Human types a proposal. JS computes hash of canonical proposal line. Displays refusal id. Explicitly states unattested default and that no action is taken. Hold-gate style: nothing leaves the page.

Canonical example line (do not wrap):
proposal#143|kind:human-proposal|exec:deny|hash:sha256|status:unattested

No live site copy changed. No hold-gate issue opened. X scan is data only.
