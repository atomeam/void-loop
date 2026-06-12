#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCanvas } = require('canvas');
const { PNG } = require('pngjs');

// Import 6502.ts emulator core
const { VCS } = require('6502.ts');

const EXPECTED_SHA1 = 'ec23bbea83cf47277482e775ad58ac8e6d1483fe';

class AgentPlayCLI {
    constructor(options) {
        this.romPath = options.rom;
        this.scriptPath = options.script;
        this.outputDir = options.out;
        this.operatorMode = options.operator || false;
        this.frameInterval = options.frameInterval || 60;
        this.romData = null;
        this.emulator = null;
        this.currentFrame = 0;
        this.auditLog = [];
        this.manifest = {
            romSha1: null,
            totalFrames: 0,
            scriptHash: null,
            outputs: [],
            pokes: []
        };
    }

    async run() {
        console.log('Adventure Agent Play CLI');
        console.log('========================');

        // Create output directory
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Load and verify ROM
        await this.loadROM();

        // Load input script
        const script = this.loadScript();

        // Initialize emulator
        this.initializeEmulator();

        // Run the script
        await this.runScript(script);

        // Generate outputs
        this.generateOutputs();

        console.log('\n✓ Run complete!');
        console.log(`Output directory: ${this.outputDir}`);
        console.log(`Total frames: ${this.manifest.totalFrames}`);
        console.log(`Audit log entries: ${this.auditLog.length}`);
    }

    async loadROM() {
        console.log(`Loading ROM: ${this.romPath}`);
        
        if (!fs.existsSync(this.romPath)) {
            throw new Error(`ROM file not found: ${this.romPath}`);
        }

        this.romData = fs.readFileSync(this.romPath);
        
        // Compute SHA-1
        const hash = crypto.createHash('sha1');
        hash.update(this.romData);
        const sha1 = hash.digest('hex');
        
        console.log(`ROM SHA-1: ${sha1}`);
        
        if (sha1.toLowerCase() !== EXPECTED_SHA1.toLowerCase()) {
            throw new Error(`ROM SHA-1 mismatch: ${sha1} (expected: ${EXPECTED_SHA1})`);
        }

        console.log('✓ ROM verified');
        this.manifest.romSha1 = sha1;
    }

    loadScript() {
        console.log(`Loading script: ${this.scriptPath}`);
        
        if (!fs.existsSync(this.scriptPath)) {
            throw new Error(`Script file not found: ${this.scriptPath}`);
        }

        const scriptContent = fs.readFileSync(this.scriptPath, 'utf8');
        const script = JSON.parse(scriptContent);
        
        // Compute script hash
        const hash = crypto.createHash('sha256');
        hash.update(scriptContent);
        this.manifest.scriptHash = hash.digest('hex');
        
        console.log(`✓ Script loaded with ${script.length} actions`);
        return script;
    }

    initializeEmulator() {
        console.log('Initializing emulator...');
        
        // Create VCS emulator instance
        this.emulator = new VCS();
        
        // Configure for PAL mode
        this.emulator.setTVMode('PAL');
        
        // Load ROM
        this.emulator.loadCartridge(this.romData);
        
        // Power on
        this.emulator.powerOn();
        
        console.log('✓ Emulator ready');
    }

    async runScript(script) {
        console.log('Running script...');
        
        let scriptIndex = 0;
        const canvas = createCanvas(160, 192); // Atari 2600 resolution
        const ctx = canvas.getContext('2d');
        
        // Process each action in the script
        for (const action of script) {
            // Run frames until we reach the target frame
            while (this.currentFrame < action.frame) {
                this.emulator.stepFrame();
                this.currentFrame++;
                
                // Capture frame at intervals
                if (this.currentFrame % this.frameInterval === 0) {
                    this.captureFrame(ctx, canvas, this.currentFrame);
                }
            }
            
            // Execute the action
            this.executeAction(action);
            
            scriptIndex++;
            if (scriptIndex % 100 === 0) {
                console.log(`  Progress: ${scriptIndex}/${script.length} actions (${this.currentFrame} frames)`);
            }
        }
        
        // Run remaining frames to complete any ongoing actions
        const maxFrame = script[script.length - 1]?.frame + 60 || 60;
        while (this.currentFrame < maxFrame) {
            this.emulator.stepFrame();
            this.currentFrame++;
            
            if (this.currentFrame % this.frameInterval === 0) {
                this.captureFrame(ctx, canvas, this.currentFrame);
            }
        }
        
        this.manifest.totalFrames = this.currentFrame;
        console.log(`✓ Script complete: ${this.currentFrame} frames`);
    }

