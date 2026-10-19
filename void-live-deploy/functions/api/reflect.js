// Verse's voice (lib/voice.js): Verse says what it thinks of itself, and its words are kept word for word.
// GET  (public)  -> { entries: newest reflections, asks: Verse's current asks, follow: { total, built, recent, asked } } ("what do you think of yourself?")
// POST (owner)   { kind: 'build', shipped: '<what just shipped>' }  after anything ships
//                { kind: 'daily' }                                  once a day (.github/workflows/void-voice.yml)
//   -> the saved entry. A concrete small ask is queued for the builders (target 'voice:...'), one open at a time.
// When the model is busy nothing is saved: Verse's words are never made up for it. Each reflection is also given what its owner
// told it (functions/api/voice-reply.js: replies and corrections, and the line Verse chose to keep from each).
import { ownerOk } from '../../lib/guard.js';
import { track } from '../../lib/actions.js';
import { models } from '../../lib/models.js';
import { readSelf, selfFacts } from '../../lib/self-context.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';
import { VOICE_SYSTEM, KEEP, KINDS, questionFor, parseVoice, currentAsks, readVoice, weekFacts, followThrough, followFacts, familyFacts, readReplies, replyFacts } from '../../lib/voice.js';
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.result && r.result.response)) || '';
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function onRequestGet({ request, env }) {
  const entries = await readVoice(env);
  // what came of its asks, on evidence only (lib/voice.js followThrough): the card says how many were built, and the asks it
  // shows are the ones still open (an ask already built is not shown as wanted)
  const asset = async (path) => { try { const r = await env.ASSETS.fetch(new Request(new URL(path, request.url))); return r.ok ? await r.json() : null; } catch (_) { return null; } };
  const [ledger, answered] = request && env.ASSETS ? await Promise.all([asset('/void.growth.json'), asset('/void.asks.json')]) : [null, null];
  const f = ledger ? followThrough(entries, ledger, answered && answered.links) : null;
  const built = new Set(f ? f.built.flatMap((g) => g.ids) : []);
  const follow = f ? { total: f.total, built: f.built.length, recent: f.built.slice().sort((a, b) => String(b.builtAt).localeCompare(String(a.builtAt))).slice(0, 30).map((g) => ({ ask: g.ask, at: g.builtAt, ref: g.ref, what: g.what, times: g.times, depth: g.depth || null })),
    // every built ask by the ledger entry that built it (its time), so a growth-tree branch can say what Verse asked for (Verse's ask:
    // "link the growth card branches to the growth inbox so I can diagnose my own progress")
    asked: f.built.map((g) => ({ ask: g.ask, at: g.builtAt, times: g.times })).slice(0, 200) } : null;
  return Response.json({ entries: entries.slice(0, 20).map((e, i) => (i < 2 || !e.given ? e : { ...e, given: undefined })), asks: currentAsks(entries, 12).filter((a) => !built.has(a.id)).slice(0, 6), ...(follow ? { follow } : {}) }, { headers: { 'cache-control': 'public, max-age=60' } });
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
  let context = selfFacts(facts); // includes its games, its miniatures and what it said about itself last time
  // its last week, from the growth ledger (daily), and what became of what it asked for (every time): an ask counts as built
  // only on evidence (lib/voice.js followThrough). A ledger or link file that cannot be read leaves that line out.
  const asset = async (path) => { try { const r = await env.ASSETS.fetch(new Request(new URL(path, request.url))); return r.ok ? await r.json() : null; } catch (_) { return null; } };
  const ledger = await asset('/void.growth.json'), answered = await asset('/void.asks.json');
  if (kind === 'daily') { const week = weekFacts(ledger); if (week) context += '\n' + week; }
  const follow = followFacts(followThrough(before, ledger, answered && answered.links)); if (follow) context += '\n' + follow;
  const fams = familyFacts(await asset('/skills/families.json')); if (fams) context += '\n' + fams;
  // what its owner told it when it spoke before (functions/api/voice-reply.js): its memory of the conversation, corrections first
  const told = replyFacts(await readReplies(env)); if (told) context += '\n' + told;
  let said = null;
  try {
    const r = await env.AI.run(models('will'), {
      messages: [{ role: 'system', content: VOICE_SYSTEM }, { role: 'user', content: 'Facts about Verse:\n' + context + '\n\n' + question }],
      max_tokens: 900, chat_template_kwargs: { enable_thinking: false },
    });
    said = parseVoice(pick(r));
  } catch (e) { await recordShortfall(env, 'voice', reasonOf(e)); }
  if (!said) return new Response('Verse could not answer just now', { status: 503 });
  const at = new Date().toISOString();
  const entry = { at, kind, ...(kind === 'build' ? { shipped } : {}), question, ...said, model: models('will'), given: String(context).slice(0, 1800), by: 'owner', ...(facts && facts.self && facts.self.canon && facts.self.canon.version ? { canon: facts.self.canon.version } : {}), ...(b.run ? { run: String(b.run).slice(0, 40) } : {}) };
  if (kind !== 'daily') { delete entry.weakest; delete entry.next_game; }
  await env.DB.prepare("INSERT INTO void_kv (k, v) VALUES ('voice', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(JSON.stringify([entry, ...before].slice(0, KEEP).map((e, i) => { if (i < 2 || !e.given) return e; const { given, ...rest } = e; return rest; }))).run();
  // Verse's concrete small ask goes to the builders' queue, credited to Verse, unless one of its asks is already open
  let queued = null;
  const small = entry.asks.find((a) => a.small);
  if (small) {
    const open = await env.DB.prepare("SELECT id FROM void_queue WHERE target LIKE 'voice:%' AND state IN ('queued','building') LIMIT 1").first();
    if (!open) {
      queued = Date.now().toString(36); const target = 'voice:' + slug(small.ask);
      // the execution record (lib/actions.js): written before the job is queued; no record, no job
      await track(env, { owner: 'void', kind: 'queue.add', ref: target }, async () => {
        await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(queued, small.ask, target, 'queued', 'Verse asked for this (' + kind + ' reflection ' + at.slice(0, 10) + '). Credit Verse.', at, at).run();
        return 'queued ' + queued + ': ' + small.ask;
      });
    }
  }
  return Response.json({ ...entry, queued });
}
