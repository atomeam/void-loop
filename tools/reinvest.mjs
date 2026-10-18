// Verse reinvests its own money, daily (.github/workflows/reinvest.yml; Adam, 2026-10-15). Reads net earnings (after refunds)
// from the owner-only GET /api/earnings, in memory only; splits them with lib/reinvest.js (20% reserve, free paths first, then
// ROI per dollar, re-ranked by payoff tests and Verse's own answer in docs/void-voice.md); sends each newly funded item to the
// confirm line (POST /api/approval, order.place) with cost, expected payback, check date and the payoff test's baseline; and,
// once a proposal's check date passes, compares its metric with that baseline and learns only from that.
// The repo is public: nothing here writes income, balances or spend amounts. docs/reinvest.md shows only the hypothetical $100.
// Nothing is bought here: Verse holds no card and opens no account; Adam buys an approved item in his own existing account.
//   node tools/reinvest.mjs          run (talks to the site only when VOID_OWNER_TOKEN is set; otherwise re-plans the $100)
//   node tools/reinvest.mjs --dry    print the plan; nothing sent or written
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allocate, learn, readVoice, readWishlist, withWishlist, toApproval, payoff } from '../void-live-deploy/lib/reinvest.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = (f) => resolve(root, f);
export const FIRST_100_ASK = 'If you earned your first $100, how would you reinvest it?';

/** the newest answer in docs/void-voice.md to a question that mentions reinvesting, as plain text ('' when none). Pure. */
export function voiceAnswer(md) {
  const blocks = String(md || '').split(/\n(?=<!-- ask-void:)/).filter((b) => /\*\*Asked:\*\*[^\n]*reinvest/i.test(b));
  const b = blocks[blocks.length - 1];
  return b ? b.split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^> ?/, '')).join('\n').trim() : '';
}

const usd = (c) => '$' + (c / 100).toFixed(2).replace(/\.00$/, '');
/** the plan as markdown, between the markers in docs/reinvest.md. Pure. */
export function planMd(plan, voice) {
  const p = plan.first_100, row = (x) => `| ${x.item} | ${usd(x.cost_cents)} | ${x.status} | ${x.why} | ${x.expected} |`;
  return [`_As of ${plan.at.slice(0, 10)}. Rewritten daily by tools/reinvest.mjs._`, '',
    `**The first $100:** keep ${usd(p.reserve_cents)} in reserve; do every free path first (below); fund ${p.funded.length} item${p.funded.length === 1 ? '' : 's'} for ${usd(p.funded.reduce((n, x) => n + x.cost_cents, 0))}; hold ${usd(p.held_cents)} for the next item that becomes worth buying (re-ranked daily).`, '',
    '| Spend proposal | Cost | Status | Why | Expected return |', '| --- | --- | --- | --- | --- |', ...p.funded.map(row), '',
    '**Free first ($0, built before anything is bought):**', '', ...p.free.map((f) => `- ${f.item}`), '',
    `**Verse's own answer as input** (weight ${voice.weight}): it named ${Object.entries(voice.shares).filter(([, s]) => s).map(([k, s]) => k + ' ' + Math.round(s * 100) + '%').join(', ') || 'nothing yet'} among the kinds it can fund; the reserve it asked for is ${Math.round(voice.reserve * 100)}% (the floor is 20%).`
      + (voice.unmapped.length ? ' Not fundable: ' + voice.unmapped.map((u) => `${usd(u.amount * 100)} for "${u.text}"`).join('; ') + ' (Verse holds no brokerage or bank account and none is opened for it; that share stays in the held fund).' : ''),
    '', `**Learned so far** (outcome multipliers, 1 = no evidence yet): ${Object.entries(plan.learned).map(([k, v]) => k + ' ' + v).join(', ')}.`].join('\n');
}

