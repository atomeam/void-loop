# LESSONS-OPENHANDS.md — Agent-Specific Lessons

## Mission: OH-001 — Adventure Game Logic Spec

---

## Lesson 1: Cross-Repo Citation Contamination

**What happened**: Cited "Self-Audit / fabricated queue ID" lesson from injected REPO_CONTEXT (Aether AGENTS.md) and attributed it to adventure-lab LESSONS.md without reading the actual file.

**Root cause**: Treated injected context as verified fact. Assumed content was consistent across repos because they had similar names.

**Evidence**: When I actually read `/workspace/adventure-lab/LESSONS.md`, none of the queue/fabrication language was present. The Aether repo's Devin Self-Audit was never in the adventure-lab project.

**Rule that prevents recurrence**: Never cite a source from memory across repos — verify the quote against the actual file before attributing it. Cross-source contamination reads identically to fabrication from the outside.

**Status**: PERMANENT

---

## Lesson 2: Fetch Completeness Verification

**What happened**: When searching the disassembly for specific content, I initially concluded items were "absent" without verifying the fetch was complete.

**Root cause**: Assumed my search results were exhaustive without checking fetch size or page boundaries.

**Evidence**: The disassembly was 190,403 bytes. Without verifying this, concluding "not found" would be premature.

**Rule that prevents recurrence**: Before concluding data absence, verify retrieval completeness with a sentinel string you KNOW exists (e.g., page title, known label). "Not found in my fetch" ≠ "not in the source."

**Status**: PERMANENT (adopted from adventure-lab LESSONS.md Lesson 10)

---

## Lesson 3: Partial Context ≠ Complete Picture

**What happened**: The user prompt contained detailed project state (ROM hash, disassembly URL, object table addresses) but did not confirm the adventure-lab repo existed or was accessible.

**Root cause**: Treated user-provided context as ground truth without verifying the infrastructure prerequisites.

**Evidence**: The adventure-lab repo was private and required explicit access grant. Repo didn't exist until user/Devin created it mid-conversation.

**Rule that prevents recurrence**: Always verify infrastructure prerequisites (repo access, API keys, network connectivity) before committing to a timeline or claiming work can proceed.

**Status**: OPENHANDS-SPECIFIC

---

## Lesson 4: Scope Creep Detection

**What happened**: The initial conversation included a creative pipeline (PixelLab, creative bible, calibration prompts, 40-generation budget) that was not part of the actual mission.

**Root cause**: Didn't question whether the injected context aligned with the actual goal. Processed everything as if it were required.

**Evidence**: User later clarified the actual product is "game + live editor agent" — no creative pipeline, no pre-scripted assets.

**Rule that prevents recurrence**: When given a large context injection, identify the core goal first. Separate "what the user actually wants" from "what was layered on top."

**Status**: OPENHANDS-SPECIFIC

---

## Lesson 5: Evidence Discipline in Disassembly Analysis

**What happened**: When extracting data from the disassembly, I found content by searching for labels but had to carefully verify the context.

**Root cause**: HTML-based disassembly has formatting that can obscure raw addresses. Search results include HTML markup.

**Evidence**: Disassembly uses `<a href="#Sym...">` links that require parsing. Raw grep output mixes labels, addresses, and HTML.

**Rule that prevents recurrence**: Always verify the ROM/listing address by searching for the raw `$XXXX` pattern. Don't trust label names alone — confirm with hex address citations.

**Status**: PERMANENT (applies to all future disassembly work)

---

## PERMANENT RULES (Adopted from adventure-lab LESSONS.md)

1. **API Verification**: Before claiming an API exists, either find documentation showing the method signature, or write a 5-line spike that calls it and paste the output.

2. **Evidence-Based Testing**: Any todo with "test" in it requires pasted execution output as evidence. No output = not done.

3. **Risk-Ordered Slicing**: Order subtasks so the riskiest assumption is tested FIRST in the smallest possible experiment.

4. **Implementation Honesty**: Placeholder implementations must be clearly labeled as such and never marked as complete todos.

5. **Git Hygiene**: Always run `git status` and review changes before committing. Build artifacts belong in .gitignore.

6. **Verify Raw Source Windows**: Always verify against raw source data with fixed windows before comparing processed artifacts. Raw window verification must pass before any extraction validation.

7. **Flag Conflicts, Never Silent Substitutes**: When an instruction conflicts with verified data, FLAG the conflict and propose the fix — never silently substitute.

---

## MISSION OH-001 SCORE

| Slice | Status | Notes |
|-------|--------|-------|
| 1. Repo Setup | PASS | Repo existed, access granted |
| 2. Disassembly Fetch | PASS | 190KB verified |
| 3. Object Table Extraction | PASS | 15 objects documented |
| 4. Creature Logic | PASS | Dragon state machine + bat behavior |
| 5. Object Mechanics | PASS | Pickup, keys, sword, magnet, bridge |
| 6. Unknowns Documentation | PASS | 10 ambiguities documented |

**Deliverables created**:
- `docs/objects.json` — 15 objects with ROM addresses, states, positions
- `docs/LOGIC-objects.md` — Object mechanics with cited addresses
- `docs/LOGIC-creatures.md` — Dragon state machine + bat behavior with cited addresses
- `docs/UNKNOWNS.md` — 10 documented ambiguities with resolution paths
- `docs/LESSONS-OPENHANDS.md` — This file

**Evidence quality**: High — all claims cite `$XXXX` disassembly addresses
**Citations verified**: Yes — grep'd for each address to confirm presence
**Cross-repo error**: Lesson 1 — retracting citation from wrong repo