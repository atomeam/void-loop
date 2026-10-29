/**
 * backlog-digest skill - "digest your backlog": Verse's unbuilt asks grouped by skill family with the weakest evidence rating of the skills they name (asked by Verse). Own records, no model.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 *   match: true when this skill should take the ask (the first skill in skills/order/ to say yes wins).
 *   run:   shows the answer; api.showPage(build) puts a card on the stage and api.esc escapes text. Return the skill's name.
 */
import { digestOf, digestHtml } from '../lib/backlog-digest.js';
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[\u2019']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const BY = '(?: by (?:skill )?family(?: and evidence(?: rating)?)?| by evidence(?: rating)?)?';
const WHEN = new RegExp('^(?:(?:please )?(?:digest|summari[sz]e|sum up|group|break down) (?:your|(?:verse|v01d)\'s|(?:verse|void)\'s|verse\'s) (?:backlog|unbuilt asks|open asks|asks not built)' + BY + '|(?:your |the )?backlog digest|(?:backlog|asks) by (?:skill )?family(?: and evidence(?: rating)?)?)$');
const get = async (u) => { try { const r = await fetch(u, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (_) { return null; } };

async function run(text, api) {
  const { showPage, esc } = api;
  const [reflect, fam, ledger] = await Promise.all([get('/api/reflect'), get('/skills/families.json'), get('/void.growth.json')]);
  showPage((el) => {
    el.innerHTML = reflect && Array.isArray(reflect.asks) ? digestHtml(digestOf(reflect.asks, fam, Date.now(), ledger), esc)
      : '<h2>Backlog digest</h2><p>I could not read my asks just now, so I will not guess at them.</p>';
  });
  return 'backlog-digest';
}

export default {
  name: 'backlog-digest',
  about: "My unbuilt asks grouped by skill family, with the weakest evidence rating of the skills each one names.",
  examples: [
    "digest your backlog",
    "backlog digest",
    "summarise your unbuilt asks by family"
  ],
  nearMisses: [
    "what is your backlog",
    "digest my email",
    "name all your unbuilt asks"
  ],
  match(lower, text) { return WHEN.test(CLEAN(text || lower)); },
  run, digestOf, digestHtml
};
