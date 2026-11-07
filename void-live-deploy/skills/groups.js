/**
 * groups skill - names into teams, and a secret santa draw, in the page (docs/GAPS.md rows 79 and 80, 2026-11-06: "random team generator"
 * and "secret santa draw" each gave an explanation). "random team generator", "split alice, bob, carol, dave into 2 teams",
 * "make 3 groups from: ...", "secret santa draw", "secret santa: ann, ben, cal". Teams: the names are shuffled (Fisher-Yates) and dealt
 * in turn, so team sizes differ by one at most. Tournament bracket (row 81, 2026-11-06: "tournament bracket" gave an article): names in, a
 * single elimination bracket out, byes to the next power of 2 spread through the first round, winners picked by pressing a name. Secret santa: every way to draw where nobody gets themselves is equally likely (shuffles
 * with someone on themselves are drawn again), and each pairing is shown one at a time. Nothing is kept or sent.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }. Tests: tools/gaps-batch3.test.mjs.
 */

const NUM = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const num = (w) => (w ? NUM[w] || +w : 0);

/** names from "a, b and c", one a line, or "a b c" with no commas: trimmed, blanks and repeats dropped, at most 200. Pure. */
export function namesOf(s) {
  const t = String(s || '').trim();
  if (!t) return [];
  const parts = /[\n,;]/.test(t) || /\s+and\s+/i.test(t) ? t.split(/\s*(?:[\n,;]|\band\b)\s*/i) : t.split(/\s+/);
  const out = [], seen = new Set();
  for (const p of parts) { const n = p.trim().replace(/^[-*•]\s*/, '').replace(/[.!?]+$/, ''); const k = n.toLowerCase(); if (n && !seen.has(k)) { seen.add(k); out.push(n); } }
  return out.slice(0, 200);
}

/** what an ask names: { kind: 'teams', count, names } or { kind: 'santa', names }, or null. Pure. */
export function groupsOf(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '');
  const t = raw.toLowerCase().replace(/\s+/g, ' ');
  if (!t || t.length > 600) return null;
  if (/^(?:what|why|how|who|when|where|is|are|does|do|history)\b|\b(?:ideas?|gifts?|rules|meaning|origin|budget|exchange ideas|bill|check|cost|screen|meeting|microsoft)\b/.test(t.replace(/:.*$/s, ''))) return null;
  const colon = raw.indexOf(':'), head = (colon > 0 ? t.slice(0, colon) : t).trim(), body = colon > 0 ? raw.slice(colon + 1) : '';
  const N = '(\\d{1,2}|two|three|four|five|six|seven|eight|nine|ten)';
  const pre = '^(?:please )?(?:(?:give me|make|do|run|open|start|use) )?(?:a |an |the )?(?:random |quick |free |online )?';
  if (new RegExp(pre + '(?:secret santa|kris kringle)(?: (?:draw|drawing|generator|picker|name picker|name draw|names?|maker|randomi[sz]er))?$').test(head)
    || /^draw names (?:for|out of a hat for) (?:a |the )?secret santa$/.test(head)) return { kind: 'santa', names: namesOf(body) };
  const br = bracketOf(raw, head, body, pre);
  if (br) return br;
  let m = head.match(new RegExp(pre + '(?:' + N + ' )?(?:teams?|groups?) (?:generator|maker|picker|randomi[sz]er|splitter|creator)(?: (?:for|of) ' + N + ')?$'));
  if (m) return { kind: 'teams', count: num(m[1] || m[2]) || 2, names: namesOf(body) };
  m = head.match(new RegExp(pre + '(?:pick|make|split(?: up)?|divide|sort) ' + N + ' (?:random )?(?:teams|groups)(?: (?:from|out of|with|for))?$'));
  if (m) return { kind: 'teams', count: num(m[1]), names: namesOf(body) };
  m = raw.match(new RegExp('^(?:please )?(?:split|divide|sort|put|break)(?: up)? (.+?) (?:into|in) ' + N + ' (?:random )?(?:teams|groups)$', 'i'));
  if (m && !/^(?:the|my|this|these|us|them|people|the class|the people)$/i.test(m[1].trim())) { const names = namesOf(m[1]); if (names.length >= 2) return { kind: 'teams', count: num(m[2].toLowerCase()), names }; }
  return null;
}

