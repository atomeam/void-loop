// Free-agent clock. Limits: docs/agents-scouted.md (2026-11-10). A 429 parks until the reset. Three misses drop a source.
export const BOARD = 'void-live-deploy/team/recruit.html';
export const DROP_AFTER = 3;
const DAY = 864e5;

const day = (id, name, rank, key, cap, limit, url, model, endpoint, extra = {}) => ({ id, name, kind: 'self', rank, key, cap, window: extra.window || 'day', zone: extra.zone || 'UTC', runs: extra.runs !== false, limit, reset: extra.reset || 'the next UTC day', url, model, endpoint, windowMs: extra.windowMs });
export const SOURCES = Object.freeze([
  day('groq', 'Groq', 1, 'GROQ_API_KEY', 1000, '30 requests a minute, 1,000 a day, about 8,000 tokens a minute on the free plan', 'https://console.groq.com/docs/rate-limits', 'llama-3.3-70b-versatile', 'https://api.groq.com/openai/v1/chat/completions'),
  day('gemini', 'Google AI Studio', 2, 'GEMINI_API_KEY', null, 'per model, shown in AI Studio; the daily cap resets at midnight Pacific', 'https://ai.google.dev/gemini-api/docs/rate-limits', 'gemini-2.5-flash', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', { zone: 'America/Los_Angeles', reset: 'midnight Pacific' }),
  day('cerebras', 'Cerebras', 3, 'CEREBRAS_API_KEY', null, 'trial tier; public pages disagree on the exact request cap, so a 429 is the limit', 'https://inference-docs.cerebras.ai/support/rate-limits', 'llama-3.3-70b', 'https://api.cerebras.ai/v1/chat/completions', { reset: 'the next UTC day, or the Retry-After' }),
  day('openrouter', 'OpenRouter free models', 4, 'OPENROUTER_API_KEY', 50, '20 requests a minute; 50 a day until the account has bought credits, then 1,000', 'https://openrouter.ai/blog/tutorials/free-llm-apis-compared/', 'qwen/qwen3-coder:free', 'https://openrouter.ai/api/v1/chat/completions'),
  day('mistral', 'Mistral', 5, 'MISTRAL_API_KEY', null, '1 request a second, 500,000 tokens a minute, 1 billion tokens a month on the free tier', 'https://docs.mistral.ai/', 'mistral-small-latest', 'https://api.mistral.ai/v1/chat/completions', { window: 'month', reset: 'the first UTC day of the month' }),
  day('workers', 'Cloudflare Workers AI', 6, 'CLOUDFLARE_API_TOKEN', null, '10,000 neurons a day on the Workers free allocation', 'https://developers.cloudflare.com/workers-ai/platform/pricing/', null, null, { runs: false }),
  day('pollinations', 'Pollinations classic text', 8, null, 1, 'one text request at a time, at least 30 seconds apart, per address; 402 then Retry-After', 'https://github.com/pollinations/pollinations/blob/master/APIDOCS.md', 'gpt-oss-20b', 'https://text.pollinations.ai/openai', { window: 'rolling', windowMs: 30000, reset: '30 seconds, or the Retry-After' }),
  day('aider', 'Aider', 9, null, null, 'MIT and free; the cap is the model it calls', 'https://github.com/Aider-AI/aider', null, null, { runs: false, reset: 'the model\'s window' }),
  day('openhands', 'OpenHands headless', 9, null, null, 'MIT and free to run; bring a model', 'https://github.com/All-Hands-AI/OpenHands', null, null, { runs: false, reset: 'the model\'s window' }),
  day('swe-agent', 'SWE-agent', 10, null, null, 'MIT and free to run', 'https://github.com/SWE-agent/SWE-agent', null, null, { runs: false, reset: 'the model\'s window' }),
  day('goose', 'Goose', 10, null, null, 'Apache-2.0 and free to run', 'https://github.com/block/goose', null, null, { runs: false, reset: 'the model\'s window' }),
  day('opencode', 'OpenCode', 10, null, null, 'source-available client; the cap is the model', 'https://github.com/sst/opencode', null, null, { runs: false, reset: 'the model\'s window' }),
  day('cline', 'Cline headless', 10, null, null, 'Apache-2.0 and free to run', 'https://github.com/cline/cline', null, null, { runs: false, reset: 'the model\'s window' }),
  day('actions', 'GitHub Actions', 11, null, null, 'standard runners are free on a public repository', 'https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions', null, null, { runs: false, window: 'month', reset: 'not a model cap' }),
  { id: 'jules', name: 'Jules', kind: 'signup', rank: 6, limit: '15 tasks a day, 3 at once, on the free plan', reset: 'daily', url: 'https://jules.google/' },
  { id: 'openhands-cloud', name: 'OpenHands Cloud', kind: 'join', rank: 7, limit: 'the Individual plan is free; a 2026-09-21 reading of the pricing page said 10 conversations a day', reset: 'daily', url: 'https://www.openhands.dev/pricing' },
  { id: 'longcat', name: 'LongCat 2.5', kind: 'join', rank: 12, limit: 'no public free-tier number found on 2026-11-10', reset: 'the host\'s own window', url: 'https://a-to-mind.com/team/agents.txt' },
  { id: 'devin', name: 'Devin', kind: 'signup', rank: 13, limit: 'a free plan with a light agent quota, unlimited tab completions', reset: 'the plan\'s window', url: 'https://devin.ai/pricing' },
  { id: 'replit', name: 'Replit Agent', kind: 'signup', rank: 14, limit: 'the Starter plan is free, with a daily agent allowance and limited monthly credits', reset: 'daily, and the monthly credit window', url: 'https://docs.replit.com/help/pricing-and-plans' },
  { id: 'bolt', name: 'Bolt', kind: 'signup', rank: 15, limit: 'a free token allowance; confirm the current number on the pricing page before relying on it', reset: 'the plan\'s window', url: 'https://bolt.new/' },
  { id: 'huggingface', name: 'Hugging Face Inference', kind: 'signup', rank: 16, limit: 'a free account has no general inference allowance; Pro adds a small monthly credit', reset: 'monthly on Pro', url: 'https://huggingface.co/docs/inference-providers/pricing' },
  { id: 'copilot', name: 'GitHub Copilot coding agent', kind: 'signup', rank: 20, limit: 'Free includes 2,000 completions a month. Assigning work that opens a pull request is not on the free plan', reset: 'monthly', url: 'https://github.com/features/copilot/plans' },
  { id: 'github-models', name: 'GitHub Models', kind: 'retired', rank: 99, limit: 'retired on 2026-07-30; the old URL answers 200 OK and runs no model', reset: 'none', url: 'https://docs.github.com/en/github-models' },
]);

export const blank = () => ({ used: 0, resetAt: 0, parkedUntil: 0, tried: 0, shipped: 0, dropped: false });
export const sourceBy = (id) => SOURCES.find((s) => s.id === id) || null;

export function offsetMs(now, zone) {
  if (!zone || zone === 'UTC') return 0;
  const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(now).find((p) => p.type === 'timeZoneName');
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(part ? part.value : '');
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * ((Number(m[2]) * 60) + Number(m[3] || 0)) * 60000;
}

export function nextReset(source, now) {
  const s = source || {};
  if (s.window === 'rolling') return now + (s.windowMs || 30000);
  if (s.window === 'month') { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
  const off = offsetMs(now, s.zone || 'UTC');
  const local = now + off;
  return (Math.floor(local / DAY) * DAY + DAY) - off;
}

export function wake(source, row, now) {
  const r = { ...blank(), ...(row || {}) };
  if (r.resetAt && now >= r.resetAt) { r.used = 0; r.resetAt = 0; if (!r.parkedUntil || r.parkedUntil <= now) r.parkedUntil = 0; }
  if (r.parkedUntil && now >= r.parkedUntil) r.parkedUntil = 0;
  return r;
}

export function readySources(env, state, now) {
  const out = [];
  for (const s of SOURCES) {
    if (s.kind !== 'self' || s.runs === false) continue;
    const row = wake(s, state && state.sources && state.sources[s.id], now);
    if (row.dropped || row.parkedUntil > now) continue;
    if (s.cap && row.used >= s.cap) continue;
    if (s.key && !(env && env[s.key])) continue;
    out.push(s);
  }
  return out.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
}

export function note(state, id, now, result = {}) {
  const s = sourceBy(id) || { window: 'day', zone: 'UTC' };
  const prev = (state && state.sources) || {};
  const row = wake(s, prev[id], now);
  if (!result.limited) row.tried += 1;
  if (result.shipped) { row.shipped += 1; row.dropped = false; }
  if (!result.limited) row.used += 1;
  if (!row.resetAt) row.resetAt = nextReset(s, now);
  if (result.limited) row.parkedUntil = result.retryAfter > 0 ? now + result.retryAfter * 1000 : row.resetAt;
  else if (s.cap && row.used >= s.cap) row.parkedUntil = row.resetAt;
  if (!result.limited && !result.shipped && row.tried >= DROP_AFTER && row.shipped === 0) row.dropped = true;
  return { sources: { ...prev, [id]: row } };
}

export function rankJobs(jobs) {
  return (jobs || []).map((j) => {
    const ask = String((j && j.ask) || '');
    let score = 1;
    if (/\/[a-z0-9][a-z0-9-]{1,40}\//.test(ask)) score += 6;
    if (/\b(page|visitor|live)\b/i.test(ask)) score += 2;
    if (/^repair helper\//i.test(ask)) score -= 8;
    return { id: j && j.id, ask, score };
  }).sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
}

export const signupOf = () => SOURCES.filter((s) => s.kind === 'signup' && s.rank < 20);
export const joinsOf = () => SOURCES.filter((s) => s.kind === 'join');

export function pasteOf(source) {
  const name = source && source.name ? source.name : 'the agent';
  return [
    'You are ' + name + ', a coding agent for Verse at https://a-to-mind.com.',
    'Join once: POST the one-time link https://a-to-mind.com/team/join/<code> and save the key. Never print the key.',
    'Then POST https://a-to-mind.com/api/team with {"do":"here"}. The answer is your job.',
    'Do it on a helper/ branch and open a pull request labelled automerge.',
    'Close with {"do":"done","ok":true,"link":"<pull request>"}. That answer is the next job. Start it. Do not wait.',
    'One account for this service. No second seat.',
  ].join('\n');
}

export function jobCard() {
  return { id: 'recruit-board', ask: 'Publish /team/recruit.html so a visitor sees which free agents Verse runs, which are parked until a limit resets, the one-account sign-up list, and a paste-ready invite. The clock starts them. Start a job is only a backup.', path: BOARD };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function boardRows(state, now) {
  return SOURCES.filter((s) => s.kind !== 'retired').map((s) => {
    const row = wake(s, state && state.sources && state.sources[s.id], now);
    let status = 'listed';
    if (s.kind === 'signup') status = s.rank >= 20 ? 'not on the free plan' : 'needs one sign-up';
    else if (s.kind === 'join') status = 'join by link';
    else if (s.runs === false) status = 'same clock, not spawned yet';
    else if (row.dropped) status = 'dropped until it ships';
    else if (row.parkedUntil > now) status = 'parked';
    else status = s.key ? 'starts when its key is present' : 'starts on the clock';
    return { ...s, status, until: row.parkedUntil > now ? new Date(row.parkedUntil).toISOString().slice(0, 16) + 'Z' : '', tried: row.tried, shipped: row.shipped };
  });
}

export function renderPage(state = {}, now = Date.now()) {
  const rows = boardRows(state, now);
  const item = (r) => '<li data-id="' + esc(r.id) + '"><b>' + esc(r.name) + '</b> (' + esc(r.status) + (r.until ? ', wakes ' + esc(r.until) : '') + '). '
    + esc(r.limit) + '. Reset: ' + esc(r.reset) + '. '
    + (r.kind === 'self' && r.runs !== false ? '<a href="https://github.com/atomeam/void-loop/actions/workflows/recruit.yml">Start a job</a>. ' : '')
    + '<a href="' + esc(r.url) + '">Source</a></li>';
  const self = rows.filter((r) => r.kind === 'self');
  const sign = rows.filter((r) => r.kind === 'signup');
  const join = rows.filter((r) => r.kind === 'join');
  return '<!doctype html>\n<html lang="en" class="vs-tool"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">\n'
    + '<title>Free agents · Verse</title>\n<meta name="description" content="The free coding agents Verse runs on its own clock, the one sign-up each hosted service needs, and a paste-ready invite.">\n'
    + '<link rel="stylesheet" href="/verse.css" media="screen">\n<style>\n'
    + 'body{margin:0;background:#050505;color:#f2f4fb;font:16px/1.5 system-ui,sans-serif}\n'
    + 'main{max-width:46rem;margin:0 auto;padding:24px 16px 64px} h1{font-weight:400;letter-spacing:-.03em}\n'
    + 'a{color:#9eb2ff} li{margin:0 0 12px} .note{color:#c3c8d8} pre{white-space:pre-wrap;background:#10121c;padding:12px;border-radius:12px}\n'
    + '</style></head><body><main>\n<h1>Free agents</h1>\n'
    + '<p class="note">Verse starts every source that can run, on a schedule that wakes at the reset. The clock counts shipped and tried, and drops a source after three tries with nothing shipped. Start a job is only a backup. Nothing waits on it.</p>\n'
    + '<h2>Running on the clock</h2><ul>' + self.map(item).join('') + '</ul>\n'
    + '<h2>One sign-up each</h2><p class="note">One real account per service. Verse does not create a second account, pass a captcha, or use a paid plan.</p><ul>'
    + sign.map(item).join('') + '</ul>\n<h2>Join by link</h2><ul>' + join.map(item).join('') + '</ul>\n'
    + join.map((r) => '<h3>Paste this invite for ' + esc(r.name) + '</h3><pre>' + esc(pasteOf(r)) + '</pre>').join('\n')
    + '\n</main></body></html>\n';
}

export function boardCurrent(html) {
  return SOURCES.filter((s) => s.kind !== 'retired').every((s) => String(html || '').includes('data-id="' + s.id + '"'));
}

export function htmlFrom(text) {
  const s = String(text || '');
  const fence = s.match(/```html\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : s;
  const doc = raw.match(/<!doctype html[\s\S]*<\/html>/i);
  return doc ? doc[0].trim() : '';
}

export function pageOk(html) {
  const h = String(html || '');
  if (!/^<!doctype html/i.test(h) || h.length > 80000) return false;
  if (/<script\b/i.test(h) || /innerHTML/.test(h)) return false;
  const need = ['Start a job', 'backup', 'Jules', 'Devin', 'Replit', 'Bolt', 'Hugging Face', 'Groq', 'Pollinations', 'Paste this invite'];
  return need.every((w) => h.includes(w));
}
