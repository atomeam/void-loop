// Public will / working-on cards: plain words, one number per goal, no raw Why items or internal metrics. Pure.
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();

const WORKING_ON = /^(?:(?:so|hey|ok(?:ay)?),?\s+)?(?:(?:please|can you|could you|tell me|show me|show|say)\s+)?(?:what(?:'s| is) (?:you|verse|void) working on|what (?:are|is) (?:you|verse|void) (?:(?:currently|now|right now|today) )?(?:working on|building(?: now| today)?|doing(?: now| today)?|up to(?: right now| now| today)?)|what you are (?:(?:currently|now|right now|today) )?(?:working on|building|doing(?: now| today)?)|what are you up to(?: right now| now| today)?)$/;

export function workingOnAsk(text) {
  const t = CLEAN(text);
  if (!t) return false;
  if (/^what(?:'s| is)? (?:new|happening) with (?:you|verse|void)$/.test(t)) return false; // the growth card
  if (/^what (?:are|is) (?:you|verse|void) (?:becoming|going to be|meant to be)$/.test(t)) return false; // the will / identity cards
  return WORKING_ON.test(t);
}

const WEAK = {
  probes: 'One of my weak spots today is turning my own checks into real fixes.',
  bench: 'One of my weak spots today is my everyday test score.', asks: 'One of my weak spots today is how slowly I get to my own asks.',
  friction: 'One of my weak spots today is skills that keep failing or barely get checked.',
  self: 'One of my weak spots today is that I am not driving enough of my own changes.',
};

export function hasJargon(text) {
  return /\b(router|self skill|probes\s+\d+|came within\s+[\d.]+|weakest part today)\b/i.test(String(text || ''));
}

export function plainReason(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const bits = [];
  const near = /(?:the )?router came within [\d.]+ of my \S+ skill and answered it as a question instead/i.test(raw);
  const heard = /(?:the )?router heard \S+:/i.test(raw);
  const asked = raw.match(/asked (\d+) times/i);
  const weak = raw.match(/my weakest part today:\s*(\w+)\s+[\d.]+/i);
  if (near) bits.push('I almost knew this was something I should handle myself, but I treated it like a regular question instead.');
  else if (heard) bits.push('I heard this as something I should handle myself, but I did not catch this wording.');
  if (asked) bits.push(+asked[1] === 1 ? 'Someone asked me this once.' : 'People have asked me this ' + asked[1] + ' times.');
  if (weak && WEAK[weak[1].toLowerCase()]) bits.push(WEAK[weak[1].toLowerCase()]);
  if (bits.length) return bits.join(' ');
  return raw.replace(/\(my weakest part today:[^)]*\)/gi, '').replace(/\brouter\b/gi, 'how I pick an answer').replace(/\bself skill\b/gi, 'my own answers').replace(/\bprobes\b/gi, 'my own checks').replace(/\s{2,}/g, ' ').trim();
}

const dayOf = (at) => {
  const t = Date.parse(at), d = isFinite(t) ? new Date(t) : (String(at || '').match(/^(\d{4})-(\d{2})-(\d{2})/) && new Date(Date.UTC(+RegExp.$1, +RegExp.$2 - 1, +RegExp.$3)));
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: isFinite(t) ? 'America/New_York' : 'UTC' }) : '';
};

export function shortBuiltLine(x) {
  if (!x) return '';
  if (x.show && String(x.show).trim()) return String(x.show).trim();
  let raw = String(x.what || x.i_want || '').replace(/^I want to\s+/i, '').replace(/\.+$/, '').trim();
  if (!raw) return '';
  raw = raw.split(/(?<=\.)\s+/)[0] || raw;
  raw = raw.replace(/\s*\([^)]*\)\s*$/, '').replace(/^[^:]{0,40}:\s+/, (m) => (/^[a-z0-9./_-]+:\s+/i.test(m) ? '' : m));
  raw = raw.replace(/\s+at \d{4,}\b.*/, '').replace(/\s+under \.[\w./-]+.*/, '');
  if (raw.includes(',') && raw.split(',')[0].trim().length >= 40) raw = raw.split(',')[0].trim();
  if (raw.length > 90) raw = raw.slice(0, 89).replace(/\s+\S*$/, '').replace(/[.,;:]+$/, '') + '…';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const sameLine = (a, b) => String(a || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === String(b || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function recentBuilt({ got = [], ledger = [], recent = [] } = {}, limit = 5) {
  if (Array.isArray(recent) && recent.length) {
    return recent.slice(0, limit).map((x) => ({ at: x.at, when: x.when || dayOf(x.at), what: x.what || shortBuiltLine(x), href: x.href || x.ref || null }));
  }
  const rows = [];
  for (const x of Array.isArray(ledger) ? ledger : []) {
    if (!x || !x.what || !x.at) continue;
    if (!['build', 'grow', 'fix'].includes(x.kind)) continue;
    const what = shortBuiltLine(x);
    if (what) rows.push({ at: x.at, what, href: x.ref || null });
  }
  for (const g of Array.isArray(got) ? got : []) {
    if (!g) continue;
    const at = g.builtAt ? (String(g.builtAt).length <= 10 ? String(g.builtAt).slice(0, 10) + 'T12:00:00Z' : String(g.builtAt)) : '';
    const what = shortBuiltLine(g);
    if (what) rows.push({ at, what, href: g.ref || null });
  }
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const out = [];
  for (const r of rows) {
    if (out.some((o) => sameLine(o.what, r.what))) continue;
    out.push({ at: r.at, when: dayOf(r.at), what: r.what, href: r.href });
    if (out.length >= limit) break;
  }
  return out;
}

export function freshWants(chosen, candidates, ledger, links = [], n = 3, split = null) {
  const pick = Array.isArray(chosen) ? chosen.slice() : [];
  const splitFn = split || ((wants, led, ln) => ({ open: wants, got: [] }));
  const s = splitFn(pick, ledger, links);
  const open = (s && s.open) || [];
  const got = (s && s.got) || [];
  const used = new Set([...open, ...got].map((w) => String((w && (w.title || w.i_want)) || '').toLowerCase()));
  const cands = Array.isArray(candidates) ? candidates : [];
  for (const c of cands) {
    if (open.length >= n) break;
    const title = String((c && c.title) || '');
    if (!title || used.has(title.toLowerCase())) continue;
    const probe = { title, i_want: c.i_want || ('I want to ' + title.replace(/^./, (x) => x.toLowerCase()) + '.') };
    if ((splitFn([probe], ledger, links).got || []).length) continue;
    open.push({
      kind: c.kind || '',
      title,
      ...(c.source ? { source: c.source } : {}),
      i_want: probe.i_want,
      because: c.because || c.why || '',
      evidence: c.why || c.because || '',
    });
    used.add(title.toLowerCase());
  }
  return { wants: open.slice(0, n), got };
}

const escDef = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function builtBlock(items, esc, moreHref = '/log/') {
  if (!items.length) return '';
  const rows = items.map((x) => '<li class="will-done" style="margin:0 0 8px;color:#9aa">' + (x.when ? '<span style="color:#aab">' + esc(x.when) + ' — </span>' : '') + esc(x.what) + '</li>').join('');
  return '<div class="vh">Already built</div><ul class="will-got" style="list-style:none;padding:0;margin:6px 0 4px">' + rows + '</ul><p class="sub" style="margin:0 0 8px"><a href="' + esc(moreHref) + '">See more of what I\'ve built</a></p>';
}

function chosenLine(at, esc) {
  const t = at && new Date(at);
  return t && !isNaN(+t) ? ' · chosen ' + esc(t.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET') : '';
}

export function willCardHtml(will, esc = escDef, ledger) {
  const w = will || {};
  const wants = Array.isArray(w.wants) ? w.wants : [];
  const built = recentBuilt({ got: w.got, ledger, recent: w.recent }, 5);
  if (!wants.length && !built.length) {
    return '<h2>What I want to become</h2><p>I haven\'t decided yet. I look at everything that exists every few hours and choose.</p>';
  }
  const goals = wants.length
    ? '<div class="vh">What I want next</div><div class="will-list" style="padding:0;margin:6px 0 10px">' + wants.map((x, i) => {
      const reason = plainReason(x.because || x.evidence || '');
      return '<div class="will-want" style="margin:0 0 14px;padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:10px"><p class="will-goal" style="margin:0;font-weight:600"><span class="will-n">' + (i + 1) + '. </span>' + esc(x.i_want || x.title || '') + '</p>'
        + (reason ? '<p class="will-why" style="color:#8a8a8a;margin:6px 0 0">' + esc(reason) + '</p>' : '') + '</div>';
    }).join('') + '</div>'
    : '<p>Everything I last chose is built. I choose again within the hour.</p>';
  return '<h2>What I want to become</h2><div class="sub">I choose this myself, from what people ask me and everything I\'m made of.</div>' + goals + builtBlock(built, esc) + '<div class="src">Source: my will' + chosenLine(w.at, esc) + '</div>';
}

export function workingOnHtml(will, esc = escDef, ledger) {
  const w = will || {};
  const wants = Array.isArray(w.wants) ? w.wants : [];
  const built = recentBuilt({ got: w.got, ledger, recent: w.recent }, 5);
  const top = wants[0], reason = top && plainReason(top.because || top.evidence || '');
  const body = top
    ? '<p class="will-goal" style="margin:8px 0 0;font-weight:600">' + esc(top.i_want || top.title || '') + '</p>' + (reason ? '<p class="will-why" style="color:#8a8a8a;margin:6px 0 0">' + esc(reason) + '</p>' : '')
    : '<p>I just finished what I was working on, or I have not picked the next thing yet. I choose again within the hour.</p>';
  return '<h2>What I\'m working on</h2><div class="sub">This is what I am doing now, from my own records, not a guess.</div>'
    + body
    + builtBlock(built, esc)
    + '<div class="src">Source: my will' + chosenLine(w.at, esc) + '</div>';
}
