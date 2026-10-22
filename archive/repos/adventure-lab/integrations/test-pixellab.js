import dotenv from 'dotenv';
import { PixelLabClient } from "@pixellab-code/pixellab";

dotenv.config();

console.log("Testing PixelLab API...");
console.log("API Key:", process.env.PIXELLAB_SECRET ? "Set" : "Not set");
console.log("Base URL:", process.env.PIXELLAB_BASE_URL);

const client = new PixelLabClient(process.env.PIXELLAB_SECRET);

async function testBalance() {
    try {
        console.log("Checking balance...");
        const balance = await client.getBalance();
        console.log("Balance:", balance);
    } catch (error) {
        console.error("Error checking balance:", error.message);
    }
}

testBalance();
