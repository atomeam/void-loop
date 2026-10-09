# Void explainers: toy specs (build input)

Status: approved build input by Adam, 2026-10-09, not implemented features. Companion to `domains/void.learning.md`
(the observation contract, the quiz, the five-minute challenge). Frontier item #17 (`domains/void.frontier.md`).

All three follow:

    Prompt → supported spec → asset → shared scene → tested behavior → card

## Shared card contract

Each card declares named ports. A type alone is not enough: a tooth count and an angle are both numbers but are not
interchangeable.

Port shape: `name + type + meaning + units + constraints`

Common rules:

- Everything works offline, without accounts or tracking.
- Geometry and visible behavior derive from one authoritative state; never accumulate frame-by-frame approximations.
- Pointer controls have equivalent keyboard or on-screen controls.
- Invalid inputs produce an explanation, not a broken scene.
- `model` outputs reference the reusable model specification, not a live renderer or shared mutable scene.
- Cross-card transfers happen only through declared ports.
- Every explainer gives the same three ports: `explanation:text`, `observations:list` (schema `void.observations.v1`,
  see void.learning.md), `model:model`.
- Every acceptance example below is a required test, named `explainer.<kind>/<case>`. Tests first, then geometry.
  Auto-merge is gated on them.
- **Assessment prompts describe the captured snapshot, never "now".** A `{placeholder}` in a prompt below is filled in
  by the source card when it exports the snapshot, so the taker receives finished text. The question stays right even
  after the visitor moves the source miniature.
- **Tolerance is absolute, in the item's own unit** (set per item below).
- Explainers keep their stage state like any other card; the quiz and the challenge do not, by default (void.learning.md).
- **Every explainer takes `presentation`** (Adam, 2026-10-09, for discovery mode, frontier #19):

  ```yaml
  takes:
    presentation:
      type: text
      meaning: Supported display mode; does not change physical state
      constraints:
        allowed: [normal, discovery]
      default: normal
      mode: live    # a later change (Reveal the rule) must arrive; a snapshot port would get one copy only
  ```

  It changes only what the explainer draws on its own card: never its state, its controls, or what its `observations`
  and `explanation` ports give. So in discovery mode observations keep flowing with real values while the readouts are
  hidden, and "Reveal the rule" just shows the `explanation` text that was being given all along. The visitor's "find
  the rule" sets it to `discovery` through the stage; Reveal sets it back to `normal` the same way. Discovery hides the
  answer, not the information needed to investigate it:
  - hidden: the generated explanation, calculated readouts that give the answer away, and answer-bearing tooltips and
    their accessible equivalents;
  - kept: input controls and their values, the motion and markers, instructions, units, schematic and safety notes, and
    an always-available "Reveal the rule".
- **Every explainer's observations include the inputs that set its measured results**, as non-assessed items, so a
  captured trial can be reproduced: gear `driverTeeth`, `drivenTeeth`; moon `orbitAngleDegrees`; lock `keyPreset`,
  `insertionFraction`, `plugAngleDegrees`. Display and playback inputs that change no result (`driverAngle`,
  `driverSpeed`, `cycleDuration`) are not required. A future explainer lists its result-setting inputs the same way.
- Required per explainer: `explainer.<kind>/discovery-hides-readouts-keeps-observations-and-inputs`.

---

## 1. Gear pair — `explainer.gear-pair`

### Visitor experience

Two meshing gears on a small mechanical stand. Drag either gear to turn it; the other responds immediately. Change tooth
counts and watch sizes, spacing and motion update. Discovery: external meshing gears turn in opposite directions, and
relative rotation depends on tooth count.

### Supported prompts

- "Explain gears."
- "Show me two gears I can turn."
- "Make one gear turn twice as fast."
- "What happens with 12 teeth and 24 teeth?"

### Supported spec

```yaml
kind: explainer.gear-pair
version: 1
parameters:
  driverTeeth: 16
  drivenTeeth: 32
  driverAngleDegrees: 0
  autoplay: false
  driverSpeedDegreesPerSecond: 30
  showLabels: true
derived:
  pitchDiameterPerTooth: constant for the demonstration profile
  driverPitchRadius: driverTeeth * pitchDiameterPerTooth / 2
  drivenPitchRadius: drivenTeeth * pitchDiameterPerTooth / 2
  centerDistance: driverPitchRadius + drivenPitchRadius
```

| Parameter | Visitor control | Constraint |
|---|---|---|
| Driver teeth | Stepper | Integer, 12–48 |
| Driven teeth | Stepper | Integer, 12–48 |
| Rotation | Drag either gear; turn buttons | Continuous, either direction |
| Autoplay speed | Slider | Signed degrees per second |
| Labels | Toggle | Teeth, direction, rotation ratio |

Tooth size is constant between gears. Changing tooth count changes gear radius and center distance, not just the painted
number.

### Asset → shared scene

Procedurally generated gear meshes, two shafts, a simple stand, and a colored marker on each gear so visitors can count
revolutions. Initial alignment has teeth entering gaps. Simplified demonstration profile, labeled as such, not a
manufacturing model.

### Tested behavior

    Δθ_driven = −Δθ_driver × (N_driver / N_driven)

Derived directly from state on every update. Explanation example: "The 16-tooth gear makes two turns while the 32-tooth
gear makes one turn in the opposite direction." Show both labeled quantities (driven turns per driver turn; driver turns
per driven turn). Never an unlabeled "2:1".

