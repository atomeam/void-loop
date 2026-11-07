# UGREEN Hackathon 2026 on AI NAS: round 1 draft

- Event: https://ugreenhackathon.devpost.com/ (rules: /rules). Registration and round 1 both close Nov 15, 2026, 11:45 PM Pacific.
- Round 1: a proposal PDF (ten items, 500 English words in all, 1 MB at most) and a pre-test Skill package ZIP (SKILL.md required,
  no executable scripts, 10 MB at most). No NAS needed until the finals; finalists get one.
- Open item: the skill must use only the CLI capabilities listed in UGREEN's Skill Creation Tool archive (uliya-skill-kit 0.7.3,
  linked from ai.ugreen.com/pages/hackathon-starter-kit). Verse could not download it from here, so the capability names in the
  SKILL.md below are the starter kit's area names (Files, Documents, Knowledge) and must be matched to the kit before submitting.

## Proposal (draft, about 430 words)

1. **One sentence.** repo-review reads the code projects kept on your NAS and writes a plain review of bugs and security holes next
   to them, without the code leaving the house.
2. **User and problem.** Home and small-team developers back up their projects to a NAS. Nobody reviews those copies; the leaked
   key or the SQL injection sits there until it ships.
3. **Solution.** A skill that walks a chosen project folder, runs a pattern review for bugs, risky habits and secrets, then asks the
   NAS's own model for a closer read that must quote the lines it flags.
4. **Core flow.** The user says "review my project in Projects/shop". The skill lists the folder, reads the source files, reviews
   them, and saves review.md beside the project with each finding, its line and a suggested fix.
5. **What differs.** Cloud reviewers need the code uploaded. This runs on the NAS. Every finding quotes the real line, and claims
   that quote nothing are dropped, so the report has no invented problems.
6. **NAS capabilities.** Files (list and read the project, step 1 and 2), the local model (closer read, step 3), Documents (write
   review.md, step 4), Knowledge (keep past reviews so a repeat run reports only what changed).
7. **Technical approach.** Read-only on source files; the only write is review.md. Inputs: a folder path, optional language and
   focus. Secrets found are masked in the report. Model: the NAS's on-device model. Nothing is sent off the device.
8. **Status.** The review logic runs today in Verse's code review (a-to-mind.com/code-review/, open source); the skill packaging
   for UGOS is new for this hackathon.
9. **Validation plan.** Case 1: a small JavaScript project with a planted SQL injection: reported with its line. Case 2: a clean
   project: "nothing found", no invented findings. Edge case: a folder with a 5 MB minified file and binaries: skipped and named.
10. **Limits and risks.** Very large repositories are reviewed in parts; the closer read depends on the NAS model's quality;
   languages beyond the common ones get the pattern checks only.

## SKILL.md (draft for the pre-test package)

```markdown
---
name: repo-review
description: Reviews a code project stored on the NAS for bugs, security holes and leaked secrets, and saves a plain review (review.md) beside it. Use when the user asks to review, check or audit code in a NAS folder. Read-only on the code; the code never leaves the device.
---
# repo-review

## User goal
Know what is wrong with a project kept on the NAS before it ships, without uploading the code anywhere.

## Required inputs
- folder: the project folder on the NAS (ask for it if the user did not name one)
- focus (optional): what to look for, such as security or SQL

## Supported CLI capabilities
- Files: list the folder; read source files (text files under 1 MB; skip binaries and minified files and name them)
- Documents: write review.md in the project folder
- Knowledge: keep the last review so a repeat run reports what changed
(Match each to the exact capability names in the Skill Creation Tool before submitting.)

## Workflow
1. Confirm the folder with the user and say that only review.md will be written.
2. List the folder; pick the source files; name what is skipped.
3. Review each file: injection, eval, assignment in conditions, unsafe HTML, leaked keys (masked in the report).
4. Ask the on-device model for a closer read of the flagged files; keep a finding only when it quotes a real line.
5. Write review.md: each finding with file, line, the quoted line, why it matters and a suggested fix.

## Completion and failure
- Done: tell the user how many findings, the worst one, and where review.md is.
- Nothing found: say so plainly; never invent a finding.
- Folder missing or unreadable: say which, and ask for another folder. Never write anywhere but review.md.
```

## What only Atom can do

Register on Devpost for the UGREEN hackathon, accept its rules, and submit the PDF and ZIP (Verse builds both once the kit's
capability names are matched).
