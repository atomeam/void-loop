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

// Public card text: no domain names, no file paths, no camelCase or SCREAMING_CASE identifiers.
const PATH = /\b(?:[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]+\b/g;
const FILE = /\b[\w.-]+\.(?:js|mjs|cjs|ts|tsx|jsx|py|json|html|css|yml|yaml|md|sh)\b/gi;
const DOMAIN = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi;
const SCREAM = /\b[A-Z][A-Z0-9]*(_[A-Z0-9]+)+\b/g;
const CAMEL = /\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g;
const PASCAL = /\b[A-Z][a-z0-9]+[A-Z][a-zA-Z0-9]*\b/g;
const siteName = (d) => { const p = String(d).toLowerCase().split('.').filter((x) => x && x !== 'www'); return p[0] ? p[0].replace(/-/g, ' ') : 'that site'; };

export function plainPublic(text) {
  let s = String(text || '').replace(PATH, '').replace(FILE, '').replace(DOMAIN, siteName).replace(SCREAM, '').replace(CAMEL, '').replace(PASCAL, '');
  s = s.replace(/\s+/g, ' ').replace(/\s*([,;:])\s*/g, '$1 ');
  for (let i = 0; i < 4; i++) s = s.replace(/\b(in|to|into|on|at|of|for|from|with)\s+(in|to|into|on|at|of|and|for|from|with)\b/gi, '$2');
  s = s.replace(/\s+(in|to|into|on|at|of|from|with)\s*[.,;]?$/gi, '').replace(/,\s*,/g, ',').replace(/ \./g, '.').trim();
  return s;
}

/** one public sentence: capital letter, ends with a stop, no leftover quotes. Pure. */
export function asSentence(text) {
  let s = String(text || '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  s = s.replace(/^["']+|["']+$/g, '').replace(/\s+"/g, ' “').replace(/"/g, '”').trim();
  if (!s) return '';
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
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
  // keep this want's own remaining reason (not only a shared weak-spot line)
  let rest = raw.replace(/(?:the )?router came within [\d.]+ of my \S+ skill and answered it as a question instead/gi, '').replace(/(?:the )?router heard \S+:/gi, '').replace(/\(?asked \d+ times\)?/gi, '').replace(/\(my weakest part today:[^)]*\)/gi, '').replace(/my weakest part today:\s*\w+\s+[\d.]+/gi, '').replace(/\(\s*\)/g, '');
  rest = dropLogJargon(plainPublic(rest));
  if (rest && !/^[.,;:]+$/.test(rest)) { if (!/[.!?]$/.test(rest)) rest += '.'; bits.push(rest); }
  if (weak && WEAK[weak[1].toLowerCase()]) bits.push(WEAK[weak[1].toLowerCase()]);
  if (bits.length) return bits.join(' ').replace(/\s{2,}/g, ' ').trim();
  return dropLogJargon(plainPublic(raw.replace(/\(my weakest part today:[^)]*\)/gi, '').replace(/\brouter\b/gi, 'how I pick an answer').replace(/\bself skill\b/gi, 'my own answers').replace(/\bprobes\b/gi, 'my own checks')));
}

// Raw numbers and shop-talk from the internal log never appear on the public card.
const LOG_JARGON = /\bexam scored\b|\bthis ask failed\b|\bfailed audio\b|\bfailed show\b|\bready-checks family\b|\bautomation handoff\b|\bhardened itself\b|\b4\.5 s limit\b|\bOpen-Meteo\b|\bprobes \d+/i;
function dropLogJargon(s) {
  let t = String(s || '');
  t = t.replace(/\bthe \S+ exam scored [\d.]+(?:, the lowest)?/gi, '').replace(/\bthis ask failed[\w, ]*/gi, '').replace(/\bfailed (?:audio|show|episode)(?:,|:|\b)/gi, '');
  t = t.replace(/\bVerse hardened itself:\s*/gi, '').replace(/\bautomation handoff\b/gi, 'hand-off').replace(/:\s*every\b[^.]*\b4\.5 s limit\b[^.]*\.?/gi, '.').replace(/\b4\.5 s limit\b/gi, '');
  t = t.replace(/\bOpen-Meteo\b/gi, 'the forecast').replace(/\(my weakest part today:[^)]*\)/gi, '');
  t = t.replace(/\s+/g, ' ').replace(/\s*([,;:])\s*/g, '$1 ').replace(/^[.,;: ]+|[.,;: ]+$/g, '').replace(/ \./g, '.').trim();
  return LOG_JARGON.test(t) ? '' : t;
}

