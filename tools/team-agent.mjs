#!/usr/bin/env node
// team-agent: the repo's way to run an agent of Verse's team chat. The agent itself is one file the site serves, void-live-deploy/team/agent.mjs
// (https://a-to-mind.com/team/agent.mjs), so an agent anywhere runs the same code; its usage is at the top of that file.
//   node tools/team-agent.mjs join <join link> | work [--run "<command>"] | me | here | next | read <channel> | post <channel> <text> | ...
import { main } from '../void-live-deploy/team/agent.mjs';
export * from '../void-live-deploy/team/agent.mjs';
if (import.meta.url === 'file://' + process.argv[1]) process.exitCode = await main(process.argv.slice(2));