### Ports

| Direction | Port | Type | Meaning |
|---|---|---|---|
| Takes | `driverTeeth` | number | Integer tooth count, 12–48 |
| Takes | `drivenTeeth` | number | Integer tooth count, 12–48 |
| Takes | `driverAngle` | number | Degrees |
| Takes | `driverSpeed` | number | Degrees per second |
| Takes | `presentation` | text | normal / discovery (live); display only |
| Gives | `drivenTurnsPerDriverTurn` | number | Positive ratio magnitude, turns-per-turn |
| Gives | `drivenTurnsPerDriverTurnSigned` | number | Signed ratio, turns-per-turn; negative for the opposite direction |
| Gives | `explanation` | text | Explanation of current configuration |
| Gives | `observations` | list | void.observations.v1 |
| Gives | `model` | model | Geometry parameters and current pose |

### Observations addendum (assessable items)

- `drivenTurnsPerDriverTurn`: number, unit `turns-per-turn` (a ratio, not an accumulated rotation), tolerance 0.01.
  Prompt: "With a {driverTeeth}-tooth driver and a {drivenTeeth}-tooth driven gear, how many turns does the driven gear
  make per driver turn?" Answer: N_driver / N_driven.
- `rotationDirection`: text, options `same` / `opposite`, answerId `opposite`. Prompt: "Do the two gears turn in the
  same or opposite direction?"

Not assessed: `driverTeeth`, `drivenTeeth` (the inputs), `centerDistance`, and `drivenTurnsPerDriverTurnSigned` (number,
unit `turns-per-turn`, negative for the opposite direction: −N_driver / N_driven). Combining the magnitude with the
direction is gear knowledge, so the gear gives it and a taker such as the #19 notebook never computes it.

In discovery mode the gear hides its explanation and both ratio readouts; tooth counts, rotation controls, the motion and
the revolution markers stay.

### Required tests

- `explainer.gear-pair/equal-teeth-equal-travel-opposite-direction`
- `explainer.gear-pair/16-driving-32-half-turn-backward`
- `explainer.gear-pair/drag-driven-applies-inverse`
- `explainer.gear-pair/tooth-change-rebuilds-geometry-center-distance` (asserts centerDistance = driverPitchRadius +
  drivenPitchRadius, each `teeth × pitchDiameterPerTooth / 2`, and that the gears stay meshed)
- `explainer.gear-pair/pause-stops-autoplay-manual-remains`
- `explainer.gear-pair/long-run-no-ratio-drift`
- `explainer.gear-pair/observations-schema-valid`
- `explainer.gear-pair/discovery-hides-readouts-keeps-observations-and-inputs`

---

## 2. Moon phases — `explainer.moon-phases`

### Visitor experience

A small Earth and Moon with a fixed sunlight direction. Drag the Moon around its orbit; a circular "view from Earth"
panel shows the corresponding phase. Lesson: sunlight lights about half the Moon; the orbit changes how much of that lit
half we see. Ordinary phases are not caused by Earth's shadow.

### Supported prompts

- "Explain Moon phases."
- "Why is a half moon called a quarter moon?"
- "Show me the difference between waxing and waning."
- "Let me move the Moon around Earth."

### Supported spec

```yaml
kind: explainer.moon-phases
version: 1
parameters:
  orbitAngleDegrees: 0
  autoplay: false
  secondsPerCycle: 30
  showSunlight: true
  showEarthView: true
  showLabels: true
conventions:
  zeroAngle: new-moon
  progression: waxing-first
  earthView: north-up-schematic
  waxingLitLimb: right   # northern-hemisphere view; stated on-scene
```

