#!/usr/bin/env node

const fs = require('fs');
const { PNG } = require('pngjs');

console.log('=== Room Renderer ===');

// Load rooms.json
const roomsData = JSON.parse(fs.readFileSync('rooms.json', 'utf8'));
const rooms = roomsData.rooms;

console.log(`Loaded ${rooms.length} rooms`);

// Load ROM for room graphics data
const romPath = process.argv[2];
if (!romPath) {
    console.error('Usage: node render-rooms.js <path-to-adventure-pal.bin>');
    process.exit(1);
}

const romBuffer = fs.readFileSync(romPath);

// Create output image: 10 columns × 3 rows = 30 rooms
const roomWidth = 320;  // 40 columns × 8 pixels (20 left + 20 right)
const roomHeight = 112; // 7 rows × 16 pixels
const cols = 10;
const rows = 3;

const totalWidth = cols * roomWidth;
const totalHeight = rows * roomHeight;

const png = new PNG({ width: totalWidth, height: totalHeight });
const pngData = new Uint8Array(totalWidth * totalHeight * 4);

// Clear to black
for (let y = 0; y < totalHeight; y++) {
    for (let x = 0; x < totalWidth; x++) {
        const idx = (totalWidth * y + x) * 4;
        pngData[idx] = 0;     // R
        pngData[idx + 1] = 0; // G
        pngData[idx + 2] = 0; // B
        pngData[idx + 3] = 255; // A
    }
}

// Render each room with proper playfield decoding
for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    
    // Calculate position in grid
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    const startX = col * roomWidth;
    const startY = row * roomHeight;
    
    // Resolve graphics pointer
    const gfxPtr = room.gfxPtr;
    const gfxOffset = gfxPtr - 0xF000;
    
    // Get room graphics data (21 bytes: 7 rows × [PF0, PF1, PF2])
    const gfxData = romBuffer.slice(gfxOffset, gfxOffset + 21);
    
    // Get room color (PAL)
    const colorVal = room.color;
    const r = (colorVal & 0x0F) * 17; // Convert 4-bit to 8-bit
    const g = ((colorVal >> 4) & 0x0F) * 17;
    const b = 0; // Adventure colors are mostly monochrome
    
    // Decode playfield: 7 rows × 3 bytes per row
    for (let rowIdx = 0; rowIdx < 7; rowIdx++) {
        const rowY = startY + (rowIdx * 16);
        
        const pf0 = gfxData[rowIdx * 3];
        const pf1 = gfxData[rowIdx * 3 + 1];
        const pf2 = gfxData[rowIdx * 3 + 2];
        
        // Left half = 20px: PF0 bits 4→7, PF1 bits 7→0, PF2 bits 0→7
        // Render left half at 8x scale
        for (let pixel = 0; pixel < 20; pixel++) {
            let bit = 0;
            if (pixel < 4) {
                // PF0 bits 4→7
                bit = (pf0 >> (7 - pixel)) & 1;
            } else if (pixel < 12) {
                // PF1 bits 7→0
                bit = (pf1 >> (11 - pixel)) & 1;
            } else {
                // PF2 bits 0→7
                bit = (pf2 >> (19 - pixel)) & 1;
            }
            
            if (bit) {
                // Draw 8x8 block for each pixel
                for (let dx = 0; dx < 8; dx++) {
                    for (let dy = 0; dy < 16; dy++) {
                        const px = startX + (pixel * 8) + dx;
                        const py = rowY + dy;
                        const idx = (totalWidth * py + px) * 4;
                        pngData[idx] = r;
                        pngData[idx + 1] = g;
                        pngData[idx + 2] = b;
                        pngData[idx + 3] = 255;
                    }
                }
            }
        }
        
        // Right half: mirror left if ctrl bit 0 set, else repeat it
        const mirror = room.flags.mirror;
        for (let pixel = 0; pixel < 20; pixel++) {
            const srcPixel = mirror ? (19 - pixel) : pixel;
            
            // Check if left half pixel was set
            let bit = 0;
            if (srcPixel < 4) {
                bit = (pf0 >> (7 - srcPixel)) & 1;
            } else if (srcPixel < 12) {
                bit = (pf1 >> (11 - srcPixel)) & 1;
            } else {
                bit = (pf2 >> (19 - srcPixel)) & 1;
            }
            
            if (bit) {
                // Draw 8x8 block for each pixel
                for (let dx = 0; dx < 8; dx++) {
                    for (let dy = 0; dy < 16; dy++) {
                        const px = startX + 160 + (pixel * 8) + dx;
                        const py = rowY + dy;
                        const idx = (totalWidth * py + px) * 4;
                        pngData[idx] = r;
                        pngData[idx + 1] = g;
                        pngData[idx + 2] = b;
                        pngData[idx + 3] = 255;
                    }
                }
            }
        }
    }
    
    // Draw room number in corner (simplified)
    const numX = startX + 10;
    const numY = startY + 10;
    
    for (let dx = 0; dx < 20; dx++) {
        for (let dy = 0; dy < 20; dy++) {
            const px = numX + dx;
            const py = numY + dy;
            if (px < startX + roomWidth && py < startY + roomHeight) {
                const idx = (totalWidth * py + px) * 4;
                pngData[idx] = 255; // White for room numbers
                pngData[idx + 1] = 255;
                pngData[idx + 2] = 255;
                pngData[idx + 3] = 255;
            }
        }
    }
    
    console.log(`Rendered room ${room.id} at (${col}, ${row}) with color ${colorVal.toString(16)} gfxPtr $${gfxPtr.toString(16)}`);
}

png.data = pngData;

// Save rooms image
const roomsImagePath = 'rooms.png';
const roomsImageBuffer = PNG.sync.write(png);
fs.writeFileSync(roomsImagePath, roomsImageBuffer);
console.log(`✓ Rooms image saved: ${roomsImagePath}`);
console.log(`  Size: ${totalWidth}x${totalHeight} (${cols}x${rows} grid)`);
