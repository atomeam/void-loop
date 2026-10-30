// wordMath out of the page, for tests (asked by Verse: "Refactor the 5614-line wordMath() function into smaller, manageable modules").
// void.html keeps wordMath as an ordered list of parts (wmPercentsAndUnits ... wmExpression); this loads it, with the tables it
// reads, into a sandbox so each part can be tested on its own and the whole is pinned to tools/word-math.golden.json.
//   node tools/word-math.mjs --write   rewrite the golden answers (only after a deliberate change to word maths)
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAGE = path.join(root, 'void-live-deploy/void.html'), GOLDEN = path.join(root, 'tools/word-math.golden.json');
const TABLES = ['TIME_S', 'unitOf', 'numberWords', 'KA', 'cupSrc', 'CUP_GRAMS', 'gcdOf', 'SOUND', 'LUMENS', 'DRINKS', 'WATER_POINTS', 'RICE', 'RICE_SERVE', 'COFFEE', 'MEAT', 'NFL_FIELD', 'IFAB_FIELD', 'POOL', 'HOOP', 'STRIDE', 'ITU_HD', 'ITU_UHD', 'DCI_FORMATS', 'SIZE_FACTS', 'CALC_HOLIDAYS', 'CALC_MONTHS', 'ABBR', 'CALC_UNITS', 'MORE_UNITS'];
export const PARTS = ['wmPercentsAndUnits', 'wmEverydayCounts', 'wmUnitQuestions', 'wmClockAndDates', 'wmGeometry', 'wmMoney', 'wmDataUnits', 'wmExpression'];
export function load(file = PAGE, now = null) {
  const L = fs.readFileSync(file, 'utf8').split('\n'), defs = [];
  for (const n of TABLES) {
    const i = L.findIndex((l) => new RegExp('^    (?:const|let|var|function)\\s+' + n + '\\b').test(l)); if (i < 0) throw new Error('void.html: ' + n + ' not found');
    let k = i + 1; while (k < L.length && !(/^    \S/.test(L[k]) && !/^    [}\])]/.test(L[k]))) k++; defs.push(L.slice(i, k).join('\n'));
  }
  const s = L.findIndex((l) => l.startsWith('    // wordMath, in parts')), e = L.findIndex((l) => l.startsWith('    function wordMath(lower)'));
  let j = e + 1; while (L[j] !== '    }') j++;
  const ctx = {}; if (now != null) { const D = Date; ctx.Date = class extends D { constructor(...a) { a.length ? super(...a) : super(now); } static now() { return now; } }; } vm.createContext(ctx);
  return vm.runInContext(defs.join('\n') + '\n' + L.slice(s, j + 1).join('\n') + '\n;({ wordMath, WM_NEXT, ' + PARTS.join(', ') + ' })', ctx);
}
export const answer = (f, a) => { try { const r = f(a); return r == null ? null : r; } catch (e) { return 'ERR'; } };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--write')) {
  const W = load(), W2 = load(PAGE, Date.parse('2031-03-07T11:22:33Z')), asks = new Set(JSON.parse(fs.readFileSync(path.join(root, 'tools/bench.json'), 'utf8')).map((x) => x.ask));
  for (const l of fs.readFileSync(PAGE, 'utf8').matchAll(/['"]([a-z0-9][^'"\n]{3,80})['"]/g)) asks.add(l[1]);
  const out = {}; for (const a of [...asks].sort()) { const r = answer(W.wordMath, a.toLowerCase()); if (r && r !== 'ERR' && JSON.stringify(r) === JSON.stringify(answer(W2.wordMath, a.toLowerCase()))) out[a] = r; } // answers that move with the clock are left out
  fs.writeFileSync(GOLDEN, JSON.stringify(out, null, 0).replace(/,"/g, ',\n"') + '\n'); console.log(Object.keys(out).length + ' golden answers');
}