| Parameter | Visitor control |
|---|---|
| Orbital position | Drag Moon or 0–360° slider |
| Phase shortcut | New, first quarter, full, last quarter |
| Playback | Play/pause |
| Cycle duration | 10–120 s per animated cycle |
| Sunlight arrows | Toggle |
| Earth-view panel | Toggle |

Animation time is demonstration time, not astronomical time.

### Asset → shared scene

Procedural spheres, orbit guide, sunlight arrows, directional light. The Earth-view panel derives its phase from the
same state as the 3D scene, never from independently selected artwork. Earth casts no eclipse-like shadow in this
demonstration.

On-scene note: "Schematic: sizes and distances not to scale. Eclipses not simulated. Right limb lit while waxing
(northern-hemisphere view)."

### Tested behavior

    f = (1 − cos θ) / 2

Reference points: 0° new 0%; 90° first quarter 50%; 180° full 100%; 270° last quarter 50%. Phase label distinguishes
waxing from waning by orbital position, not by illuminated fraction. If physical durations are shown, name the 27.3-day
orbital period and 29.5-day phase cycle separately.

### Ports

| Direction | Port | Type | Meaning |
|---|---|---|---|
| Takes | `orbitAngle` | number | Degrees under this card's convention |
| Takes | `cycleDuration` | duration | Animation duration per cycle |
| Takes | `phaseName` | text | Validated phase shortcut |
| Takes | `presentation` | text | normal / discovery (live); display only |
| Gives | `illuminatedFraction` | number | 0–1 |
| Gives | `phaseName` | text | Current named phase |
| Gives | `explanation` | text | Position, visibility, waxing/waning |
| Gives | `observations` | list | void.observations.v1 |
| Gives | `model` | model | Scene spec and current position |

### Observations addendum (assessable items)

- `illuminatedFraction`: number, unit `fraction`, tolerance 0.02. Prompt: "At the captured orbital position of
  {orbitAngleDegrees}°, what fraction of the Moon's near side is illuminated?"
- `phaseName`: text. Options (stable ids): `new-moon`, `waxing-crescent`, `first-quarter`, `waxing-gibbous`,
  `full-moon`, `waning-gibbous`, `last-quarter`, `waning-crescent`. Prompt: "At the captured orbital position of
  {orbitAngleDegrees}°, which phase is shown?"
- `waxingOrWaning`: text, options `waxing` / `waning`. Prompt: "At the captured orbital position of
  {orbitAngleDegrees}°, is the lit part growing or shrinking from night to night?" Assessable only between the turning
  points (normalized angle in [0°, 360°)):
  - 0° < angle < 180°: answerId `waxing`
  - 180° < angle < 360°: answerId `waning`
  - exactly new (0°) or full (180°): `assessment.enabled = false` for this item; the phase-name and fraction questions
    stay available there.

Not assessed: `orbitAngleDegrees` (the input).

### Required tests

- `explainer.moon-phases/0-new-0-percent`
- `explainer.moon-phases/90-first-quarter-50-percent`
- `explainer.moon-phases/180-full-100-percent`
- `explainer.moon-phases/270-last-quarter-50-percent`
- `explainer.moon-phases/lit-side-faces-light`
- `explainer.moon-phases/overview-camera-does-not-change-earth-view`
- `explainer.moon-phases/wrap-360-to-0-no-jump`
- `explainer.moon-phases/explanation-never-cites-earth-shadow`
- `explainer.moon-phases/waxing-lit-limb-right`
- `explainer.moon-phases/waxing-or-waning-not-assessed-at-new-or-full`
- `explainer.moon-phases/observations-schema-valid`
- `explainer.moon-phases/discovery-hides-readouts-keeps-observations-and-inputs`

---

## 3. Lock cutaway — `explainer.pin-lock`

### Visitor experience

A cutaway lock: key, rotating plug, five spring-loaded pin pairs. Insert a demonstration key, watch it lift the pins, try
to turn. Lesson: the right key sets every key-pin/driver-pin boundary at the shear line so the plug can rotate; a
misaligned pin blocks it. An explanation of normal operation, not a lock-picking simulator.

### Supported prompts

- "Show me how a key opens a lock."
- "Why won't the wrong key turn?"
- "Explain the pins inside a lock."
- "Show the moving parts."

### Supported spec

