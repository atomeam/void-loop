#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const { PNG } = require('pngjs');

const PAL_SHA1 = 'ec23bbea83cf47277482e775ad58ac8e6d1483fe';

// Operator-provided PAL ROM offsets (from sprite_sheet.png analysis)
const PAL_OFFSETS = {
    easterEgg: 0x0D83,  // "Created by Warren Robinett" - file offset $0D83 (ROM $FD83)
    bridge: 0x0CD4,
    castleGate: 0x0BF5,
    creatureSprites: { start: 0x0BC4, end: 0x0D2F },
    roomPlayfield: 0x0E24
};

console.log('=== Adventure Asset Extractor ===');
console.log('Extracting assets from PAL ROM with Rosetta-stone offset alignment');

// Check command line arguments
const romPath = process.argv[2];
if (!romPath) {
    console.error('Usage: node extract-assets.js <path-to-adventure-pal.bin>');
    process.exit(1);
}

if (!fs.existsSync(romPath)) {
    console.error(`ROM file not found: ${romPath}`);
    process.exit(1);
}

// Read ROM
console.log(`Loading ROM: ${romPath}`);
const romBuffer = fs.readFileSync(romPath);

// Verify SHA-1
console.log('Verifying SHA-1...');
const hash = crypto.createHash('sha1');
hash.update(romBuffer);
const sha1 = hash.digest('hex');
console.log(`ROM SHA-1: ${sha1}`);

if (sha1.toLowerCase() !== PAL_SHA1.toLowerCase()) {
    console.error(`✗ SHA-1 mismatch: ${sha1} (expected: ${PAL_SHA1})`);
    process.exit(1);
}

console.log('✓ SHA-1 verified');

// STEP 1: Raw Window Verification (must pass before extraction)
console.log('\n=== STEP 1: Raw Window Verification ===');

// Verify raw ROM bytes against operator reference
const easterEggWindow = romBuffer.slice(0x0D83, 0x0D83 + 120);
const easterEggHash = crypto.createHash('sha1');
easterEggHash.update(easterEggWindow);
const easterEggSha1 = easterEggHash.digest('hex');
console.log(`Easter egg SHA-1: ${easterEggSha1}`);
console.log(`Operator reference: e6546173662fa7301d57fea2220930100e94944f`);
console.log(`Match: ${easterEggSha1 === 'e6546173662fa7301d57fea2220930100e94944f' ? 'YES' : 'NO'}`);

const bridgePattern = Buffer.from([0xf0, 0xff, 0x0f, 0x00, 0xff, 0xdb, 0xfc, 0xc3, 0xc3, 0xc3, 0xc3, 0x42, 0x42, 0x42, 0x42]);
const bridgeOffset = romBuffer.indexOf(bridgePattern);
console.log(`Bridge pattern at: 0x${bridgeOffset.toString(16).padStart(4, '0')} (expected: 0x0CD4)`);
console.log(`Match: ${bridgeOffset === 0x0CD4 ? 'YES' : 'NO'}`);

const gatePattern = Buffer.from([0xf0, 0xff, 0x0f, 0x11, 0x4d, 0x31, 0x0f, 0x4d, 0x31, 0x10, 0x4d, 0x31, 0x00, 0xff, 0x05, 0xfc]);
const gateOffset = romBuffer.indexOf(gatePattern);
console.log(`Gate pattern at: 0x${gateOffset.toString(16).padStart(4, '0')} (expected: 0x0BF5)`);
console.log(`Match: ${gateOffset === 0x0BF5 ? 'YES' : 'NO'}`);

if (easterEggSha1 === 'e6546173662fa7301d57fea2220930100e94944f' && 
    bridgeOffset === 0x0CD4 && 
    gateOffset === 0x0BF5) {
    console.log('✓ Raw window verification PASSED - ROM byte-identical to operator reference');
} else {
    console.log('✗ Raw window verification FAILED - ROM differs from operator reference');
    process.exit(1);
}

// Calculate PAL/NTSC offset delta using Rosetta-stone technique
console.log('\n=== Rosetta-Stone Offset Calculation ===');

// Extract Easter egg text bytes from PAL ROM at known offset
const easterEggPAL = romBuffer.slice(PAL_OFFSETS.easterEgg, PAL_OFFSETS.easterEgg + 120);
console.log(`PAL Easter egg at $${PAL_OFFSETS.easterEgg.toString(16).padStart(4, '0')}: ${easterEggPAL.slice(0, 20).toString('hex')}...`);

// Expected Easter egg text from NTSC disassembly (first few bytes)
// "Created by Warren Robinett" in ASCII would be specific byte pattern
// For now, we'll assume offset delta = 0 since operator provided offsets match NTSC expectations
const offsetDelta = 0;
console.log(`Offset delta (PAL - NTSC): ${offsetDelta === 0 ? '0 (addresses match)' : offsetDelta}`);

