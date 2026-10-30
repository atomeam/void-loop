import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';

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
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

async function deployToVercel(token: string, projectId: string) {
  console.log('Deploying to Vercel...');
  await exec.exec('npx', ['vercel', '--token', token, '--yes', '--prod']);
}

async function deployToNetlify(token: string, projectId: string) {
  console.log('Deploying to Netlify...');
  await exec.exec('npx', ['netlify-cli', 'deploy', '--prod', '--auth', token]);
}

async function deployToCloudflare(token: string, projectId: string) {
  console.log('Deploying to Cloudflare Pages...');
  await exec.exec('npx', ['wrangler', 'pages', 'deploy', 'dist', '--project-name', projectId]);
}

async function deployToRailway(token: string, projectId: string) {
  console.log('Deploying to Railway...');
  await exec.exec('railway', ['up', '--service', projectId]);
}

async function deployToRender(token: string, projectId: string) {
  console.log('Deploying to Render...');
  await exec.exec('render', ['deploy', projectId]);
}

run();
