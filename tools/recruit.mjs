#!/usr/bin/env node
// The free-agent clock. One short piece per call, then check and stitch. node tools/recruit.mjs --once
// Prints status names only. Never prints a key, a token, or a join code.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readySources, note, chunkOk, chunkText, stitchJob, workJob } from '../void-live-deploy/lib/recruit.js';

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

const wait = (ms, sleep) => (ms > 0 ? sleep(ms) : Promise.resolve());

/** one short call per section. A piece that fails the check is asked once more, then the job stops. No substitute sentence is written. */
export async function fill(source, job, env, fetchImpl, { sleep = (ms) => new Promise((r) => setTimeout(r, ms)), gapMs = 31000, log = () => {}, now = Date.now() } = {}) {
  const replies = [], parts = [];
  let last = 0;
  for (const part of job.parts) {
    let text = '', ok = false, prompt = part.prompt;
    for (let tryN = 0; tryN < 2 && !ok; tryN++) {
      await wait(last ? gapMs - (Date.now() - last) : 0, sleep);
      const out = await ask(source, [{ role: 'user', content: prompt }], env, fetchImpl);
      last = Date.now();
      replies.push({ id: part.id, try: tryN, status: out.status, say: out.say, raw: out.raw || out.text || '' });
      log(out.say);
      if (out.limited) return { ok: false, limited: true, retryAfter: out.retryAfter, replies, parts };
      text = chunkText(out.text);
      ok = chunkOk(text, part);
      prompt = part.again;
    }
    if (!ok) return { ok: false, replies, parts };
    parts.push({ id: part.id, text });
  }
  return { ok: true, replies, parts, html: stitchJob(job, parts), at: now };
}

export async function once({ env = process.env, state = { sources: {} }, now = Date.now(), fetchImpl = fetch, sleep, log = () => {} } = {}) {
  const job = workJob();
  const source = readySources(env, state, now)[0];
  log('job ' + job.id + ' source ' + (source ? source.id : 'none'));
  if (!source) return { state, job, skipped: true };
  const done = await fill(source, job, env, fetchImpl, { sleep, log, now });
  const cur = note(state, source.id, now, { shipped: !!done.ok, limited: !!done.limited, retryAfter: done.retryAfter });
  if (!done.ok) log('stopped: a piece failed the check');
  return { state: cur, job, html: done.html || '', replies: done.replies || [], how: done.ok ? source.id : '', skipped: !done.ok };
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
  if (!out.html) { console.log('no page written'); return; }
  mkdirSync(dirname(out.job.path), { recursive: true });
  writeFileSync(out.job.path, out.html);
  console.log('wrote ' + out.job.path + ' via ' + out.how);
}

if (process.argv[1] && process.argv[1].endsWith('recruit.mjs')) main();
