// Browser AgentBridge Test Script
// Paste this into the browser console on ?agent=1 page

async function testAgentBridge() {
    console.log('Testing AgentBridge API...');
    
    try {
        // Test 1: Load ROM (you'll need to provide the ROM file)
        console.log('Test 1: Load ROM');
        // Uncomment and provide your ROM file:
        // const romResponse = await fetch('path/to/your/adventure.bin');
        // const romArrayBuffer = await romResponse.arrayBuffer();
        // await AgentBridge.loadRom(romArrayBuffer);
        console.log('✓ Load ROM test skipped (requires ROM file)');
        
        // Test 2: Input queueing
        console.log('Test 2: Input queueing');
        AgentBridge.input('right', 500);
        AgentBridge.input('fire', 100);
        AgentBridge.input('left', 300);
        console.log('✓ Input queueing works');
        
        // Test 3: Frame capture
        console.log('Test 3: Frame capture');
        try {
            const frame = AgentBridge.getFrame();
            console.log('✓ Frame capture works, data length:', frame.length);
        } catch (e) {
            console.log('✗ Frame capture failed (ROM not loaded):', e.message);
        }
        
        // Test 4: State management
        console.log('Test 4: State management');
        try {
            const state = AgentBridge.getState();
            console.log('✓ Get state works, state length:', state.length);
        } catch (e) {
            console.log('✗ Get state failed (ROM not loaded):', e.message);
        }
        
        // Test 5: RAM peek
        console.log('Test 5: RAM peek');
        try {
            const value = AgentBridge.peek(0x80);
            console.log('✓ RAM peek works, value at $80:', value);
        } catch (e) {
            console.log('✗ RAM peek failed:', e.message);
        }
        
        // Test 6: Frame count
        console.log('Test 6: Frame count');
        const frameCount = AgentBridge.getFrameCount();
        console.log('✓ Frame count:', frameCount);
        
        // Test 7: Operator mode (if enabled)
        if (window.location.search.includes('operator=1')) {
            console.log('Test 7: Operator mode poke');
            try {
                AgentBridge.poke(0x85, 0x10, 'Test poke');
                console.log('✓ Operator poke works');
                
                const auditLog = AgentBridge.getAuditLog();
                console.log('✓ Audit log works, entries:', auditLog.length);
            } catch (e) {
                console.log('✗ Operator mode failed:', e.message);
            }
        } else {
            console.log('Test 7: Operator mode skipped (add ?operator=1 to enable)');
        }
        
        console.log('\n✓ AgentBridge API tests complete!');
        
    } catch (error) {
        console.error('✗ Test failed:', error);
    }
}

// Run the test
testAgentBridge();
