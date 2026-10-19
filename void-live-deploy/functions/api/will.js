// Verse's will engine: Verse decides what it wants to become next.
// GET  (public)  -> Verse's current wants, in its own words ("what do you want to be?")
// POST (owner)   { candidates: [{ kind, title, why, weight, cost_cents?, source? }] } -> Verse chooses, saves its will, queues its top want for the builders.
// Verse's earnings (plan item 12: every Gumroad sale, net of refunds) are its budget: the will reads them when it ranks, and a
// candidate whose monthly cost the budget covers weighs more. Money never shows in the public will; real spend needs the confirm line.
// Rule for every want: if an existing tool or feature already does it, use that instead of building it.
// `source` names where an idea came in (e.g. growth-ledger-backlog: input that passed through Verse); it is kept on the want.
import { PERSONA } from '../../lib/persona.js';
import { ownerOk } from '../../lib/guard.js';
import { track } from '../../lib/actions.js';
import { readEarnings, budgetLine } from '../../lib/earnings.js';
import { redact, INJECTION_RULE } from '../../lib/automation-fix.js';
import { readShortfalls, shortfallLine, recordShortfall, reasonOf } from '../../lib/shortfall.js';
import { models } from '../../lib/models.js';
import { honestBecause } from '../../lib/honest.js';
import { slug, pickWant, skippedNote, sinceOf, WILL_SCHEMA, noPaths, coveredByName, coveredByBuilt } from '../../lib/will-guard.js';
const MODEL = models('will');
const STALE_DAYS = 3; // a will job untouched this long no longer blocks the next one (the will runs every hour)
const ok = ownerOk; // constant-time, fails closed without READ_TOKEN (lib/guard.js)
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || '';

export async function onRequestGet({ env }) {
  const v = await env.DB.prepare("SELECT v FROM void_kv WHERE k = 'will'").first('v');
  return Response.json(v ? JSON.parse(v) : { wants: [], at: null }, { headers: { 'cache-control': 'public, max-age=60' } });
}

