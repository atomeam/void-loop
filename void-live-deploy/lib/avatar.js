// Avatars for the tower's fights (owner, 2026-10-25: "each site and verse should have an avatar face for the battle"; "could be just our logos but
// something visual to hype it up"). Two faces, both drawn here as inline SVG, nothing fetched:
//   faceSvg(seed, { size, facing })  a cartoon fighter for a site: head, hair, eyes, brow, mouth, skin and hair tone and one accessory, each picked
//                                    by a hash of the seed (the site's host), so the same site always has the same face. Never the site's logo,
//                                    favicon, brand colour or brand mark (lib/tower.js: a site is named in plain text only; nothing implies
//                                    affiliation): the tones come from one fixed cartoon palette, the shapes from fixed sets.
//   verseFace({ size })              Verse's own mark, the atom galaxy of its card art (lib/void-seal.js): a blazing nucleus with three tilted
//                                    orbits in violet, electric blue and gold, each with its star cluster, and a small friendly face in the core.
// Both are role="img" with a label. Pure: strings in, a string out, no DOM.

/** FNV-1a 32-bit of a string. Pure. */
export function hashOf(s) { let h = 0x811c9dc5; for (const ch of String(s == null ? '' : s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pick = (h, shift, n) => (((h >>> shift) ^ (h >>> (shift + 11))) >>> 0) % n; // XOR signs the number: back to unsigned before the modulo

// one fixed cartoon palette, the same for every site (no site's colours)
export const SKIN = ['#f6d3b3', '#e8b48c', '#c98a5e', '#9c5f3b', '#6b3f26', '#b9c9d8'];
export const HAIR = ['#1d1a22', '#5a3a22', '#d9b05a', '#b5452a', '#b8b8c4', '#2a2f5e', '#3f8f5a', '#c84f9a'];
const INK = '#17131d', MOUTH = '#2a1420';
const HEAD = [
  '<circle cx="50" cy="52" r="30"/>',
  '<path d="M22 32Q22 22 32 22H68Q78 22 78 32V68Q78 84 64 84H36Q22 84 22 68Z"/>',
  '<ellipse cx="50" cy="52" rx="27" ry="32"/>',
  '<path d="M20 40Q20 22 50 22Q80 22 80 40L74 72Q66 84 50 84Q34 84 26 72Z"/>',
];
const HAIRDO = [
  'M20 42L28 18L36 32L44 10L52 30L60 8L68 30L76 16L80 42Q50 30 20 42Z', // spikes
  'M22 22H78V38Q50 32 22 38Z', // flat top
  'M40 30L50 2L60 30Q50 26 40 30Z', // mohawk
  'M20 44Q22 18 52 20Q78 20 80 44Q68 30 54 36Q40 26 20 44Z', // swept
  'M23 36Q50 14 77 36Q50 30 23 36Z', // buzz
  'M18 44Q20 16 50 18Q80 16 82 44L84 70L74 68L74 44Q50 30 26 44L26 68L16 70Z', // long
];
const EYES = [
  (p) => '<circle cx="38" cy="50" r="4.6" fill="#fff"/><circle cx="62" cy="50" r="4.6" fill="#fff"/><circle cx="39" cy="50.5" r="2.3" fill="' + p + '"/><circle cx="63" cy="50.5" r="2.3" fill="' + p + '"/><circle cx="40" cy="49" r=".8" fill="#fff"/><circle cx="64" cy="49" r=".8" fill="#fff"/>',
  (p) => '<path d="M30 50Q38 45 46 50Q38 54 30 50Z" fill="#fff"/><path d="M54 50Q62 45 70 50Q62 54 54 50Z" fill="#fff"/><circle cx="39" cy="50" r="2" fill="' + p + '"/><circle cx="63" cy="50" r="2" fill="' + p + '"/>',
  (p) => '<path d="M33 51Q38 44 43 51Z" fill="#fff"/><path d="M57 51Q62 44 67 51Z" fill="#fff"/><circle cx="38.5" cy="49.5" r="1.6" fill="' + p + '"/><circle cx="62.5" cy="49.5" r="1.6" fill="' + p + '"/>',
  (p) => '<circle cx="38" cy="50" r="5.6" fill="#fff"/><circle cx="62" cy="50" r="5.6" fill="#fff"/><circle cx="39" cy="51" r="3" fill="' + p + '"/><circle cx="63" cy="51" r="3" fill="' + p + '"/><circle cx="40.5" cy="49" r="1.1" fill="#fff"/><circle cx="64.5" cy="49" r="1.1" fill="#fff"/>',
];
const BROWS = ['M30 40L46 44M70 40L54 44', 'M30 41H46M54 41H70', 'M30 42Q38 35 46 41M54 41Q62 35 70 42'];
const MOUTHS = [
  '<path d="M36 68Q50 82 64 68Z" fill="' + MOUTH + '"/><path d="M38 68.5H62V72Q50 74.5 38 72Z" fill="#fff"/>', // grin with teeth
  '<path d="M38 71Q50 77 62 67" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>', // smirk
  '<path d="M38 71H62" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>', // grim
  '<ellipse cx="50" cy="72" rx="7" ry="6" fill="' + MOUTH + '"/>', // a shout
  '<path d="M36 69Q50 78 64 69" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/><path d="M58 69.5L60 74L62 69.5Z" fill="#fff"/>', // a fang
];
const EXTRAS = [
  () => '',
  (hair) => '<path d="M22 33H78V40H22Z" fill="#c43b3b" stroke="' + INK + '" stroke-width="2"/><path d="M78 36L92 30L88 42Z" fill="#c43b3b" stroke="' + INK + '" stroke-width="2"/>', // headband
  () => '<circle cx="62" cy="50" r="6.5" fill="#111"/><path d="M56 46L26 38M68 46L80 42" stroke="#111" stroke-width="2.2"/>', // eye patch
  () => '<path d="M66 56L72 68M64 62L71 60" stroke="#a04a4a" stroke-width="2.2" stroke-linecap="round"/>', // a scar
  () => '<circle cx="79" cy="58" r="2.4" fill="#e6c25a" stroke="' + INK + '" stroke-width="1"/>', // an earring
  () => '<circle cx="38" cy="50" r="7.5" fill="none" stroke="' + INK + '" stroke-width="2.5"/><circle cx="62" cy="50" r="7.5" fill="none" stroke="' + INK + '" stroke-width="2.5"/><path d="M45.5 50H54.5" stroke="' + INK + '" stroke-width="2.5"/>', // glasses
];

/** a site's fighter: the same seed, the same face; a different seed, a different one. `facing` 'right' (default) or 'left' mirrors it. Pure. */
export function faceSvg(seed, { size = 64, facing = 'right', label = '' } = {}) {
  const key = String(seed || '').toLowerCase().trim(), h = hashOf(key);
  const skin = SKIN[pick(h, 0, SKIN.length)], hair = HAIR[pick(h, 3, HAIR.length)], pupil = ['#2b1d3a', '#1e3a5a', '#3a2a1a', '#1d1a22'][pick(h, 6, 4)];
  const head = HEAD[pick(h, 9, HEAD.length)], hairdo = HAIRDO[pick(h, 12, HAIRDO.length)], eyes = EYES[pick(h, 15, EYES.length)](pupil);
  const brow = BROWS[pick(h, 18, BROWS.length)], mouth = MOUTHS[pick(h, 21, MOUTHS.length)], extra = EXTRAS[pick(h, 24, EXTRAS.length)](hair);
  const body = '<circle cx="50" cy="50" r="48" fill="#1b1826" stroke="#3a3550" stroke-width="2"/>'
    + '<path d="M40 76H60V92H40Z" fill="' + skin + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>'
    + '<g fill="' + skin + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round">' + head + '<circle cx="21" cy="54" r="5"/><circle cx="79" cy="54" r="5"/></g>'
    + '<path d="' + hairdo + '" fill="' + hair + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>'
    + eyes + '<path d="' + brow + '" fill="none" stroke="' + hair + '" stroke-width="3.6" stroke-linecap="round"/>'
    + '<path d="M50 52L47 61H52.5" fill="none" stroke="' + INK + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' + mouth + extra;
  const s = Math.max(8, Math.round(+size) || 64), name = label || ((key || 'a site') + "'s fighter");
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="' + esc(name) + '" class="av-face">'
    + (facing === 'left' ? '<g transform="translate(100 0) scale(-1 1)">' + body + '</g>' : body) + '</svg>';
}

// the three orbits of the atom galaxy (lib/void-seal.js: violet, electric blue, gold), each tilted its own way, with its star cluster
const ORBITS = [[275, 12, 0.72], [205, 70, 0.22], [44, -52, 0.5]];
const pt = (deg, phase) => { const t = phase * Math.PI * 2, a = (deg * Math.PI) / 180, x = Math.cos(t) * 41, y = Math.sin(t) * 13; return [50 + x * Math.cos(a) - y * Math.sin(a), 50 + x * Math.sin(a) + y * Math.cos(a)]; };
/** Verse's avatar: its atom-galaxy mark with a small friendly face in the nucleus. Pure. */
export function verseFace({ size = 64, label = 'Verse' } = {}) {
  const s = Math.max(8, Math.round(+size) || 64);
  let dust = ''; for (let i = 0; i < 26; i++) { const a = i * 2.399, r = 18 + ((i * 7919) % 27); dust += '<circle cx="' + (50 + Math.cos(a) * r).toFixed(1) + '" cy="' + (50 + Math.sin(a) * r).toFixed(1) + '" r="' + (i % 5 ? 0.7 : 1.1) + '" fill="#fff" opacity="' + (0.35 + (i % 4) * 0.15) + '"/>'; }
  const orbits = ORBITS.map(([hue, deg, ph]) => { const c = 'hsl(' + hue + ' 90% 66%)', [ex, ey] = pt(deg, ph);
    return '<ellipse cx="50" cy="50" rx="41" ry="13" transform="rotate(' + deg + ' 50 50)" fill="none" stroke="' + c + '" stroke-width="6" opacity=".5" filter="url(#vfa-b)"/>'
      + '<ellipse cx="50" cy="50" rx="41" ry="13" transform="rotate(' + deg + ' 50 50)" fill="none" stroke="' + c + '" stroke-width="2.4"/>'
      + '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="4.5" fill="' + c + '" opacity=".6" filter="url(#vfa-b)"/><circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="2.4" fill="#fff"/>'; }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="' + esc(label) + '" class="av-verse">'
    + '<defs><radialGradient id="vfa-n"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff9a3d" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="vfa-g"><stop offset="0" stop-color="#2a1a4a"/><stop offset="1" stop-color="#07060d"/></radialGradient>'
    + '<filter id="vfa-b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>'
    + '<circle cx="50" cy="50" r="48" fill="url(#vfa-g)" stroke="#5a4a8a" stroke-width="2"/>' + dust + orbits
    + '<circle cx="50" cy="50" r="19" fill="url(#vfa-n)" opacity=".85"/><circle cx="50" cy="50" r="11" fill="#fff6d6" stroke="#ffd36a" stroke-width="1.5"/>'
    // the face in the core: two bright eyes with a glint, confident brows, a small smile
    + '<ellipse cx="45.5" cy="48" rx="2.1" ry="2.6" fill="#3a1f6a"/><ellipse cx="54.5" cy="48" rx="2.1" ry="2.6" fill="#3a1f6a"/><circle cx="46.2" cy="47.2" r=".7" fill="#fff"/><circle cx="55.2" cy="47.2" r=".7" fill="#fff"/>'
    + '<path d="M42.5 44.2Q45.5 43 48 44.6M52 44.6Q54.5 43 57.5 44.2" fill="none" stroke="#3a1f6a" stroke-width="1.2" stroke-linecap="round"/>'
    + '<path d="M45 53Q50 57.5 55 53" fill="none" stroke="#3a1f6a" stroke-width="1.5" stroke-linecap="round"/></svg>';
}
