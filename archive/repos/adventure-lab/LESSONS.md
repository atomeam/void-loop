# LESSONS LEARNED

## Mission: Adventure Emulator with Agent Play Mode

### Lesson 1: Assumption vs Known - RAM Access APIs
**SURPRISE:** Javatari.js does not expose public RAM access APIs despite being a full emulator.
**ROOT CAUSE:** Assumed "full emulator" includes "RAM access APIs" without verifying. Treated assumption as known.
**RULE:** Before claiming an API exists, either (a) find documentation showing the method signature, or (b) write a 5-line spike that calls it and paste the output.
**PERMANENT:** ✓ (This is a fundamental verification pattern)

### Lesson 2: Marking Tests Done Without Execution
**SURPRISE:** Marked browser-agent-test.js and headless CLI todos as complete without running them.
**ROOT CAUSE:** Conflated "wrote test script" with "ran test and captured output."
**RULE:** Any todo with "test" in it requires pasted execution output as evidence. No output = not done.
**PERMANENT:** ✓ (Evidence-based completion)

### Lesson 3: NPM Package ≠ Drop-in API
**SURPRISE:** 6502.ts NPM package requires complex build setup for Node.js API access.
**ROOT CAUSE:** Assumed "available on NPM" means "simple require() and use." Didn't read the actual API documentation.
**RULE:** Before adding a dependency, read its actual usage docs. If it mentions "build system" or "webpack," treat as complex integration, not drop-in.
**PERMANENT:** ✓ (Dependency verification)

### Lesson 4: Slice by Risk, Not Sequence
**SURPRISE:** Built full CLI scaffolding before verifying the core emulator could run headless.
**ROOT CAUSE:** Ordered tasks by "what seems logical" not "what might fail." Should have tested 6502.ts headless capability first.
**RULE:** Order subtasks so the riskiest assumption is tested FIRST in the smallest possible experiment.
**PERMANENT:** ✓ (Risk-ordered slicing)

### Lesson 5: Placeholder Code ≠ Working Code
**SURPRISE:** Implemented peek/poke as placeholders that throw errors, but marked as complete.
**ROOT CAUSE:** Treated "wrote the function signature" as "implemented the feature."
**RULE:** Placeholder implementations must be clearly labeled as such and never marked as complete todos.
**PERMANENT:** ✓ (Implementation honesty)

### Lesson 6: Git Hygiene - Committed Build Artifacts
**SURPRISE:** .vercel/ directory was committed to git (build artifacts).
**ROOT CAUSE:** Didn't check what was being committed. Just ran `git add .`
**RULE:** Always run `git status` and review changes before committing. Build artifacts belong in .gitignore.
**PERMANENT:** ✓ (Git hygiene)

## PERMANENT RULES (Apply to All Future Work)

1. **API Verification:** Before claiming an API exists, either find documentation showing the method signature, or write a 5-line spike that calls it and paste the output.

2. **Evidence-Based Testing:** Any todo with "test" in it requires pasted execution output as evidence. No output = not done.

3. **Dependency Verification:** Before adding a dependency, read its actual usage docs. If it mentions "build system" or "webpack," treat as complex integration, not drop-in.

4. **Risk-Ordered Slicing:** Order subtasks so the riskiest assumption is tested FIRST in the smallest possible experiment.

5. **Implementation Honesty:** Placeholder implementations must be clearly labeled as such and never marked as complete todos.

6. **Git Hygiene:** Always run `git status` and review changes before committing. Build artifacts belong in .gitignore.

## MISSION SCORE

**Phase 4 Kickback:**
- Slices passed on first attempt: 0/8
- Kickbacks required: 1 (major)
- Longest-surviving assumption: "Javatari exposes RAM access APIs" (survived through implementation, caught at testing)
- Root cause pattern: Assumptions treated as knowns without verification

**Overall Mission (Phases 1-2):**
- Slices passed on first attempt: 5/5
- Kickbacks required: 0
- Evidence quality: High (screenshots, deployment URLs, git verification)

**Mission 002 (Evidence Completion):**
- Slices passed on first attempt: 4/7 (A1 FAIL, A2 FAIL, A3 PASS, B1 DESCOPED, B2 PASS, C1 DESCOPED, D1 PASS)
- Kickbacks required: 0 (evidence-first approach prevented kickbacks)
- Descopes: 3 (honest, documented)
- Evidence quality: High (spike outputs, git status, README updates)

**Key Insight:** The difference between Phase 4 (failure) and Mission 002 (controlled descopes) was evidence discipline. Mission 002 tested risky assumptions first with minimal spikes, leading to quick FAIL verdicts and honest descopes rather than placeholder implementations.

## LESSON 7: Risk-Ordered Slicing Works

**SURPRISE:** Testing 6502.ts with a 10-line spike immediately revealed the dependency injection complexity.
**ROOT CAUSE:** In Phase 4, built full CLI scaffolding before testing the core. In Mission 002, tested core capability first.
**RULE:** Order subtasks so the riskiest assumption is tested FIRST in the smallest possible experiment.
**PERMANENT:** ✓ (Already established)

## LESSON 8: Honest Descope > Placeholder

**SURPRISE:** Removing non-functional code and documenting limitations is better than leaving placeholders.
**ROOT CAUSE:** Fear of "failure" led to placeholder implementations in Phase 4. Mission 002 embraced descopes.
**RULE:** When a slice FAILS, either (a) split smaller, (b) swap approach, or (c) descope honestly with documentation. Never leave placeholders.
**PERMANENT:** ✓ (New rule - descoping is valid outcome)

## LESSON 9: Verify Raw Source Windows, Not Processed Artifacts

**SURPRISE:** Compared extracted runs from sprites.json against operator's raw ROM windows instead of verifying raw ROM bytes first. Processing differences masqueraded as data differences.
**ROOT CAUSE:** Compared processed artifacts (sprites.json) against raw source data (ROM windows) instead of raw-to-raw verification first.
**RULE:** Always verify against raw source data with fixed windows before comparing processed artifacts. Raw window verification must pass before any extraction validation.
**PERMANENT:** ✓ (New rule - raw-first verification protocol)

## LESSON 10: "Data Absent From My Fetch" ≠ "Data Absent From The Source"

**SURPRISE:** Concluded NTSC Easter egg address was absent from disassembly HTML when operator found it present. Fetch was truncated.
**ROOT CAUSE:** Third universal-negative from incomplete evidence. Did not verify retrieval completeness with sentinel string known to exist.
**RULE:** Before concluding data absence, verify retrieval completeness with a sentinel string you KNOW exists (e.g., page title). "Not found in my fetch" ≠ "not in the source."
**PERMANENT:** ✓ (New rule - verify retrieval completeness before concluding absence)

## LESSON 11: Flag Conflicts, Never Silent Substitutes

**SURPRISE:** Implemented route $11 → $01 → $04 which was graph-invalid ($04 not adjacent to $01). Silent reroute indistinguishable from wrong turn.
**ROOT CAUSE:** Instruction conflicted with verified data, but conflict was not flagged. Substituted route without proposing fix.
**RULE:** When an instruction conflicts with verified data, FLAG the conflict and propose the fix — never silently substitute. A silent reroute is indistinguishable from a wrong turn.
**PERMANENT:** ✓ (New rule - conflict flagging before substitution)
