// Collision module - per-player wall collision against playfield bitmaps
const fs = require('fs');
const { getRoom, resolveNeighbor } = require('./world');

// Load ROM for room graphics data
let romBuffer = null;

function setRomBuffer(buffer) {
    romBuffer = buffer;
}

// Decode room playfield to collision bitmap
function decodeRoomPlayfield(roomId) {
    const room = getRoom(roomId);
    if (!room || !romBuffer) return null;
    
    const gfxPtr = room.gfxPtr;
    const gfxOffset = gfxPtr - 0xF000;
    const gfxData = romBuffer.slice(gfxOffset, gfxOffset + 21);
    
    // Create collision bitmap (40x7)
    const collisionMap = new Array(40).fill(0).map(() => new Array(7).fill(0));
    
    for (let rowIdx = 0; rowIdx < 7; rowIdx++) {
        const pf0 = gfxData[rowIdx * 3];
        const pf1 = gfxData[rowIdx * 3 + 1];
        const pf2 = gfxData[rowIdx * 3 + 2];
        
        // Left half = 20px
        for (let pixel = 0; pixel < 20; pixel++) {
            let bit = 0;
            if (pixel < 4) {
                bit = (pf0 >> (7 - pixel)) & 1;
            } else if (pixel < 12) {
                bit = (pf1 >> (11 - pixel)) & 1;
            } else {
                bit = (pf2 >> (19 - pixel)) & 1;
            }
            collisionMap[pixel][rowIdx] = bit;
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
            collisionMap[20 + pixel][rowIdx] = bit;
        }
    }
    
    return collisionMap;
}

// Check if position collides with wall
function checkCollision(player, roomId) {
    const collisionMap = decodeRoomPlayfield(roomId);
    if (!collisionMap) return false;
    
    // Convert player position to playfield coordinates
    // Room is 40x7 in playfield units, player is 320x112 in pixels
    // Scale: 8x horizontal, 16x vertical
    const pfX = Math.floor(player.x / 8);
    const pfY = Math.floor(player.y / 16);
    
    // Check bounds
    if (pfX < 0 || pfX >= 40 || pfY < 0 || pfY >= 7) {
        // Check for doorway transition
        return checkDoorway(player, roomId);
    }
    
    // Check wall collision
    if (collisionMap[pfX][pfY]) {
        return true; // Wall collision
    }
    
    // Check thin walls (ctrl bits 6/7)
    const room = getRoom(roomId);
    if (room.flags.leftThinWall && pfX === 0) {
        return true; // Left thin wall
    }
    if (room.flags.rightThinWall && pfX === 39) {
        return true; // Right thin wall
    }
    
    return false;
}

// Check for doorway transition
function checkDoorway(player, roomId) {
    const room = getRoom(roomId);
    if (!room) return null;
    
    // Check screen edges for doorway
    if (player.x <= 0) {
        // Left edge - check if there's a room to the left
        return room.roomLeft !== 0 ? room.roomLeft : null;
    }
    if (player.x >= 319) {
        // Right edge - check if there's a room to the right
        return room.roomRight !== 0 ? room.roomRight : null;
    }
    if (player.y <= 0) {
        // Top edge - check if there's a room above
        return room.roomAbove !== 0 ? room.roomAbove : null;
    }
    if (player.y >= 111) {
        // Bottom edge - check if there's a room below
        return room.roomDown !== 0 ? room.roomDown : null;
    }
    
    return null;
}

// Perform room transition
function performTransition(state, playerId, newRoomId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    
    // Resolve dynamic door if needed
    const resolvedRoomId = resolveNeighbor(newRoomId, state.currentLevel);
    if (resolvedRoomId === null) return; // Invalid door
    
    player.roomId = resolvedRoomId;
    
    // Reset position to center of new room
    player.x = 160;
    player.y = 56;
}

// Update player position with collision detection
function updatePosition(state, playerId, newX, newY) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    
    const oldX = player.x;
    const oldY = player.y;
    
    // Try new position
    player.x = newX;
    player.y = newY;
    
    // Check collision
    if (checkCollision(player, player.roomId)) {
        // Revert if collision
        player.x = oldX;
        player.y = oldY;
        return false; // Collision detected
    }
    
    // Check for doorway transition
    const doorRoomId = checkDoorway(player, player.roomId);
    if (doorRoomId !== null) {
        performTransition(state, playerId, doorRoomId);
    }
    
    return true; // No collision
}

module.exports = {
    setRomBuffer,
    updatePosition,
    checkCollision
};