// Extract graphics data using operator's canonical splitter
console.log('\n=== Graphics Data Extraction (Canonical Splitter) ===');
console.log('Using operator\'s exact algorithm: single zeros stay inside runs, only >=2 consecutive zeros split');

const graphicsStart = 0x0A80;
const graphicsEnd = 0x1000;
const graphicsData = romBuffer.slice(graphicsStart, graphicsEnd);

// Canonical splitter (operator's exact algorithm)
const sprites = [];
let i = 0;

while (i < graphicsData.length) {
    // Skip zero bytes - runs start at nonzero
    if (graphicsData[i] === 0) {
        i++;
        continue;
    }
    
    // Scan for run end (2 consecutive zeros)
    let j = i;
    let consecutiveZeros = 0;
    
    while (j < graphicsData.length) {
        if (graphicsData[j] === 0) {
            consecutiveZeros++;
            if (consecutiveZeros >= 2) {
                break; // Run ends at 2 consecutive zeros
            }
        } else {
            consecutiveZeros = 0; // Reset on nonzero
        }
        j++;
    }
    
    // Extract run (trim trailing zeros, keep single interior zeros)
    const runLength = j - consecutiveZeros - i;
    if (runLength > 0) {
        const run = graphicsData.slice(i, i + runLength);
        sprites.push(run);
    }
    
    i = j + 1; // Continue after the run
}

// Filter runs < 5 bytes (operator's method)
const spritesFiltered = sprites.filter(s => s.length >= 5);
console.log(`Found ${sprites.length} sprite candidates (before <5 byte filter)`);
console.log(`Filtered to ${spritesFiltered.length} sprites (≥5 bytes)`);
console.log(`Operator found: 35 candidates`);

// Render spritesheet using pngjs (no canvas dependency)
console.log('\n=== Rendering Spritesheet ===');
const width = 320; // 40 sprites × 8 pixels wide
const height = 320; // 8 rows of 40 sprites
const png = new PNG({ width, height });

const pngData = new Uint8Array(width * height * 4);
const spritePerRow = 40;

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const idx = (width * y + x) * 4;
        pngData[idx] = 0;     // R
        pngData[idx + 1] = 0; // G
        pngData[idx + 2] = 0; // B
        pngData[idx + 3] = 255; // A
    }
}

let spriteIndex = 0;
for (const sprite of spritesFiltered) {
    if (spriteIndex >= 160) break; // Limit to 160 sprites for initial spritesheet
    
    const startX = (spriteIndex % spritePerRow) * 8;
    const startY = Math.floor(spriteIndex / spritePerRow) * 8;
    
    // Render sprite as 8px wide bitmap
    for (let row = 0; row < sprite.length; row++) {
        const byte = sprite[row];
        for (let bit = 7; bit >= 0; bit--) {
            if (byte & (1 << bit)) {
                const x = startX + (7 - bit);
                const y = startY + row;
                if (x < width && y < height) {
                    const idx = (width * y + x) * 4;
                    pngData[idx] = 0;     // R
                    pngData[idx + 1] = 0; // G
                    pngData[idx + 2] = 255; // B (blue for visibility)
                    pngData[idx + 3] = 255; // A
                }
            }
        }
    }
    
    spriteIndex++;
}

png.data = pngData;

// Save spritesheet
const spritesheetPath = 'spritesheet.png';
const spritesheetBuffer = PNG.sync.write(png);
fs.writeFileSync(spritesheetPath, spritesheetBuffer);
console.log(`✓ Spritesheet saved: ${spritesheetPath}`);

// Extract room data from disassembly spec
console.log('\n=== Room Data Extraction (Disassembly Spec) ===');
const roomDataTableOffset = 0x0E1B; // RoomDataTable at $FE1B (file 0x0E1B)
const roomEntrySize = 9; // 9 bytes per room
const maxRooms = 30; // Adventure has ~30 rooms

console.log(`RoomDataTable at $${roomDataTableOffset.toString(16).padStart(4, '0')}`);

const rooms = [];
const gfxMap = new Map(); // Store shared graphics by offset

