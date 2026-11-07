/**
 * math-quiz skill - a quiz in the page (docs/GAPS.md rows 24 and 25, 2026-11-06: "times tables quiz" gave a Python script, "math quiz"
 * an article on a school competition). "times tables quiz", "7 times table quiz", "multiplication quiz", "math quiz", "maths quiz hard",
 * "addition quiz", "division quiz". Ten questions, typed answers, each checked as you go, a score and the ones missed at the end.
 * Questions are made here at random; every answer is a whole number, and a take-away never goes below zero.
 * Nothing is kept or sent. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }. Tests: tools/gaps-batch2.test.mjs.
 */

export const LEVELS = ['easy', 'medium', 'hard'];
const WORD = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

/** what the ask names: { kind: 'times' | 'mixed' | 'add' | 'sub' | 'mul' | 'div', level, table? } or null. Pure. */
export function quizOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t || t.length > 70) return null;
  if (/^(?:what|why|how|is|does|do|who|when|where)\b|\b(?:answers?|chart|song|printable|pdf|worksheet|meaning|definition|bowl|competition|olympiad)\b/.test(t)) return null;
  const pre = '^(?:please )?(?:(?:give me|do|start|play|take|try|run|open) )?(?:a |an |the |some )?(?:quick |random |online |free )?';
  const lvl = '(?: (?:on |at |level )?(easy|medium|hard)(?: level| mode)?)?';
  let m = t.match(new RegExp(pre + '(?:(\\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) )?(?:times[ -]tables?|multiplication tables?|times[ -]table) (?:quiz|test|practice|game|drill|questions)' + lvl + '$'));
  if (m) { const n = m[1] ? (WORD[m[1]] || +m[1]) : 0; return { kind: 'times', level: m[2] || 'medium', ...(n >= 2 && n <= 12 ? { table: n } : {}) }; }
  m = t.match(new RegExp(pre + '(?:(easy|medium|hard) )?(maths?|mental maths?|arithmetic|addition|subtraction|multiplication|division|adding|times) (?:quiz|test|practice|game|drill|questions)' + lvl + '$'));
  if (m) {
    const w = m[2], kind = /^add/.test(w) ? 'add' : w === 'subtraction' ? 'sub' : w === 'multiplication' || w === 'times' ? 'mul' : w === 'division' ? 'div' : 'mixed';
    return { kind, level: m[1] || m[3] || 'medium' };
  }
  return null;
}

const range = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const LIM = { easy: { add: 20, mul: 5 }, medium: { add: 100, mul: 12 }, hard: { add: 1000, mul: 20 } };

/** one question { a, b, op, answer, text }: whole numbers, never a negative take-away, division always exact. Pure given rng. */
export function question(spec, rng = Math.random) {
  const L = LIM[spec.level] || LIM.medium;
  const op = spec.kind === 'times' || spec.kind === 'mul' ? '×' : spec.kind === 'add' ? '+' : spec.kind === 'sub' ? '−' : spec.kind === 'div' ? '÷' : ['+', '−', '×', '÷'][range(rng, 0, 3)];
  let a, b, answer;
  if (op === '+') { a = range(rng, 1, L.add); b = range(rng, 1, L.add); answer = a + b; }
  else if (op === '−') { a = range(rng, 1, L.add); b = range(rng, 0, a); answer = a - b; }
  else if (op === '×') { a = spec.table || range(rng, 2, spec.kind === 'times' ? 12 : L.mul); b = range(rng, 1, spec.kind === 'times' ? 12 : Math.max(10, L.mul)); if (!spec.table && rng() < 0.5) [a, b] = [b, a]; answer = a * b; }
  else { b = range(rng, 2, Math.max(5, L.mul)); answer = range(rng, 1, Math.max(10, L.mul)); a = b * answer; }
  return { a, b, op, answer, text: a + ' ' + op + ' ' + b };
}

/** n questions with no repeat while repeats can be avoided. Pure given rng. */
export function questions(spec, n = 10, rng = Math.random) {
  const out = [], seen = new Set();
  for (let tries = 0; out.length < n && tries < n * 50; tries++) { const q = question(spec, rng); if (seen.has(q.text) && tries < n * 40) continue; seen.add(q.text); out.push(q); }
  return out;
}

/** a typed answer as a whole number, or null: "56", " 56 ", "1,000" and "-3" read; "5 6" and "abc" do not. Pure. */
export function readAnswer(s) { const t = String(s || '').trim().replace(/,(?=\d{3}\b)/g, ''); return /^-?\d{1,7}$/.test(t) ? +t : null; }

const BTN = 'padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#e8e8e8;cursor:pointer;font:14px system-ui';
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

