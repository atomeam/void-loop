// The agent's real capacity (functions/api/agent.js). Atom's rule (2026-11-20): Verse is not capped by a number it made up; it harvests every legal free
// resource it already has a key for, stacked and rotated, and stops only when every one is genuinely out. Workers AI (the binding, two models) goes first,
// then each free provider that has a key on this deploy, a model at a time (a free tier limits each model on its own), then the pot pays (lib/agent-cap.js).
// A provider or model that answers 429 or says its quota is gone is parked (a minute for a rate limit, the rest of the UTC day for a daily one) so the next
// task does not knock on a closed door; the park is one row in lib/daily-cap.js's counter, shared by every edge location. One account per service, no
// new accounts, no stacked keys. Gemini and OpenRouter free tiers may train on prompts (resources/free.json: "never send visitor data"), so a visitor's ask
// goes to them only when AGENT_PRIVATE_FREE is "on"; the house lane's own exam (owner-signed) may always use them.
// Groq's free-plan models (console.groq.com/docs/models, 2026-11-20): gpt-oss-120b, gpt-oss-20b, qwen3.8-27b; llama-3.3-70b-versatile is now Contact Sales.
// Tests: tools/agent-providers.test.mjs.
import { cap, peek, dayOf } from './daily-cap.js';
import { GEMINI_MODELS } from './models.js';

export const PROVIDERS = Object.freeze([
  { id: 'groq', name: 'Groq', key: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/chat/completions', models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'], perModelDay: 1000, private: false, registry: 'groq-free' },
  { id: 'gemini', name: 'Google Gemini', key: 'GEMINI_API_KEY', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', models: GEMINI_MODELS, perModelDay: 250, private: true, registry: 'gemini-free' },
  { id: 'openrouter', name: 'OpenRouter', key: 'OPENROUTER_API_KEY', url: 'https://openrouter.ai/api/v1/chat/completions', models: ['meta-llama/llama-3.3-70b-instruct:free'], perModelDay: 50, private: true, registry: 'openrouter-free' },
]);
export const WORKERS = Object.freeze({ id: 'workers-ai', name: 'Cloudflare Workers AI', neuronsPerDay: 10000, registry: 'workers-ai-chat' });
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
const pk = (id, model, when) => 'park:' + slug(id) + (model ? ':' + slug(model) : '') + ':' + when;
const minuteOf = (now) => 'm' + Math.floor(now / 60000);

/** how a provider's refusal reads: 'day' (the quota for today is gone), 'minute' (a rate limit), 'model' (this model id is not served), 'error'. Pure. */
export function kindOf(status, message = '', retryAfter = 0) {
  const m = String(message || '');
  if (status === 429 || /quota|rate.?limit|too many|exhaust|\b4006\b|daily free allocation/i.test(m)) return /per day|daily|\bTPD\b|\bRPD\b|PerDay|\b4006\b|neurons|free allocation/i.test(m) || retryAfter > 3600 ? 'day' : 'minute';
  if (status === 404 || status === 400 || status === 403) return 'model';
  return 'error';
}
// a model id the provider does not serve (Groq's free plan lost llama-3.3-70b-versatile) is skipped for the minute, not asked on every task
export async function park(env, id, model, kind, now = Date.now()) { if (kind === 'day' || kind === 'minute' || kind === 'model') await cap(env, pk(id, model, kind === 'day' ? dayOf(now) : minuteOf(now)), 1e9, now); }
export async function parked(env, id, model, now = Date.now()) { return (await peek(env, pk(id, model, dayOf(now)), now)) > 0 || (await peek(env, pk(id, model, minuteOf(now)), now)) > 0; }
/** the providers this deploy can reach and may use for this traffic: a key is set, and a prompt-training free tier only for the owner's own traffic or when switched on. Pure. */
export const usable = (env, { owner = false } = {}) => PROVIDERS.filter((p) => env && env[p.key] && (!p.private || owner || env.AGENT_PRIVATE_FREE === 'on'));
/** one free model call on an OpenAI-style endpoint: the text, or an Error with .status and .kind. `fetchFn` is injectable. */
export async function ask(p, model, env, messages, fetchFn = fetch) {
  const res = await fetchFn(p.url, { method: 'POST', headers: { authorization: 'Bearer ' + env[p.key], 'content-type': 'application/json' }, body: JSON.stringify({ model, messages, max_tokens: 700, temperature: 0.3 }), signal: AbortSignal.timeout(30000) });
  if (!res.ok) { const body = await res.text().catch(() => ''); const e = new Error(p.id + ' ' + res.status + ' ' + body.slice(0, 200)); e.status = res.status; e.kind = kindOf(res.status, body, Number(res.headers && res.headers.get && res.headers.get('retry-after')) || 0); throw e; }
  const j = await res.json().catch(() => ({})), text = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  if (text.length < 2) { const e = new Error(p.id + ': empty'); e.kind = 'error'; throw e; }
  return text;
}
/** rotate through the usable providers and their models, skipping the parked, parking the ones that say they are out. { text, provider, model, tried } or { text: '', tried }. */
export async function answerFree(env, messages, { owner = false, only = '', now = Date.now(), fetchFn = fetch } = {}) {
  const tried = [];
  for (const p of usable(env, { owner }).filter((u) => !only || u.id === only)) for (const model of p.models) {
    if (await parked(env, p.id, model, now)) { tried.push({ id: p.id, model, why: 'parked' }); continue; }
    try { const text = await ask(p, model, env, messages, fetchFn); return { text, provider: p.id, name: p.name, model, tried }; } catch (e) {
      const kind = e.kind || kindOf(e.status, e.message); tried.push({ id: p.id, model, why: kind });
      await park(env, p.id, model, kind, now);
    }
  }
  return { text: '', tried };
}
/** has every provider this traffic may use been parked for the day (nothing is left to try)? Workers AI counts when it is bound. */
export async function exhausted(env, { owner = false, now = Date.now() } = {}) {
  if (env && env.AI && !(await peek(env, pk(WORKERS.id, '', dayOf(now)), now) > 0)) return false;
  for (const p of usable(env, { owner })) for (const m of p.models) if (!(await peek(env, pk(p.id, m, dayOf(now)), now) > 0)) return false;
  return true;
}
/** one answer counted under its provider today (the log of who answered). */
export const countVia = (env, id, now = Date.now()) => cap(env, 'agent-via:' + slug(id), 1e9, now);
/** today's real capacity and use, for GET /api/agent?capacity=1: names, booleans and counts, never a key. */
export async function capacityOf(env, { now = Date.now() } = {}) {
  const rows = [{ id: WORKERS.id, name: WORKERS.name, reachable: !!(env && env.AI), usable: !!(env && env.AI), private: false, limit: WORKERS.neuronsPerDay + ' neurons a day', parked: (await peek(env, pk(WORKERS.id, '', dayOf(now)), now)) > 0, answeredToday: await peek(env, 'agent-via:' + slug(WORKERS.id), now) }];
  for (const p of PROVIDERS) rows.push({ id: p.id, name: p.name, reachable: !!(env && env[p.key]), usable: usable(env).some((u) => u.id === p.id), private: p.private, models: p.models.length, limit: p.perModelDay + ' a day per model', answersAvailableToday: (env && env[p.key] ? p.models.length * p.perModelDay : 0), parked: (await Promise.all(p.models.map((m) => peek(env, pk(p.id, m, dayOf(now)), now)))).filter((n) => n > 0).length, answeredToday: await peek(env, 'agent-via:' + slug(p.id), now) });
  return rows;
}
