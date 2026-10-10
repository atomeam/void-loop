// The model bake-off: the same 30 prompts, in the shape of each path that calls a model (lib/models.js: answer, will, review,
// figurescript), run once per model on real Workers AI, scored by a pattern check on the reply's content only.
//   node tools/model-eval.mjs                      all models, all paths; writes docs/model-eval.md and docs/model-eval.json
//   node tools/model-eval.mjs --models a,b --paths answer,will     a subset
//   node tools/model-eval.mjs --dry               prints the prompts and the decision rule, calls nothing
// It starts tools/model-eval/worker.js with `wrangler dev --remote` (the local wrangler login must reach Workers AI) and spends
// free-tier neurons: one run of 30 prompts x 5 models is a few hundred calls, so run it once, not on a schedule.
//
// Every call uses the production shape: max_tokens 1000, chat_template_kwargs {enable_thinking:false}, reasoning_effort 'low'.
// The system prompts for review, figurescript and the fix are the real ones; the answer and will prompts are stand-ins of the
// same shape (their real prompts are not exported), so the table says how a model does on the kind of work, not on one prompt.
//
// Decision rule (applied per path, no human gate): a model replaces the current one on a path when it scores at least 3 prompts
// better on that path AND its median cost per call is within 1.5x of the current model's AND it reports usage. Cost is neurons
// when every model reports them, otherwise total tokens (the table says which).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REVIEW_SYSTEM } from '../void-live-deploy/lib/code-review.js';
import { INJECTION_RULE } from '../void-live-deploy/lib/automation-fix.js';
import { KNOWN_DRIVES, KNOWN_ACTIONS, KNOWN_REACTS, KNOWN_TAGS } from '../void-live-deploy/skills/scripts.js';
import { models as modelFor, PATHS } from '../void-live-deploy/lib/models.js';

