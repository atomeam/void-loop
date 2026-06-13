import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const API_BASE = 'https://api.pixellab.ai/v1';
const API_TOKEN = process.env.PIXELLAB_SECRET;

const NEGATIVE = "background, anti-aliasing, gradient, blur, text, border, shading, detailed texture, realistic, 3D";

const prompts = [
    {
        id: 1,
        name: "The Square That Knows",
        description: "a sentient bright yellow square creature with two tiny worried white eyes and stubby feet, simple flat retro game sprite, side view, hard 4-color palette, bold 1-pixel black outline, no shading, single subject, clear silhouette"
    },
    {
        id: 2,
        name: "Sir Cube-a-Lot",
        description: "a tiny knight in absurdly cubic boxy armor, square helmet with droopy plume, holding a comically oversized straight sword, flat retro game sprite, side view, hard 6-color palette, bold 1-pixel black outline, no shading, single subject, clear silhouette"
    },
    {
        id: 3,
        name: "The Intern",
        description: "a tiny office worker in a short-sleeve shirt and crooked tie holding a coffee mug like a sword, determined expression, flat retro game sprite, side view, hard 5-color palette, bold 1-pixel black outline, no shading, single subject, clear silhouette"
    }
];

async function generateCalibrationImage(prompt) {
    console.log(`\nGenerating #${prompt.id}: ${prompt.name}`);
    console.log(`Description: ${prompt.description}`);
    
    try {
        const response = await fetch(`${API_BASE}/generate-image-pixflux`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: prompt.description,
                negative_description: NEGATIVE,
                image_size: { width: 64, height: 64 },
                no_background: true,
                outline: "single color black outline",
                shading: "flat shading"
            })
        });
        
        console.log(`Response status: ${response.status} ${response.statusText}`);
        
        const data = await response.json();
        
        console.log('Response data keys:', Object.keys(data));
        console.log('Image field type:', typeof data.image);
        
        if (!response.ok) {
            console.error('API Error Response:', JSON.stringify(data, null, 2));
            throw new Error(data.error || data.message || JSON.stringify(data) || 'API request failed');
        }
        
        // Save base64 image
        let base64Data;
        if (typeof data.image === 'string') {
            base64Data = data.image.replace(/^data:image\/png;base64,/, '');
        } else if (data.image && data.image.base64) {
            base64Data = data.image.base64;
        } else if (data.image && data.image.data) {
            base64Data = data.image.data;
        } else {
            console.error('Unexpected image data structure:', JSON.stringify(data, null, 2));
            throw new Error('Unexpected image data structure');
        }
        
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `output/calibration-${prompt.id}-${prompt.name.toLowerCase().replace(/ /g, '-')}.png`;
        fs.writeFileSync(filename, buffer);
        
        console.log(`✓ Saved to ${filename}`);
        console.log(`  Usage: ${JSON.stringify(data.usage || 'N/A')}`);
        
        return {
            id: prompt.id,
            name: prompt.name,
            filename,
            success: true,
            error: null,
            usage: data.usage
        };
    } catch (error) {
        console.error(`✗ Error: ${error.message}`);
        return {
            id: prompt.id,
            name: prompt.name,
            filename: null,
            success: false,
            error: error.message,
            usage: null
        };
    }
}

async function main() {
    console.log("=== CALIBRATION PROMPT LEDGER ===");
    console.log("Canvas: 64×64, Transparent: ON");
    console.log(`Negative: ${NEGATIVE}\n`);
    
    const results = [];
    
    for (const prompt of prompts) {
        const result = await generateCalibrationImage(prompt);
        results.push(result);
    }
    
    console.log("\n=== LEDGER ===");
    for (const result of results) {
        console.log(`\nGen #${result.id}: ${result.name}`);
        console.log(`Prompt: ${prompts.find(p => p.id === result.id).description}`);
        console.log(`Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`File: ${result.filename || 'N/A'}`);
        if (result.usage) console.log(`Usage: ${JSON.stringify(result.usage)}`);
        if (result.error) console.log(`Error: ${result.error}`);
    }
    
    // Write ledger to file
    const ledger = {
        timestamp: new Date().toISOString(),
        canvas: "64×64",
        transparent: true,
        negative: NEGATIVE,
        results
    };
    
    fs.writeFileSync('output/calibration-ledger.json', JSON.stringify(ledger, null, 2));
    console.log("\n✓ Ledger saved to output/calibration-ledger.json");
}

main();