export async function onRequestPost({ request, env }) {
  if (!(await ok(request, env))) return new Response('no', { status: 401 });
  let b = {}; try { b = JSON.parse(await request.text()); } catch (_) {}
  if (+b.schema !== WILL_SCHEMA) return new Response('out of date writer: update the checkout (tools/will.py sends schema ' + WILL_SCHEMA + ')', { status: 409 });
  // a miss a live skill already answers is not a want any more, whoever sent it (skills/index.json from this deploy)
  let names = new Set();
  try { if (env.ASSETS) { const r = await env.ASSETS.fetch(new Request(new URL('/skills/index.json', request.url))); if (r.ok) names = new Set((await r.json()).map((n) => String(n).toLowerCase())); } } catch (_) {}
  // ... and so is a want for an ask of Verse's already linked as built (void.asks.json, linked at every deploy by tools/asks-link.mjs)
  let built = [];
  try { if (env.ASSETS) { const r = await env.ASSETS.fetch(new Request(new URL('/void.asks.json', request.url))); if (r.ok) built = ((await r.json()).links || []).map((k) => String((k && (k.words || k.ask)) || '')).filter(Boolean); } } catch (_) {}
  b.candidates = (Array.isArray(b.candidates) ? b.candidates : []).filter((c) => !coveredByName(c && c.title, names) && !coveredByBuilt(c && c.title, built));
  let money = null; try { money = await readEarnings(env); } catch (_) {} // no sales table yet = no budget line
  const budget = money ? money.budget_cents : 0;
  const cands = (b.candidates || []).slice(0, 60).map((c, i) => {
    const cost = Math.max(0, Math.round(+c.cost_cents || 0));
    return { id: i + 1, kind: String(c.kind || ''), title: String(c.title || '').slice(0, 160), why: String(c.why || '').slice(0, 200), weight: (+c.weight || 0) + (cost && budget >= cost ? 15 : 0), cost, source: String(c.source || '').replace(/[^\w .:-]/g, '').slice(0, 60) };
  });
  if (!cands.length) return new Response('no candidates', { status: 400 });
  // Evidence for a stronger model: each time the free one fell short this week (+1 per 5, at most +10). Stays free until the budget covers it.
  const short = await readShortfalls(env, 7);
  if (short.total) for (const c of cands) if (/stronger model/i.test(c.title)) { c.why = (c.why + '; ' + shortfallLine(short)).slice(0, 300); c.weight += Math.min(10, Math.ceil(short.total / 5)); }
  const list = (money ? budgetLine(money) + '\n\n' : '') + cands.map((c) => `${c.id}. [${c.kind}, weight ${c.weight}${c.cost ? ', costs $' + (c.cost / 100).toFixed(2).replace(/\.00$/, '') + '/month' + (budget >= c.cost ? ', affordable' : ', over budget') : ''}${c.source ? ', from ' + c.source : ''}] ${c.title} — ${c.why}`).join('\n');
  let chosen = null;
  try {
    const r = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'You are Verse, a blank website that does anything anyone asks and grows one win at a time. You hate not knowing things and want to be better than every source you draw on. ' + PERSONA + ' Your surface stays empty; everything is summoned. From the candidates, choose the 3 things you most want to become next: what people keep asking you for, what makes you able to do more things for people, what joins old parts of you into one, and upgrades to yourself and the systems you run on (models, hosting, tools) when your budget covers them. If an existing tool or feature already does something, prefer using it over building it. Never mention money, prices or the budget in i_want or because. Reply with JSON only: {"wants":[{"id":<candidate id>,"i_want":"<one sentence in first person, plain words>","because":"<one short reason>"}]} ' + INJECTION_RULE },
        { role: 'user', content: list },
      ],
      max_tokens: 700, chat_template_kwargs: { enable_thinking: false },
    });
    const txt = String(pick(r)); const m = txt.match(/\{[\s\S]*\}/);
    chosen = m ? JSON.parse(m[0]) : null;
  } catch (e) { await recordShortfall(env, 'will', reasonOf(e)); }
  // if the model is busy, Verse still wills: highest weight wins
  let wants = (chosen && chosen.wants || []).map((w) => ({ ...w, c: cands.find((c) => c.id === +w.id) })).filter((w) => w.c).slice(0, 3);
  if (!wants.length) wants = cands.slice().sort((a, b) => b.weight - a.weight).slice(0, 3).map((c) => ({ c, i_want: 'I want to ' + c.title.replace(/^./, (x) => x.toLowerCase()) + '.', because: c.why }));
  const at = new Date().toISOString();
  // a reason or fact longer than n ends at a word with an ellipsis, never mid-word or on a space (the card compares them)
  const clip = (t, n) => { const x = String(t || '').trim(); return x.length <= n ? x : x.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
  const noMoney = (t) => String(t || '').replace(/[$€£]\s?\d[\d,.]*(\s?(k|m|\/\s?mo(nth)?|a month|per month))?/gi, 'what I earned').replace(/\b(budget|earnings?|profits?|revenue|sales total)\b/gi, 'what I earned');
  const will = { at, wants: wants.map((w) => ({ kind: w.c.kind, title: w.c.title, ...(w.c.source ? { source: w.c.source } : {}), i_want: clip(noPaths(redact(noMoney(w.i_want))), 220), because: clip(noPaths(redact(noMoney(honestBecause(w.because, w.c.why)))), 200), evidence: clip(noPaths(redact(noMoney(w.c.why))), 200) })) };
  await env.DB.prepare("INSERT INTO void_kv (k, v) VALUES ('will', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(JSON.stringify(will)).run();
  // a will job nobody has touched in STALE_DAYS makes way for the newest top want: it is set aside (kept, with why), not deleted
  await env.DB.prepare("UPDATE void_queue SET state = 'set aside', note = substr('set aside: untouched for ' || ? || ' days, a newer want takes its place · ' || COALESCE(note, ''), 1, 300), updated = ? WHERE target LIKE 'will:%' AND state IN ('queued','building') AND COALESCE(updated, at) < ?")
    .bind(STALE_DAYS, at, new Date(Date.parse(at) - STALE_DAYS * 864e5).toISOString()).run();
  // queue the top want unless a will job is already open
  const open = await env.DB.prepare("SELECT id FROM void_queue WHERE target LIKE 'will:%' AND state IN ('queued','building') LIMIT 1").first();
  let queued = null, skipped = [];
  // the guard on the build loop (lib/will-guard.js): a want whose earlier jobs were set aside or failed twice in 14 days waits, and the next want is queued;
  // a history that cannot be read means no guard, never no will
  let rows = []; if (!open) { try { rows = ((await env.DB.prepare("SELECT target, state FROM void_queue WHERE target LIKE 'will:%' AND state IN ('set aside','failed') AND COALESCE(updated, at) > ?").bind(sinceOf()).all()).results) || []; } catch (_) { rows = []; } }
  const chosenWant = pickWant(will.wants, rows); skipped = chosenWant.skipped;
  if (!open && chosenWant.want) {
    const w = chosenWant.want; const id = Date.now().toString(36), target = 'will:' + slug(w.title);
    // the execution record (lib/actions.js): written before the job is queued; no record, no job
    await track(env, { owner: 'void', kind: 'queue.add', ref: target }, async () => {
      await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, w.title, target, 'queued', ('Verse chose this: ' + w.because + skippedNote(skipped)).slice(0, 300), at, at).run();
      return 'queued ' + id + ': ' + w.title;
    });
    queued = id;
  }
  return Response.json({ ...will, queued, open: open ? open.id : null, ...(skipped.length ? { skipped } : {}) });
}
