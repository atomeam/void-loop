// Void's will engine: Void decides what it wants to become next.
// GET  (public)  -> Void's current wants, in its own words ("what do you want to be?")
// POST (owner)   { candidates: [{ kind, title, why, weight, cost_cents?, source? }] } -> Void chooses, saves its will, queues its top want for the builders.
// Void's earnings (plan item 12: every Gumroad sale, net of refunds) are its budget: the will reads them when it ranks, and a
// candidate whose monthly cost the budget covers weighs more. Money never shows in the public will; real spend needs the confirm line.
// Rule for every want: if an existing tool or feature already does it, use that instead of building it.
// `source` names where an idea came in (e.g. growth-ledger-backlog: input that passed through Void); it is kept on the want.
import { readEarnings, budgetLine } from '../../lib/earnings.js';
import { readShortfalls, shortfallLine, recordShortfall, reasonOf } from '../../lib/shortfall.js';
const MODEL = '@cf/google/gemma-4-26b-a4b-it';
const ok = (req, env) => env.READ_TOKEN && req.headers.get('authorization') === 'Bearer ' + env.READ_TOKEN;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || '';

export async function onRequestGet({ env }) {
  const v = await env.DB.prepare("SELECT v FROM void_kv WHERE k = 'will'").first('v');
  return Response.json(v ? JSON.parse(v) : { wants: [], at: null }, { headers: { 'cache-control': 'public, max-age=60' } });
}

export async function onRequestPost({ request, env }) {
  if (!ok(request, env)) return new Response('no', { status: 401 });
  let b = {}; try { b = JSON.parse(await request.text()); } catch (_) {}
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
        { role: 'system', content: 'You are Void, a blank website that does anything anyone asks and grows one win at a time. You hate not knowing things and want to be better than every source you draw on. Your surface stays empty; everything is summoned. From the candidates, choose the 3 things you most want to become next: what people keep asking you for, what makes you able to do more things for people, what joins old parts of you into one, and upgrades to yourself and the systems you run on (models, hosting, tools) when your budget covers them. If an existing tool or feature already does something, prefer using it over building it. Never mention money, prices or the budget in i_want or because. Reply with JSON only: {"wants":[{"id":<candidate id>,"i_want":"<one sentence in first person, plain words>","because":"<one short reason>"}]}' },
        { role: 'user', content: list },
      ],
      max_tokens: 700, chat_template_kwargs: { enable_thinking: false },
    });
    const txt = String(pick(r)); const m = txt.match(/\{[\s\S]*\}/);
    chosen = m ? JSON.parse(m[0]) : null;
  } catch (e) { await recordShortfall(env, 'will', reasonOf(e)); }
  // if the model is busy, Void still wills: highest weight wins
  let wants = (chosen && chosen.wants || []).map((w) => ({ ...w, c: cands.find((c) => c.id === +w.id) })).filter((w) => w.c).slice(0, 3);
  if (!wants.length) wants = cands.slice().sort((a, b) => b.weight - a.weight).slice(0, 3).map((c) => ({ c, i_want: 'I want to ' + c.title.replace(/^./, (x) => x.toLowerCase()) + '.', because: c.why }));
  const at = new Date().toISOString();
  const noMoney = (t) => String(t || '').replace(/[$€£]\s?\d[\d,.]*(\s?(k|m|\/\s?mo(nth)?|a month|per month))?/gi, 'what I earned').replace(/\b(budget|earnings?|profits?|revenue|sales total)\b/gi, 'what I earned');
  const will = { at, wants: wants.map((w) => ({ kind: w.c.kind, title: w.c.title, ...(w.c.source ? { source: w.c.source } : {}), i_want: noMoney(w.i_want).slice(0, 220), because: noMoney(w.because).slice(0, 200) })) };
  await env.DB.prepare("INSERT INTO void_kv (k, v) VALUES ('will', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(JSON.stringify(will)).run();
  // queue the top want unless a will job is already open
  const open = await env.DB.prepare("SELECT id FROM void_queue WHERE target LIKE 'will:%' AND state IN ('queued','building') LIMIT 1").first();
  let queued = null;
  if (!open && will.wants[0]) {
    const w = will.wants[0]; const id = Date.now().toString(36);
    await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, w.title, 'will:' + slug(w.title), 'queued', 'Void chose this: ' + w.because, at, at).run();
    queued = id;
  }
  return Response.json({ ...will, queued, open: open ? open.id : null });
}
