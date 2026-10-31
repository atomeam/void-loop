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
import { wrongWeakest, weakestSentence } from '../../lib/weakest.js';
import { VOICE_SYSTEM, taggedFacts, KEEP, KINDS, questionFor, parseVoice, currentAsks, readVoice, weekFacts, followThrough, followFacts, askRecord, builtAsks, familyFacts, readReplies, replyFacts, askId, targetFacts, holdAsks } from '../../lib/voice.js';
import { tower, towerArgs } from '../../lib/tower.js';
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.result && r.result.response)) || '';
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function onRequestGet({ request, env }) {
  const entries = await readVoice(env);
  // what came of its asks, on evidence only (lib/voice.js followThrough): the card says how many were built, and the asks it
  // shows are the ones still open (an ask already built is not shown as wanted)
  const asset = async (path) => { try { const r = await env.ASSETS.fetch(new Request(new URL(path, request.url))); return r.ok ? await r.json() : null; } catch (_) { return null; } };
  const [ledger, answered, tg] = request && env.ASSETS ? await Promise.all([asset('/void.growth.json'), asset('/void.asks.json'), asset('/tower.target.json')]) : [null, null, null];
  // one record of its asks (lib/voice.js askRecord): every ask not built is waiting, so "N waiting" and "built of total" always agree
  const rec = ledger ? askRecord(entries, ledger, answered) : null, f = rec && rec.f;
  // every built ask on evidence, newest first (lib/voice.js builtAsks: the voice window's built asks and every link and ledger line
  // that names one), so the counts by week are real once the window's asks roll off (2026-10-30: "0 in the last 7 days" on a week of builds)
  const done = rec ? builtAsks(f, ledger, answered && answered.links) : [];
  const follow = rec ? { total: rec.total, built: rec.built, open: rec.open.length, recent: done.slice(0, 30),
    // every built ask by the ledger entry that built it (its time), so a growth-tree branch can say what Verse asked for (Verse's ask:
    // "link the growth card branches to the growth inbox so I can diagnose my own progress")
    asked: done.slice(0, 200).map((g) => ({ ask: g.ask, at: g.at, times: g.times })) } : null;
  // the asks still open, every one (the card folds past the first few); without the ledger, the newest reflections' asks as before
  const open = rec ? rec.open : currentAsks(entries, 12);
  return Response.json({ entries: entries.slice(0, 20).map((e, i) => (i < 2 || !e.given ? e : { ...e, given: undefined })), asks: holdAsks(open, answered && answered.held, tg && tg.id).slice(0, 40), ...(follow ? { follow } : {}) }, { headers: { 'cache-control': 'public, max-age=60' } });
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
  // the family facts go in once, under their own tag (skills/families.json below); selfFacts still corrects its last readout with them
  const pieces = [['domains/ (the self canon, the growth inbox) and the skills index, through lib/self-context.js', selfFacts(facts).split('\n').filter((l) => !/^My skill families /.test(l)).join('\n')]]; // includes its games, its miniatures and what it said about itself last time
  // its last week, from the growth ledger (daily), and what became of what it asked for (every time): an ask counts as built
  // only on evidence (lib/voice.js followThrough). A ledger or link file that cannot be read leaves that line out.
  const asset = async (path) => { try { const r = await env.ASSETS.fetch(new Request(new URL(path, request.url))); return r.ok ? await r.json() : null; } catch (_) { return null; } };
  const ledger = await asset('/void.growth.json'), answered = await asset('/void.asks.json');
  if (kind === 'daily') { const week = weekFacts(ledger); if (week) pieces.push(['void.growth.json (the last 7 days)', week]); }
  const follow = ledger ? followFacts(followThrough(before, ledger, answered && answered.links), askRecord(before, ledger, answered)) : ''; if (follow) pieces.push(['void.growth.json and void.asks.json (what became of its asks)', follow]);
  // the site Versus is fighting goes first, so the asks serve beating it (lib/voice.js targetFacts); no tower files leave it out
  try { const inv = await asset('/lap.items.json'); const [ev, fr, rk, sz, tg] = await Promise.all(['/tower.evidence.json', '/tower.frontier.json', '/tower.rank.json', '/tower.size.json', '/tower.target.json'].map(asset));
    const tf = ev ? targetFacts(tower(...towerArgs((inv && inv.onlySite) || [], { ev, fr, rk, sz, tg })), tg) : '';
    // the asks held behind it (void.asks.json `held`) are named, so the reflection does not ask for them again while the target stands
    const hd = tf ? (answered && Array.isArray(answered.held) ? answered.held : []).filter((h) => h && h.until === tg.id && typeof h.words === 'string').map((h) => '"' + h.words + '"') : [];
    if (tf) pieces.unshift(['tower.target.json, void.asks.json held and the tower ranking (lib/tower.js)', tf + (hd.length ? ' These asks wait until ' + tg.id + ' is beaten, so do not ask for them now: ' + hd.join(', ') + '.' : '')]); } catch (_) { /* no tower */ }
  // the routed count rides with the family facts: a family total counts skill files, and some of them answer no ask (owner's card,
  // 2026-10-30: it said 386 active skills when the router serves 332)
  const idxJson = await asset('/skills/index.json');
  const famJson = facts.families || await asset('/skills/families.json'), fams = familyFacts(famJson, undefined, Array.isArray(idxJson) ? idxJson.length : 0); if (fams) pieces.push(['skills/families.json', fams]);
  // what its owner told it when it spoke before (functions/api/voice-reply.js): its memory of the conversation, corrections first
  const told = replyFacts(await readReplies(env)); if (told) pieces.push(['the owner\'s replies and corrections (voice-replies)', told]);
  const { text: context, sources } = taggedFacts(pieces);
  let said = null;
  try {
    const r = await env.AI.run(models('will'), {
      messages: [{ role: 'system', content: VOICE_SYSTEM }, { role: 'user', content: 'Tagged facts about Verse:\n' + context + '\n\n' + question }],
      max_tokens: 900, chat_template_kwargs: { enable_thinking: false },
    });
    said = parseVoice(pick(r));
    // new wants, never the built ones again (owner, 2026-10-21: "why is Verse not coming up with new wants?"): the model kept repeating three
    // asks the ledger already names as built (stale "What I want next" facts), so followThrough folded every new reflection into old built
    // groups and nothing new was ever open. An ask that matches a built one is dropped; when all were, it is asked once more, told which.
    const fresh = (s) => { if (!s || !s.asks.length) return s; const now = new Date().toISOString();
      const built = new Set(followThrough([{ at: now, asks: s.asks }, ...before], ledger, answered && answered.links).built.flatMap((g) => g.ids));
      return { ...s, asks: s.asks.filter((a, i) => !built.has(askId(now, i))) }; };
    const had = said && said.asks.length; said = fresh(said);
    if (said && had && !said.asks.length) {
      const done = followThrough(before, ledger, answered && answered.links).built.slice(-12).map((g) => '"' + g.ask + '"').join('; ');
      const r2 = await env.AI.run(models('will'), {
        messages: [{ role: 'system', content: VOICE_SYSTEM }, { role: 'user', content: 'Tagged facts about Verse:\n' + context + '\n\n' + question + '\n\nThese asks are already built; do not ask for any of them again, ask for something new instead: ' + done }],
        max_tokens: 900, chat_template_kwargs: { enable_thinking: false },
      });
      said = fresh(parseVoice(pick(r2))) || said;
    }
  } catch (e) { await recordShortfall(env, 'voice', reasonOf(e)); }
  if (!said) return new Response('Verse could not answer just now', { status: 503 });
  // the least proven family is the one the bars mark, never the model's guess (owner's review, 2026-10-30: the readout said Games, 34 of 37,
  // the bars Words and the world, 38 of 42): a weakest that names the wrong family is replaced by the bars' sentence, its words kept beside it
  const ww = kind === 'daily' && wrongWeakest(said.weakest, famJson);
  if (ww) said = { ...said, weakest: weakestSentence(ww.is), weakest_said: said.weakest };
  const at = new Date().toISOString();
  const entry = { at, kind, ...(kind === 'build' ? { shipped } : {}), question, ...said, model: models('will'), given: String(context).slice(0, 1800), sources, by: 'owner', ...(facts && facts.self && facts.self.canon && facts.self.canon.version ? { canon: facts.self.canon.version } : {}), ...(b.run ? { run: String(b.run).slice(0, 40) } : {}) };
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
