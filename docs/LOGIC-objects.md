# LOGIC-objects.md — Adventure Object Mechanics

Extracted from: https://6502disassembly.com/2600-adventure/Adventure.bin.html

## Pickup / Carry / Drop Mechanics

**Routine**: `PickupPutdown` at `$F556` (line 811)

### Pickup Conditions
1. Player's joystick trigger (INPT4) activated
2. Object within player's proximity (collision check at `$F5AA`)
3. Player not already carrying an object (`$97` must be $00)
4. Object not in "held" state

### Carry State
- When picked up, object is set to "held" state (value $FF)
- Object position follows player
- `$97` set to object ID when carrying
- `PickupObject` at `$F5B4` handles the pickup state assignment

### Drop Conditions
- Joystick trigger while carrying an object
- Object drops at player's current position
- State reverts to grounded ($00)
- `$97` cleared to $00

### Edge Cases
- **Bat pickup**: Bat cannot pick up creatures or portals. Bat can only grab: keys, sword, chalice, magnet
- **Bridge crossing**: Bridge check at `$F4F5` — if player has ANY key, bridge collision bypasses wall check

---

## Key → Gate → Castle Unlock Sequence

**Routines**:
- Key matching: `$F946` (line 1411)
- Portal handling: `$F95C-$F979`
- Castle room lookup: `$F9B0` (CastleRoomOffsets)

### Key Offsets (at `$F9AA`)
```
$63 = Yellow Key (object ID $BF)
$6C = White Key (object ID $C2)
$75 = Black Key (object ID $C5)
```

### Castle Entry Rooms (at `$F9AD`)
```
$12 = Yellow Castle Entry
$1A = White Castle Entry
$1B = Black Castle Entry
```

### Castle Rooms (at `$F9B0`)
```
$11 = Yellow Castle
$0F = White Castle
$10 = Black Castle
```

### Unlock Sequence
1. Player picks up key (e.g., Yellow Key = ID $BF)
2. Player enters castle entry room ($12)
3. Game checks key in `$946` — compares `$F9AA` lookup with held key
4. If match: object teleported to corresponding castle room ($11)
5. Portcullis state at `$F487-$F489` set to opened

### Castle-Specific Behavior
- **Yellow Castle ($11)**: Level completion — requires both chalice AND ball ($87) inside
- **White Castle ($0F)**: Opens only with white key, contains sword pickup
- **Black Castle ($10)**: Opens only with black key, contains bat spawn

---

## Bridge Crossing

**Routine**: `PlayerCollision` at `$F4F5` (line 756)

### Bridge Detection
```
f4f5: c0 02        PlayerCollision  cpy     #$02     ;check for bridge
f4fb: c9 5a                         cmp     #$5a     ;bridge object ID = $5A
f501: c5 bc                        cmp     $bc      ;is bridge in this room?
```

### Bridge Activation
- Bridge visible only when player has NO keys
- Bridge collision check at `$F508-$F519`
- Player Y position check: if `Y > bridge.Y + $FC`, player passes through
- Bridge disappears when any key is picked up

### Bridge Locations
| Game | Room | X | Y |
|------|------|---|---|
| 1 | $04 (Blue Maze Top) | $29 (41) | $37 (55) |
| 2,3 | $0B (Maze Side) | $40 (64) | $40 (64) |

### Portcullis States (at `$F487-$F489`)
```
$1C = Portcullis closed state
```
Three portcullis entries (white, black, yellow castles) at sequential addresses.

---

## Magnet Attraction Rules

**Routine**: `Mag` at `$F9B3` (line 1472)

### Magnet Object Matrix (at `$F9DA`)
```
BF B3  ;Yellow Key, Magnet
C2 B3  ;White Key, Magnet
C5 B3  ;Black Key, Magnet
B6 B3  ;Sword, Magnet
BC B3  ;Bridge, Magnet
B9 B3  ;Chalice, Magnet
```

### Attraction Behavior
1. Magnet checks for objects within attraction radius
2. Attracted objects: keys ($BF, $C2, $C5), sword ($B6), bridge ($BC), chalice ($B9)
3. Objects pulled toward magnet position
4. Magnet state tracked at `$FE0E` (MagnetCurr) and `$FE0F` (MagnetStates)