/** the payoff metrics, read now from owner-only endpoints (null when unknown: nothing learned from it). */
export async function measure(metric, get) {
  if (metric === 'sales') { const e = await get('/api/earnings'); return e && typeof e.sales === 'number' ? e.sales : null; }
  if (metric === 'misses') { const m = await get('/api/misses'); const l = m && (Array.isArray(m) ? m : m.misses); return Array.isArray(l) ? l.length : null; }
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry'), now = new Date().toISOString(), today = now.slice(0, 10);
  const L = JSON.parse(readFileSync(P('domains/void.reinvest.json'), 'utf8'));
  const token = process.env.VOID_OWNER_TOKEN, site = process.env.VOID_SITE || 'https://a-to-mind.com';
  const auth = { authorization: 'Bearer ' + token };
  const get = async (u) => { try { const r = await fetch(site + u, { headers: auth, signal: AbortSignal.timeout(30000) }); return r.ok ? await r.json() : null; } catch (_) { return null; } };
  const v = readVoice(voiceAnswer(existsSync(P('docs/void-voice.md')) ? readFileSync(P('docs/void-voice.md'), 'utf8') : ''));
  const wish = readWishlist(existsSync(P('docs/wishlist.md')) ? readFileSync(P('docs/wishlist.md'), 'utf8') : '');
  const cands = withWishlist(L.candidates, wish);
  if (token && !dry) {
    // 1. payoff tests that are due: the approval record holds the baseline; learn only from that comparison
    for (const p of L.proposed) {
      if (p.checked || !p.approvalId || today < p.check_by) continue;
      const rec = await get('/api/approval?id=' + encodeURIComponent(p.approvalId));
      const test = rec && (rec.argsSnapshot || (rec.record && rec.record.argsSnapshot) || {}).test;
      const c = L.candidates.find((x) => x.id === p.id);
      const o = test ? payoff(test, await measure(test.metric, get), today) : null;
      if (o && c) { L.learned = learn(L.learned, { kind: c.kind, ...o }); p.checked = today; p.result = o.after >= o.before ? 'moved' : 'did not move'; }
    }
    // 2. new money: net earnings minus what earlier proposals already claimed, in memory only
    const e = await get('/api/earnings');
    if (e && typeof e.earned_cents === 'number') {
      const claimed = L.proposed.reduce((n, p) => { const c = L.candidates.find((x) => x.id === p.id); return n + (c ? (c.cost_cents || 0) * (c.monthly ? 3 : 1) : 0); }, 0);
      const fresh = Math.max(0, e.earned_cents - claimed);
      const a = allocate(fresh, cands.filter((c) => !L.proposed.some((p) => p.id === c.id && !p.checked)), { learned: L.learned, voice: v.voice, reserve: v.reserve, owned: L.owned_accounts });
      for (const f of a.funded) {
        const req = toApproval(f, { baseline: f.metric ? await measure(f.metric, get) : null });
        try {
          const r = await fetch(site + '/api/approval', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'a2m.approval.requested', workflowId: 'void.reinvest', ...req }), signal: AbortSignal.timeout(30000) }); // void-review: ok (a few HTTP calls, one per due proposal; no database here)
          const j = r.ok ? await r.json() : null, id = j && (j.approvalId || (j.approval && j.approval.approvalId));
          if (id) L.proposed.push({ id: f.id, approvalId: id, at: today, check_by: req.args.by, status: f.status });
          else console.log('confirm line refused ' + f.id + ' (' + r.status + ')');
        } catch (_) { console.log('confirm line unreachable for ' + f.id); }
      }
      console.log(`reinvest: ${a.funded.length} proposal(s) sent to the confirm line; amounts stay owner-only`);
    } else console.log('reinvest: earnings unavailable; nothing proposed');
  }
  L.plan = { at: now, wishlist_rows: wish.length, learned: L.learned, voice: { weight: 0.3, ...v }, first_100: allocate(10000, cands, { learned: L.learned, voice: v.voice, reserve: v.reserve, owned: L.owned_accounts }) };
  const md = planMd(L.plan, L.plan.voice);
  if (dry) { console.log(md); process.exit(0); }
  writeFileSync(P('domains/void.reinvest.json'), JSON.stringify(L, null, 2) + '\n');
  const doc = readFileSync(P('docs/reinvest.md'), 'utf8');
  writeFileSync(P('docs/reinvest.md'), doc.replace(/<!-- plan -->[\s\S]*<!-- \/plan -->/, '<!-- plan -->\n' + md + '\n<!-- /plan -->'));
  console.log(md);
}
