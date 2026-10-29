"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
async function run() {
    try {
        const platform = core.getInput('platform');
        const apiToken = core.getInput('api_token');
        const projectId = core.getInput('project_id');
        const buildCommand = core.getInput('build_command');
        const outputDirectory = core.getInput('output_directory');
        console.log(`Deploying to ${platform}...`);
        console.log(`Project: ${projectId}`);
        console.log(`Build command: ${buildCommand}`);
        console.log(`Output directory: ${outputDirectory}`);
        // Run build command
        if (buildCommand) {
            await exec.exec(buildCommand);
        }
        // Platform-specific deployment
        switch (platform) {
            case 'vercel':
                await deployToVercel(apiToken, projectId);
                break;
            case 'netlify':
                await deployToNetlify(apiToken, projectId);
                break;
            case 'cloudflare':
                await deployToCloudflare(apiToken, projectId);
                break;
            case 'railway':
                await deployToRailway(apiToken, projectId);
                break;
            case 'render':
                await deployToRender(apiToken, projectId);
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
        core.setOutput('deployment_url', `https://${projectId}.${platform}.dev`);
        console.log('Deployment successful!');
    }
    catch (error) {
        core.setFailed(error instanceof Error ? error.message : String(error));
    }
}
async function deployToVercel(token, projectId) {
    console.log('Deploying to Vercel...');
    await exec.exec('npx', ['vercel', '--token', token, '--yes', '--prod']);
}
async function deployToNetlify(token, projectId) {
    console.log('Deploying to Netlify...');
    await exec.exec('npx', ['netlify-cli', 'deploy', '--prod', '--auth', token]);
}
async function deployToCloudflare(token, projectId) {
    console.log('Deploying to Cloudflare Pages...');
    await exec.exec('npx', ['wrangler', 'pages', 'deploy', 'dist', '--project-name', projectId]);
}
async function deployToRailway(token, projectId) {
    console.log('Deploying to Railway...');
    await exec.exec('railway', ['up', '--service', projectId]);
}
async function deployToRender(token, projectId) {
    console.log('Deploying to Render...');
    await exec.exec('render', ['deploy', projectId]);
}
run();