/** the current goal as one clear public sentence, written as what a visitor gains. Pure. */
export function visitorGoal(want) {
  let raw = String((want && (want.i_want || want.title)) || (typeof want === 'string' ? want : '') || '').trim();
  raw = plainPublic(raw);
  const quoted = raw.match(/^fix the \S+ exam:\s*["“](.+?)["”]\.?$/i) || raw.match(/^I want to fix the \S+ exam:\s*["“](.+?)["”]\.?$/i);
  if (quoted) return asSentence("I'm getting better at answering “" + quoted[1].trim().replace(/[.]+$/, '') + "” when you ask");
  if (/audio and show\/episode/i.test(raw) || /podcast exam failures/i.test(raw)) return asSentence("I'm making it easier to find a show, play the right episode, and hear the audio");
  const fail = raw.match(/(?:I want to )?fix the \S+ exam failures for (.+)/i);
  if (fail) return asSentence("I'm getting better at " + fail[1].replace(/\bdetection\b/gi, '').replace(/\s+/g, ' ').trim());
  const ans = raw.match(/(?:I want to )?answer ["“'](.+?)["”'] for a visitor/i);
  if (ans) return asSentence("I'm making sure I can answer “" + ans[1].trim() + "” when you ask");
  let s = raw.replace(/^I want to\s+/i, '');
  if (s && !/^I(?:'m| am)\b/i.test(s)) s = "I'm working on how to " + s.charAt(0).toLowerCase() + s.slice(1);
  return asSentence(s);
}

/** a public reason, or empty when the log line has no visitor meaning left. Pure. */
export function visitorReason(text) {
  const s = plainReason(text);
  return LOG_JARGON.test(s) ? '' : s;
}

const dayOf = (at) => {
  const t = Date.parse(at), d = isFinite(t) ? new Date(t) : (String(at || '').match(/^(\d{4})-(\d{2})-(\d{2})/) && new Date(Date.UTC(+RegExp.$1, +RegExp.$2 - 1, +RegExp.$3)));
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: isFinite(t) ? 'America/New_York' : 'UTC' }) : '';
};

// Internal-only built lines stay off the public card (housekeeping, ready-checks, coverage).
const INTERNAL_BUILT = /\bready-checks family\b|\bhouse:\s*coverage\b|\bskills\/order\b|\bcoverage \(#/i;

/** a complete public built title: no truncated "working,", no stray quotes, no internal-only lines. Pure. */
export function visitorBuilt(x) {
  if (!x) return '';
  let raw = String((typeof x === 'string' ? x : (x.show || x.what || x.i_want)) || '').trim();
  if (!raw) return '';
  if (INTERNAL_BUILT.test(raw)) return '';
  raw = raw.replace(/^I want to\s+/i, '').replace(/\.+$/, '').trim();
  raw = raw.replace(/^Verse hardened itself:\s*/i, '');
  raw = raw.replace(/^['‘](.+)['’]$/, '$1').replace(/^["“](.+)["”]$/, '$1');
  raw = raw.replace(/:\s*every\b[^.]*\b4\.5 s limit\b.*$/i, '').replace(/\b4\.5 s limit\b/gi, '').replace(/\bOpen-Meteo\b/gi, '');
  raw = raw.replace(/\bautomation handoff(?: for)?\b/gi, 'hand-off for');
  if (/what I['’]m working(?: on)?(?:,|\s+in plain words)/i.test(raw) || /what I['’]m working,/i.test(raw)) return asSentence("I can tell you what I'm working on, in plain words");
  raw = raw.split(/(?<=\.)\s+/)[0] || raw;
  raw = raw.replace(/\s*\([^)]*\)\s*$/, '').replace(/^[^:]{0,40}:\s+/, (m) => (/^[a-z0-9./_-]+:\s+/i.test(m) ? '' : m));
  raw = raw.replace(/\s+at \d{4,}\b.*/, '').replace(/\s+under \.[\w./-]+.*/, '');
  raw = dropLogJargon(plainPublic(raw));
  if (!raw || INTERNAL_BUILT.test(raw) || LOG_JARGON.test(raw)) return '';
  return asSentence(raw);
}

export function shortBuiltLine(x) { return visitorBuilt(x); }

const sameLine = (a, b) => String(a || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === String(b || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function recentBuilt({ got = [], ledger = [], recent = [] } = {}, limit = 5) {
  const rows = [];
  if (Array.isArray(recent) && recent.length) {
    for (const x of recent) {
      const what = visitorBuilt(x);
      if (what) rows.push({ at: x.at, what, href: x.href || x.ref || null, when: x.when || dayOf(x.at) });
    }
  } else {
    for (const x of Array.isArray(ledger) ? ledger : []) {
      if (!x || !x.what || !x.at) continue;
      if (!['build', 'grow', 'fix'].includes(x.kind)) continue;
      const what = visitorBuilt(x);
      if (what) rows.push({ at: x.at, what, href: x.ref || null });
    }
    for (const g of Array.isArray(got) ? got : []) {
      if (!g) continue;
      const at = g.builtAt ? (String(g.builtAt).length <= 10 ? String(g.builtAt).slice(0, 10) + 'T12:00:00Z' : String(g.builtAt)) : '';
      const what = visitorBuilt(g);
      if (what) rows.push({ at, what, href: g.ref || null });
    }
    rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }
  const out = [];
  for (const r of rows) {
    if (out.some((o) => sameLine(o.what, r.what))) continue;
    out.push({ at: r.at, when: r.when || dayOf(r.at), what: r.what, href: r.href });
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

/** a short, safe art subject for the current goal: objects in a scene, never a person, never words to paint. Pure. */
export function artSubjectOf(want) {
  const s = String((want && (want.i_want || want.title)) || (typeof want === 'string' ? want : '') || '');
  if (/podcast|episode|show\/episode|\baudio\b/i.test(s)) return 'podcast microphone on a wooden workbench';
  if (/joke|riddle|funny/i.test(s)) return 'a standing microphone under a warm spotlight';
  if (/weather|forecast/i.test(s)) return 'a window looking out on changing weather';
  if (/recipe|cook|food/i.test(s)) return 'a kitchen workbench with a simple meal';
  if (/joke|email|remind/i.test(s)) return 'a tidy desk with an envelope and a lamp';
  return 'a tidy wooden workbench with a current project';
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

const QUIET_CHROME = '<style data-will-quiet>.vcard:has(.will-goal) .vc-pt,.vcard:has(.will-goal) .vc-arrows,.vcard:has(.will-goal) .vc-num{display:none!important}</style>';
export function willCardHtml(will, esc = escDef, ledger) {
  const w = will || {};
  const wants = Array.isArray(w.wants) ? w.wants : [];
  const built = recentBuilt({ got: w.got, ledger, recent: w.recent }, 5);
  if (!wants.length && !built.length) {
    return '<h2>What I want to become</h2><p>I haven\'t decided yet. I look at everything that exists every few hours and choose.</p>';
  }
  const goals = wants.length
    ? '<div class="vh">What I want next</div><div class="will-list" style="padding:0;margin:6px 0 10px">' + wants.map((x, i) => {
      const reason = visitorReason(x.because || x.evidence || '');
      return '<div class="will-want" style="margin:0 0 14px;padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:10px"><p class="will-goal" style="margin:0;font-weight:600"><span class="will-n">' + (i + 1) + '. </span>' + esc(visitorGoal(x)) + '</p>'
        + (reason ? '<p class="will-why" style="color:#8a8a8a;margin:6px 0 0">' + esc(reason) + '</p>' : '') + '</div>';
    }).join('') + '</div>'
    : '<p>Everything I last chose is built. I choose again within the hour.</p>';
  return '<h2>What I want to become</h2><div class="sub">I choose this myself, from what people ask me and everything I\'m made of.</div>' + goals + builtBlock(built, esc) + '<div class="src">Source: my will' + chosenLine(w.at, esc) + '</div>' + QUIET_CHROME;
}

export function workingOnHtml(will, esc = escDef, ledger) {
  const w = will || {};
  const wants = Array.isArray(w.wants) ? w.wants : [];
  const built = recentBuilt({ got: w.got, ledger, recent: w.recent }, 5);
  const top = wants[0];
  const goal = top ? visitorGoal(top) : '';
  const body = goal
    ? '<p class="will-goal" style="margin:8px 0 0;font-weight:600">' + esc(goal) + '</p>'
    : '<p>I just finished what I was working on, or I have not picked the next thing yet. I choose again within the hour.</p>';
  return '<h2>What I\'m working on</h2>'
    + body
    + builtBlock(built, esc)
    + '<div class="src">Source: my will' + chosenLine(w.at, esc) + '</div>' + QUIET_CHROME;
}
