# Learning cards: explainers that hand off to a quiz and a five-minute challenge

Approved as build input by Adam, 2026-10-09 (two reviews; both sets of edits are applied here). Proposed specs, not built yet. Frontier item #17 (`domains/void.frontier.md`).
Everything here works offline: no accounts, no tracking, no outside model call.

**Build order:** gear explainer → moon explainer → lock explainer → quiz → five-minute challenge. Adam: "Revert fix stays at
priority 1 alongside the gear miniature."

**Blocked on:** the three explainer specs (gear pair, moon phases, lock cutaway) are not in this repo yet. Commit them
here beside this file, with Adam's four edits applied (below), before building the explainers.

## Rules for every card here

- **Ports have one name each:** explainer cards give `explanation: text`, `observations: list`, `model: model`. Not
  `phaseObservations` or `pinObservations`. A card that takes `observations` never needs to know which card sent it.
- **Tests first.** Every acceptance example is a required test named `<kind>/<case>` (for example
  `explainer.gear-pair/16-driving-32`). Write the tests from the acceptance list before the geometry. Auto-merge is gated
  only on tests that exist, so a card whose acceptance is prose only ships with no gate at all.
- **Derive from one authoritative state, never accumulate per frame** (the gear angle, the challenge timer).

### Adam's edits to the three explainer specs (apply before committing them)

1. Port names unified: gives `explanation: text`, `observations: list`, `model: model`. Rename `phaseObservations` and
   `pinObservations` to `observations`.
2. Every acceptance example becomes a required test named `explainer.<kind>/<case>`.
3. Moon: add the convention "right limb lit while waxing, northern-hemisphere view" to the spec's `conventions` block and
   to the on-scene schematic note.
4. Gear: the centre distance is derived, `(driverTeeth + drivenTeeth) * toothPitch / 2`, and asserted in the
   tooth-count-change test (no disconnected gears after the tooth count changes).
5. **Addenda: which items are assessable** (Adam, second review). Without them the quiz meets nothing eligible on day one
   and shows its empty state. Each explainer spec names its assessable items, with approved prompt wording:
   - gear: `drivenTurnsPerDriverTurn` (number)
   - moon: `illuminatedFraction` (number), `phaseName` (text; options: the eight phase names, new moon, waxing crescent,
     first quarter, waxing gibbous, full moon, waning gibbous, last quarter, waning crescent)
   - lock: `alignedPinCount` (number), `mechanismState` (text; options: the five mechanism states the lock spec names)

## 1. The shared observation contract

One port name needs one item shape too, or every taker still parses each explainer its own way.

```yaml
schema: void.observations.v1
source:
  cardId: example-card
  revision: 1
items:
  - id: example-observation
    label: Human-readable label
    value: 0.5
    valueType: number        # number | text
    unit: fraction
    meaning: What this value represents
    displayValue: "50%"
    assessment:
      enabled: true
      prompt: "What fraction is illuminated?"
      answerLabel: "50%"
      tolerance: 0.001
      options:               # text items only: stable ids + labels; the answer is one of the ids
        - { id: waxing-crescent, label: "Waxing crescent" }
      answerId: waxing-crescent
```

- `valueType` is `number` or `text` to start.
- A numeric item gives its unit, and when assessed, a tolerance.
- The source writes the question; a taker never invents a factual claim from a label.
- An item without `assessment.enabled` is still an observation but never becomes a question by itself.
- Both takers take the same payload whatever card sent it.
- Taking a handoff makes a snapshot: the source changing never silently changes an active question.
- No assessable items gives a plain empty state, never made-up questions.
- The envelope is still a `list` port; `schema` and `source` are its metadata.

- **Settled (Adam, second review):** a text item that can be assessed carries `assessment.options` (stable `id` plus
  `label`) and `assessment.answerId`. Free-text grading stays out of version 1, so a text item without options is never
  a question.

### Open points (settle in the contract before building the takers)

1. **What the tolerance is measured in.** Proposed: absolute, in the item's own `unit` (0.001 of a fraction). The test
   `learning.quiz/numeric-answer-respects-unit-and-tolerance` asserts it.
2. **"Nothing retained" against Void's stage.** Void saves every stage card with its state in the browser
   (`a2m.void.state.v1`), and for someone signed in with a passkey the stage syncs to their other devices through the
   server. So a quiz on the stage would keep its answers, and sync them, by default. These two cards must opt out: keep at
   most the snapshot, never the answers, unless the visitor asks to keep them. A required test should assert it.

## 2. Quiz card: "Quiz me on this"

After exploring a miniature the visitor asks "quiz me on this". A small question deck appears beside it: one question at
a time, an explanation after each, and a short review of what they got and what to look at again.

**Pipeline:** prompt → supported quiz spec → procedural question deck → shared scene → deterministic assessment → quiz card.

```yaml
kind: learning.quiz
version: 1
parameters:
  questionCount: 3
  answerMode: mixed          # numeric | choice | mixed
  feedback: after-answer     # after-answer | at-end
  questionOrder: source-order
  showSource: true
state:
  observationsSnapshot: null
  currentQuestion: 0
  responses: []
  status: ready
```

| Control | Behaviour |
|---|---|
| Question count | 1–5, capped by the eligible observations |
| Answer mode | Numeric entry, choice, or mixed |
| Feedback timing | After each answer, or at the end |
| Retry missed | A new attempt with only the missed questions |
| Refresh source | Replace the snapshot on purpose, and restart |

Choice questions use the source's own options only: no invented distractors.

**Scene:** a small deck or notebook with a progress marker. The question, the answer controls and the feedback stay
accessible text controls. No animation delays answering or hides the result.

