// "what can you do" (asked by Verse: "Implement a clear, useful answer for 'what can you do' for visitors"). A short, true answer: how many
// skills Verse has and in how many families, read from skills/families.json (written from the repo on every deploy by tools/families.mjs), and
// one family per line with what it is for and one ask to tap. The ask is taken from the family's best-proven skill that is loaded (the most
// real asks in the benchmark and browser-suite checks together), and only when that skill is the first loaded skill, in routing order, to take its own example: an ask on this
// card goes where the card says. Nothing on it is typed by hand, so it follows every new skill and every rename. Carries the first version of
// helper PR #2297 ("what can you do names the things Verse can put on the stage"), whose lead was a hand-written list.

/** the asks this answers: "what can you do", "what else can Verse do", not "what can you do now that you couldn't last week" (the growth card).
 *  The page holds the same pattern (void.html wantsCanDo; tools/can-do.test.mjs keeps them one). Pure. */
export const CAN_DO = /^what\s+(?:else\s+)?can\s+(?:you|u|(?:verse|void|v01d))\s+do\b(?!\s+(?:now\s+that|today\s+that|that\s+you))/;
export const asksCanDo = (lower) => CAN_DO.test(String(lower || '').toLowerCase().trim());

const BENCH = /(\d+) real asks? in the benchmark/, SUITE = /(\d+) browser-suite mentions?/;
/** how much a families.json row's why names: its real benchmark asks plus its browser-suite checks (0 when none). Pure. */
export const evidenceCount = (row) => { const w = String((row && row.why) || ''), b = BENCH.exec(w), s = SUITE.exec(w); return (b ? +b[1] : 0) + (s ? +s[1] : 0); };

/** the name of the first skill, in the order given, whose match takes the ask; '' when none. A match that throws takes nothing. Pure. */
export function firstMatch(skills, ask) {
  const a = String(ask || ''), lower = a.toLowerCase();
  for (const s of skills || []) {
    if (!s || typeof s.match !== 'function') continue;
    let hit = false; try { hit = !!s.match(lower, a); } catch (_) { hit = false; }
    if (hit) return String(s.name || '');
  }
  return '';
}

/** the answer's facts: { skills, families: [{ id, name, for, proven, total, ask, skill }] }, families in the file's order, each with the
 *  example of its best-proven loaded skill that routes to that skill; a family with no such example still has its line, without an ask.
 *  fam: families.json; loaded: the page's loaded skills in routing order ({ name, examples, match }). Pure. */
export function canDo(fam, loaded) {
  const fams = ((fam && fam.families) || []).filter((f) => f && Array.isArray(f.skills) && f.skills.length);
  const byName = new Map((loaded || []).filter((s) => s && s.name).map((s) => [s.name, s]));
  const families = fams.map((f) => {
    const proven = f.skills.filter((s) => s && s.tier === 'proven');
    const ranked = proven.filter((s) => byName.has(s.name)).sort((a, b) => evidenceCount(b) - evidenceCount(a) || String(a.name).localeCompare(String(b.name)));
    let ask = '', skill = '';
    for (const row of ranked) {
      const sk = byName.get(row.name), ex = (Array.isArray(sk.examples) ? sk.examples : []).find((e) => typeof e === 'string' && e.length <= 48 && firstMatch(loaded, e) === sk.name);
      if (ex) { ask = ex; skill = sk.name; break; }
    }
    return { id: String(f.id || ''), name: String(f.name || f.id || ''), for: String(f.for || ''), proven: proven.length, total: f.skills.length, ask, skill };
  });
  return { skills: families.reduce((n, f) => n + f.total, 0), families };
}

/** the family's "for" in a visitor's words: its first clause, before a colon ("board games ... and play: one picker" -> up to "play"). Pure. */
export const forWords = (s) => String(s || '').split(':')[0].trim();

/** the card's body below its title: the lead, then one line per family with its ask to tap. esc: the page's escaper. Pure. */
export function canDoHtml(esc, facts) {
  const fs = (facts && facts.families) || [];
  if (!fs.length) return '<p>I could not read my own list just now. Ask for anything anyway: a timer, the weather, a game, a page about any topic.</p>';
  const lead = 'Ask for anything and it appears here as a working card, game or page. I have ' + facts.skills + ' skills in ' + fs.length + ' families:';
  return '<p class="lead can-do-lead" style="font-size:17px;margin:4px 0 10px">' + esc(lead) + '</p>'
    + '<ul class="can-do" style="list-style:none;margin:0;padding:0">' + fs.map((f) => '<li data-family="' + esc(f.id) + '" style="padding:6px 0;border-top:1px solid rgba(255,255,255,.06)">'
      + '<b style="font-weight:600">' + esc(f.name) + '</b> <span style="color:#9a9fb0">' + esc(forWords(f.for)) + '</span>'
      + (f.ask ? '<br><a href="#" data-ask="' + esc(f.ask) + '" data-skill="' + esc(f.skill) + '" style="color:var(--fg);text-decoration:none">try “' + esc(f.ask) + '”</a>' : '') + '</li>').join('') + '</ul>'
    + '<p class="sub" style="margin-top:10px">Tap one, or type your own words. “menu” opens the whole book.</p>'
    + '<div class="src">From skills/families.json, written from the repo on every deploy</div>';
}
