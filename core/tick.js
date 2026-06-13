// Tick module - fixed-timestep tick loop with async input queue
import { resolveRoomGraph } from './world.js';
import { updatePosition } from './collision.js';

// Input queue for async action collection
let inputQueue = [];
let currentTick = 0;

// Add input to queue (async interface)
function queueInput(playerId, action) {
    inputQueue.push({ playerId, action, tick: currentTick });
}

// Process all queued inputs for a tick
function processInputs(state) {
    const inputsThisTick = inputQueue.filter(i => i.tick === currentTick);
    inputQueue = inputQueue.filter(i => i.tick > currentTick);
    
    // Group inputs by player
    const inputsByPlayer = new Map();
    inputsThisTick.forEach(input => {
        if (!inputsByPlayer.has(input.playerId)) {
            inputsByPlayer.set(input.playerId, []);
        }
        inputsByPlayer.get(input.playerId).push(input.action);
    });
    
    return inputsByPlayer;
}

// Apply input to player state with collision detection
function applyInput(state, playerId, action) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    
    const moveSpeed = 1; // 1px per tick per axis
    let newX = player.x;
    let newY = player.y;
    
    switch (action) {
        case 'up':
            newY = Math.max(0, player.y - moveSpeed);
            break;
        case 'down':
            newY = Math.min(111, player.y + moveSpeed);
            break;
        case 'left':
            newX = Math.max(0, player.x - moveSpeed);
            break;
        case 'right':
            newX = Math.min(159, player.x + moveSpeed);
            break;
    }
    
    // Apply with collision detection
    updatePosition(state, playerId, newX, newY);
}

// Single tick of game logic
function tick(state) {
    const inputsByPlayer = processInputs(state);
    
    // Apply inputs for each player
    inputsByPlayer.forEach((actions, playerId) => {
        // Use the last action for this tick (simplified)
        const lastAction = actions[actions.length - 1];
        if (lastAction) {
            applyInput(state, playerId, lastAction);
        }
    });
    
    currentTick++;
    
    return state;
}

// Reset tick counter (for replay)
function resetTick() {
    currentTick = 0;
    inputQueue = [];
}

// Get current tick number
function getCurrentTick() {
    return currentTick;
}

export {
    queueInput,
    tick,
    resetTick,
    getCurrentTick
};