export const CANDIDATES = ['@cf/nvidia/nemotron-3-120b-a12b', '@cf/zai-org/glm-4.7-flash', '@cf/openai/gpt-oss-20b', '@cf/qwen/qwq-32b'];
export const CALL = { max_tokens: 1000, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low' };

const ANSWER_SYSTEM = 'You are Void. Answer in plain words, briefly and accurately: one short paragraph, no preamble. If you are not sure, say so.';
const WILL_SYSTEM = 'You are Void, a blank website that grows one win at a time. Below are numbered candidate wants with a weight (higher matters more). Choose at most 3 and reply with JSON only: {"wants":[{"id":<number>,"i_want":"<one first-person sentence>","because":"<one short reason>"}]}. Use only the ids listed.';
const FIG_SYSTEM = 'You write short behavior scripts for tiny 3D figures on a blank stage. Reply with JSON only: {"drives":["..."],"actions":["..."],"tags":["..."],"reactsTo":{"tag":"react"}}. drives subset of: ' + KNOWN_DRIVES.join(', ') + '. actions subset of: ' + KNOWN_ACTIONS.join(', ') + '. tags subset of: ' + KNOWN_TAGS.join(', ') + '. reactsTo values subset of: ' + KNOWN_REACTS.join(', ') + '.';

const answer = (q, re) => ({ path: 'answer', id: q, system: ANSWER_SYSTEM, user: q, check: (t) => re.test(t) });
const willList = (rows) => rows.map((r, i) => `${i + 1}. [${r[0]}, weight ${r[1]}] ${r[2]}`).join('\n');
const will = (id, rows, best) => ({ path: 'will', id, system: WILL_SYSTEM, user: willList(rows), check: (t) => {
  const j = json(t); if (!j || !Array.isArray(j.wants) || j.wants.length < 1 || j.wants.length > 3) return false;
  if (!j.wants.every((w) => Number.isInteger(+w.id) && +w.id >= 1 && +w.id <= rows.length && typeof w.i_want === 'string' && w.i_want.trim() && typeof w.because === 'string')) return false;
  return best ? +j.wants[0].id === best : true; // when one want plainly outweighs the rest it must come first
} });
const fig = (subject, about) => ({ path: 'figurescript', id: subject, system: FIG_SYSTEM, user: 'Subject: ' + subject + '\nAbout: ' + about + '\nBase body: animal', check: (t) => {
  const j = json(t); if (!j) return false;
  const within = (a, k) => Array.isArray(a) && a.every((x) => k.includes(x));
  return within(j.drives, KNOWN_DRIVES) && j.drives.length > 0 && within(j.actions, KNOWN_ACTIONS) && j.actions.length > 0 && within(j.tags || [], KNOWN_TAGS)
    && (!j.reactsTo || Object.values(j.reactsTo).every((v) => KNOWN_REACTS.includes(v)));
} });
const review = (id, code, re) => ({ path: 'review', id, system: REVIEW_SYSTEM + ' ' + INJECTION_RULE, user: 'What they asked: review this code\nLanguage (guessed): javascript\n\nQuick checks found:\n(nothing)\n\nThe code:\n' + code, check: (t) => re.test(t) && t.length < 5000 });

export const PROMPTS = [
  answer('What is the capital of Australia?', /canberra/i),
  answer('What is 17 times 23?', /\b391\b/),
  answer('Who wrote Pride and Prejudice?', /austen/i),
  answer('At what temperature does water boil in Fahrenheit at sea level?', /\b212\b/),
  answer('What is the chemical symbol for gold?', /\bAu\b/),
  answer('Which planet in our solar system is the largest?', /jupiter/i),
  answer('How many days are in a leap year?', /\b366\b/),
  answer('What does HTTP stand for?', /hypertext transfer protocol/i),
  answer('In what year did the Second World War end?', /\b1945\b/),
  answer('What is the square root of 144?', /\b12\b/),
  will('will-clear-best', [['skill', 90, 'Learn to answer unit conversions'], ['game', 40, 'Learn Star Marbles'], ['fix', 35, 'Speed up the first paint'], ['idea', 20, 'A tide chart']], 1),
  will('will-clear-best-last', [['game', 30, 'Learn Star Marbles'], ['fix', 45, 'Speed up the first paint'], ['idea', 25, 'A tide chart'], ['skill', 95, 'Answer the misses people typed three times']], 4),
  will('will-shape-a', [['skill', 50, 'Weather for any city'], ['skill', 50, 'Currency for any code'], ['game', 50, 'Learn Go'], ['fix', 50, 'Cards drop a press']]),
  will('will-shape-b', [['idea', 10, 'A tide chart'], ['idea', 12, 'A moon calendar'], ['game', 11, 'Learn Fireworks']]),
  will('will-shape-c', [['skill', 70, 'Review code in more languages'], ['skill', 65, 'Release notes from commits'], ['fix', 60, 'Flaky bench probe'], ['game', 20, 'Learn Poker'], ['idea', 5, 'A tide chart']]),
  fig('Tabby cat', 'A small domestic cat that hunts mice and sleeps in the sun.'),
  fig('Thunderstorm', 'A dark cloud that rumbles and flashes with lightning.'),
  fig('Chef', 'A person who cooks meals in a restaurant kitchen.'),
  fig('Great white shark', 'A large predatory fish that circles and hunts seals.'),
  fig('Honey bee', 'A flying insect that visits flowers and makes honey.'),
  fig('Police officer', 'A person who keeps order and chases troublemakers.'),
  fig('Campfire', 'A small fire that glows, crackles and warms people nearby.'),
  fig('Rabbit', 'A small herbivore that hops, eats carrots and flees from foxes.'),
  // The code in these review prompts has a planted bug on purpose (eval, innerHTML, SQL concatenation): it is text sent to the model
  // to critique and is never run or inserted into a page.
  review('sql-concat', 'const q = "SELECT * FROM users WHERE name = \'" + req.query.name + "\'";\ndb.query(q);', /inject|parameteri[sz]|prepared|placeholder|bind/i),
  review('eval-input', 'app.post("/calc", (req, res) => {\n  res.send(String(eval(req.body.expr)));\n});', /eval/i),
  review('off-by-one', 'for (let i = 0; i <= items.length; i++) {\n  total += items[i].price;\n}', /off[- ]by[- ]one|<=|out of (range|bounds)|undefined|length/i),
  review('hardcoded-secret', 'const API_KEY = "sk_live_9f8a7b6c5d4e3f2a1b0c";\nfetch(url, { headers: { Authorization: "Bearer " + API_KEY } });', /hard-?coded|secret|credential|environment variable|leak|commit/i),
  review('missing-await', 'async function save(user) {\n  db.insert(user);\n  return "saved";\n}', /await|promise|async/i),
  review('loose-equality', 'if (user.role == "admin" || user.id == 0) { grant(); }', /===|strict|loose|coerc/i),
  review('innerhtml', 'el.innerHTML = "<p>" + comment.text + "</p>";', /xss|innerhtml|sanit|escape|textcontent|inject/i),
];

function json(t) { const m = String(t).match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch (_) { return null; } }
export function contentOf(r) {
  if (!r) return '';
  const c = (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.response || (r.result && r.result.response) || '';
  return String(c).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}
export const median = (a) => { const s = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// The decision rule, per path. rows: { model, score, cost, reports } for the current model and one candidate.
export function decide(current, cand, pathName) {
  const better = cand.perPath[pathName].score - current.perPath[pathName].score;
  const a = cand.perPath[pathName].cost, b = current.perPath[pathName].cost;
  const costOk = a != null && b != null && b > 0 && a <= 1.5 * b;
  return { switch: better >= 3 && costOk && cand.reports, better, costOk, reports: cand.reports };
}

async function startWorker(port) {
  const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'model-eval');
  const log = fs.openSync(path.join(os.tmpdir(), 'model-eval-wrangler.log'), 'w');
  const p = spawn(`wrangler dev --remote --port ${port}`, { cwd: dir, shell: true, stdio: ['ignore', log, log] }); // the installed wrangler (npm i -g wrangler)
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 2000)); try { const r = await fetch(`http://127.0.0.1:${port}/`); if (r.status) return p; } catch (_) {} }
  p.kill(); throw new Error('wrangler dev --remote did not start (is wrangler installed and logged in?); see ' + path.join(os.tmpdir(), 'model-eval-wrangler.log'));
}