### Magnet Position
| Game | Room | X | Y |
|------|------|---|---|
| 1 | $1B (Black Castle Entry) | $80 (128) | $20 (32) |
| 2,3 | $0E (Top Entry Room) | $80 (128) | $20 (32) |

### Objects NOT Attracted
- Dragons (IDs $A4, $A9, $AE)
- Bat ($CB)
- Ball ($87)
- Player

---

## Sword Mechanics

**Routines**:
- Sword pickup: `PickupPutdown` at `$F556`
- Sword state: `SwordCurr` at `$FD78`, `SwordStates` at `$FD79`

### Sword States
```
$00 = Sword grounded (pickable)
$FF = Sword held by player OR inactive
```

### Sword vs Dragon Collision
**Routine**: `MoveDragon` at `$F7EA` (line 1169)

```
f83b: c9 51                        cmp     #$51     ;has sword hit dragon?
f83d: d0 0c                        bne     @MoveDragon_5 ;if not, branch
f83f: a9 01                        lda     #$01     ;set state to 01 (dead)
f841: 95 04                        sta     $04,x    ;store as dragon state
```

### Dragon Death Behavior
- Sword contact sets dragon state to `$01` (dead)
- Dragon no longer moves or kills player
- Dead dragon stays in room
- Sound effect: noise type `$03`

### Sword in Object Matrices
Each dragon has sword in its interaction matrix:
```
RedDragMatrix ($F7A7):  B6 A4  ;Sword, Red Dragon
YelDragMatrix ($F7C2):  B6 A9  ;Sword, Yellow Dragon
GreenDragMatrix ($F7DD): AE C5 ;Green Dragon, Black Key
```
Note: Green dragon's matrix shows sword is NOT in its collision list — green dragon cannot be killed by sword.

### Sword Pickup Location
| Game | Room | X | Y |
|------|------|---|---|
| 1 | $12 (Yellow Castle Entry) | $20 (32) | $20 (32) |
| 2,3 | $11 (Yellow Castle) | $20 (32) | $20 (32) |

---

## Object Table Format

**Location**: `$F43C-$F4C0` (lines 679-726)

### Object GFX Pointers (at `$F43C`)
```
F43C: A4 01 1D  ;Red Dragon     - pointer to graphics data
F43F: A9 01 1D  ;Yellow Dragon
F442: AE 01 1D  ;Green Dragon
F445: B6 01 1D  ;Sword
F448: BC 01 1D  ;Bridge
F44B: BF 01 1D  ;Yellow Key
F44E: C2 01 16  ;White Key
F451: C5 01 12  ;Black Key
F454: CB 01 1D  ;Bat
F457: B3 01 1D  ;Magnet
```

### Game 1 Object Locations (at `$F460`)
Format: `[room, X, Y]` for static objects, `[room, X, Y, movement, state]` for creatures

### Game 2/3 Object Locations (at `$F491`)
Same format as Game 1, different positions per difficulty level.

---

## Difficulty Switch Effects

**Console switch**: `SWCHB` at `$F7F6` (line 1164)
- P1 difficulty at bit 7 ($80)
- Amateur (left): Dragon ignores sword, chases player more aggressively
- Pro (right): Dragon can be killed by sword, more methodical movement

### DragonDiff Table (at `$F89F`)
```
D0 E8  ;Level 1: Amateur, Pro
F0 F6  ;Level 2: Amateur, Pro
F0 F6  ;Level 3: Amateur, Pro
```
Values represent timing/state delays for difficulty.

---

## Win Condition

**Routine**: Check at `$F315` (line 530)

```f315: c9 12                        cmp     #$12     ;is it in the yellow castle?
```

### Level Completion Requirements
1. Chalice (ID $B9) in yellow castle ($11)
2. Ball (ID $87) in yellow castle ($11)
3. Entry through yellow castle entry ($12)

---

## Notes

- All hex values in `$XX` format are direct 6502 addresses or values
- ROM addresses like `$FXXX` are from the disassembly listing
- RAM addresses like `$97`, `$BC` are zero-page working memory
- Object IDs are hexadecimal: Red Dragon=$A4, Yellow Dragon=$A9, Green Dragon=$AE, Sword=$B6, etc.