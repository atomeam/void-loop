// World module - room graph and game state management
import fs from 'fs';
import { checkCollision } from './collision.js';

// Load rooms.json v2
const roomsData = JSON.parse(fs.readFileSync('rooms.json', 'utf8'));
const rooms = roomsData.rooms;
const roomDiffs = roomsData.roomDiffs;

// Create room lookup by ID
const roomById = new Map();
rooms.forEach(room => roomById.set(room.id, room));

// Resolve neighbor bytes to room IDs for a given game level
function resolveNeighbor(neighborByte, currentLevel) {
    if (neighborByte < 0x80) {
        // Literal room ID
        return neighborByte;
    } else {
        // Dynamic door - resolve via roomDiffs
        const diffIndex = (neighborByte - 0x80) + Math.floor(currentLevel / 2);
        if (diffIndex >= 0 && diffIndex < roomDiffs.length) {
            const diff = roomDiffs[diffIndex];
            // Return the appropriate room ID from the diff based on current level
            const levelOffset = currentLevel % 2;
            return diff[levelOffset];
        }
        return null; // Invalid door
    }
}

// Get room by ID
function getRoom(roomId) {
    return roomById.get(roomId);
}

// Resolve full room graph for a given level
function resolveRoomGraph(currentLevel) {
    const graph = new Map();
    
    rooms.forEach(room => {
        const resolved = {
            id: room.id,
            above: resolveNeighbor(room.roomAbove, currentLevel),
            left: resolveNeighbor(room.roomLeft, currentLevel),
            down: resolveNeighbor(room.roomDown, currentLevel),
            right: resolveNeighbor(room.roomRight, currentLevel),
            flags: room.flags
        };
        graph.set(room.id, resolved);
    });
    
    return graph;
}

// Spawn player near a position, scanning outward for wall-free position
function spawnNear(roomId, targetX, targetY) {
    const hitboxSize = 8;
    const maxSearchRadius = 40;
    
    for (let radius = 0; radius <= maxSearchRadius; radius++) {
        // Search in spiral pattern
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                // Only check perimeter of current radius
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                
                const testX = targetX + dx;
                const testY = targetY + dy;
                
                // Check bounds
                if (testX < 0 || testX > 159 - hitboxSize || testY < 0 || testY > 111 - hitboxSize) {
                    continue;
                }
                
                // Test if position is wall-free
                const testPlayer = { x: testX, y: testY };
                if (!checkCollision(testPlayer, roomId)) {
                    return { x: testX, y: testY };
                }
            }
        }
    }
    
    // Fallback to center if no wall-free position found
    return { x: 80, y: 56 };
}

// Initialize game state
function createInitialState() {
    return {
        currentLevel: 1, // Game 1 for demo
        players: [
            {
                id: 0,
                roomId: 17, // Yellow Castle exterior ($11 = 17 decimal)
                ...spawnNear(17, 80, 72), // Spawn near courtyard center
                color: 0xFF0000 // Red for player 0
            },
            {
                id: 1,
                roomId: 17, // Yellow Castle exterior
                ...spawnNear(17, 40, 72), // Spawn near left side
                color: 0x00FF00 // Green for player 1
            }
        ]
    };
}

export {
    resolveNeighbor,
    getRoom,
    resolveRoomGraph,
    createInitialState
};