function run(text, api) {
  const q = quizOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api, N = 10;
  const title = q.kind === 'times' ? (q.table ? q.table + ' times table' : 'Times tables') + ' quiz' : { add: 'Addition', sub: 'Subtraction', mul: 'Multiplication', div: 'Division', mixed: 'Math' }[q.kind] + ' quiz';
  const el = showPage((p) => {
    p.innerHTML = '<h2>' + esc(title) + '</h2>'
      + (q.kind === 'times'
        ? '<label style="display:flex;gap:8px;align-items:center;margin:8px 0">Table <select class="mq-table" aria-label="Table"><option value="0">all, 2 to 12</option>' + Array.from({ length: 11 }, (_, i) => i + 2).map((n) => '<option value="' + n + '"' + (n === q.table ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>'
        : '<div role="group" aria-label="Level" style="display:flex;gap:6px;margin:8px 0">' + LEVELS.map((l) => '<button type="button" class="mq-level" data-level="' + l + '" aria-pressed="' + (l === q.level) + '" style="' + BTN + '">' + l + '</button>').join('') + '</div>')
      + '<p class="mq-q" aria-live="polite" style="font-size:30px;margin:12px 0;font-variant-numeric:tabular-nums"></p>'
      + '<form class="mq-form" style="display:flex;gap:8px;align-items:center"><input class="mq-in" inputmode="numeric" autocomplete="off" aria-label="Your answer" style="width:8em;font:20px system-ui;padding:4px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.05);color:inherit">'
      + '<button type="submit" class="mq-check" style="' + BTN + '">Check</button></form>'
      + '<p class="mq-say" aria-live="polite" style="min-height:1.4em;margin:8px 0"></p><p class="mq-score" style="color:#8a8a8a"></p>'
      + '<div class="mq-end"></div><div class="src">Questions made in your browser · nothing is kept or sent</div>';
  });
  const $ = (c) => el && el.querySelector && el.querySelector(c);
  const qEl = $('.mq-q'), form = $('.mq-form'), input = $('.mq-in'), say = $('.mq-say'), score = $('.mq-score'), end = $('.mq-end');
  if (!qEl || !form || !input) return 'math-quiz';
  let spec = { ...q }, list = [], i = 0, right = 0, missed = [], t0 = 0;
  const show = () => { qEl.textContent = list[i].text + ' = ?'; input.value = ''; if (score) score.textContent = 'Question ' + (i + 1) + ' of ' + N + ' · ' + right + ' right'; try { input.focus(); } catch (_) {} };
  const start = () => { list = questions(spec, N); i = 0; right = 0; missed = []; t0 = now(); if (end) end.innerHTML = ''; if (say) say.textContent = ''; form.style.display = 'flex'; show(); };
  const finish = () => {
    const secs = Math.round((now() - t0) / 1000);
    qEl.textContent = right + ' of ' + N; form.style.display = 'none';
    if (score) score.textContent = secs + ' seconds in all';
    if (end) {
      end.innerHTML = (missed.length ? '<p>To go over:</p><ul>' + missed.map((m) => '<li>' + esc(m.text + ' = ' + m.answer) + (m.given !== null ? ' (you wrote ' + esc(String(m.given)) + ')' : '') + '</li>').join('') + '</ul>' : '<p>All ten right.</p>')
        + '<button type="button" class="mq-again" style="' + BTN + '">Again</button>';
      const again = end.querySelector && end.querySelector('.mq-again'); if (again) again.addEventListener('click', start);
    }
  };
  form.addEventListener('submit', (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (i >= list.length) return;
    const given = readAnswer(input.value);
    if (given === null && String(input.value).trim() === '') { if (say) say.textContent = 'Type a whole number.'; return; }
    const cur = list[i];
    if (given === cur.answer) { right++; if (say) say.textContent = 'Right.'; } else { missed.push({ ...cur, given }); if (say) say.textContent = 'Not quite: ' + cur.text + ' = ' + cur.answer; }
    i++;
    if (i >= N) finish(); else show();
  });
  const table = $('.mq-table'); if (table) table.addEventListener('change', () => { const n = +table.value; spec = { ...spec, table: n || undefined }; if (!n) delete spec.table; start(); });
  if (el && el.querySelectorAll) for (const b of el.querySelectorAll('.mq-level')) b.addEventListener('click', () => { spec = { ...spec, level: b.dataset.level }; for (const o of el.querySelectorAll('.mq-level')) o.setAttribute('aria-pressed', String(o === b)); start(); });
  start();
  return 'math-quiz';
}

export default {
  name: 'math-quiz',
  examples: ['times tables quiz', '7 times table quiz', 'multiplication quiz', 'math quiz', 'maths quiz hard', 'addition quiz', 'division quiz easy'],
  nearMisses: ['what is a math quiz', 'math quiz answers', 'times tables chart', 'times tables song', 'math competition', 'pub quiz'],
  match(lower, text) { return !!quizOf(text || lower); },
  run,
};
