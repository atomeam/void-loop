// Frame renderer - thin renderer with headless PNG output
import fs from 'fs';
import { PNG } from 'pngjs';
import { getRoom } from '../core/world.js';

// Load ROM for room graphics data
let romBuffer = null;

function setRomBuffer(buffer) {
    romBuffer = buffer;
}

// Render a single frame to PNG
function renderFrame(state, outputPath) {
    const roomWidth = 160; // World space: 160 wide
    const roomHeight = 112; // World space: 112 tall
    
    const png = new PNG({ width: roomWidth, height: roomHeight });
    const pngData = new Uint8Array(roomWidth * roomHeight * 4);
    
    // Clear to black
    for (let y = 0; y < roomHeight; y++) {
        for (let x = 0; x < roomWidth; x++) {
            const idx = (roomWidth * y + x) * 4;
            pngData[idx] = 0;
            pngData[idx + 1] = 0;
            pngData[idx + 2] = 0;
            pngData[idx + 3] = 255;
        }
    }
    
    // Render room playfield for each player's current room
    const renderedRooms = new Set();
    
    state.players.forEach(player => {
        if (renderedRooms.has(player.roomId)) return;
        renderedRooms.add(player.roomId);
        
        const room = getRoom(player.roomId);
        if (!room || !romBuffer) return;
        
        const gfxPtr = room.gfxPtr;
        const gfxOffset = gfxPtr - 0xF000;
        const gfxData = romBuffer.slice(gfxOffset, gfxOffset + 21);
        
        // Get room color (PAL)
        const colorVal = room.color;
        const r = (colorVal & 0x0F) * 17;
        const g = ((colorVal >> 4) & 0x0F) * 17;
        const b = 0;
        
        // Decode playfield: 7 rows × 3 bytes per row
        for (let rowIdx = 0; rowIdx < 7; rowIdx++) {
            const rowY = rowIdx * 16;
            
            const pf0 = gfxData[rowIdx * 3];
            const pf1 = gfxData[rowIdx * 3 + 1];
            const pf2 = gfxData[rowIdx * 3 + 2];
            
            // Left half = 20px (20 cells × 1px, but each cell is 4px wide in world space)
            for (let pixel = 0; pixel < 20; pixel++) {
                let bit = 0;
                if (pixel < 4) {
                    bit = (pf0 >> (7 - pixel)) & 1;
                } else if (pixel < 12) {
                    bit = (pf1 >> (11 - pixel)) & 1;
                } else {
                    bit = (pf2 >> (19 - pixel)) & 1;
                }
                
                if (bit) {
                    // Draw 4px wide × 16px tall block for each playfield cell
                    for (let dx = 0; dx < 4; dx++) {
                        for (let dy = 0; dy < 16; dy++) {
                            const px = (pixel * 4) + dx;
                            const py = rowY + dy;
                            const idx = (roomWidth * py + px) * 4;
                            pngData[idx] = r;
                            pngData[idx + 1] = g;
                            pngData[idx + 2] = b;
                            pngData[idx + 3] = 255;
                        }
                    }
                }
            }
            
            // Right half
            const mirror = room.flags.mirror;
            for (let pixel = 0; pixel < 20; pixel++) {
                const srcPixel = mirror ? (19 - pixel) : pixel;
                
                let bit = 0;
                if (srcPixel < 4) {
                    bit = (pf0 >> (7 - srcPixel)) & 1;
                } else if (srcPixel < 12) {
                    bit = (pf1 >> (11 - srcPixel)) & 1;
                } else {
                    bit = (pf2 >> (19 - srcPixel)) & 1;
                }
                
                if (bit) {
                    for (let dx = 0; dx < 4; dx++) {
                        for (let dy = 0; dy < 16; dy++) {
                            const px = 80 + (pixel * 4) + dx;
                            const py = rowY + dy;
                            const idx = (roomWidth * py + px) * 4;
                            pngData[idx] = r;
                            pngData[idx + 1] = g;
                            pngData[idx + 2] = b;
                            pngData[idx + 3] = 255;
                        }
                    }
                }
            }
        }
    });
    
    // Render players as colored squares
    state.players.forEach(player => {
        const pr = (player.color >> 16) & 0xFF;
        const pg = (player.color >> 8) & 0xFF;
        const pb = player.color & 0xFF;
        
        // Draw 8x8 square for player
        for (let dx = 0; dx < 8; dx++) {
            for (let dy = 0; dy < 8; dy++) {
                const px = player.x + dx;
                const py = player.y + dy;
                if (px < roomWidth && py < roomHeight) {
                    const idx = (roomWidth * py + px) * 4;
                    pngData[idx] = pr;
                    pngData[idx + 1] = pg;
                    pngData[idx + 2] = pb;
                    pngData[idx + 3] = 255;
                }
            }
        }
    });
    
    png.data = pngData;
    
    // Save PNG
    const buffer = PNG.sync.write(png);
    fs.writeFileSync(outputPath, buffer);
}

export {
    setRomBuffer,
    renderFrame
};