// "tournament bracket", "single elimination bracket", "bracket generator", "bracket for ann, ben, cal", "tournament bracket for 8 players".
// A bare "bracket" is not one, nor a named league's ("march madness bracket") or a tax bracket.
function bracketOf(raw, head, body, pre) {
  const m = head.match(new RegExp(pre + '(?:(single[- ]elimination|knockout|elimination) )?(tournament )?bracket( (?:generator|maker|creator|builder|picker|template))?$'));
  if (m && (m[1] || m[2] || m[3] || (/[\n,;]|\band\b/i.test(body) && namesOf(body).length >= 2))) return { kind: 'bracket', names: namesOf(body) };
  const f = raw.match(/^(?:please )?(?:(?:make|create|build|draw|do|set up|give me) )?(?:a |an |the )?(?:(?:single[- ]elimination|knockout) )?(?:tournament )?bracket (?:for|with|of|from):? (.+)$/i);
  if (!f || /^(?:the|my|our|this|march|ncaa|nfl|nba|nhl|mlb|world cup|playoffs?)\b/i.test(f[1].trim())) return null;
  const k = f[1].trim().match(/^(\d{1,2}) (players|people|names|teams)$/i);
  if (k) { const n = Math.max(2, Math.min(64, +k[1])), w = /teams/i.test(k[2]) ? 'Team ' : 'Player '; return { kind: 'bracket', names: Array.from({ length: n }, (_, i) => w + (i + 1)) }; }
  const names = namesOf(f[1]);
  return names.length >= 2 ? { kind: 'bracket', names } : null;
}

/** a copy of xs in random order (Fisher-Yates). Pure given rng. */
export function shuffled(xs, rng = Math.random) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** the names dealt into count teams in turn after a shuffle: sizes differ by one at most. Pure given rng. */
export function teams(names, count, rng = Math.random) {
  const k = Math.max(1, Math.min(count || 2, names.length || 1));
  const out = Array.from({ length: k }, () => []);
  shuffled(names, rng).forEach((n, i) => out[i % k].push(n));
  return out;
}

/** [giver, receiver] pairs where nobody gets themselves, each such draw equally likely; null for fewer than 2 names. Pure given rng. */
export function santa(names, rng = Math.random) {
  if (names.length < 2) return null;
  for (let tries = 0; tries < 1000; tries++) {
    const r = shuffled(names, rng);
    if (r.every((x, i) => x !== names[i])) return names.map((g, i) => [g, r[i]]);
  }
  return names.map((g, i) => [g, names[(i + 1) % names.length]]); // never reached in practice: about 1 shuffle in 3 has nobody on themselves
}

/** the first round of a single elimination bracket: [a, b] pairs after a shuffle, b null for a bye. The bracket is the next power of 2
 *  at or above the count, the byes spread across its halves and quarters, and no match is two byes. null for fewer than 2 names. Pure given rng. */
export function firstRound(names, rng = Math.random) {
  const ns = shuffled(names.slice(0, 64), rng);
  if (ns.length < 2) return null;
  let size = 2; while (size < ns.length) size *= 2;
  const half = size / 2, byes = size - ns.length, bits = Math.log2(half);
  // the byes go to the slots in bit-reversed order (0, half/2, half/4, ...), so they land in different halves and quarters
  const rev = (i) => { let r = 0; for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1); return r; };
  const isBye = new Set(Array.from({ length: half }, (_, i) => i).sort((x, y) => rev(x) - rev(y)).slice(0, byes));
  const out = []; let k = 0;
  for (let i = 0; i < half; i++) out.push(isBye.has(i) ? [ns[k++], null] : [ns[k++], ns[k++]]);
  return out;
}

