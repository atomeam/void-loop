/**
 * grades skill - GPA from your grades, the score you need on a final, cumulative GPA, and a percent as a letter grade (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "what is my gpa A B B+ A-", "gpa with A 4 credits, B+ 3 credits, C 3 credits", "weighted gpa A in AP, B+ honors, A-",
 * "what's my gpa if i got 3 A's and 2 B's", "gpa calculator", "i have an 85 and my final is worth 20% what do i need to get a 90",
 * "what grade do i need on my final", "my gpa is 3.2 with 60 credits and i got a 3.8 this semester with 15 credits",
 * "what gpa do i need next semester with 15 credits to raise my 3.2 with 60 credits to 3.4", "what letter grade is an 87".
 * Built the way the most-used tools do it (the credit-weighted GPA of the big GPA calculators, RogerHub's final-grade
 * formula) and better than them: one plain ask instead of a form, letters, percents, credits and AP/honors in any mix,
 * every answer shows its working, and the scale it used is on the card.
 */
// College Board's 4.0 conversion (BigFuture, "How to Convert Your GPA to a 4.0 Scale"); D- is the usual 0.7 where schools use it
const SCALE = [
  { l: 'A+', p: 4.0, lo: 97 }, { l: 'A', p: 4.0, lo: 93 }, { l: 'A-', p: 3.7, lo: 90 },
  { l: 'B+', p: 3.3, lo: 87 }, { l: 'B', p: 3.0, lo: 83 }, { l: 'B-', p: 2.7, lo: 80 },
  { l: 'C+', p: 2.3, lo: 77 }, { l: 'C', p: 2.0, lo: 73 }, { l: 'C-', p: 1.7, lo: 70 },
  { l: 'D+', p: 1.3, lo: 67 }, { l: 'D', p: 1.0, lo: 65 }, { l: 'F', p: 0, lo: 0 }
];
const POINTS = { 'A+': 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7, 'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0, E: 0 };
const BONUS = { ap: 1, ib: 1, 'dual enrollment': 1, honors: 0.5 }; // the common high-school weighting (a 5.0 scale for AP/IB)
const letterOf = (pct) => (SCALE.find((s) => pct >= s.lo) || SCALE[SCALE.length - 1]);
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);
const pctTxt = (n) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '') + '%';
// a letter target counts as its lowest grade: "an A" = 90 (A- or better), "a B" = 80; "an A+" = 97, "a B+" = 87
const TARGET = { 'A+': 97, A: 90, 'A-': 90, 'B+': 87, B: 80, 'B-': 80, 'C+': 77, C: 70, 'C-': 70, 'D+': 67, D: 65, 'D-': 60 };

const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const GPA_WORD = /\b(?:gpa|g\.p\.a\.?|grade\s+point\s+average)\b/;
const OFF = /\b(?:define|definition|meaning|mean|stand\s+for|stands\s+for|translate|spell|synonym|song|lyrics|movie|essay|harvard|stanford|yale|mit|princeton|ivy|admission|admissions|scholarships?|get\s+into|good|bad|average|national|typical|median|remind|reminder|alarm|calendar|schedule|study\s+plan|when\s+is\s+my\s+final|out\s+of)\b/;

function norm(text) {
  return String(text || '').replace(/[\u2018\u2019]/g, "'").replace(/[\u2013\u2014]/g, '-').replace(/[?!]+$/, '').replace(/\.$/, '').replace(/\s+/g, ' ').trim();
}

