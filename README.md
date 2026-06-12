# Adventure (1980) - Browser-based Atari 2600 Emulator

A browser-based implementation of the classic Atari 2600 game "Adventure" (1980) by Warren Robinett, running in PAL mode with modern enhancements.

## Features

### Phase 1 (Core)
- **Javatari.js Integration**: Open-source JavaScript Atari 2600 emulator with PAL/NTSC support
- **ROM Verification**: Client-side SHA-1 checksum verification against known good PAL dump
- **PAL Mode**: Forced PAL console mode for accurate timing and colors
- **Input Controls**: Keyboard (arrows + space) and touch controls for mobile
- **Secure ROM Loading**: File-picker only - ROM never stored on server

### Phase 2 (Enhancements)
- **CRT Effect**: Toggleable scanlines and vignette shader (default OFF)
- **Save States**: LocalStorage-based save state system
- **Fullscreen Mode**: Native fullscreen API integration
- **Difficulty Controls**: Quick-switch buttons for left/right difficulty switches
- **Game Selection**: UI buttons for game variations (1/2/3)

### Phase 4 (Agent Play Mode)
- **Browser AgentBridge**: Programmatic API for AI agents to control the emulator via `?agent=1` flag
- **Headless CLI**: Node.js command-line interface (currently requires build setup - see limitations below)
- **Operator Mode**: RAM manipulation (`poke()`) with audit logging for agent intervention studies (headless only)
- **Frame Capture**: Deterministic frame output for training data generation (headless only)
- **RAM Access**: Peek/poke console RAM ($80–$FF) for agent perception and world manipulation (headless only)

**Current Limitations:**
- **Browser RAM Access**: Javatari.js does not expose public RAM access APIs. Peek/poke only available in headless mode.
- **Headless CLI**: Requires building 6502.ts from source for proper Node.js API access. The NPM package provides browser-focused APIs that need complex setup.
- **Demo Scripts**: Provided as templates but require actual ROM file and working emulator for validation.

## ROM Information

**Expected PAL ROM**: Adventure (1980) (Atari, Warren Robinett) (CX2613, CX2613P) (PAL).bin
- **Size**: 4096 bytes
- **CRC32**: 18DC23F9
- **MD5**: 4b27f5397c442d25f0c418ccdacf1926
- **SHA-1**: ec23bbea83cf47277482e775ad58ac8e6d1483fe

## Usage

1. Open the page in a modern browser
2. Click "Select ROM File" or drag-and-drop your Adventure ROM
3. The emulator will verify the SHA-1 checksum
4. If verification passes, the game will boot in PAL mode

### Controls

- **Arrow Keys**: Move joystick
- **Space**: Fire button
- **R**: Reset console
- **Game Select Buttons**: Choose game variation (1/2/3)
- **Difficulty Buttons**: Toggle left/right difficulty (A/B)

## Security

- ROM files are loaded client-side only via file picker
- No ROM data is ever stored on the server
- No ROM files are committed to the repository
- Checksum verification ensures only the correct PAL ROM is loaded

## Technology Stack

- **Emulator**: Javatari.js (v5.0.4)
- **Hosting**: Vercel (free tier)
- **Technologies**: HTML5, CSS3, Vanilla JavaScript

## Deployment

Deployed to Vercel free tier as a preview deployment.

## License

This project uses Javatari.js, which is open-source. The Adventure ROM is property of Atari and must be provided by the user who owns the original cartridge.

## Phase 3 (Optional)

If implemented, BPS/IPS patches will be provided for minor enhancements. Original ROM remains untouched - only patch files are distributed.

## How an AI Agent Plays

This emulator supports two environments for AI agent play:

### 1. Browser AgentBridge API

Enable agent mode by adding `?agent=1` to the URL. This exposes `window.AgentBridge` with the following methods:

```javascript
// Load ROM programmatically (bypasses file picker)
await AgentBridge.loadRom(arrayBuffer);

// Queue input actions (frame-accurate)
AgentBridge.input('right', 500);  // Move right for 500ms
AgentBridge.input('fire', 100);   // Press fire for 100ms

// Get current frame as base64 PNG
const frameData = AgentBridge.getFrame();

// Save/load state
const state = AgentBridge.getState();
AgentBridge.setState(state);

// Peek at console RAM ($80–$FF)
const playerX = AgentBridge.peek(0x85);  // Example: read player X position

// Get current frame count
const frameCount = AgentBridge.getFrameCount();
```

**Important RAM Access Limitation**: Javatari.js does not expose public RAM access APIs. The `peek()` and `poke()` methods are **only available in the headless CLI** (which uses the 6502.ts core). In browser mode, these methods will throw an error directing you to use the CLI for RAM operations.

**Operator Mode** (add `?operator=1`):

```javascript
// NOTE: Operator mode RAM operations are only available in headless CLI
// Browser mode does not support poke() due to Javatari.js limitations
// Use the Node.js CLI with --operator flag for RAM manipulation
```

**Valid Actions**: `up`, `down`, `left`, `right`, `fire`, `reset`, `select`

### 2. Headless CLI

**CURRENT STATUS: NON-FUNCTIONAL - Requires Build Setup**

The headless CLI requires building 6502.ts from source to access the Node.js API. The NPM package provides browser-focused APIs that need complex build setup. 

To enable headless mode, you would need to:
1. Clone https://github.com/6502ts/6502.ts
2. Build the project using their build system (Yarn + Webpack)
3. Extract the Node.js-compatible emulator core
4. Integrate it into the agent-play.js CLI

This is a significant undertaking that goes beyond the current $0 budget constraint.

**Intended Usage** (when functional):

```bash
# Install dependencies
npm install

# Run a script
node agent-play.js --rom path/to/adventure.bin --script demo-key-castle.json --out output/

# Run with operator mode (allows poke actions)
node agent-play.js --rom path/to/adventure.bin --script demo-operator-summon.json --out output/ --operator

# Capture every 30th frame (default: 60)
node agent-play.js --rom path/to/adventure.bin --script demo-key-castle.json --out output/ --frame-interval 30
```

**Input Script Format** (JSON):

```json
[
  {
    "frame": 0,
    "action": "reset",
    "frames": 1
  },
  {
    "frame": 60,
    "action": "right",
    "frames": 30
  },
  {
    "frame": 120,
    "action": "fire",
    "frames": 5
  },
  {
    "frame": 180,
    "action": "poke",
    "addr": 135,
    "value": 5,
    "reason": "Summon bridge"
  }
]
```

**Outputs**:
- `frame_XXXXXX.png` - Captured frames at specified intervals
- `manifest.json` - Run metadata (ROM SHA-1, total frames, script hash)
- `ram_dump.json` - Final RAM state ($80–$FF)
- `audit_log.json` - Operator mode poke log (if `--operator` enabled)

### Adventure RAM Map

The Atari 2600 has 128 bytes of RAM at addresses $80–$FF. While the exact Adventure memory map requires reverse-engineering, known patterns include:

**Player/Object State** (approximate, requires verification):
- `$80-$8F`: Player state (position, room, carrying item)
- `$90-$9F`: Object states (sword, keys, bridge, etc.)
- `$A0-$AF`: Dragon states (Yorgle, Grundle, Rhindle)
- `$B0-$BF`: Room/object relationships
- `$C0-$CF`: Game flags and state
- `$D0-$FF`: Stack and temporary variables

**Common Patterns**:
- Object positions typically stored as X/Y coordinates
- Room numbers often use single bytes
- Item carried flags usually bit-masks
- Dragon AI state machines use sequential bytes

**Note**: The exact Adventure RAM map is an active research area. Agents should use `peek()` to discover patterns and `poke()` to test hypotheses about memory layout.

### Agent Hierarchy

1. **Players** (human or agent) - Inputs only. Live inside the rules: walk, carry, run from dragons.
2. **Operators** (agents only) - Can `poke()` RAM to summon items, teleport, modify world state. Every poke is logged.
3. **Architect** (human) - Decides which agents get operator access and reviews audit logs.

The audit log turns "summons" into labeled training data: *world state → intervention → outcome*. This enables training models that learn when operators should reach into the system and change it.