/** every round from the first round and the picks ({ 'round-match': name }): match = { a, b, w }, '' for a place not yet known, b null for
 *  a bye (its a goes through). A pick counts only while it names one of the two in that match, so changing an early pick clears what
 *  hung on it. Pure. */
export function rounds(first, picks = {}) {
  const out = [];
  let cur = first.map(([a, b]) => ({ a, b }));
  for (let r = 0; cur.length; r++) {
    for (let i = 0; i < cur.length; i++) {
      const x = cur[i], p = picks[r + '-' + i];
      x.w = x.b === null ? x.a : x.a && x.b && (p === x.a || p === x.b) ? p : '';
    }
    out.push(cur);
    if (cur.length === 1) break;
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push({ a: cur[i].w, b: cur[i + 1].w });
    cur = next;
  }
  return out;
}

/** "Final", "Semifinals", "Quarterfinals", then "Round of 16" and so on, for round r of n. Pure. */
export const roundName = (r, n) => (n - r === 1 ? 'Final' : n - r === 2 ? 'Semifinals' : n - r === 3 ? 'Quarterfinals' : 'Round of ' + 2 ** (n - r));

const BTN = 'padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#e8e8e8;cursor:pointer;font:14px system-ui';
const BOX = 'width:100%;min-height:110px;box-sizing:border-box;font:15px/1.5 system-ui;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.05);color:inherit';