// ---- a list of grades: "A B B+ A-", "A 4 credits, B+ 3 credits", "A in AP, B honors", "3 A's and 2 B's", "93 88 79"
function coursesOf(raw) {
  let s = raw.replace(GPA_WORD, ' ').replace(/\b([abcdfABCDF])\s+(plus|minus)\b/g, (m, g, pm) => g + (/^p/i.test(pm) ? '+' : '-'));
  // counts: "3 A's and 2 B's" -> A A A B B
  s = s.replace(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+([abcdfABCDF][+-]?)(?:'s|s)(?![a-z])/gi, (m, n, g) => {
    const k = WORDNUM[n.toLowerCase()] || +n; return k > 0 && k <= 20 ? Array(k).fill(g.toUpperCase()).join(' ') : m; });
  const upper = /(?:^|[\s,(])[ABCDF][+-]?(?=$|[\s,);])/.test(s);
  const toks = s.replace(/([,;()&/])/g, ' $1 ').replace(/\b(credits?|credit\s+hours?|units?|hours?|hrs?|cr|ch)\b/gi, ' credits ').split(/\s+/).filter(Boolean);
  const out = []; let pendC = null, pendTag = null, last = null, lastWasGrade = false;
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i], lo = tk.toLowerCase(), next = (toks[i + 1] || '').toLowerCase(), prev = (toks[i - 1] || '').toLowerCase();
    let g = null;
    const lm = tk.match(/^([abcdfeABCDFE])([+-]?)$/);
    if (lm) {
      const L = lm[1].toUpperCase() + lm[2];
      if (lm[1] === 'e' || lm[1] === 'E') g = null; // "e" is rarely a grade in a typed ask
      else if (upper) g = /[A-Z]/.test(lm[1]) ? L : null; // with capitals in the ask, a lowercase "a" is the article
      else if (lo === 'a' && /^(?:and|with|got|get|had|have|earned|plus|also|made|receive|received)$/.test(prev) && /^[abcdf][+-]?$/.test(next)) g = null; // "and a b" = article
      else g = L;
    }
    if (g) {
      if (g === 'D-' || POINTS[g] !== undefined) { last = { grade: g, credits: pendC, tag: pendTag }; out.push(last); pendC = null; pendTag = null; lastWasGrade = true; continue; }
    }
    const nm = tk.match(/^(\d{1,3}(?:\.\d+)?)%?$/);
    if (nm) {
      const v = +nm[1];
      if (next === 'credits' || (v <= 6 && lastWasGrade && last && last.credits == null && !/%$/.test(tk))) {
        if (v <= 0 || v > 12) return null;
        if (last && last.credits == null && (lastWasGrade || next === 'credits') && !(pendC != null)) {
          // "A 4 credits" / "A 4": the course just named; "4 credits A": the next one
          if (lastWasGrade) last.credits = v; else pendC = v;
        } else pendC = v;
        lastWasGrade = false; continue;
      }
      if (v >= 10 && v <= 100) { last = { pct: v, grade: letterOf(v).l, credits: pendC, tag: pendTag }; out.push(last); pendC = null; pendTag = null; lastWasGrade = true; continue; }
      if (v < 10) return null; // grade points or an odd number: not this list
      continue;
    }
    const tag = /^(?:ap|ib)$/.test(lo) ? lo : /^(?:honors|honours|hon|h)$/.test(lo) ? 'honors' : lo === 'dual' ? 'dual enrollment' : null;
    if (tag) {
      if (last && !last.tag && (lastWasGrade || /^(?:in|an?)$/.test(prev))) last.tag = tag; else pendTag = tag;
      continue;
    }
    if (lo === 'credits' || /^(?:in|an?|class|course|the|for|with|and|,|;|\(|\)|&|\/|x|\*|-)$/.test(lo)) { if (lo !== 'credits' && !/^(?:in|an?|the)$/.test(lo)) lastWasGrade = false; continue; }
    lastWasGrade = false;
  }
  return out.length ? out : null;
}

function gpaOf(courses) {
  let qp = 0, wqp = 0, cr = 0, anyTag = false, anyCredits = false;
  for (const c of courses) {
    const k = c.credits == null ? 1 : c.credits; if (c.credits != null) anyCredits = true;
    const p = POINTS[c.grade]; const b = c.tag ? BONUS[c.tag] || 0 : 0; if (b) anyTag = true;
    qp += p * k; wqp += (p > 0 ? p + b : 0) * k; cr += k;
  }
  return { gpa: qp / cr, weighted: wqp / cr, credits: cr, points: qp, anyTag, anyCredits };
}

// ---- the score a final needs (RogerHub's formula): needed = (target - current x (1 - w)) / w
function neededOf(current, weight, target) { const w = weight / 100; return (target - current * (1 - w)) / w; }
function targetOf(s) {
  if (!s) return null;
  const m = s.match(/^(\d{1,3}(?:\.\d+)?)\s*%?$/); if (m) return +m[1] <= 100 ? { pct: +m[1], said: pctTxt(+m[1]) } : null;
  const L = s.toUpperCase().replace(/\s*PLUS$/, '+').replace(/\s*MINUS$/, '-');
  return TARGET[L] != null ? { pct: TARGET[L], said: (/^[AEIOF]/.test(L) ? 'an ' : 'a ') + L, letter: L } : null;
}

