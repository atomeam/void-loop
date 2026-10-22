# UNKNOWNS.md — Documented Disassembly Ambiguities

## Purpose
This file documents everything the disassembly leaves ambiguous. For each item:
- What the ambiguity is
- What evidence exists
- What evidence is missing
- Why it can't be resolved from listing alone

---

## 1. Object → Graphics Run Mapping

### Ambiguity
The disassembly shows object gfx pointers (e.g., `$F43C` contains `$A4, $01, $1D`) but does not explain how these bytes map to actual sprite data in the ROM.

### Evidence Exists
- Object gfx pointer table at `$F43C-$F457`
- `sprites.json` exists with 35 extracted runs (IDs 0-34)
- `assets.json` has ROM offsets for specific features (bridge=$0CD4, castleGate=$0BF5, etc.)

### Evidence Missing
- Sprite-address mapping table (no label like "SpritePointerTable" found)
- No documentation of how `$A4, $01, $1D` format encodes sprite data
- `sprites.json` contains pixel data but NO addresses — cannot cross-reference

### Why Unresolved
The disassembly describes object manipulation but not the graphics subsystem internals. Sprite extraction appears to be a separate analysis process not documented in the listing.

### Action Required
Parse raw ROM at object gfx pointer locations OR find sprite-address mapping in separate documentation.

---

## 2. Dragon Movement Speed Values

### Ambiguity
The dragon entry points set a "delta" value in `$D4` but the disassembly doesn't label what units this represents (pixels/frame, sub-pixel increments, etc.).

### Evidence Exists
- RedDragon: `lda #$A7` (low) + `lda #$F7` (high) → `$F7A7`
- Movement stored in `$D4` at `$F79F`
- `MoveGameObject` uses this value

### Evidence Missing
- No comment explaining `$D4` units
- No labeled constant for "DRAGON_SPEED" or similar
- No comparison with player movement constants

### Why Unresolved
The graphics/movement subsystem is not fully labeled. The listing describes behavior but not the physics model.

### Action Required
Reverse-engineer movement system from frame-by-frame analysis or find external documentation of Atari 2600 movement mechanics.

---

## 3. Magnet Attraction Radius

### Ambiguity
The magnet attracts objects but the listing doesn't specify the attraction radius or falloff function.

### Evidence Exists
- `Mag` routine at `$F9B3`
- MagnetMatrix at `$F9DA` lists affected objects
- Magnet position stored in `$B5` (Y) with X in `$B4`

### Evidence Missing
- No labeled "MAGNET_RADIUS" constant
- No distance check formula visible in listing
- No clear "attraction force" calculation

### Why Unresolved
The magnet attraction logic may be embedded in `MoveGameObject` or collision detection, not explicitly labeled in the magnet routine.

### Action Required
Test magnet behavior empirically or find frame analysis documentation.

---

## 4. Bat Random Number Generation

### Ambiguity
Bat teleport is triggered by `$D1` (fed-up counter) reaching 0, but how `$D1` is calculated and how the random destination room is selected is not documented.

### Evidence Exists
- `$D1` checked at `$F8B3`
- `$CF` counter increments each frame
- Random room selection in `@MoveBat_4`

### Evidence Missing
- No labeled "BAT_FEDUP_RATE" or "BAT_TELEPORT_CHANCE" constant
- No visible random number generator call
- No seed or entropy source documented

### Why Unresolved
Random number generation may be tied to paddle read (INPT4) or frame counter, not explicitly labeled.

### Action Required
Instrument the game to observe `$D1` behavior over time, or find frame analysis.

---

## 5. Portcullis State Persistence

### Ambiguity
Portcullis states are stored at `$F487-$F489` but it's unclear if they persist across rooms or reset on level change.

### Evidence Exists
- Three portcullis state locations at `$F487`, `$F488`, `$F489`
- Values $1C when closed
- Key unlock sets portcullis to "open"

### Evidence Missing
- No level-reset routine visible in listing
- No "InitializePortcullis" or similar label
- No persistence check before setting state

### Why Unresolved
Level initialization may clear or initialize these locations elsewhere in the ROM, not visible in the creature logic section.

### Action Required
Find level initialization routine and test persistence behavior.

---

## 6. Ball Object ($87) Behavior Details

### Ambiguity
The ball object (ID $87) is the player's cursor/pointer, but the listing doesn't fully explain:
- How ball position maps to joystick input
- Whether ball is always visible or only in certain rooms
- How ball state transitions work

### Evidence Exists
- Ball collision checks throughout listing
- Ball position in RAM: `$8A` (room), `$8B` (X), `$8C` (Y)
- Ball eaten by dragon → state 02