function run(text, api) {
  const g = groupsOf(text);
  if (!g) return 'none';
  const { showPage, esc } = api, isSanta = g.kind === 'santa', isBracket = g.kind === 'bracket';
  const el = showPage((p) => {
    p.innerHTML = '<h2>' + (isSanta ? 'Secret santa draw' : isBracket ? 'Tournament bracket' : 'Random teams') + '</h2>'
      + '<label style="display:block;margin:6px 0">Names, one a line or with commas<textarea class="gr-names" aria-label="Names" style="' + BOX + '">' + esc(g.names.join('\n')) + '</textarea></label>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0">'
      + (isSanta || isBracket ? '' : '<label>Teams <input class="gr-count" type="number" min="2" max="50" value="' + esc(String(g.count)) + '" aria-label="How many teams" style="width:4.5em;font:15px system-ui;padding:3px 6px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.05);color:inherit"></label>')
      + '<button type="button" class="gr-go" style="' + BTN + '">' + (isSanta ? 'Draw' : isBracket ? 'Make bracket' : 'Make teams') + '</button></div>'
      + '<p class="gr-say" aria-live="polite" style="min-height:1.4em;margin:6px 0"></p><div class="gr-out"></div>'
      + '<div class="src">' + (isSanta ? 'Drawn in your browser: nobody gets themselves, and every such draw is equally likely' : isBracket ? 'Seeded at random in your browser: single elimination, byes to the next power of 2 spread through round 1' : 'Shuffled in your browser and dealt in turn: team sizes differ by one at most') + ' · nothing is kept or sent</div>';
  });
  const $ = (c) => el && el.querySelector && el.querySelector(c);
  const box = $('.gr-names'), go = $('.gr-go'), say = $('.gr-say'), out = $('.gr-out'), countEl = $('.gr-count');
  if (!box || !go || !out) return 'groups';
  let bracketState = null;
  const paintBracket = () => {
    const rs = rounds(bracketState.first, bracketState.picks), n = rs.length, champ = rs[n - 1][0].w;
    const who = (x, r, i) => (x === null ? '<span style="color:#8a8a8a">bye</span>' : !x ? '<span style="color:#8a8a8a">to come</span>'
      : '<button type="button" class="gr-pick" data-k="' + r + '-' + i + '" data-n="' + esc(x) + '" aria-pressed="' + (rs[r][i].w === x) + '" style="' + BTN + ';padding:3px 10px;margin:2px 0;' + (rs[r][i].w === x ? 'background:rgba(255,255,255,.18);font-weight:600' : '') + '">' + esc(x) + '</button>');
    out.innerHTML = '<div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:6px">' + rs.map((ms, r) => '<div style="min-width:150px"><strong>' + roundName(r, n) + '</strong>'
      + ms.map((x, i) => '<div style="margin:8px 0;padding:6px 8px;border:1px solid rgba(255,255,255,.14);border-radius:10px">' + who(x.a, r, i) + '<div style="color:#8a8a8a;font-size:12px">vs</div>' + who(x.b, r, i) + '</div>').join('') + '</div>').join('') + '</div>'
      + (champ ? '<p style="font-size:18px;margin:8px 0"><strong>Champion: ' + esc(champ) + '</strong></p>' : '')
      + '<button type="button" class="gr-again" style="' + BTN + '">Seed again</button>';
    const again = out.querySelector && out.querySelector('.gr-again'); if (again) again.addEventListener('click', draw);
  };
  if (isBracket) out.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('.gr-pick');
    if (!b || !bracketState) return;
    bracketState.picks[b.dataset.k] = b.dataset.n;
    paintBracket();
  });
  const draw = () => {
    const names = namesOf(box.value);
    if (isBracket) {
      const first = firstRound(names);
      if (!first) { if (say) say.textContent = 'Write at least 2 names.'; out.innerHTML = ''; return; }
      bracketState = { first, picks: {} };
      const n = rounds(first).length, byes = first.filter(([, b]) => b === null).length;
      if (say) say.textContent = Math.min(names.length, 64) + ' names, ' + n + (n === 1 ? ' round' : ' rounds') + (byes ? ', ' + byes + (byes === 1 ? ' bye' : ' byes') : '') + '. Press a name to send it through.';
      paintBracket();
      return;
    }
    if (isSanta) {
      const pairs = santa(names);
      if (!pairs) { if (say) say.textContent = 'Write at least 2 names.'; out.innerHTML = ''; return; }
      if (say) say.textContent = names.length + ' names drawn. Hand the screen to each giver and press their name.';
      out.innerHTML = '<ul style="list-style:none;padding:0;margin:0">' + pairs.map(([gv], i) => '<li style="margin:6px 0">' + esc(gv) + ' gives to <button type="button" class="gr-reveal" data-i="' + i + '" style="' + BTN + '">Show</button></li>').join('') + '</ul>';
      if (out.querySelectorAll) for (const b of out.querySelectorAll('.gr-reveal')) b.addEventListener('click', () => { const pr = pairs[+b.dataset.i]; const s = document.createElement('strong'); s.textContent = pr[1]; b.replaceWith(s); });
      return;
    }
    const k = Math.max(2, Math.min(50, +(countEl && countEl.value) || g.count || 2));
    if (names.length < 2) { if (say) say.textContent = 'Write at least 2 names.'; out.innerHTML = ''; return; }
    const ts = teams(names, k);
    if (say) say.textContent = names.length + ' names in ' + ts.length + ' teams' + (ts.length < k ? ' (fewer names than teams)' : '') + '.';
    out.innerHTML = ts.map((t, i) => '<div style="margin:8px 0"><strong>Team ' + (i + 1) + '</strong> (' + t.length + '): ' + t.map(esc).join(', ') + '</div>').join('')
      + '<button type="button" class="gr-again" style="' + BTN + '">Shuffle again</button>';
    const again = out.querySelector && out.querySelector('.gr-again'); if (again) again.addEventListener('click', draw);
  };
  go.addEventListener('click', draw);
  if (g.names.length >= 2) draw(); else { try { box.focus(); } catch (_) {} }
  return 'groups';
}

export default {
  name: 'groups',
  examples: ['random team generator', 'split alice, bob, carol and dave into 2 teams', 'make 3 groups from: ann, ben, cal, dee, eve, fay', 'secret santa draw', 'secret santa: ann, ben, cal, dee', 'tournament bracket', 'bracket for ann, ben, cal, dee, eve'],
  nearMisses: ['what is secret santa', 'secret santa gift ideas', 'split the bill', 'microsoft teams meeting', 'split the class into 3 groups', 'team generator rules', 'what is a tournament bracket', 'march madness bracket', 'tax bracket calculator', 'bracket'],
  match(lower, text) { return !!groupsOf(text || lower); },
  run,
};
