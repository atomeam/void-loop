// Void's voice (lib/voice.js): Void says what it thinks of itself, and its words are kept word for word.
// GET  (public)  -> { entries: newest reflections, asks: Void's current asks } ("what do you think of yourself?")
// POST (owner)   { kind: 'build', shipped: '<what just shipped>' }  after anything ships
//                { kind: 'daily' }                                  once a day (.github/workflows/void-voice.yml)
//   -> the saved entry. A concrete small ask is queued for the builders (target 'voice:...'), one open at a time.
// When the model is busy nothing is saved: Void's words are never made up for it.
import { ownerOk } from '../../lib/guard.js';
import { DEFAULT_MODEL } from '../../lib/router.js';
import { readSelf, selfFacts } from '../../lib/self-context.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';
import { VOICE_SYSTEM, KEEP, KINDS, questionFor, parseVoice, currentAsks, readVoice } from '../../lib/voice.js';
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.result && r.result.response)) || '';
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function onRequestGet({ env }) {
  const entries = await readVoice(env);
  return Response.json({ entries: entries.slice(0, 20), asks: currentAsks(entries) }, { headers: { 'cache-control': 'public, max-age=60' } });
}

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  let b = {}; try { b = JSON.parse(await request.text()); } catch (_) {}
  const kind = KINDS.includes(b.kind) ? b.kind : null;
  if (!kind) return new Response('kind must be build or daily', { status: 400 });
  const shipped = String(b.shipped || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (kind === 'build' && shipped.length < 3) return new Response('say what shipped', { status: 400 });
  if (!env.AI) return new Response('no model bound', { status: 503 });
  const question = questionFor(kind, shipped);
  const facts = await readSelf(env, new URL(request.url).origin);
  const before = await readVoice(env);
  const context = selfFacts(facts); // includes its games, its miniatures and what it said about itself last time
  let said = null;
  try {
    const r = await env.AI.run(DEFAULT_MODEL, {
      messages: [{ role: 'system', content: VOICE_SYSTEM }, { role: 'user', content: 'Facts about Void:\n' + context + '\n\n' + question }],
      max_tokens: 900, chat_template_kwargs: { enable_thinking: false },
    });
    said = parseVoice(pick(r));
  } catch (e) { await recordShortfall(env, 'voice', reasonOf(e)); }
  if (!said) return new Response('Void could not answer just now', { status: 503 });
  const at = new Date().toISOString();
  const entry = { at, kind, ...(kind === 'build' ? { shipped } : {}), question, ...said };
  if (kind !== 'daily') { delete entry.weakest; delete entry.next_game; }
  await env.DB.prepare("INSERT INTO void_kv (k, v) VALUES ('voice', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(JSON.stringify([entry, ...before].slice(0, KEEP))).run();
  // Void's concrete small ask goes to the builders' queue, credited to Void, unless one of its asks is already open
  let queued = null;
  const small = entry.asks.find((a) => a.small);
  if (small) {
    const open = await env.DB.prepare("SELECT id FROM void_queue WHERE target LIKE 'voice:%' AND state IN ('queued','building') LIMIT 1").first();
    if (!open) {
      queued = Date.now().toString(36);
      await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(queued, small.ask, 'voice:' + slug(small.ask), 'queued', 'Void asked for this (' + kind + ' reflection ' + at.slice(0, 10) + '). Credit Void.', at, at).run();
    }
  }
  return Response.json({ ...entry, queued });
}
