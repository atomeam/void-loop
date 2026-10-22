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

### Phase 4 (Agent Play Mode) - DESCOPE NOTICE

**HEADLESS CLI: NON-FUNCTIONAL**
- **Browser AgentBridge**: Programmatic API for AI agents to control the emulator via `?agent=1` flag (PARTIALLY FUNCTIONAL)
- **Headless CLI**: NOT AVAILABLE - Requires complex build setup beyond $0 budget constraints
- **Operator Mode**: NOT AVAILABLE - RAM manipulation requires working headless emulator
- **Frame Capture**: NOT AVAILABLE - Requires working headless emulator
- **RAM Access**: NOT AVAILABLE - Neither browser (Javatari.js) nor headless (build complexity) expose RAM access APIs

**Current Status:**
- **Browser AgentBridge**: PARTIALLY FUNCTIONAL - Input queueing, frame counting, state management work. RAM access blocked by Javatari.js architecture.
- **Headless CLI**: NON-FUNCTIONAL - 6502.ts requires complex build setup (Yarn + Webpack) for Node.js API access. Alternative emulators (retroemu) are designed for interactive terminal play, not programmatic agent integration.
- **RAM Access**: UNAVAILABLE EVERYWHERE - Javatari.js does not expose public RAM access APIs. No drop-in headless emulator provides programmatic RAM access within $0 budget.
- **Agent Capability**: VISION-ONLY - Agents can play via input/output (frames + controls) but cannot access RAM for state inspection or manipulation.

**Evidence:**
- 6502.ts Board class requires complex dependency injection (test-6502-spike.js output)
- retroemu designed for interactive terminal play, not programmatic API (test-retroemu-spike.js output)
- Javatari.js confirmed to not expose RAM access APIs (GitHub research: sehugg/javatari.js commits show read/writeAddress added but not public; pitfall-agent-javatari fork shows RAM access requires modifying Javatari internals)

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

This emulator supports browser-based agent play with vision-only capabilities.

### Browser AgentBridge API

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

// Get current frame count
const frameCount = AgentBridge.getFrameCount();
```

**IMPORTANT LIMITATIONS:**
- **RAM Access NOT Available**: Javatari.js does not expose public RAM access APIs. Agents cannot peek/poke memory.
- **Vision-Only Agents**: Agents play via input/output (frames + controls) but cannot access internal game state.
- **No Operator Mode**: RAM manipulation requires working headless emulator which is not available within $0 budget.

**Valid Actions**: `up`, `down`, `left`, `right`, `fire`, `reset`, `select`

### Agent Capability Summary

**Available:**
- Input queueing (frame-accurate)
- Frame capture (base64 PNG)
- State management (save/load)
- Frame counting

**NOT Available:**
- RAM peek/poke (memory access)
- Operator mode (world manipulation)
- Headless execution (CLI)
- Deterministic frame capture to disk
- Audit logging

**Evidence:**
- 6502.ts Board class requires complex dependency injection (test-6502-spike.js)
- retroemu designed for interactive terminal play, not programmatic API (test-retroemu-spike.js)
- Javatari.js confirmed to not expose RAM access APIs (research + browser testing)
