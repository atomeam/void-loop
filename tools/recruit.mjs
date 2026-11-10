#!/usr/bin/env node
// The free-agent clock. Wakes a source whose limit has reset, asks it for the visitor board, and parks it on a 429.
//   node tools/recruit.mjs --once [--state <file>] [--out <file>]
// Prints status names and counts. Never prints a key, a token, or a join code.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readySources, note, renderPage, pageOk, htmlFrom, jobCard, boardCurrent } from '../void-live-deploy/lib/recruit.js';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ''; };

export async function ask(source, messages, env, fetchImpl = fetch) {
  const headers = { 'content-type': 'application/json' };
  let url = source.endpoint, body;
  if (source.id === 'pollinations') body = { messages, max_tokens: 4000 };
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
  if (!text.trim()) return { ok: false, status: r.status, say: source.id + ' empty' };
  return { ok: true, status: r.status, text, say: source.id };
}

export async function once({ env = process.env, state = { sources: {} }, now = Date.now(), fetchImpl = fetch, existing = '', log = () => {} } = {}) {
  const job = jobCard();
  if (boardCurrent(existing)) return { state, html: existing, how: 'current', job, skipped: true };
  const order = readySources(env, state, now);
  log('job ' + job.id + ' ready ' + (order.map((s) => s.id).join(', ') || 'none'));
  let cur = state, used = null, reply = null;
  for (const source of order.slice(0, 2)) {
    const out = await ask(source, [
      { role: 'system', content: 'Return one complete HTML document and nothing else. No script tags. No keys.' },
      { role: 'user', content: job.ask + '\n\nUse this page. You may rephrase a sentence. Keep every data-id, every name, and the words Start a job, backup, and Paste this invite:\n' + renderPage({}, now) },
    ], env, fetchImpl);
    log(out.say);
    if (out.limited) { cur = note(cur, source.id, now, { limited: true, retryAfter: out.retryAfter }); continue; }
    used = source;
    reply = out;
    break;
  }
  const fromModel = reply && reply.ok ? htmlFrom(reply.text) : '';
  const good = pageOk(fromModel);
  if (used) cur = note(cur, used.id, now, { shipped: good });
  else log('no source answered; the renderer wrote the board');
  return { state: cur, html: good ? fromModel : renderPage({}, now), how: good ? used.id : 'renderer', job };
}

async function main() {
  if (!args.includes('--once')) { console.log('node tools/recruit.mjs --once'); return; }
  const statePath = flag('--state');
  let state = { sources: {} };
  if (statePath) { try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch (_) { state = { sources: {} }; } }
  const file = flag('--out') || jobCard().path;
  let existing = '';
  try { existing = readFileSync(file, 'utf8'); } catch (_) { existing = ''; }
  const out = await once({ env: process.env, state, existing, log: (line) => console.log(String(line).replace(/[A-Za-z0-9_\-]{24,}/g, '[masked]')) });
  if (out.skipped) { console.log('board current'); return; }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, out.html);
  if (statePath) writeFileSync(statePath, JSON.stringify(out.state));
  const row = out.state.sources[out.how] || {};
  console.log('wrote ' + file + ' via ' + out.how + (row.tried ? ' tried ' + row.tried + ' shipped ' + row.shipped : ''));
}

if (process.argv[1] && process.argv[1].endsWith('recruit.mjs')) main();
