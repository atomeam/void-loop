// World module - room graph and game state management
const fs = require('fs');

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

// Initialize game state
function createInitialState() {
    return {
        currentLevel: 1, // Game 1 for demo
        players: [
            {
                id: 0,
                roomId: 17, // Yellow Castle exterior ($11 = 17 decimal)
                x: 160, // Center of room (320px width)
                y: 16, // Upper area (112px height) - row 1
                color: 0xFF0000 // Red for player 0
            },
            {
                id: 1,
                roomId: 17, // Yellow Castle exterior
                x: 160, // Center of room
                y: 48, // Lower area - row 3
                color: 0x00FF00 // Green for player 1
            }
        ]
    };
}

module.exports = {
    resolveNeighbor,
    getRoom,
    resolveRoomGraph,
    createInitialState
};