### Evidence Missing
- No "BallMovement" label beyond basic collision
- No joystick-to-ball mapping documented
- No visibility control logic

### Why Unresolved
The ball/player control system may be in a different ROM bank or use hardware TIA registers not fully labeled.

### Action Required
Analyze player input handling and TIA register usage.

---

## 7. Win Condition Timing

### Ambiguity
Level completion requires chalice + ball in yellow castle, but the exact moment of victory detection and any delay/transition is not labeled.

### Evidence Exists
- Check at `$F315`: `cmp #$12` (yellow castle entry)
- Both chalice ($B9) and ball ($87) must be in castle

### Evidence Missing
- No "VictoryDetected" or "LevelComplete" label
- No score update routine visible
- No transition animation documented

### Why Unresolved
Victory detection may be in a separate game state machine not included in creature/object analysis section.

### Action Required
Find game state machine and victory transition logic.

---

## 8. Object State Byte Layout

### Ambiguity
Objects have state bytes (e.g., `$04` offset from object pointer) but the exact layout of all state bytes is not documented.

### Evidence Exists
- `$00,x` = room
- `$01,x` = X position
- `$02,x` = Y position
- `$03,x` = (unknown)
- `$04,x` = state
- `$05,x` = (unknown)

### Evidence Missing
- No labeled struct like "ObjectState" or "DynamicObjectData"
- No documentation of `$03` and `$05` usage
- No comment explaining the full layout

### Why Unresolved
The object state structure may be documented elsewhere (commented differently) or inferred from usage patterns.

### Action Required
Trace all accesses to `$03,x` and `$05,x` to determine their purpose.

---

## 9. RoomDiffs Interpretation

### Ambiguity
`RoomDiffs` at `$FF32` contains door offsets but the exact interpretation of each byte pair is unclear.

### Evidence Exists
```ff32: 10 0f 0f  ;down from room 01
ff35: 05 11 11  ;down from room 02
ff38: 1d 0a 0a  ;down from room 03
ff3b: 1c 16 16  ;U/L/R/D from room 1b
ff3e: 1b 0c 0c  ;down from room 1c
ff41: 03 0c 0c  ;up from room 1d
```

### Evidence Missing
- No label explaining byte meaning (direction? delta? absolute?)
- No "RoomDiffsFormat" or similar documentation
- Pattern not obvious from values alone

### Why Unresolved
The room difference encoding may use a custom scheme (e.g., 4-bit nibbles for U/L/R/D) not documented in comments.

### Action Required
Cross-reference with room data (RoomDataTable at `$FE1B`) and test actual navigation.

---

## 10. Sound Effect Trigger Conditions

### Ambiguity
Sound effects are triggered (e.g., `$E0` = sound type, `$DF` = noise count) but the exact conditions for each sound are not fully labeled.

### Evidence Exists
- `$E0 = $01`: Dragon roar
- `$E0 = $02`: Ball eaten
- `$E0 = $03`: Dragon killed by sword
- `$DF = $10`: Noise count for all three

### Evidence Missing
- No "PlaySoundRoar" or similar label
- No documentation of sound bank or sample data
- No volume or duration controls visible

### Why Unresolved
Sound generation may use TIA registers not fully labeled in the listing.

### Action Required
Analyze TIA audio register writes or find sound bank documentation.

---

## Summary Table

| # | Item | Evidence | Missing | Resolution Path |
|---|------|----------|---------|-----------------|
| 1 | Object→Gfx mapping | Pointers exist | Mapping table | Parse raw ROM |
| 2 | Dragon speed units | Delta in $D4 | Unit documentation | Frame analysis |
| 3 | Magnet radius | Position check | Radius constant | Empiric test |
| 4 | Bat RNG | $D1 counter | Seed/selection | Observe behavior |
| 5 | Portcullis persistence | State addresses | Init routine | Find level reset |
| 6 | Ball behavior | Collision checks | Input mapping | Analyze input |
| 7 | Win timing | Check location | Victory transition | Find state machine |
| 8 | State byte layout | Partial layout | $03, $05 usage | Trace accesses |
| 9 | RoomDiffs format | Data table | Byte meaning | Cross-reference |
| 10 | Sound triggers | Effect codes | Conditions | Analyze TIA |

---

## Verification Protocol

Per Lesson 10: "Data Absent From My Fetch" ≠ "Data Absent From The Source"

Before marking any item as "not in disassembly":
1. Verify the disassembly page loaded completely (check for expected content like `RoomDataTable`)
2. Search multiple patterns (label names, hex values, comments)
3. Check if content might be in a different section of the listing
4. Document the search pattern used before concluding absence

**Disassembly fetch verification**: 190,403 bytes retrieved (confirmed complete)