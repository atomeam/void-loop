# LOGIC-creatures.md — Adventure Creature Behavior

Extracted from: https://6502disassembly.com/2600-adventure/Adventure.bin.html

## Dragon State Machine

**Core Routine**: `MoveDragon` at `$F7EA` (line 1169)

Each dragon (Red, Yellow, Green) has a dedicated entry point that sets up a pointer to its object matrix and calls the shared `MoveDragon` routine.

### Dragon Entry Points
| Dragon | Routine | Address | Object Matrix | Matrix Address |
|--------|---------|---------|--------------|----------------|
| Red | MoveRedDragon | `$F795` | RedDragMatrix | `$F7A7` |
| Yellow | MoveYellowDragon | `$F7BA` | YelDragMatrix | `$F7C2` |
| Green | MoveGreenDragon | `$F7CB` | GreenDragMatrix | `$F7DD` |

### Dragon States

```
00 = Normal state 1 (roaming)
01 = Dead
02 = Normal state 2 (has eaten ball)
03-FB = Roaring (transitional)
FC-FF = (reserved/end states)
```

### State Transitions

```
State 00 (Normal 1)
    ↓ (player-ball collision + difficulty check)
State 03-FB (Roaring)
    ↓ (timer expires + player-ball collision)
State 02 (Normal 2 / Ball Eaten)
    ↓ (player-ball collision)
State 02 (stays — ball now attached to dragon)

State 01 (Dead)
    ↓ (never transitions — permanent)
```

### State 00 → 03-FB (Roaring)
**Location**: `$F871-$F898`

```f871: f6 04        @MoveDragon_7   inc     $04,x      ;increment state
f873: b5 04                             lda     $04,x      ;get state
f875: c9 fc                             cmp     #$fc       ;near end?
f877: 90 25                             bcc     @MoveDragon_9 ;if not, branch
```

Dragon increments state each frame while roaring. State 03 → 04 → ... → FB. At FB, transition check occurs.

### State 01 (Dead) Behavior
**Location**: `$F84E-$F84B`

```f84e: c9 01        @MoveDragon_6   cmp     #$01      ;dead?
f850: f0 4c                             beq     @MoveDragon_9 ;return if dead
```

Dead dragons:
- Do not move
- Do not kill player
- Remain in room
- Do not transition out of state

### State 02 (Ball Eaten) Behavior
**Location**: `$F856-$F86C`

```f856: b5 00                             lda     $00,x    ;get dragon's room
f858: 85 8a                             sta     $8a    ;store as ball's room
f85c: b5 01                             lda     $01,x    ;get dragon X
f861: 18                                clc
f85f: 69 03                             adc     #$03    ;adjust X
f863: 85 8b                             sta     $8b    ;ball X = dragon X + 3
f865: b5 02                             lda     $02,x    ;get dragon Y
f867: 38                                sec
f868: e9 0a                             sbc     #$0a    ;adjust Y
f86a: 85 8c                             sta     $8c    ;ball Y = dragon Y - 10
```

When ball collides with roaring dragon:
- Ball teleports to center of dragon
- Ball now follows dragon
- Player must use sword to kill dragon to recover ball

### Sword → Death Transition
**Location**: `$F83B-$F84B`

```f83b: c9 51                             cmp     #$51    ;sword hit dragon?
f83d: d0 0c                             bne     @MoveDragon_5
f83f: a9 01                             lda     #$01    ;set dead
f841: 95 04                             sta     $04,x
f843: a9 03                             lda     #$03    ;sound type 3
f845: 85 e0                             sta     $e0
f847: a9 10                             lda     #$10    ;noise count
f849: 85 df                             sta     $df
```

**IMPORTANT**: Sword kills are checked AFTER roar transition. Green dragon's matrix (`$F7DD`) does NOT include sword — green dragon cannot be killed.

### Movement Routine
**Routine**: `MoveGameObject` at `$F808`

```f808: 20 15 f7        MoveDragon_3   jsr     MoveGameObject ;6 move object
```

Movement is handled by shared routine with object-specific delta values.

---

## Dragon Difficulty Switch Effects

**Console Switch**: `SWCHB` at `$F7F6`

```f7f6: ad 82 02                          lda     SWCHB       ;read console
f7f9: 29 80                              and     #$80       ;check P1 difficulty
f7fb: f0 05                              beq     @MoveDragon_2 ;amateur branch
f7fd: a9 00                              lda     #$00       ;pro - ignore nothing
f7ff: 4c 04 f8                           jmp     @MoveDragon_3
f802: a9 b6        @MoveDragon_2       lda     #$b6       ;amateur - ignore sword
f804: 85 d6                              sta     $d6       ;store difficulty
```

### Amateur Mode (P1 switch left)
- Dragon ignores sword collision
- Sword cannot kill dragon
- More aggressive chase behavior

### Pro Mode (P1 switch right)
- Dragon can be killed by sword
- More methodical movement pattern

### DragonDiff Table (at `$F89F`)
```f89f: d0 e8        DragonDiff     .bulk   $d0,$e8 ;Level 1: Am, Pro
f8a1: f0 f6                             .bulk   $f0,$f6 ;Level 2: Am, Pro
f8a3: f0 f6                             .bulk   $f0,$f6 ;Level 3: Am, Pro
```

Values represent state delay counters. Higher values = longer roar duration = more dangerous.

---

## Bat Behavior

**Routine**: `MoveBat` at `$F8A5` (line 1320)