**Behaviour:** ready → answering → submitted → feedback → next → complete.
- Each question records at most one scored answer.
- Numeric answers use the declared unit and tolerance; choice answers use stable option ids.
- No free-text grading in version 1.
- Completion shows the right answers and the missed items, with no personality or ability label.
- Reset clears the attempt; nothing is kept unless the visitor asks.

| Direction | Port | Type | Meaning |
|---|---|---|---|
| Takes | `observations` | `list` | The assessable snapshot |
| Takes | `explanation` | `text` | Optional context from the source, labelled as such |
| Takes | `questionCount` | `number` | How many questions |
| Gives | `observations` | `list` | Per-question results: assessment stays on for missed items (the original prompt, answer, options and tolerance) and is off for correct ones |
| Gives | `explanation` | `text` | The review and the corrections |
| Gives | `score` | `number` | Fraction correct, 0–1 |
| Gives | `model` | `model` | The deck's spec and its current state |

Next handoff, for example: "turn the questions I missed into a five-minute challenge". That works because the missed
items stay assessable; the challenge's empty state then means a perfect score, which is the right message anyway.

**Required tests:**
```text
learning.quiz/accepts-all-three-explainer-payloads
learning.quiz/caps-count-to-eligible-items
learning.quiz/rejects-malformed-observations
learning.quiz/no-assessable-items-shows-empty-state
learning.quiz/numeric-answer-respects-unit-and-tolerance
learning.quiz/choice-answer-uses-option-id
learning.quiz/duplicate-submit-does-not-double-score
learning.quiz/source-change-does-not-mutate-active-quiz
learning.quiz/refresh-source-restarts-attempt
learning.quiz/completion-reports-correct-and-missed
learning.quiz/retry-includes-only-missed-items
learning.quiz/reset-clears-attempt
learning.quiz/keyboard-completes-entire-quiz
```

## 3. Five-minute challenge: "Give me five minutes with this"

A short activity with a start, a finish and something learned. Version 1 is predict, inspect, explain:
1. Predict an answer from a hidden observation.
2. Submit the prediction.
3. Reveal the source value and inspect the miniature.
4. Compare the prediction with the result.
5. Finish with a one-sentence takeaway.

It reads observations; it never needs permission to change the source card.

**Pipeline:** prompt → supported challenge spec → procedural activity card and timer → shared scene → deterministic
session → challenge card.

```yaml
kind: learning.five-minute-challenge
version: 1
parameters:
  durationSeconds: 300
  roundCount: 3
  mode: predict-inspect-explain
  showTimer: true
  autoStart: false
state:
  observationsSnapshot: null
  rounds: []
  activeElapsedMilliseconds: 0
  status: ready
```

| Control | Behaviour |
|---|---|
| Start | Begins the challenge (never on its own after a handoff) |
| Pause / resume | Stops and resumes active time |
| Round count | 1–3, capped by the eligible observations |
| Timer display | Show or hide, without changing the timing |
| Finish now | Ends with the results so far |
| Restart | Clears the attempt, back to ready |

**Scene:** a small activity tray with three progress tokens and a timer. Reuse Void's existing timer card presentation
rather than a second timing engine. The source miniature stays open to inspect.

**Behaviour:** ready → active ↔ paused → completed, time-ended or ended-early.
- Time left derives from active elapsed time, never a per-frame countdown. Paused time does not count.
- Reaching zero ends it cleanly once, unfinished rounds included. Finishing every round early completes it at once.
- Revealing an answer makes that round ineligible for a later scored prediction.
- Reflections are optional and unscored. The summary describes results, not traits.
- Refreshing or closing the page leaves no hidden memory behind.

| Direction | Port | Type | Meaning |
|---|---|---|---|
| Takes | `observations` | `list` | Eligible facts and their prompts |
| Takes | `explanation` | `text` | Optional supporting explanation |
| Takes | `duration` | `duration` | Active-time budget; five minutes by default |
| Gives | `observations` | `list` | Predictions, revealed answers, outcomes |
| Gives | `explanation` | `text` | The takeaway and what is unfinished |
| Gives | `elapsed` | `duration` | Active time used |
| Gives | `model` | `model` | The tray's spec and its current state |

**Required tests:**
```text
learning.five-minute-challenge/accepts-all-three-explainer-payloads
learning.five-minute-challenge/handoff-does-not-autostart
learning.five-minute-challenge/no-eligible-items-shows-empty-state
learning.five-minute-challenge/caps-rounds-to-eligible-items
learning.five-minute-challenge/pause-excludes-paused-time
learning.five-minute-challenge/remaining-time-independent-of-frame-rate
learning.five-minute-challenge/zero-time-ends-once
learning.five-minute-challenge/all-rounds-finished-completes-early
learning.five-minute-challenge/reveal-prevents-later-scored-prediction
learning.five-minute-challenge/source-change-preserves-snapshot
learning.five-minute-challenge/finish-now-reports-partial-results
learning.five-minute-challenge/restart-clears-attempt
learning.five-minute-challenge/keyboard-completes-entire-activity
```

## The first end-to-end handoffs

```text
Gear explainer gives observations:list → "Quiz me on this" → the quiz takes observations:list → answers → feedback → done
Quiz gives its missed items as observations:list → "turn the questions I missed into a five-minute challenge"
```

Each hands the source card's real exported payload over with no card-specific adapter. These four are the first tests of
the architecture rule itself, and they gate the merge like every other required test:

```text
handoff/gear-to-quiz-no-adapter
handoff/moon-to-quiz-no-adapter
handoff/lock-to-quiz-no-adapter
handoff/quiz-missed-to-challenge
```