function gradesOf(text) {
  const raw = norm(text); const t = raw.toLowerCase();
  if (!t || t.length > 400) return null;
  let m;
  // forms
  if (/^(?:(?:open|show(?:\s+me)?|give\s+me|i\s+need|use)\s+)?(?:an?\s+|the\s+|my\s+)?(?:(?:weighted|unweighted|college|high\s+school|cumulative|semester|term|final)\s+)*(?:gpa|grade\s+point\s+average)\s+calc(?:ulator)?$/.test(t)
    || /^(?:help\s+me\s+)?(?:calculate|work\s+out|figure\s+out|compute)\s+my\s+(?:(?:weighted|unweighted|college|high\s+school|semester)\s+)?gpa$/.test(t)
    || /^what(?:'s|\s+is)\s+my\s+(?:(?:weighted|unweighted|semester|college|high\s+school)\s+)?gpa$/.test(t)) return { kind: 'gpaForm', weighted: /\bweighted\b/.test(t) && !/unweighted/.test(t) };
  if (/^(?:(?:open|show(?:\s+me)?|give\s+me|use)\s+)?(?:an?\s+|the\s+)?(?:final(?:\s+exam)?\s+grade|final\s+exam|finals?|grade|exam\s+grade|test\s+grade)\s+calc(?:ulator)?$/.test(t)
    || /^what\s+(?:grade|score|mark|percent(?:age)?)\s+do\s+i\s+need\s+(?:to\s+get\s+)?on\s+(?:my|the)\s+(?:final|final\s+exam|exam)$/.test(t)
    || /^what\s+do\s+i\s+need\s+(?:to\s+get\s+)?on\s+(?:my|the)\s+(?:final|final\s+exam|exam)$/.test(t)) return { kind: 'finalForm' };
  // a percent or a GPA as a letter grade
  if (!/\bout\s+of\b/.test(t)) {
    m = t.match(/^(?:what\s+(?:letter\s+)?grade\s+is\s+(?:an?\s+)?|what\s+is\s+(?:an?\s+)?|is\s+(?:an?\s+)?)?(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)?\s+(?:is\s+what\s+(?:letter\s+)?grade|in\s+(?:a\s+)?letter\s+grade|as\s+a\s+letter(?:\s+grade)?|to\s+(?:a\s+)?letter(?:\s+grade)?|letter\s+grade)$/)
      || t.match(/^what\s+letter\s+grade\s+is\s+(?:an?\s+)?(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)?$/)
      || t.match(/^what\s+grade\s+is\s+(?:an?\s+)?(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)$/);
    if (m && +m[1] <= 100) return { kind: 'letter', pct: +m[1] };
    m = t.match(/^(?:what\s+is\s+)?(?:an?\s+)?([0-4](?:\.\d{1,2})?)\s+gpa\s+(?:in|as|to)\s+(?:an?\s+)?(letter(?:\s+grade)?|percent(?:age)?|%)$/)
      || t.match(/^what\s+(letter\s+grade|percent(?:age)?)\s+is\s+(?:an?\s+)?([0-4](?:\.\d{1,2})?)\s+gpa$/);
    if (m) { const g = /^[0-4]/.test(m[1]) ? +m[1] : +m[2]; const want = /^[0-4]/.test(m[1]) ? m[2] : m[1]; if (g <= 4) return { kind: 'gpaLetter', gpa: g, want: /perc|%/.test(want) ? 'percent' : 'letter' }; }
  }
  // the score needed on a final
  if (/\b(?:final|exam|finals)\b/.test(t) && /\b(?:need|needs|have\s+to|must|lowest|minimum|least|get|make|score)\b/.test(t) && !/\b(?:remind|calendar|schedule|when\s+is|study)\b/.test(t)) {
    const cur = t.match(/(?:i\s+(?:have|got|am\s+at|'m\s+at|currently\s+have)|i'm\s+at|my\s+(?:current\s+|class\s+)?grade\s+is|current(?:ly)?\s+(?:grade\s+)?(?:is\s+|of\s+|at\s+)?|sitting\s+at|with)\s+(?:an?\s+)?(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)?(?!\s*(?:%|percent)?\s*(?:of|on)\s)/);
    const w = t.match(/(?:final|exam)\s+(?:exam\s+)?(?:is\s+)?(?:worth|counts?\s+(?:for|as)|weighs?|weighted(?:\s+at)?|is|=)\s+(\d{1,2}(?:\.\d+)?)\s*(?:%|percent)/)
      || t.match(/(\d{1,2}(?:\.\d+)?)\s*(?:%|percent)\s+(?:of\s+(?:my|the)\s+(?:grade|class)|final|exam)/)
      || t.match(/\bworth\s+(\d{1,2}(?:\.\d+)?)\s*(?:%|percent)/);
    const tg = t.match(/(?:to\s+(?:get|end\s+up\s+with|keep|have|finish\s+with|make|pass\s+with|stay\s+at|hit)|and\s+still\s+(?:get|have|keep|pass\s+with)|for)\s+(?:an?\s+)?(\d{1,3}(?:\.\d+)?\s*%?|[abcd](?:\s*(?:\+|-|plus|minus))?)(?=\s|$)(?:\s+(?:in\s+the\s+class|overall|in\s+the\s+course))?/);
    const pass = /\bpass\b/.test(t) && !tg;
    if (cur || w || tg) {
      const current = cur ? +cur[1] : null, weight = w ? +w[1] : null;
      let target = tg ? targetOf(tg[1].replace(/\s+/g, '')) : pass ? { pct: 65, said: 'a pass (65%, a D on the College Board scale)' } : null;
      if (current != null && (current > 120 || current < 0)) return null;
      if (weight != null && (weight <= 0 || weight >= 100)) return null;
      return { kind: 'final', current, weight, target };
    }
  }
  // cumulative GPA: "my gpa is 3.2 with 60 credits ..."
  const base = t.match(/(?:my\s+)?(?:current\s+|cumulative\s+|overall\s+)?gpa\s+(?:is|of)\s+(?:an?\s+)?([0-4](?:\.\d+)?)\s+(?:with|over|after|for|on|across|and\s+i\s+have)\s+(\d{1,3})\s+(?:credits?|credit\s+hours?|hours|units)/)
    || t.match(/(?:i\s+have\s+)?(?:an?\s+)?([0-4](?:\.\d+)?)\s+(?:gpa\s+)?(?:with|over|after|on|across)\s+(\d{1,3})\s+(?:credits?|credit\s+hours?|hours|units)/);
  if (base && GPA_WORD.test(t)) {
    const g0 = +base[1], c0 = +base[2]; const rest = t.replace(base[0], ' ');
    const term = rest.match(/(?:got|get|earned|made|make|had|have|getting)\s+(?:an?\s+)?([0-4](?:\.\d+)?)\s+(?:gpa\s+)?(?:this|last|next|in\s+(?:my\s+)?(?:next|this|last)?)?\s*(?:semester|term|quarter|year)?\s*(?:with|on|over|for|in|across)\s+(\d{1,2})\s+(?:credits?|credit\s+hours?|hours|units)/);
    const need = /\bwhat\s+(?:gpa|grades?)\s+do\s+i\s+need|\bwhat\s+do\s+i\s+need|\bneed\s+to\s+get|\bhow\s+(?:high|much)\b/.test(rest);
    const tgt = rest.match(/\b(?:raise|bring|get|reach|hit|pull|boost|make|to)\b[^0-9]*?([0-4]\.\d{1,2})/);
    const nc = rest.match(/(\d{1,2})\s+(?:credits?|credit\s+hours?|hours|units)/);
    if (g0 > 4 || c0 <= 0) return null;
    if (need && tgt && nc) return { kind: 'cumNeed', g0, c0, target: +tgt[1], c1: +nc[1] };
    if (term) return { kind: 'cum', g0, c0, g1: +term[1], c1: +term[2] };
    return null;
  }
  // a list of grades
  if (GPA_WORD.test(t)) {
    if (/\b(?:define|meaning|mean|stand\s+for|stands\s+for|translate|spell|synonym|harvard|stanford|yale|mit|princeton|ivy|admissions?|scholarships?|get\s+into|good|bad|average|national|typical|median|remind|reminder|calendar|out\s+of)\b/.test(t)) return null;
    const courses = coursesOf(raw);
    if (!courses || courses.length < 1 || courses.length > 30) return null;
    return { kind: 'gpa', courses, weighted: /\bweighted\b/.test(t) && !/unweighted/.test(t) };
  }
  return null;
}

// ---- cards
const SRC = '<div class="src">Scale: <a href="https://bigfuture.collegeboard.org/plan-for-college/get-started/how-to-convert-gpa-4.0-scale" target="_blank" rel="noopener">College Board, How to Convert Your GPA to a 4.0 Scale</a> \u00b7 AP/IB +1, honors +0.5 is the common weighting; your school\u2019s own scale wins if it differs</div>';
const BIG = (s) => '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + s + '</div>';
const GREY = (s) => '<p style="color:#8a8a8a">' + s + '</p>';
function scaleTable() {
  return '<table style="border-collapse:collapse;margin:6px 0;font-size:13px">' + SCALE.map((s, i) => '<tr><td style="padding:1px 10px 1px 0"><b>' + s.l + '</b></td><td style="padding:1px 10px 1px 0">' + (i === 0 ? '97\u2013100' : s.lo === 0 ? 'below 65' : s.lo + '\u2013' + (SCALE[i - 1].lo - 1)) + '</td><td>' + s.p.toFixed(1) + '</td></tr>').join('') + '</table>';
}

function gpaCard(q, api) {
  const { showPage, esc } = api; const r = gpaOf(q.courses);
  const show = q.weighted && r.anyTag ? r.weighted : r.gpa; const both = r.anyTag;
  const rows = q.courses.map((c) => { const k = c.credits == null ? 1 : c.credits; const p = POINTS[c.grade]; const b = c.tag && p > 0 ? BONUS[c.tag] : 0;
    return '<li><b>' + esc(c.grade) + '</b>' + (c.pct != null ? ' (' + esc(pctTxt(c.pct)) + ')' : '') + (c.tag ? ' \u00b7 ' + esc(c.tag === 'ap' || c.tag === 'ib' ? c.tag.toUpperCase() : c.tag) : '')
      + ' \u00b7 ' + p.toFixed(1) + (b ? ' + ' + b : '') + ' \u00d7 ' + k + (k === 1 ? ' credit' : ' credits') + ' = ' + fmt((p + b) * k, 1) + '</li>'; }).join('');
  showPage((el) => { el.innerHTML = '<h2>' + (q.weighted && both ? 'Weighted GPA' : 'GPA') + '</h2>'
    + '<div class="sub">' + q.courses.length + (q.courses.length === 1 ? ' class' : ' classes') + ', ' + r2(r.credits) + (r.credits === 1 ? ' credit' : ' credits') + (r.anyCredits ? '' : ' (1 each; add credits like "A 4 credits")') + '</div>'
    + BIG(esc(fmt(show))) + (both ? '<div class="sub">' + (q.weighted ? 'Unweighted ' + fmt(r.gpa) : 'Weighted ' + fmt(r.weighted) + ' (AP/IB +1, honors +0.5)') + '</div>' : '')
    + '<ul>' + rows + '</ul>'
    + GREY('GPA = grade points \u00d7 credits, added up, \u00f7 total credits (' + fmt(both && q.weighted ? r.weighted * r.credits : r.points, 1) + ' \u00f7 ' + r2(r.credits) + '). That is ' + esc(letterForGpa(show)) + ' on average. Ask "gpa calculator" to add and change classes.') + SRC; });
  return 'grades';
}
function letterForGpa(g) {
  const L = SCALE.filter((x) => x.l !== 'A+'); const an = (l) => (/^[AEF]/.test(l) ? 'an ' : 'a ') + l;
  if (g > 4.0 + 1e-9) return 'above a straight-A 4.0, thanks to the weighting';
  const exact = L.find((x) => Math.abs(x.p - g) < 0.05); if (exact) return 'about ' + an(exact.l);
  const hi = L.slice().reverse().find((x) => x.p > g), lo = L.find((x) => x.p < g);
  return hi && lo ? 'between ' + an(lo.l) + ' and ' + an(hi.l) : 'about ' + an((hi || lo).l);
}

function finalCard(q, api) {
  const { showPage, esc } = api; const { current, weight, target } = q;
  if (current == null) return finalForm(api, q);
  const TGTS = [{ l: 'an A', p: 90 }, { l: 'a B', p: 80 }, { l: 'a C', p: 70 }, { l: 'a D', p: 65 }];
  const say = (n) => n <= 0 ? 'nothing: you have it locked in' : n > 100 ? pctTxt(n) + ' (more than 100%, out of reach unless there is extra credit)' : pctTxt(n);
  if (weight == null) {
    const W = [10, 15, 20, 25, 30, 40, 50]; const tp = target ? target.pct : 90;
    showPage((el) => { el.innerHTML = '<h2>Score you need on the final</h2><div class="sub">' + esc('you have ' + pctTxt(current) + ', aiming for ' + (target ? target.said + (target.letter ? ' (' + target.pct + '%)' : '') : 'an A (90%)')) + '</div>'
      + '<p>How much the final counts changes everything. For each common weight:</p><ul>' + W.map((w) => '<li>final worth <b>' + w + '%</b>: ' + esc(say(neededOf(current, w, tp))) + '</li>').join('') + '</ul>'
      + GREY('needed = (goal \u2212 current \u00d7 (1 \u2212 weight)) \u00f7 weight. Say "and the final is worth 20%" for one answer.')
      + '<div class="src">Formula as in <a href="https://rogerhub.com/final-grade-calculator/" target="_blank" rel="noopener">RogerHub\u2019s final grade calculator</a></div>'; });
    return 'grades';
  }
  const tp = target ? target.pct : null;
  const main = tp != null ? neededOf(current, weight, tp) : null;
  showPage((el) => { el.innerHTML = '<h2>Score you need on the final</h2><div class="sub">' + esc('you have ' + pctTxt(current) + ', the final counts ' + pctTxt(weight) + (target ? ', aiming for ' + target.said + (target.letter ? ' (' + target.pct + '%)' : '') : '')) + '</div>'
    + (main != null ? BIG(esc(main <= 0 ? '0%' : pctTxt(main))) + '<div class="sub">' + esc(main <= 0 ? 'you already have it locked in, even with a 0 on the final' : main > 100 ? 'more than 100%: out of reach without extra credit' : 'on the final to finish with ' + pctTxt(tp)) + '</div>' : '')
    + '<ul>' + TGTS.map((x) => '<li>' + esc(x.l) + ' (' + x.p + '%): ' + esc(say(neededOf(current, weight, x.p))) + '</li>').join('') + '</ul>'
    + GREY('needed = (goal \u2212 current \u00d7 (1 \u2212 weight)) \u00f7 weight' + (main != null ? ' = (' + tp + ' \u2212 ' + current + ' \u00d7 ' + fmt(1 - weight / 100) + ') \u00f7 ' + fmt(weight / 100) : '') + '. If you score 100 you finish with ' + pctTxt(current * (1 - weight / 100) + weight) + '; with a 0, ' + pctTxt(current * (1 - weight / 100)) + '. A letter goal counts as its lowest grade (an A = 90).')
    + '<div class="src">Formula as in <a href="https://rogerhub.com/final-grade-calculator/" target="_blank" rel="noopener">RogerHub\u2019s final grade calculator</a></div>'; });
  return 'grades';
}

function finalForm(api, q) {
  const { showPage } = api; q = q || {};
  const el = showPage((p) => { p.innerHTML = '<h2>Final grade calculator</h2>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0">'
    + '<label>Current grade <input id="fg-cur" type="number" min="0" max="120" step="0.1" value="' + (q.current != null ? q.current : 88) + '" style="width:70px" aria-label="current grade percent">%</label>'
    + '<label>Goal <input id="fg-tgt" type="number" min="0" max="120" step="0.1" value="' + (q.target ? q.target.pct : 90) + '" style="width:70px" aria-label="goal percent">%</label>'
    + '<label>Final is worth <input id="fg-w" type="number" min="1" max="99" step="0.5" value="' + (q.weight != null ? q.weight : 20) + '" style="width:60px" aria-label="final weight percent">%</label></div>'
    + '<div id="fg-out" aria-live="polite"></div>' + GREY('needed = (goal \u2212 current \u00d7 (1 \u2212 weight)) \u00f7 weight. An A = 90, a B = 80, a C = 70.')
    + '<div class="src">Formula as in <a href="https://rogerhub.com/final-grade-calculator/" target="_blank" rel="noopener">RogerHub\u2019s final grade calculator</a></div>'; });
  const g = (id) => el.querySelector('#' + id), out = g('fg-out');
  const upd = () => { const c = +g('fg-cur').value, tg = +g('fg-tgt').value, w = +g('fg-w').value;
    if (!(w > 0 && w < 100) || !Number.isFinite(c) || !Number.isFinite(tg)) { out.textContent = 'fill in all three'; return; }
    const n = neededOf(c, w, tg); out.innerHTML = BIG(n <= 0 ? '0%' : pctTxt(n)) + '<div class="sub">Needed on the final: ' + (n <= 0 ? 'already locked in' : n > 100 ? 'out of reach without extra credit' : pctTxt(n)) + '</div>'; };
  for (const id of ['fg-cur', 'fg-tgt', 'fg-w']) g(id).addEventListener('input', upd); upd();
  return 'grades';
}

function gpaForm(api, weighted) {
  const { showPage } = api;
  const opts = (sel) => Object.keys(POINTS).filter((k) => k !== 'E').map((k) => '<option' + (k === sel ? ' selected' : '') + '>' + k + '</option>').join('');
  const row = (g, c, tag) => '<div class="gp-row" style="display:flex;gap:6px;margin:4px 0;align-items:center"><select class="gp-g" aria-label="grade">' + opts(g) + '</select>'
    + '<input class="gp-c" type="number" min="0.5" max="12" step="0.5" value="' + c + '" style="width:60px" aria-label="credits"> credits'
    + '<select class="gp-t" aria-label="level"><option value="">regular</option><option value="honors"' + (tag === 'honors' ? ' selected' : '') + '>honors</option><option value="ap"' + (tag === 'ap' ? ' selected' : '') + '>AP / IB</option></select></div>';
  const el = showPage((p) => { p.innerHTML = '<h2>GPA calculator</h2><div id="gp-rows">' + row('A', 3) + row('B+', 3) + row('A-', 4) + row('B', 3) + '</div>'
    + '<button id="gp-add" type="button">add a class</button><div id="gp-out" aria-live="polite" style="margin-top:8px"></div>'
    + GREY('Or just ask: "what is my gpa A 4 credits, B+ 3 credits, C 3 credits", or "weighted gpa A in AP, B honors".') + SRC; });
  const out = el.querySelector('#gp-out');
  const upd = () => { const cs = [...el.querySelectorAll('.gp-row')].map((r) => ({ grade: r.querySelector('.gp-g').value, credits: +r.querySelector('.gp-c').value || 0, tag: r.querySelector('.gp-t').value || null })).filter((c) => c.credits > 0);
    if (!cs.length) { out.textContent = 'add a class'; return; }
    const r = gpaOf(cs); out.innerHTML = BIG(fmt(weighted && r.anyTag ? r.weighted : r.gpa)) + '<div class="sub">' + (r.anyTag ? 'Unweighted ' + fmt(r.gpa) + ' \u00b7 weighted ' + fmt(r.weighted) : 'GPA') + ' \u00b7 ' + r2(r.credits) + ' credits</div>'; };
  el.addEventListener('input', upd); el.addEventListener('change', upd);
  el.querySelector('#gp-add').addEventListener('click', () => { el.querySelector('#gp-rows').insertAdjacentHTML('beforeend', row('A', 3)); upd(); });
  upd();
  return 'grades';
}

async function run(text, api) {
  const { showPage, esc } = api; const q = gradesOf(text);
  if (!q) return 'none';
  if (q.kind === 'gpaForm') return gpaForm(api, q.weighted);
  if (q.kind === 'finalForm') return finalForm(api);
  if (q.kind === 'gpa') return gpaCard(q, api);
  if (q.kind === 'final') return finalCard(q, api);
  if (q.kind === 'letter') {
    const s = letterOf(q.pct);
    showPage((el) => { el.innerHTML = '<h2>Letter grade</h2><div class="sub">' + esc(pctTxt(q.pct)) + '</div>' + BIG(esc(s.l)) + '<div class="sub">' + s.p.toFixed(1) + ' grade points on a 4.0 scale</div>'
      + scaleTable() + GREY('Many classes use a plain 10-point scale instead (90 A, 80 B, 70 C, 60 D), where ' + esc(pctTxt(q.pct)) + ' is ' + (q.pct >= 90 ? 'an A' : q.pct >= 80 ? 'a B' : q.pct >= 70 ? 'a C' : q.pct >= 60 ? 'a D' : 'an F') + '.') + SRC; });
    return 'grades';
  }
  if (q.kind === 'gpaLetter') {
    const s = SCALE.slice().reverse().filter((x) => x.p <= q.gpa + 1e-9).pop() || SCALE[SCALE.length - 1];
    const i = SCALE.indexOf(s); const hi = i === 0 ? 100 : SCALE[i - 1].lo - 1;
    showPage((el) => { el.innerHTML = '<h2>' + esc(q.gpa % 1 ? String(q.gpa) : q.gpa.toFixed(1)) + ' GPA</h2><div class="sub">on a 4.0 scale</div>' + BIG(esc(q.want === 'percent' ? s.lo + '\u2013' + hi + '%' : s.l))
      + '<div class="sub">' + esc(q.want === 'percent' ? 'about ' + (/^[AEF]/.test(s.l) ? 'an ' : 'a ') + s.l + ' average' : 'about ' + s.lo + '\u2013' + hi + '%') + '</div>' + scaleTable() + SRC; });
    return 'grades';
  }
  if (q.kind === 'cum') {
    const tot = q.c0 + q.c1, g = (q.g0 * q.c0 + q.g1 * q.c1) / tot;
    showPage((el) => { el.innerHTML = '<h2>Cumulative GPA</h2><div class="sub">' + esc(fmt(q.g0) + ' over ' + q.c0 + ' credits, then ' + fmt(q.g1) + ' over ' + q.c1) + '</div>' + BIG(esc(fmt(g)))
      + '<div class="sub">' + (g > q.g0 ? 'up ' : g < q.g0 ? 'down ' : 'no change, ') + esc(fmt(Math.abs(g - q.g0))) + ' \u00b7 ' + tot + ' credits</div>'
      + GREY('(' + q.g0 + ' \u00d7 ' + q.c0 + ' + ' + q.g1 + ' \u00d7 ' + q.c1 + ') \u00f7 ' + tot + ' = ' + fmt(g) + '. Credits weigh in: the more you already have, the slower it moves.') + SRC; });
    return 'grades';
  }
  if (q.kind === 'cumNeed') {
    const n = (q.target * (q.c0 + q.c1) - q.g0 * q.c0) / q.c1;
    const more = []; if (n > 4) for (const c of [15, 30, 45, 60]) { const v = (q.target * (q.c0 + c) - q.g0 * q.c0) / c; if (v <= 4) { more.push(c); break; } }
    showPage((el) => { el.innerHTML = '<h2>GPA you need</h2><div class="sub">' + esc('to go from ' + fmt(q.g0) + ' (' + q.c0 + ' credits) to ' + fmt(q.target) + ' with ' + q.c1 + ' more credits') + '</div>'
      + BIG(esc(n <= 0 ? '0.00' : fmt(n))) + '<div class="sub">' + esc(n > 4 ? 'more than a 4.0: not possible in ' + q.c1 + ' credits' + (more.length ? '; a 4.0 over ' + more[0] + ' credits gets there' : '') : n <= q.g0 ? 'you are already there or above' : 'average over those ' + q.c1 + ' credits (' + letterForGpa(n) + ')') + '</div>'
      + GREY('needed = (goal \u00d7 all credits \u2212 current \u00d7 credits so far) \u00f7 new credits = (' + q.target + ' \u00d7 ' + (q.c0 + q.c1) + ' \u2212 ' + q.g0 + ' \u00d7 ' + q.c0 + ') \u00f7 ' + q.c1 + '.') + SRC; });
    return 'grades';
  }
  return 'none';
}

export { gradesOf, coursesOf, gpaOf, neededOf, letterOf };
export default {
  name: 'grades',
  examples: [
    'what is my gpa A B B+ A-',
    'gpa with A 4 credits, B+ 3 credits, C 3 credits',
    'weighted gpa A in AP, B+ honors, A-',
    "what's my gpa if i got 3 A's and 2 B's",
    'gpa calculator',
    'i have an 85 and my final is worth 20% what do i need to get a 90',
    'what grade do i need on my final',
    'my gpa is 3.2 with 60 credits and i got a 3.8 this semester with 15 credits',
    'what letter grade is an 87'
  ],
  nearMisses: [
    'what is the gpa of 3.5 and 4.0',
    'what grade is 42 out of 50',
    'what does gpa stand for',
    'what is a good gpa',
    'remind me to study for my final',
    'when is my final exam'
  ],
  match(lower, text) { return !!gradesOf(text); },
  run
};
