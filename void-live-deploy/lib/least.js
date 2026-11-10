// The Tower. A site is finished only when every job it does has been run and held.
// Fewest jobs first is how the next site is chosen. That order is not shown.
// Tests: tools/least.test.mjs.

const escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** rotate letters by `places`. Everything that is not a letter stays. Pure. */
export function rotateLetters(text, places) {
  const k = ((Number(places) % 26) + 26) % 26;
  return String(text == null ? '' : text).replace(/[a-z]/gi, (c) => {
    const b = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - b + k) % 26 + 26) % 26 + b);
  });
}

/** Verse's own words for the plain page. The site that made the argument is not copied. */
export const ESSAY = 'A page can be words. This one is. It uses the headings and paragraphs a browser already knows how to show. It does not load a picture, a font file, or a script to make its point.\n\nThe words wrap on a small screen and on a large one. With every style turned off, the words are still the page. Ornament can help a person. It is also what makes a page heavy, slow, or hard to read. This is Verse\'s own telling of that argument.';

/** tsundere.pw on 10 November 2026: a start time and a piece. No sound. */
export const TRACKS = [['0:00', '21st Century Schizoid Man (including Mirrors)'], ['7:24', 'I Talk To The Wind'], ['13:29', 'Epitaph (including March for No Reason and Tomorrow and Tomorrow)'], ['22:16', 'Moonchild (including The Dream and The Illusion)'], ['34:28', 'The Court Of The Crimson King (including The Return of the Fire Witch and The Dance of the Puppets)']];

export function silentList(tracks = TRACKS) {
  return { sound: false, lines: tracks.map(([at, name]) => at + '  ' + name) };
}

export const JOBS = {
  'rotate-letters': { words: 'rotate letters by a number of places you choose', prove: () => { const a = rotateLetters('Hello, world!', 13); return a === 'Uryyb, jbeyq!' && rotateLetters(a, 13) === 'Hello, world!' && rotateLetters('Az!', 1) === 'Ba!'; } },
  'plain-text': { words: 'show a page whose only design is readable text, to argue for that', prove: () => ESSAY.split(/\s+/).length > 60 && !/<(?:style|script)\b/i.test(ESSAY) },
  'silent-list': { words: 'show a timed list of pieces and play no sound', prove: () => { const l = silentList(); return l.sound === false && l.lines.length === 5 && l.lines[0].startsWith('0:00  21st'); } },
};

// Read 10 November 2026. `aside` stays in the record: Verse cannot offer it yet, and it is not dropped.
export const SITES = [
  { host: 'motherfuckingwebsite.com', url: 'https://motherfuckingwebsite.com/', page: '/sites/motherfuckingwebsite.com/', jobs: [{ id: 'plain-text', words: JOBS['plain-text'].words }] },
  { host: 'rot13.com', url: 'https://rot13.com/', page: '/sites/rot13.com/', jobs: [{ id: 'rotate-letters', words: JOBS['rotate-letters'].words }] },
  { host: 'tsundere.pw', url: 'https://tsundere.pw/', page: '/memes/#tsundere-pw', jobs: [{ id: 'silent-list', words: JOBS['silent-list'].words }] },
  { host: 'hackertyper.net', url: 'https://hackertyper.net/', page: '', jobs: [{ id: 'type-code', words: 'fill the screen with code as you type' }, { id: 'type-look', words: 'change the colour, speed, font and size of that code' }] },
  { host: 'yesno.wtf', url: 'https://yesno.wtf/', page: '', jobs: [{ id: 'yes-no', words: 'answer yes, no, or maybe' }, { id: 'yes-picture', words: 'hand back a picture with that answer' }] },
  { host: 'neverssl.com', url: 'http://neverssl.com/', page: '', aside: 'Verse is hosted where every address is encrypted. This site has to stay unencrypted so a wifi sign-in page can interrupt it. That needs a host that answers in the clear.', jobs: [{ id: 'plain-http', words: 'answer over plain HTTP and never switch to encryption, so a wifi sign-in page can interrupt' }] }, // void-review: ok (this site's real address is plain HTTP on purpose; Verse does not request it)
];

const held = (id) => { try { return !!(JOBS[id] && JOBS[id].prove()); } catch (_) { return false; } };
const byLeast = (a, b) => a.jobs.length - b.jobs.length || a.host.localeCompare(b.host);
export const running = () => SITES.filter((s) => !s.aside).slice().sort(byLeast);
export const doneSites = () => running().filter((s) => s.jobs.every((j) => held(j.id)));
export const nextSite = () => running().find((s) => !s.jobs.every((j) => held(j.id))) || null;
const names = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
export const cardSay = () => { const d = doneSites(); return d.length ? 'Finished: ' + names(d.map((s) => s.host)) + '.' : 'No site is finished yet.'; };

export function cardHtml(esc = escHtml) {
  const d = doneSites();
  const lead = d.length ? 'These sites are finished. Open a page to use it, and to read where the site came from.' : 'No site is finished yet.';
  const items = d.map((s) => '<li><a href="' + esc(s.page) + '">' + esc(s.host) + '</a> — ' + esc(s.jobs.map((j) => j.words).join('; ')) + '</li>').join('');
  return '<div class="tw"><h2 class="tw-head">Tower</h2><p>' + esc(lead) + '</p>' + (items ? '<ul class="tw-done">' + items + '</ul>' : '') + '<p><a href="/conquered/">The whole list</a></p></div>';
}

/** plain words for the self card: what Verse can do, which sites have pages, and the next job. */
export function selfLead(recent = '') {
  const d = doneSites(), n = nextSite(), can = [...new Set(d.flatMap((s) => s.jobs.map((j) => j.words)))];
  const bits = [];
  if (can.length) bits.push('Verse can ' + names(can) + '.');
  if (d.length) bits.push('It has a page for ' + names(d.map((s) => s.host)) + '.');
  const built = String(recent || '').replace(/\s+/g, ' ').trim();
  if (built) bits.push('Just built: ' + built);
  if (n) bits.push('Next: ' + n.jobs.filter((j) => !held(j.id)).map((j) => j.words).join('; ') + ', from ' + n.host + '.');
  return bits.join(' ');
}