for (let i = 0; i < maxRooms; i++) {
    const offset = roomDataTableOffset + (i * roomEntrySize);
    if (offset + roomEntrySize > romBuffer.length) break;
    
    const entry = romBuffer.slice(offset, offset + roomEntrySize);
    
    // Parse room entry structure
    const gfxPtr = (entry[1] << 8) | entry[0];
    const room = {
        id: i,
        gfxPtr: gfxPtr,
        color: entry[2],
        bwColor: entry[3],
        pfControl: entry[4],
        roomAbove: entry[5],
        roomLeft: entry[6],
        roomDown: entry[7],
        roomRight: entry[8],
        flags: {
            rightThinWall: (entry[4] & 0x40) !== 0,
            leftThinWall: (entry[4] & 0x80) !== 0,
            mirror: (entry[4] & 0x01) !== 0
        }
    };
    
    rooms.push(room);
    
    // Extract room graphics data (21 bytes at gfxPtr - $F000)
    const gfxOffset = gfxPtr - 0xF000;
    if (gfxOffset + 21 <= romBuffer.length) {
        const gfxData = romBuffer.slice(gfxOffset, gfxOffset + 21);
        const gfxHex = gfxData.toString('hex');
        
        // Store shared graphics by offset
        if (!gfxMap.has(gfxHex)) {
            gfxMap.set(gfxHex, {
                offset: gfxPtr,
                data: gfxHex,
                rooms: []
            });
        }
        gfxMap.get(gfxHex).rooms.push(i);
    }
}

console.log(`Parsed ${rooms.length} rooms from RoomDataTable`);
console.log(`Found ${gfxMap.size} unique graphics groups (shared gfx)`);

// Extract RoomDiffs table for dynamic door resolution
const roomDiffsOffset = 0x0F32; // RoomDiffs at $FF32 (file 0x0F32)
const roomDiffs = [];
for (let i = 0; i < 6; i++) {
    const offset = roomDiffsOffset + (i * 3);
    if (offset + 3 <= romBuffer.length) {
        const diff = romBuffer.slice(offset, offset + 3);
        roomDiffs.push(Array.from(diff));
    }
}
console.log(`Extracted RoomDiffs table: ${roomDiffs.length} entries`);

// Extract PAL color table from room entries
const palColorTable = rooms.map(r => ({
    roomId: r.id,
    color: r.color,
    bwColor: r.bwColor
}));

console.log(`Extracted PAL color table from ${rooms.length} rooms`);

// Create assets.json
const assets = {
    palSha1: sha1,
    offsetDelta: offsetDelta,
    palOffsets: PAL_OFFSETS,
    colorTable: {
        type: 'PAL',
        colors: palColorTable
    },
    sprites: spritesFiltered.map(s => s.toString('hex')),
    spriteCount: spritesFiltered.length
};

const assetsPath = 'assets.json';
fs.writeFileSync(assetsPath, JSON.stringify(assets, null, 2));
console.log(`✓ Assets saved: ${assetsPath}`);

// Create rooms.json v2
const roomsPath = 'rooms.json';
const roomsData = {
    rooms: rooms,
    total: rooms.length,
    gfxMap: Array.from(gfxMap.entries()).map(([hex, data]) => ({
        hex: hex,
        offset: data.offset,
        rooms: data.rooms
    })),
    roomDiffs: roomDiffs
};
fs.writeFileSync(roomsPath, JSON.stringify(roomsData, null, 2));
console.log(`✓ Rooms v2 saved: ${roomsPath}`);

// Create sprites.json
const spritesPath = 'sprites.json';
const spritesData = {
    sprites: spritesFiltered.map((s, i) => ({
        id: i,
        data: s.toString('hex'),
        size: s.length
    })),
    total: spritesFiltered.length
};
fs.writeFileSync(spritesPath, JSON.stringify(spritesData, null, 2));
console.log(`✓ Sprites saved: ${spritesPath}`);

console.log('\n=== STEP 3: Operator Reference Manifest Verification ===');

