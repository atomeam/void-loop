#!/usr/bin/env node

const fs = require('fs');
const { createInitialState } = require('./core/world');
const { queueInput, tick, resetTick, getCurrentTick } = require('./core/tick');
const { setRomBuffer: setCollisionRom } = require('./core/collision');
const { setRomBuffer: setRenderRom, renderFrame } = require('./render/frame');

console.log('=== Demo Runner: 3-Room Walk ===');

// Load ROM
const romPath = process.argv[2];
if (!romPath) {
    console.error('Usage: node demo-runner.js <path-to-adventure-pal.bin>');
    process.exit(1);
}

const romBuffer = fs.readFileSync(romPath);
setCollisionRom(romBuffer);
setRenderRom(romBuffer);

// Load demo script
const demoScript = JSON.parse(fs.readFileSync('demo-3room-walk.json', 'utf8'));

// Create initial state
let state = createInitialState();
resetTick();

// Create output directory
const outputDir = 'demo-frames';
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// Run demo
console.log(`Running demo with ${demoScript.length} ticks...`);

for (const step of demoScript) {
    // Queue inputs for this tick
    step.inputs.forEach(input => {
        queueInput(input.playerId, input.action);
    });
    
    // Execute tick
    state = tick(state);
    
    // Render frame
    const framePath = `${outputDir}/frame_${String(getCurrentTick()).padStart(3, '0')}.png`;
    renderFrame(state, framePath);
    
    console.log(`Tick ${getCurrentTick()}: Player 0 at (${state.players[0].roomId}, ${state.players[0].x}, ${state.players[0].y}), Player 1 at (${state.players[1].roomId}, ${state.players[1].x}, ${state.players[1].y})`);
}

console.log(`\n✓ Demo complete. Frames saved to ${outputDir}/`);
console.log(`Replay command: node demo-runner.js "${romPath}"`);
