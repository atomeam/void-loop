#!/usr/bin/env node
// The "is it real and useful?" check. A phone-width visit, then a free model. No person approves it. A missing model is a no.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');
const dir = mkdtempSync(join(tmpdir(), 'versus-'));
const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(300);
const chrome = async (url, shot) => {
  const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=390,844', '--virtual-time-budget=6000', '--dump-dom', url];
  const dom = spawn('/usr/bin/google-chrome', args, { stdio: ['ignore', 'pipe', 'ignore'] });
  let html = ''; dom.stdout.on('data', (d) => { html += d; });
  const code = await new Promise((r) => dom.on('exit', r));
  if (shot) spawn('/usr/bin/google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=390,844', '--virtual-time-budget=6000', '--screenshot=' + shot, url], { stdio: 'ignore' });
  return { code, text: html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 900) };
};
const pages = [
  ['readable', 'http://127.0.0.1:8765/our-motherfucking-version/', join(dir, 'read.png')],
  ['rotate', 'http://127.0.0.1:8765/rotate-letters/?text=Ab!&shift=1', join(dir, 'rot.png')],
  ['tracks', 'http://127.0.0.1:8765/track-times/', join(dir, 'tr.png')],
];
const seen = [];
for (const [name, url, shot] of pages) { const r = await chrome(url, shot); seen.push(name + ' exit ' + r.code + ': ' + r.text); }
server.kill();
const record = seen.join('\n');
const ask = 'A normal person opens these Verse pages on a phone to get a job done. Do they get it done? Is the page honest? Would they come back? If not, what got in the way? Quote words you can see in the visit. Start with YES or NO.\n\n' + record;
let answer = '';
try {
  const r = await fetch('https://a-to-mind.com/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask }), signal: AbortSignal.timeout(40000) });
  const j = await r.json(); answer = String(j.answer || j.error || '');
} catch (e) { answer = ''; }
const yes = /^yes\b/i.test(answer) && answer.length > 40 && /rotate|track|mother|letter|page/i.test(answer);
console.log(record.slice(0, 500));
console.log('--- model ---');
console.log(answer.slice(0, 700) || 'no model answer');
console.log('shots', dir);
if (!yes) { console.error('useful check: no'); process.exit(1); }
console.log('useful check: yes');
