// Expectation mining + generalize-every-miss (Adam: "Verse needs to learn to check things it can't think of yet").
// 1. mine:        from text Verse studied passively (a game's manual, a leading site's page, read by tools/rea-study.mjs / study-engine.mjs
//                 on the owner's machine), pull out the features players expect, from a vocabulary of basics. The text and where it came
//                 from stay in private memory (~/.verse-private/expectations, never in this public repo).
// 2. diff:        which of those a Verse game's code does not have: each one is a gap.
// 3. generalize:  a gap becomes a general rule that runs on EVERY game (tools/completeness-rules.json, read by tools/completeness.mjs), so the
//                 same miss is caught everywhere, including in games nobody has looked at yet.
// 4. wants:       each gap is filed as a want (topic only: game + feature), never studied text or a visitor's words.
//   node tools/expectations.mjs --game chess --text <private file>   mine, diff, print wants; --learn also adds the general rules
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { pathToFileURL } from 'node:url';
const here = path.dirname(new URL(import.meta.url).pathname);
export const LEARNED = path.join(here, 'completeness-rules.json');
// feature: words that show a manual expects it, and code that shows Verse has it
export const VOCAB = {
  'hint': { says: /\bhints?\b|suggest(ed)? move/i, has: /hint|suggest/i },
  'timer': { says: /\btimer\b|\bclock\b|time control/i, has: /timer|clock|elapsed/i },
  'stats': { says: /\bstatistics\b|\bstats\b|win rate|streak/i, has: /stats|streak|record\(/i },
  'difficulty': { says: /difficulty|\blevels?\b|easy|hard mode/i, has: /level|difficulty/i },
  'sound': { says: /\bsound\b|\baudio\b|\bmute\b/i, has: /sound|audio|mute/i },
  'move-history': { says: /move (list|history)|notation|game log/i, has: /log|history|moves/i },
  'undo': { says: /\bundo\b|take ?back/i, has: /undo|take back/i },
  'tutorial': { says: /tutorial|learn to play|walkthrough/i, has: /tutorial|tip|how to play|g-rules/i },
  'balance': { says: /\bmoney\b|\bcash\b|\bbalance\b|\bchips\b/i, has: /balance|mono-players|stack|pot/i },
  'inventory': { says: /\bdeeds?\b|properties owned|\binventory\b|your hand/i, has: /holdings|inventory|hand/i },
  'trade': { says: /\btrad(e|ing)\b/i, has: /offer|trade/i },
  'mortgage': { says: /\bmortgage/i, has: /mortgage/i },
  'save': { says: /\bsave\b|resume|continue later/i, has: /save|localStorage/i },
  'settings': { says: /\bsettings\b|options|preferences/i, has: /settings|options|level/i },
  'rematch': { says: /rematch|play again|new game/i, has: /new game|again|rematch/i },
};
export function mine(text) { return Object.keys(VOCAB).filter((k) => VOCAB[k].says.test(String(text || ''))); }
export function diff(expected, src) { return expected.filter((k) => !VOCAB[k].has.test(src)); }
// a gap -> a general rule: every game whose code mentions the topic must also show the feature
export function generalize(feature, game) {
  const v = VOCAB[feature];
  return { id: 'learned-' + feature, need: 'should', label: 'expected ' + feature.replace('-', ' ') + ' (learned from a miss in ' + game + ')', applies: v.says.source, has: v.has.source, origin: 'mined gap in ' + game };
}
export function learn(rules, file = LEARNED) {
  const cur = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  for (const r of rules) if (!cur.some((c) => c.id === r.id)) cur.push(r);
  fs.writeFileSync(file, JSON.stringify(cur, null, 2) + '\n'); return cur;
}
export const wantsOf = (game, gaps) => gaps.map((f) => ({ kind: 'want', topic: game + ': ' + f.replace('-', ' '), source: 'expectation mining' }));
export const privateDir = () => path.join(os.homedir(), '.verse-private', 'expectations');

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const game = a('--game'), file = a('--text');
  if (!game || !file) { console.log('usage: node tools/expectations.mjs --game <name> --text <private study text> [--learn]'); process.exit(0); }
  const src = fs.readFileSync(path.join(here, '..', 'void-live-deploy', 'skills', game + '.js'), 'utf8');
  const gaps = diff(mine(fs.readFileSync(file, 'utf8')), src);
  fs.mkdirSync(privateDir(), { recursive: true }); fs.writeFileSync(path.join(privateDir(), game + '.json'), JSON.stringify({ game, gaps, at: new Date().toISOString() }));
  console.log(JSON.stringify(wantsOf(game, gaps)));
  if (process.argv.includes('--learn')) console.log('rules: ' + learn(gaps.map((g) => generalize(g, game))).length);
}