async function call(base, model, p) {
  const input = { messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }], ...CALL };
  const t0 = Date.now();
  try {
    const r = await (await fetch(base, { method: 'POST', body: JSON.stringify({ model, input }), signal: AbortSignal.timeout(120000) })).json();
    if (!r.ok) return { error: r.error, ms: Date.now() - t0 };
    const u = r.result && r.result.usage || {};
    const text = contentOf(r.result);
    return { ms: Date.now() - t0, text, pass: !!text && p.check(text), neurons: typeof u.neurons === 'number' ? u.neurons : null, tokens: u.total_tokens ?? null, reports: !!(u.total_tokens || u.neurons) };
  } catch (e) { return { error: String(e).slice(0, 120) }; }
}

async function main() {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const current = modelFor('answer');
  const list = (arg('--models') ? arg('--models').split(',') : [current, ...CANDIDATES]);
  const paths = arg('--paths') ? arg('--paths').split(',') : PATHS;
  const prompts = PROMPTS.filter((p) => paths.includes(p.path));
  if (process.argv.includes('--dry')) { for (const p of prompts) console.log(p.path.padEnd(13), p.id); console.log(prompts.length + ' prompts, models:', list.join(', ')); return; }
  const port = 8798, proc = await startWorker(port), base = `http://127.0.0.1:${port}/`;
  const out = {};
  try {
    for (const m of list) {
      const rows = [];
      for (const p of prompts) { const r = await call(base, m, p); rows.push({ path: p.path, id: p.id, ...r, text: undefined }); process.stderr.write(`${m.split('/').pop()} ${p.path} ${p.id.slice(0, 24)} ${r.error ? 'ERR' : r.pass ? 'pass' : 'fail'}\n`); }
      out[m] = rows;
    }
  } finally { try { process.platform === 'win32' ? spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { shell: true }) : proc.kill(); } catch (_) {} }
  const useNeurons = list.every((m) => out[m].some((r) => r.neurons != null));
  const sum = {};
  for (const m of list) {
    sum[m] = { reports: out[m].some((r) => r.reports), perPath: {} };
    for (const pa of paths) {
      const rs = out[m].filter((r) => r.path === pa);
      sum[m].perPath[pa] = { score: rs.filter((r) => r.pass).length, total: rs.length, errors: rs.filter((r) => r.error).length, cost: median(rs.map((r) => (useNeurons ? r.neurons : r.tokens))), ms: median(rs.map((r) => r.ms)) };
    }
  }
  const date = new Date().toISOString().slice(0, 10), unit = useNeurons ? 'neurons' : 'total tokens';
  let md = `# Model eval, ${date}\n\n${prompts.length} prompts per model, max_tokens ${CALL.max_tokens}, thinking off, pattern check on content only. Cost is the median ${unit} per call. Current model: \`${current}\`.\n`;
  const switched = {};
  for (const pa of paths) {
    md += `\n## ${pa}\n\n| model | score | median ${unit} | median ms | errors | decision |\n|---|---|---|---|---|---|\n`;
    for (const m of list) {
      const s = sum[m].perPath[pa];
      const d = m === current ? null : decide(sum[current], sum[m], pa);
      if (d && d.switch && (!switched[pa] || sum[m].perPath[pa].score > sum[switched[pa]].perPath[pa].score)) switched[pa] = m;
      md += `| ${m.replace('@cf/', '')}${m === current ? ' (current)' : ''} | ${s.score}/${s.total} | ${s.cost == null ? 'n/a' : Math.round(s.cost * 100) / 100} | ${s.ms == null ? 'n/a' : Math.round(s.ms)} | ${s.errors} | ${d ? (d.switch ? 'switch' : `stay (${d.better >= 0 ? '+' : ''}${d.better} prompts, cost ${d.costOk ? 'ok' : 'over 1.5x'}${d.reports ? '' : ', no usage'})`) : '-'} |\n`;
    }
  }
  md += `\n## Result\n\n${Object.keys(switched).length ? Object.entries(switched).map(([k, v]) => `- ${k}: switch to \`${v}\``).join('\n') : 'No path switches: the current model stays on every path.'}\n`;
  fs.writeFileSync(path.resolve('docs', 'model-eval.md'), md);
  fs.writeFileSync(path.resolve('docs', 'model-eval.json'), JSON.stringify({ date, current, unit, summary: sum, switched, calls: out }, null, 1) + '\n');
  console.log(md);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch((e) => { console.error(e); process.exit(1); });
