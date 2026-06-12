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
