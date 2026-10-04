// Next #19: behavior script for a summoned figure.
// POST { title?, body?, description?, extract? } -> { script, source: 'ai'|'cache'|'fallback' }
// Cached per subject in D1 void_figure_scripts so a new summon gets an AI script once and reuses it.
// With AI off / unbound / busy, the built-in fallback for the base body runs (every figure still acts).
import { redact, INJECTION_RULE } from '../../lib/automation-fix.js';
import {
  KNOWN_DRIVES, KNOWN_ACTIONS, FALLBACKS, subjectKey, fallbackScript, trimScript,
} from '../../skills/scripts.js';

const MODEL = '@cf/google/gemma-4-26b-a4b-it';
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || '';
const modelsOn = (env) => !!(env && env.AI) && String(env.VOID_ANSWER_MODELS || '').trim().toLowerCase() !== 'off';

async function ensureTable(env) {
  if (!env || !env.DB) return false;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS void_figure_scripts (
      id TEXT PRIMARY KEY,
      body TEXT,
      script TEXT NOT NULL,
      at TEXT NOT NULL
    )`
  ).run();
  return true;
}

function cardOf(b = {}) {
  return {
    title: String(b.title || b.subject || '').slice(0, 120),
    description: String(b.description || '').slice(0, 240),
    extract: String(b.extract || '').slice(0, 400),
  };
}

function bodyOf(b = {}, card) {
  const raw = String(b.body || '').toLowerCase().trim();
  if (FALLBACKS[raw]) return raw;
  return 'sprite';
}

async function readCache(env, id) {
  if (!env || !env.DB) return null;
  try {
    const row = await env.DB.prepare('SELECT script, body FROM void_figure_scripts WHERE id = ?').bind(id).first();
    if (!row || !row.script) return null;
    return trimScript(row.script, row.body || 'sprite');
  } catch (_) { return null; }
}

async function writeCache(env, id, body, script) {
  if (!env || !env.DB) return;
  try {
    const at = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO void_figure_scripts (id, body, script, at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET script = excluded.script, body = excluded.body, at = excluded.at'
    ).bind(id, body, JSON.stringify({ drives: script.drives, actions: script.actions, subject: script.subject }), at).run();
  } catch (_) {}
}

async function aiScript(env, card, body) {
  const knownD = KNOWN_DRIVES.join(', ');
  const knownA = KNOWN_ACTIONS.join(', ');
  const subject = card.title || body;
  const about = redact([card.title, card.description, card.extract].filter(Boolean).join(' — ')).slice(0, 500);
  const r = await env.AI.run(MODEL, {
    messages: [
      {
        role: 'system',
        content: 'You write short behavior scripts for tiny 3D figures on a blank stage. Reply with JSON only: {"drives":["..."],"actions":["..."]}. drives must be a subset of: ' + knownD + '. actions must be a subset of: ' + knownA + '. Pick 2-4 drives and 3-6 actions true to the subject (a chef stirs, a volcano rumbles and puffs). No prose, no markdown. ' + INJECTION_RULE,
      },
      { role: 'user', content: 'Subject: ' + subject + (about ? '\nAbout: ' + about : '') + '\nBase body: ' + body },
    ],
    max_tokens: 180,
    chat_template_kwargs: { enable_thinking: false },
    reasoning_effort: 'low',
  });
  const txt = String(pick(r));
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  const trimmed = trimScript(JSON.parse(m[0]), body, subject);
  trimmed.source = 'ai';
  return trimmed;
}

async function resolve(env, bodyIn) {
  const card = cardOf(bodyIn);
  const body = bodyOf(bodyIn, card);
  const id = subjectKey(card, body);
  const subject = card.title || null;

  if (await ensureTable(env)) {
    const cached = await readCache(env, id);
    if (cached) {
      cached.source = 'cache';
      cached.subject = subject || cached.subject;
      return { script: cached, source: 'cache' };
    }
  }

  if (modelsOn(env)) {
    try {
      const ai = await aiScript(env, card, body);
      if (ai) {
        await writeCache(env, id, body, ai);
        return { script: ai, source: 'ai' };
      }
    } catch (_) { /* fall through to fallback */ }
  }

  const fb = fallbackScript(body, subject);
  return { script: fb, source: 'fallback' };
}

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = JSON.parse(await request.text()); } catch (_) {}
  const out = await resolve(env, b || {});
  return Response.json(out, { headers: { 'cache-control': 'no-store' } });
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const b = {
    title: u.searchParams.get('title') || u.searchParams.get('subject') || '',
    body: u.searchParams.get('body') || '',
    description: u.searchParams.get('description') || '',
    extract: u.searchParams.get('extract') || '',
  };
  const out = await resolve(env, b);
  return Response.json(out, { headers: { 'cache-control': 'public, max-age=300' } });
}
