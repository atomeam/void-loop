#!/usr/bin/env node
// The free-agent clock. One short piece per call, then check and stitch. node tools/recruit.mjs --once
// Prints status names only. Never prints a key, a token, or a join code.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readySources, keepPatch } from '../void-live-deploy/lib/recruit.js';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ''; };

export async function ask(source, messages, env, fetchImpl = fetch) {
  const headers = { 'content-type': 'application/json' };
  let url = source.endpoint, body;
  if (source.id === 'pollinations') body = { messages, max_tokens: 120 };
  else {
    if (!env[source.key]) return { ok: false, status: 0, say: 'no key' };
    headers.authorization = 'Bearer ' + env[source.key];
    body = { model: source.model, messages, max_tokens: 4000 };
  }
  let r;
  try { r = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) }); }
  catch (e) { return { ok: false, status: 0, say: source.id + ' ' + ((e && e.name) || 'error') }; }
  const retry = Number(r.headers.get('retry-after')) || 0;
  if (r.status === 429 || r.status === 402) return { ok: false, status: r.status, limited: true, retryAfter: retry || (source.windowMs ? source.windowMs / 1000 : 0), say: source.id + ' ' + r.status };
  const raw = await r.text();
  if (!r.ok) return { ok: false, status: r.status, say: source.id + ' ' + r.status };
  let text = raw;
  try {
    const j = JSON.parse(raw);
    text = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || j.response || '');
  } catch (_) { text = raw; }
  if (!text.trim()) return { ok: false, status: r.status, say: source.id + ' empty', raw };
  return { ok: true, status: r.status, text, raw, say: source.id };
}

/** a test job is published only after its command exits 0. A page of model prose is never published. */
export async function once({ state = { sources: {} }, log = () => {} } = {}) {
  const source = readySources(process.env, state, Date.now())[0];
  log('source ' + (source ? source.id : 'none') + '; no test job, nothing written');
  return { state, html: '', replies: [], skipped: true, how: '' };
}

async function main() {
  if (!args.includes('--once')) { console.log('node tools/recruit.mjs --once'); return; }
  const statePath = flag('--state');
  let state = { sources: {} };
  if (statePath) { try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch (_) { state = { sources: {} }; } }
  const out = await once({ env: process.env, state, log: (line) => console.log(String(line).replace(/[A-Za-z0-9_\-]{24,}/g, '[masked]')) });
  const replies = flag('--replies');
  if (replies && out.replies) { mkdirSync(dirname(replies), { recursive: true }); writeFileSync(replies, JSON.stringify(out.replies, null, 2)); }
  if (statePath) writeFileSync(statePath, JSON.stringify(out.state));
  if (!keepPatch(out.job, out.html, out.testExit)) { console.log('nothing checked; nothing written'); return; }
  mkdirSync(dirname(out.job.file), { recursive: true });
  writeFileSync(out.job.file, out.html);
  console.log('wrote ' + out.job.file + ' via ' + out.how);
}

if (process.argv[1] && process.argv[1].endsWith('recruit.mjs')) main();
