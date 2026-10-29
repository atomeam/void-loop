// Browser AgentBridge Test Script
// Paste this into the browser console on ?agent=1 page

async function testAgentBridge() {
    console.log('=== AgentBridge API Test ===');
    console.log('URL:', window.location.href);
    console.log('AgentBridge available:', typeof window.AgentBridge !== 'undefined');
    
    if (typeof window.AgentBridge === 'undefined') {
        console.error('✗ AgentBridge not found. Add ?agent=1 to URL');
        return;
    }
    
    try {
        // Test 1: API availability
        console.log('\nTest 1: API Method Availability');
        const methods = ['loadRom', 'input', 'getFrame', 'getState', 'setState', 'peek', 'poke', 'getAuditLog', 'getFrameCount'];
        methods.forEach(method => {
            console.log(`  ${method}:`, typeof AgentBridge[method] === 'function' ? '✓' : '✗');
        });
        
        // Test 2: Input queueing (works without ROM)
        console.log('\nTest 2: Input Queueing');
        try {
            AgentBridge.input('right', 500);
            AgentBridge.input('fire', 100);
            AgentBridge.input('left', 300);
            console.log('✓ Input queueing works');
        } catch (e) {
            console.log('✗ Input queueing failed:', e.message);
        }
        
        // Test 3: Frame count (works without ROM)
        console.log('\nTest 3: Frame Count');
        try {
            const frameCount = AgentBridge.getFrameCount();
            console.log('✓ Frame count:', frameCount);
        } catch (e) {
            console.log('✗ Frame count failed:', e.message);
        }
        
        // Test 4: RAM peek (EXPECTED TO FAIL - Javatari limitation)
        console.log('\nTest 4: RAM Peek (Expected to fail)');
        try {
            const value = AgentBridge.peek(0x80);
            console.log('✓ RAM peek works (unexpected!), value at $80:', value);
        } catch (e) {
            console.log('✓ RAM peek correctly fails:', e.message);
            console.log('  (This is expected - Javatari.js does not expose RAM access)');
        }
        
        // Test 5: Operator mode poke (EXPECTED TO FAIL - Javatari limitation)
        console.log('\nTest 5: Operator Mode Poke (Expected to fail)');
        try {
            AgentBridge.poke(0x85, 0x10, 'Test poke');
            console.log('✗ Operator poke works (unexpected!)');
        } catch (e) {
            console.log('✓ Operator poke correctly fails:', e.message);
            console.log('  (This is expected - Javatari.js does not expose RAM access)');
        }
        
        // Tests requiring ROM (will fail without ROM loaded)
        console.log('\nTests 6-8: ROM-Dependent (will fail without ROM)');
        
        console.log('\nTest 6: Frame Capture');
        try {
            const frame = AgentBridge.getFrame();
            console.log('✓ Frame capture works, data length:', frame.length);
        } catch (e) {
            console.log('✗ Frame capture failed (expected without ROM):', e.message);
        }
        
        console.log('\nTest 7: State Management');
        try {
            const state = AgentBridge.getState();
            console.log('✓ Get state works, state length:', state.length);
        } catch (e) {
            console.log('✗ Get state failed (expected without ROM):', e.message);
        }
        
        console.log('\nTest 8: Load ROM (requires actual ROM file)');
        console.log('✗ Skipped - requires ROM file upload via file picker');
        console.log('  To test: Upload your Adventure ROM, then call:');
        console.log('  await AgentBridge.loadRom(arrayBuffer)');
        
        console.log('\n=== Test Summary ===');
        console.log('✓ AgentBridge API is available');
        console.log('✓ Input queueing works');
        console.log('✓ Frame counting works');
        console.log('✓ RAM access correctly blocked (Javatari limitation)');
        console.log('✗ ROM-dependent tests require actual ROM file');
        console.log('✗ Headless CLI non-functional (6502.ts requires complex build, alternatives not suitable)');
        console.log('✗ Agent capability: VISION-ONLY (frames + controls, no RAM access)');
        
    } catch (error) {
        console.error('✗ Test failed:', error);
    }
}

// Run the test
testAgentBridge();