### Bat State Machine
Bat has a simple state counter (`$CF`) that increments each frame. When it overflows, bat changes behavior.

```f8a5: e6 cf        MoveBat         inc     $cf       ;next state
f8ab: d0 04                              bne     @MoveBat_2 ;not overflow, continue
f8b1: a5 d1        @MoveBat_2         lda     $d1       ;get fed-up value
f8b3: f0 0e                              beq     @MoveBat_3 ;if fed-up, teleport
```

### Bat States

```
$CF = State counter (0-255, overflow triggers action)
$D0 = Object currently being carried (0 = none)
$D1 = Fed-up counter (0 = bat will teleport)
```

### Bat Teleport Behavior
**Location**: `$F8C3-$F908`

```f8c3: a9 cb        @MoveBat_3       lda     #$cb    ;bat's dynamic data
f8c6: 20 08 f9                            jsr     @MoveBat_4 ;teleport logic
```

When fed-up counter reaches 0:
1. Bat picks up a random nearby object
2. Teleports both bat and carried object to random room
3. Resets fed-up counter

### Objects Bat Can Carry
**Bat Interaction Matrix**: Lines 1397-1399

```f92d: cb bf        MagnetMatrix    .bulk   $cb,$bf ;Bat, Yellow Key
f92f: cb c2                              .bulk   $cb,$c2 ;Bat, White Key
f931: cb c5                              .bulk   $cb,$c5 ;Bat, Black Key
```

Bat CAN carry:
- Yellow Key ($BF)
- White Key ($C2)
- Black Key ($C5)
- Sword ($B6)
- Chalice ($B9)
- Magnet ($B3)

Bat CANNOT carry:
- Dragons
- Ball ($87)
- Bridge ($BC)
- Portcullis

### Bat Pickup Prevention
**Location**: `$F8DE-$F908`

```f8de: f0 28                              beq     @MoveBat_4 ;nothing found
f8e8: d0 1e                              bne     @MoveBat_4 ;if not, no pickup
f8f4: d0 12                              bne     @MoveBat_4 ;if not, no pickup
f900: d0 06                              bne     @MoveBat_4 ;if not, no pickup
```

Checks prevent bat from picking up:
- Creatures (dragons)
- Ball
- Portals (bridge, portcullis)

### Bat Carrying State
When bat carries an object:
- Object position = bat position
- Object room = bat room
- Object becomes temporarily inaccessible
- Bat drops object when fed-up counter expires

---

## Creature Speed Constants

These values are not explicitly labeled in the disassembly but can be inferred from:
- Movement delta stored in `$D4` (dragon)
- Position adjustments in `MoveGameObject`

### Dragon Movement
- Horizontal delta: Set per dragon in entry point
- Vertical movement: Controlled by `MoveGameObject` routine
- Speed increases during chase (amateur mode)

### Bat Movement
- Bat position updated each frame
- Teleport distance: Random within bounds
- No smooth movement — instant teleport

---

## Creature Spawn Locations by Difficulty

### Red Dragon
| Game | Room | X | Y | Movement | State |
|------|------|---|---|----------|-------|
| 1 | $0E (14) | $50 (80) | $20 (32) | $00 | 0 |
| 2,3 | $14 (20) | $50 (80) | $20 (32) | $A0 (160) | 0 |

### Yellow Dragon
| Game | Room | X | Y | Movement | State |
|------|------|---|---|----------|-------|
| 1 | $01 (1) | $50 (80) | $20 (32) | $00 | 0 |
| 2,3 | $19 (25) | $50 (80) | $20 (32) | $A0 (160) | 0 |

### Green Dragon
| Game | Room | X | Y | Movement | State |
|------|------|---|---|----------|-------|
| 1 | $1D (29) | $50 (80) | $20 (32) | $00 | 0 |
| 2,3 | $04 (4) | $50 (80) | $20 (32) | $A0 (160) | 0 |

### Bat
| Game | Room | X | Y | Movement | State |
|------|------|---|---|----------|-------|
| 1 | $1A (26) | $20 (32) | $20 (32) | $00 | 0 |
| 2,3 | $02 (2) | $20 (32) | $20 (32) | $90 (144) | 0 |

---

## Collision Matrices

### RedDragon Collision Matrix (at `$F7A7`)
```
B6 A4  ;Sword, Red Dragon
A4 8A  ;Red Dragon, Ball
A4 B9  ;Red Dragon, Chalice
A4 C2  ;Red Dragon, White Key
```

### YellowDragon Collision Matrix (at `$F7C2`)
```
B6 A9  ;Sword, Yellow Dragon
BF A9  ;Yellow Key, Yellow Dragon
A9 8A  ;Yellow Dragon, Ball
A9 B9  ;Yellow Dragon, Chalice
```

### GreenDragon Collision Matrix (at `$F7DD`)
```
AE C5  ;Green Dragon, Black Key
AE B3  ;Green Dragon, Magnet
```

**NOTE**: Green dragon does NOT have sword in its collision matrix. Sword cannot kill green dragon.

---

## Notes

- All hex values in `$XX` format are direct 6502 addresses or values
- ROM addresses like `$FXXX` are from the disassembly listing
- RAM addresses like `$D4`, `$CF`, `$D1` are zero-page working memory
- Object IDs are hexadecimal: Red Dragon=$A4, Yellow Dragon=$A9, Green Dragon=$AE, Sword=$B6, etc.
- Ball object ID is $87
- Difficulty switch values: Amateur=$00, Pro=$80 (bit 7 of SWCHB)