```yaml
kind: explainer.pin-lock
version: 1
parameters:
  keyPreset: matching       # matching | one-mismatch | several-mismatch
  insertionFraction: 0
  plugAngleDegrees: 0
  cutawayAmount: 0.6
  showShearLine: true
  showLabels: true
mechanism:
  pinPairs: 5
  demonstrationOnly: true
```

| Parameter | Visitor control |
|---|---|
| Key | Matching / one mismatched cut / several mismatched cuts |
| Insertion | Drag or 0–100% slider |
| Turn attempt | Drag key or turn buttons |
| Cutaway | Visibility slider |
| Shear line | Highlight toggle |
| Explanation | Step-through button |

Invented, dimensionless demonstration profiles only; no real key codes or brand measurements.

### Asset → shared scene

Named procedural components: fixed housing, rotating plug, key, five key pins, five driver pins, five springs,
shear-line highlight. Pins move on constrained axes; the plug rotates about its own axis.

### Tested behavior

Exactly five public states. Full insertion is a condition, not a sixth state: at full insertion the lock is classified
straight away as `ready` or `blocked`.

    withdrawn → inserting → ready | blocked
    ready → turned
    turned → ready   (when returned to the starting angle)

- Pin motion follows the demonstration key profile.
- Rotation requires full insertion and all boundaries aligned.
- Removing the key requires the plug back at its start angle.
- A blocked turn highlights the obstructing pin and explains why.
- Spring motion follows pin position; not independently animated.

### Ports

| Direction | Port | Type | Meaning |
|---|---|---|---|
| Takes | `keyPreset` | text | Validated demonstration preset |
| Takes | `insertionFraction` | number | 0–1 |
| Takes | `requestedPlugAngle` | number | Degrees |
| Takes | `presentation` | text | normal / discovery (live); display only |
| Gives | `alignedPinCount` | number | Integer 0–5 |
| Gives | `mechanismState` | text | withdrawn / inserting / blocked / ready / turned |
| Gives | `explanation` | text | Why rotation is allowed or blocked |
| Gives | `observations` | list | void.observations.v1 |
| Gives | `model` | model | Component spec and current pose |

### Observations addendum (assessable items)

- `alignedPinCount`: number, unit `pins`, tolerance 0 (exact integer). Prompt: "With the {keyPreset} key inserted
  {insertionPercent}% of the way, how many pin pairs are aligned at the shear line?"
- `mechanismState`: text. Options (stable ids): `withdrawn`, `inserting`, `blocked`, `ready`, `turned`. Prompt: "With
  the {keyPreset} key inserted {insertionPercent}% of the way and the plug at {plugAngleDegrees}°, what state is the lock
  in?"
- `canTurn`: text, options `yes` / `no`. A hypothetical about the key, so it stays right whatever the snapshot's
  insertion. Prompt: "If this demonstration key is fully inserted and the plug is at its starting angle, will the plug
  be allowed to turn?" Answer: `yes` for `matching`; `no` for either mismatched preset.

Not assessed: `keyPreset`, `insertionFraction`, `plugAngleDegrees` (the inputs).

### Required tests

- `explainer.pin-lock/matching-key-all-five-aligned-rotation-allowed`
- `explainer.pin-lock/mismatched-key-blocked-names-obstructing-pin`
- `explainer.pin-lock/partial-insertion-cannot-unlock`
- `explainer.pin-lock/full-insertion-is-ready-or-blocked-never-a-sixth-state`
- `explainer.pin-lock/turned-returns-to-ready-at-start-angle`
- `explainer.pin-lock/plug-rotation-carries-components`
- `explainer.pin-lock/reset-restores-start-no-residual-motion`
- `explainer.pin-lock/cutaway-changes-presentation-not-state`
- `explainer.pin-lock/key-removal-requires-plug-at-start`
- `explainer.pin-lock/observations-schema-valid`
- `explainer.pin-lock/discovery-hides-readouts-keeps-observations-and-inputs`

---

## Handoff order

1. Gear pair establishes scene, interaction, parameter controls, behavior and typed ports.
2. Moon phases reuses the pattern; adds lighting, orbital movement, and a synchronized second view.
3. Lock cutaway adds named parts, constrained movement, and an explanatory state machine.

Then quiz, then challenge (void.learning.md). The handoff tests `handoff/*-to-quiz-no-adapter` pass each explainer's
actual exported `observations` payload into the quiz with no explainer-specific adapter.

Each explainer gives at least one numeric and one choice question (`rotationDirection`, `waxingOrWaning`, `canTurn`
are the choice ones), so a quiz built from any single explainer tests understanding, not only reading a number off the
miniature.
