/**
 * oracle skill - the glitch oracle (owner, 2026-10-18, the Opposite Era; made with tools/new-skill.mjs). "ask the glitch
 * oracle why is the sky blue" / "glitch oracle: what is rain" runs the question through the page's normal ask path (the same
 * card any question gets: a skill's answer or /api/answer) and then shows that answer corrupted: some words flicker, some are
 * blacked out, and a few are deliberately wrong (marked only by a data attribute, never visibly), with a "piece it together"
 * hint and one button that reveals the true answer. The corruption (corrupt, reveal, html) is pure, seeded by the question,
 * and reversible: reveal(corrupt(text)) is the text. Tested in tools/stage-pack-f.test.mjs. The oracle is a game, not a source.
 */
const CLEAN = (s) => String(s || '').trim().replace(/\s+/g, ' ');
/** the question for the oracle, or null. Pure. */
export function oracleOf(text) {
  const t = CLEAN(text);
  const m = /^(?:please\s+)?ask\s+the\s+glitch\s+oracle[:,]?\s+(.{2,300})$/i.exec(t) || /^(?:the\s+)?glitch\s+oracle\s*[:,]\s*(.{2,300})$/i.exec(t);
  return m ? m[1].trim() : null;
}

const WRONG = ['never', 'always', 'nobody', 'yesterday', 'purple', 'seven', 'silence', 'backwards', 'the moon', 'underwater', 'tomorrow', 'sideways', 'cold', 'upside down', 'an owl', 'twice'];
const seedOf = (s) => { let h = 2166136261; for (const c of String(s || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const mul = (seed) => { let a = seed || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** the answer as segments: { k: 'plain' | 'flicker' | 'redact' | 'wrong', s: the true text, w?: the wrong word shown }. The whitespace is
 *  kept in plain segments, so the pieces joined are the text. At least one of each corruption when the text has 6 words or more. Pure. */
export function corrupt(text, seed = seedOf(text)) {
  const r = mul(seed), parts = String(text || '').split(/(\s+)/), out = [];
  const words = parts.map((p, i) => ({ p, i })).filter((x) => x.i % 2 === 0 && x.p);
  const kinds = new Map();
  for (const { p, i } of words) {
    const alpha = /^[A-Za-z][A-Za-z'-]{2,}[.,;:!?]?$/.test(p), x = r();
    if (x < 0.14) kinds.set(i, 'flicker'); else if (x < 0.24) kinds.set(i, 'redact'); else if (x < 0.32 && alpha) kinds.set(i, 'wrong');
  }
  if (words.length >= 6) for (const k of ['flicker', 'redact', 'wrong']) if (![...kinds.values()].includes(k)) { // one of each at least, on a long word nobody picked
    const free = words.filter((x) => !kinds.has(x.i) && (k !== 'wrong' || /^[A-Za-z][A-Za-z'-]{2,}[.,;:!?]?$/.test(x.p))).sort((a, b) => b.p.length - a.p.length)[0];
    if (free) kinds.set(free.i, k);
  }
  parts.forEach((p, i) => {
    if (!p) return;
    const k = kinds.get(i);
    if (!k) { const last = out[out.length - 1]; if (last && last.k === 'plain') last.s += p; else out.push({ k: 'plain', s: p }); return; }
    if (k === 'wrong') { const tail = /[.,;:!?]$/.exec(p); out.push({ k, s: p, w: WRONG[Math.floor(r() * WRONG.length)] + (tail ? tail[0] : '') }); }
    else out.push({ k, s: p });
  });
  return out;
}
/** the true text back from its segments. Pure. */
export const reveal = (segs) => (segs || []).map((x) => x.s).join('');
/** the corrupted answer as HTML: flickers in .gl-flicker, blocks in .gl-redact, wrong words in a span whose only mark is data-o="w". Pure given esc. */
export function html(segs, esc) {
  return (segs || []).map((x) => {
    if (x.k === 'flicker') return '<span class="gl-flicker" data-len="' + x.s.length + '">' + esc(x.s) + '</span>';
    if (x.k === 'redact') return '<span class="gl-redact" aria-label="redacted">' + '█'.repeat(Math.max(2, Math.min(12, x.s.length))) + '</span>';
    if (x.k === 'wrong') return '<span data-o="w">' + esc(x.w) + '</span>';
    return esc(x.s);
  }).join('');
}
/** how many pieces are corrupted: { flicker, redact, wrong }. Pure. */
export const countOf = (segs) => (segs || []).reduce((c, x) => { if (x.k !== 'plain') c[x.k] = (c[x.k] || 0) + 1; return c; }, { flicker: 0, redact: 0, wrong: 0 });

const GLYPHS = '!<>-_\\/[]{}=+*^?#%&@$0123456789';
/** the open card for a question, once it has stopped changing: { title, body } or null (no card within `ms`). Browser only. */
async function settle(ms = 12000) {
  const wait = (t) => new Promise((r) => setTimeout(r, t));
  let last = '', same = 0;
  for (let t = 0; t < ms; t += 300) {
    await wait(300);
    const el = document.querySelector('.vpage');
    if (!el) { if (t > 2500) return null; continue; }
    const text = el.innerText || '';
    if (/thinking…|looking up/.test(text)) { same = 0; last = text; continue; }
    if (text === last) { if (++same >= 2) { const m = await import('../lib/card-share.js'); const d = m.readCard(el); return { title: d.t || '', body: d.b || text.trim() }; } }
    else { same = 0; last = text; }
  }
  return null;
}

async function run(text, api) {
  const q = oracleOf(text);
  if (!q) return 'none';
  api.say('the oracle is listening');
  const asked = api.stage && typeof api.stage.ask === 'function' ? api.stage.ask(q) : null;
  try { await asked; } catch (_) { /* the ask path said what it had to */ }
  const got = await settle();
  if (!got || !got.body) { api.say('the oracle answers questions: ask the glitch oracle why is the sky blue'); return 'oracle'; }
  const segs = corrupt(got.body, seedOf(q)), n = countOf(segs);
  const { showPage, esc } = api;
  const el = showPage((p) => {
    p.innerHTML = '<h2>The glitch oracle</h2><div class="sub">asked: ' + esc(q) + '</div><p class="gl-body" style="line-height:1.7;font-family:ui-monospace,monospace">' + html(segs, esc) + '</p>'
      + '<p class="sub gl-hint">piece it together: ' + n.flicker + ' word' + (n.flicker === 1 ? '' : 's') + ' flicker, ' + n.redact + (n.redact === 1 ? ' is' : ' are') + ' blacked out, and ' + n.wrong + (n.wrong === 1 ? ' is' : ' are') + ' wrong</p>'
      + '<button type="button" class="gl-reveal g-btn" style="font:inherit;font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:inherit;cursor:pointer">reveal the true answer</button>'
      + '<div class="src">the answer came through the normal ask path (' + esc(got.title || q) + '); the glitches were added on this device · the oracle is a game, not a source</div>';
  });
  el.dataset.oracle = 'glitched';
  const flick = setInterval(() => {
    if (!el.isConnected) { clearInterval(flick); return; }
    el.querySelectorAll('.gl-flicker').forEach((s) => { const n = +s.dataset.len || 3; let out = ''; for (let i = 0; i < n; i++) out += Math.random() < 0.5 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ' '; s.textContent = out; });
  }, 120);
  const b = el.querySelector('.gl-reveal');
  b.addEventListener('click', (e) => {
    e.stopPropagation(); clearInterval(flick);
    const body = el.querySelector('.gl-body'); if (body) { body.textContent = reveal(segs); body.style.fontFamily = ''; }
    const hint = el.querySelector('.gl-hint'); if (hint) hint.textContent = 'the true answer, unglitched';
    b.remove(); el.dataset.oracle = 'revealed';
  });
  api.say('');
  return 'oracle';
}

export default {
  name: 'oracle',
  examples: ['ask the glitch oracle why is the sky blue', 'glitch oracle: what is rain', 'ask the glitch oracle, how far is the moon'],
  nearMisses: ['oracle database', 'the oracle of delphi', 'ask the oracle', 'glitch in the matrix', 'oracle cloud pricing'],
  match(lower, text) { return !!oracleOf(text); },
  run
};