    executeAction(action) {
        const { action: type, frames, addr, value, reason } = action;
        
        switch (type) {
            case 'up':
            case 'down':
            case 'left':
            case 'right':
                this.emulator.setJoystickDirection(0, type);
                setTimeout(() => this.emulator.setJoystickDirection(0, 'center'), frames * 16.67);
                break;
                
            case 'fire':
                this.emulator.setJoystickButton(0, true);
                setTimeout(() => this.emulator.setJoystickButton(0, false), frames * 16.67);
                break;
                
            case 'reset':
                this.emulator.reset();
                break;
                
            case 'select':
                this.emulator.setConsoleSwitch('SELECT', true);
                setTimeout(() => this.emulator.setConsoleSwitch('SELECT', false), 100);
                break;
                
            case 'poke':
                if (!this.operatorMode) {
                    throw new Error('Poke actions require --operator flag');
                }
                this.poke(addr, value, reason);
                break;
                
            default:
                console.warn(`Unknown action: ${type}`);
        }
    }

    poke(addr, value, reason) {
        if (addr < 0x80 || addr > 0xFF) {
            throw new Error(`Invalid RAM address: ${addr.toString(16)} (must be $80–$FF)`);
        }

        if (value < 0 || value > 255) {
            throw new Error(`Invalid value: ${value} (must be 0–255)`);
        }

        const before = this.peek(addr);
        
        // Write to RAM
        this.emulator.writeRAM(addr, value);
        
        // Log the operation
        const logEntry = {
            frame: this.currentFrame,
            addr: addr,
            before: before,
            after: value,
            reason: reason || 'unspecified'
        };
        
        this.auditLog.push(logEntry);
        this.manifest.pokes.push(logEntry);
        
        console.log(`  [POKE] $${addr.toString(16).padStart(2, '0')}: $${before.toString(16).padStart(2, '0')} → $${value.toString(16).padStart(2, '0')} (${reason || 'unspecified'})`);
    }

    peek(addr) {
        if (addr < 0x80 || addr > 0xFF) {
            throw new Error(`Invalid RAM address: ${addr.toString(16)} (must be $80–$FF)`);
        }
        return this.emulator.readRAM(addr);
    }

    captureFrame(ctx, canvas, frameNumber) {
        // Get frame buffer from emulator
        const frameBuffer = this.emulator.getFrameBuffer();
        
        // Create image data
        const imageData = ctx.createImageData(160, 192);
        
        // Convert emulator frame buffer to canvas format
        for (let i = 0; i < frameBuffer.length; i++) {
            const pixel = frameBuffer[i];
            const idx = i * 4;
            imageData.data[idx] = pixel.r;     // R
            imageData.data[idx + 1] = pixel.g; // G
            imageData.data[idx + 2] = pixel.b; // B
            imageData.data[idx + 3] = 255;     // A
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Save as PNG
        const filename = `frame_${frameNumber.toString().padStart(6, '0')}.png`;
        const filepath = path.join(this.outputDir, filename);
        
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(filepath, buffer);
        
        this.manifest.outputs.push(filename);
    }

    generateOutputs() {
        console.log('Generating outputs...');
        
        // Save manifest
        const manifestPath = path.join(this.outputDir, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2));
        
        // Save RAM dump
        const ramDump = this.dumpRAM();
        const ramPath = path.join(this.outputDir, 'ram_dump.json');
        fs.writeFileSync(ramPath, JSON.stringify(ramDump, null, 2));
        
        // Save audit log if operator mode
        if (this.operatorMode && this.auditLog.length > 0) {
            const auditPath = path.join(this.outputDir, 'audit_log.json');
            fs.writeFileSync(auditPath, JSON.stringify(this.auditLog, null, 2));
        }
        
        console.log('✓ Outputs generated');
    }

    dumpRAM() {
        const ram = {};
        for (let addr = 0x80; addr <= 0xFF; addr++) {
            ram[addr.toString(16).padStart(2, '0')] = this.peek(addr);
        }
        return ram;
    }
}

// CLI interface
function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node agent-play.js --rom <path> --script <path> --out <dir> [--operator] [--frame-interval <n>]');
        console.log('');
        console.log('Options:');
        console.log('  --rom <path>           Path to Adventure ROM file');
        console.log('  --script <path>        Path to input script JSON');
        console.log('  --out <dir>            Output directory for frames and manifest');
        console.log('  --operator             Enable operator mode (allow poke actions)');
        console.log('  --frame-interval <n>   Capture every Nth frame (default: 60)');
        process.exit(1);
    }
    
    const options = {
        rom: null,
        script: null,
        out: null,
        operator: false,
        frameInterval: 60
    };
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--rom':
                options.rom = args[++i];
                break;
            case '--script':
                options.script = args[++i];
                break;
            case '--out':
                options.out = args[++i];
                break;
            case '--operator':
                options.operator = true;
                break;
            case '--frame-interval':
                options.frameInterval = parseInt(args[++i]);
                break;
            default:
                console.error(`Unknown option: ${args[i]}`);
                process.exit(1);
        }
    }
    
    if (!options.rom || !options.script || !options.out) {
        console.error('Missing required options: --rom, --script, --out');
        process.exit(1);
    }
    
    const cli = new AgentPlayCLI(options);
    cli.run().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

if (require.main === module) {
    main();
}

module.exports = AgentPlayCLI;
