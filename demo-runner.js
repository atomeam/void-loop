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

// Verify ROM SHA-1
const crypto = require('crypto');
const sha1 = crypto.createHash('sha1');
sha1.update(romBuffer);
const romSha1 = sha1.digest('hex');
const expectedSha1 = 'ec23bbea83cf47277482e775ad58ac8e6d1483fe';

if (romSha1 !== expectedSha1) {
    console.error(`✗ ROM SHA-1 mismatch: ${romSha1} (expected: ${expectedSha1})`);
    console.error('Demo will only run against the verified PAL dump.');
    process.exit(1);
}

console.log(`✓ ROM SHA-1 verified: ${romSha1}`);

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
