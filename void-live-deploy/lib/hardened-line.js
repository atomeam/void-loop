// One of Verse's own hardening runs in one line (skills/showcase.js, skills/merges.js and the growth card, skills/growth.js). Pure.
/** what one of Verse's own upgrades did, from the line grow-self writes (it opens "Verse hardened itself:" and names the benchmark asks and
 *  the skills they are for, calendar-file, clock and web4, say): "Better at calendar file, clock and web4: 9 more ways of asking answered right". The first
 *  clause alone read "Verse hardened itself" on every one of them (owner, 2026-10-20: "it should be saying the upgrade not just Verse hardened
 *  itself a bunch of times"). null for any other line. Pure. */
export function hardenedLine(what) {
  const m = /^(?:Verse|Void|V01D) hardened itself:\s*(.+)$/i.exec(String(what || '').replace(/\s+/g, ' ').trim());
  if (!m) return null;
  const [asksPart, ...rest] = m[1].split(/\.\s+(?=Why these|New phrases|Added:|Did not route)/)[0].replace(/\.$/, '').split(/,? and (?=the card art)/i);
  const art = /card art/i.test(rest.join(' ') + ' ' + asksPart);
  const a = /^(\d+) benchmark ask\(s\) for (.+)$/i.exec(asksPart.trim());
  if (!a) return art ? 'Sharper card art: my art scores went up' : null;
  // keep the richer "Why these / Added / Did not route" tail when present (owner 2026-10-21)
  // the actual new phrases and the skill each now opens (owner, 2026-10-21: "list the actual new phrases and which skill they now open, not just a count")
  const ph = /New phrases:\s*(.+?)\.(?:\s+Did not route|\s*$)/.exec(m[1]);
  const tail = ph ? ' \u2014 new phrases: ' + ph[1].trim() : m[1].includes('Added:') ? ' \u2014 added: ' + m[1].split('Added:')[1].split(/\.\s+Did not route/)[0].replace(/\.$/, '').trim() : '';
  const names = a[2].split(/,\s*/).map((x) => x.replace(/-/g, ' ').trim()).filter(Boolean);
  const shown = names.length > 3 ? names.slice(0, 3).concat(names.length - 3 + ' more') : names;
  const list = shown.length > 1 ? shown.slice(0, -1).join(', ') + ' and ' + shown[shown.length - 1] : shown[0];
  return 'Better at ' + list + ': ' + a[1] + ' more ways of asking answered right' + (art ? ', and sharper card art' : '') + tail;
}