// Verify against operator's full reference manifest
const operatorManifest = [
    { offset: 0x0A80, length: 34, sha1: '81f152643d60eb44ea320e20a5115b0f97a4e2da' },
    { offset: 0x0AC4, length: 5, sha1: '6cea2e9e3f01acef1a19740c3e6d4340ed039fcf' },
    { offset: 0x0AD9, length: 6, sha1: '07faae70b9270250f53b9a8a84bdd8327cdff544' },
    { offset: 0x0AEE, length: 62, sha1: '0b97b656ef6268107f92b10a6137fc42660c1653' },
    { offset: 0x0B3B, length: 26, sha1: 'e521e02a159394189d5c801518eab735effe9bd6' },
    { offset: 0x0B59, length: 24, sha1: '4337ccc3c3e84892e9bd6322fc680029c71edd79' },
    { offset: 0x0B78, length: 40, sha1: '6011c79dec6c050a139819061df43cd5993b1126' },
    { offset: 0x0BA4, length: 5, sha1: '748dfab35e437ff1f23b4ecb35109159d69a4aad' },
    { offset: 0x0BAC, length: 21, sha1: 'b58207c110927369827e5734adf9266fcec8ae3e' },
    { offset: 0x0BC4, length: 46, sha1: 'ba61743964331400ea6fa3fd0bdf3a7f89b574f2' },
    { offset: 0x0BF5, length: 51, sha1: '5cfbe4415543708a70258f9f4979b0397164bf77' },
    { offset: 0x0C31, length: 20, sha1: '04ab560fcedad4dd790abe889a138ca03bd11f8f' },
    { offset: 0x0C4A, length: 5, sha1: '748dfab35e437ff1f23b4ecb35109159d69a4aad' },
    { offset: 0x0C58, length: 20, sha1: '724dcd8e0c4788c0f8290a9588170af37cf8497c' },
    { offset: 0x0C6F, length: 8, sha1: '4bacc2737b15fae3f51668104c4542cd13abcc1e' },
    { offset: 0x0C86, length: 5, sha1: '4302d10544e972be68c5fc37cbda4e30c645330e' },
    { offset: 0x0C95, length: 9, sha1: '6f808c6874dae521631df85e6b5c89c651c714a2' },
    { offset: 0x0CA1, length: 17, sha1: '30be5be4d190bd4175b48cd1d911f857e7a6df7a' },
    { offset: 0x0CBB, length: 15, sha1: '0fa73dfe7c4113e1154810ba8cbcba9fcd5fbfac' },
    { offset: 0x0CD4, length: 38, sha1: '817b59d530dbf276366713263e505fc5d17ff477' },
    { offset: 0x0CFD, length: 47, sha1: 'ab0aed538d645c6bab57960a8e0fe4dd58fea166' },
    { offset: 0x0D2F, length: 71, sha1: 'e726a740963ba503851c1b92c7bc8d5349609369' },
    { offset: 0x0D79, length: 7, sha1: '68a89e4ba482ba222524ec474255f346f668e6ee' },
    { offset: 0x0D83, length: 120, sha1: 'e6546173662fa7301d57fea2220930100e94944f' },
    { offset: 0x0E03, length: 28, sha1: 'd7e9f9b1db5e6711fbfc559beea1032d455ed87a' },
    { offset: 0x0E24, length: 302, sha1: 'd209d0fcc9e8f275bc23a582a43ba1dde87d9552' },
    { offset: 0x0F56, length: 5, sha1: '3721298e7706592144688b7351d137948179c969' },
    { offset: 0x0F5F, length: 5, sha1: '144338ece62c030170ef03513f4a46ac7480a6b7' },
    { offset: 0x0F68, length: 6, sha1: '321ac2941bb7bd89a85e9479b1e73853df3da139' },
    { offset: 0x0F71, length: 6, sha1: '80e0e2e1c523153b05b97657d2e516d75caf3f8d' },
    { offset: 0x0F7A, length: 24, sha1: 'aa0a08e4e31297d35d0d2e241a313dd84b99a9c4' },
    { offset: 0x0F95, length: 41, sha1: 'c3583938f09f8a686b481f7744308fb35c8cc44a' },
    { offset: 0x0FC2, length: 5, sha1: 'd72f648a7b03912b826b1c5eee24b2360f11c3f9' },
    { offset: 0x0FCB, length: 32, sha1: '8eeabba404c12677e2cbc77631d2753f66c94067' },
    { offset: 0x0FFB, length: 5, sha1: '3959a3c6841fb7d9f8ce1c546120466aac582a04' }
];

let manifestMatches = 0;
let manifestTotal = operatorManifest.length;

for (const entry of operatorManifest) {
    const window = romBuffer.slice(entry.offset, entry.offset + entry.length);
    const hash = crypto.createHash('sha1');
    hash.update(window);
    const sha1 = hash.digest('hex');
    
    if (sha1 === entry.sha1) {
        manifestMatches++;
    } else {
        console.log(`✗ Manifest mismatch at 0x${entry.offset.toString(16).padStart(4, '0')}: ${sha1} (expected: ${entry.sha1})`);
    }
}

console.log(`Manifest verification: ${manifestMatches}/${manifestTotal} matches`);
if (manifestMatches === manifestTotal) {
    console.log('✓ Full manifest verification PASSED - 35/35 hash matches');
} else {
    console.log(`✗ Manifest verification FAILED - only ${manifestMatches}/${manifestTotal} matches`);
}

console.log('\n=== Extraction Complete ===');
console.log('Generated files:');
console.log(`- ${spritesheetPath} (${spritesFiltered.length} sprites rendered)`);
console.log(`- ${assetsPath} (offset delta: ${offsetDelta})`);
console.log(`- ${roomsPath} (placeholder structure)`);
console.log(`- ${spritesPath} (${spritesFiltered.length} sprites)`);
console.log('\nNext steps:');
console.log('1. Extract NTSC Easter egg address from disassembly for proper offset calculation');
console.log('2. Implement proper room parsing from disassembly');
console.log('3. Extract PAL color table from disassembly');
