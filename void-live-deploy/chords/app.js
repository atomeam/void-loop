// /chords/ (Versus' chord and scale finder lane site): chords, scales and keys from lib/music-tools.js, drawn as piano keys and guitar fingerings, and played.
import { CHORD_TYPES, SCALE_TYPES, NOTE_NAMES, chordOf, chordMidi, guitarVoicings, scaleOf, scalesWith, identifyChord, chordsInKey, nextChords, PROGRESSIONS, keySignature, circleOfFifths, transposeSymbol, isBlack, pitchClass, STRINGS_STANDARD, noteName, fretboardMap, fretsToPcs } from '/lib/music-tools.js';
import { audio, startNote } from '/lib/music-audio.js';
import { mountRelated } from '/lib/toolkit.js';
import { $, boot, t, wire, num } from '/lib/music-ui.js';

const say_ = () => {};
const q = new URLSearchParams(location.search);
/** draws a keyboard from C3 to B5 into an inner element, lighting the given MIDI notes (exact) or pitch classes. */
function kb(inner, lit, byPc = false) {
  inner.textContent = ''; let wi = 0; const W = 44;
  for (let m = 48; m <= 83; m++) {
    const on = byPc ? lit.has(m % 12) : lit.has(m); const b = document.createElement('div'); b.setAttribute('aria-hidden', 'true');
    if (isBlack(m)) { b.className = 'bk' + (on ? ' on' : ''); b.style.left = wi * W + 'px'; if (on) b.textContent = noteName(m, true).replace(/\d/, ''); }
    else { b.className = 'wk' + (on ? ' on' : ''); wi++; b.style.minHeight = '0'; if (on) b.textContent = NOTE_NAMES[m % 12]; }
    inner.append(b);
  }
}
function guitarSvg(v) {
  const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'); s.setAttribute('viewBox', '0 0 120 140'); s.setAttribute('class', 'dia'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', t('Guitar fingering, strings low to high:') + ' ' + v.label);
  const el = (n, a, tx) => { const e = document.createElementNS(ns, n); for (const k in a) e.setAttribute(k, a[k]); if (tx != null) e.textContent = tx; s.append(e); return e; };
  for (let i = 0; i < 6; i++) el('line', { x1: 20 + i * 16, y1: 30, x2: 20 + i * 16, y2: 130, 'stroke-width': 1.2 });
  for (let f = 0; f <= 4; f++) el('line', { x1: 20, y1: 30 + f * 25, x2: 100, y2: 30 + f * 25, 'stroke-width': f === 0 && v.base === 1 ? 4 : 1.2 });
  if (v.base > 1) el('text', { x: 4, y: 46 }, v.base + 'fr');
  v.frets.forEach((f, i) => { const x = 20 + i * 16; if (f === null) el('text', { x: x - 4, y: 22 }, '×'); else if (f === 0) el('circle', { cx: x, cy: 20, r: 4, fill: 'none', stroke: 'currentColor' }); else { const row = f - (v.base > 1 ? v.base : 1); el('circle', { cx: x, cy: 42 + row * 25, r: 6, class: 'dotf' }); } });
  return s;
}
function chordView() {
  const root = $('cRoot').value, type = $('cType').value, inv = +$('cInv').value, c = chordOf(root, type); if (!c) return;
  const mids = chordMidi(root, type, 3, inv); $('cName').firstChild.nodeValue = c.symbol + ' '; $('cNotes').textContent = c.name + ': ' + c.notes.join(' ');
  kb($('cKbi'), new Set(mids)); const box = $('gtr'); box.textContent = ''; const vs = guitarVoicings(root, type, 4);
  if (!vs.length) { const p = document.createElement('p'); p.className = 'note'; p.textContent = t('No easy guitar shape for this chord in the first 12 frets.'); box.append(p); }
  for (const v of vs) { const d = document.createElement('div'); d.append(guitarSvg(v)); const p = document.createElement('p'); p.className = 'note'; p.style.textAlign = 'center'; p.textContent = v.label; d.append(p); box.append(d); }
  $('cInv').querySelectorAll('option').forEach((o, i) => { o.disabled = i >= c.pcs.length; }); if (inv >= c.pcs.length) $('cInv').value = '0';
}
const playMidis = (mids, gap = 0) => { if (!audio()) return; const t0 = audio().currentTime + 0.05; mids.forEach((m, i) => startNote(m, 'piano', 0.7, t0 + i * gap, gap ? 0.5 : 1.8)); };
function scaleView() {
  const root = $('sRoot').value, type = $('sType').value, s = scaleOf(root, type); if (!s) return;
  $('sName').firstChild.nodeValue = s.name + ' '; $('sNotes').textContent = s.notes.join(' '); $('sSteps').textContent = s.steps; kb($('sKbi'), new Set(s.pcs), true);
  const minor = type === 'minor', sev = $('sev').checked, ch = chordsInKey(root, minor, sev), bySym = Object.fromEntries(ch.map((c) => [c.roman.replace(/7$/, ''), c.symbol])), tb = $('keyChords').tBodies[0]; tb.textContent = '';
  const major7 = ['major', 'minor'].includes(type);
  $('keyChords').hidden = !major7; if (!major7) { $('sig').textContent = t('Chords of a key are shown for major and natural minor.'); } else {
    for (const c of ch) { const r = tb.insertRow(); r.insertCell().textContent = c.roman; r.insertCell().textContent = c.symbol; r.insertCell().textContent = c.notes.join(' '); r.insertCell().textContent = nextChords(c.roman).map((x) => bySym[x] || x).join(', '); }
    const ks = keySignature(root, minor); $('sig').textContent = t('Key signature:') + ' ' + (ks === 0 ? t('no sharps or flats.') : Math.abs(ks) + ' ' + (ks > 0 ? t('sharps') : t('flats')) + '.');
    const ul = $('progs'); ul.textContent = ''; const key = (r) => r.replace(/[°ø]/g, '').replace(/7$/, '');
    const lookup = Object.fromEntries(chordsInKey(root, minor, false).map((c) => [key(c.roman), c.symbol]));
    for (const [prog, name] of PROGRESSIONS) { const syms = prog.split(' ').map((r) => lookup[r]); if (syms.some((x) => !x)) continue; const li = document.createElement('li'); li.textContent = prog + ' = ' + syms.join(' ') + ' · ' + name; ul.append(li); }
    if (!ul.children.length) { const li = document.createElement('li'); li.textContent = t('No common progression fits this mode.'); ul.append(li); }
  }
  neckView();
}
const NS = 'http://www.w3.org/2000/svg', NECK = { x0: 26, fw: 29, sh: 22, top: 14, frets: 12 };
/** a neck drawn as an SVG into `box`: strings lowest at the bottom, frets 0 to 12 left to right; cell(string, fret) gives { fill, label } for a dot or null. */
function drawNeck(box, cell, onPress) {
  box.textContent = ''; const { x0, fw, sh, top, frets } = NECK, W = x0 + frets * fw + 6, H = top + 5 * sh + 26, svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('role', 'img');
  const el = (n, a, tx) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (tx != null) e.textContent = tx; svg.append(e); return e; };
  for (let f = 0; f <= frets; f++) el('line', { x1: x0 + f * fw, y1: top, x2: x0 + f * fw, y2: top + 5 * sh, stroke: 'currentColor', 'stroke-width': f === 0 ? 3 : 1, opacity: f === 0 ? 0.9 : 0.4 });
  for (const f of [3, 5, 7, 9, 12]) el('text', { x: x0 + (f - 0.5) * fw, y: H - 6, 'text-anchor': 'middle' }, String(f));
  for (let i = 0; i < 6; i++) { const y = top + (5 - i) * sh; el('line', { x1: x0, y1: y, x2: x0 + frets * fw, y2: y, stroke: 'currentColor', 'stroke-width': 0.6 + (5 - i) * 0.0 + (i === 0 ? 1.4 : i === 1 ? 1.1 : i === 2 ? 0.9 : 0.6), opacity: 0.55 }); el('text', { x: 2, y: y + 3 }, noteName(STRINGS_STANDARD[i]).replace(/\d/, ''));
    for (let f = 0; f <= frets; f++) { const c = cell(i, f), cx = f === 0 ? x0 - 11 : x0 + (f - 0.5) * fw; if (c) { el('circle', { cx, cy: y, r: 8, fill: c.fill, stroke: 'var(--accent)', 'stroke-width': 1.2 }); if (c.label) el('text', { x: cx, y: y + 3, 'text-anchor': 'middle', style: c.fill === 'var(--accent)' ? 'fill:var(--on-accent)' : '' }, c.label); }
      if (onPress) { const hit = el('rect', { x: f === 0 ? x0 - 22 : x0 + (f - 1) * fw, y: y - sh / 2, width: f === 0 ? 22 : fw, height: sh, fill: 'transparent', style: 'cursor:pointer' }); hit.addEventListener('click', () => onPress(i, f)); } } }
  box.append(svg); return svg;
}
function neckView() {
  const s = scaleOf($('sRoot').value, $('sType').value); if (!s) return; const m = fretboardMap(s.pcs, s.root);
  const svg = drawNeck($('neck'), (i, f) => (m[i][f] ? { fill: m[i][f] === 2 ? 'var(--accent)' : 'var(--tint)', label: NOTE_NAMES[(STRINGS_STANDARD[i] + f) % 12] } : null)); svg.setAttribute('aria-label', s.name + ' on a guitar neck: ' + s.notes.join(' '));
}
const held = [null, null, null, null, null, null];
function pickNeck() {
  drawNeck($('pickNeck'), (i, f) => (held[i] === f ? { fill: 'var(--accent)', label: NOTE_NAMES[(STRINGS_STANDARD[i] + f) % 12] } : null), (i, f) => { held[i] = held[i] === f ? null : f; neckSync(); });
}
function neckSync() {
  for (const sel of $('neckSel').querySelectorAll('select')) { const v = held[+sel.dataset.s]; sel.value = v === null ? 'x' : String(v); }
  pickNeck(); const pcs = fretsToPcs(held), ids = identifyChord(pcs);
  $('neckOut').textContent = pcs.length < 2 ? t('Tap the neck or use the lists to hold frets; the chord is named here.') : (ids.length ? t('This is') + ' ' + ids.slice(0, 4).map((c) => c.symbol + ' (' + c.name + ')').join(', ') + '.' : t('No chord has exactly these notes.')) + ' ' + t('Notes') + ': ' + pcs.map((p) => NOTE_NAMES[p]).join(' ') + '.';
}
const picked = new Set();
function pickView() {
  const pcs = [...picked]; const ids = identifyChord(pcs), sc = scalesWith(pcs); const out = $('idOut');
  out.textContent = pcs.length < 2 ? t('Pick two or more notes to name the chord, and to see every scale that holds them.') : (ids.length ? t('This is') + ' ' + ids.slice(0, 4).map((c) => c.symbol + ' (' + c.name + ')').join(', ') + '.' : t('No chord has exactly these notes.'));
  const ul = $('idScales'); ul.textContent = ''; for (const s of sc.slice(0, 24)) { const li = document.createElement('li'); li.textContent = s.name; ul.append(li); }
  if (pcs.length && !sc.length) { const li = document.createElement('li'); li.textContent = t('No common scale holds all of them.'); ul.append(li); }
}
function circle() {
  const box = $('circle'); box.textContent = ''; for (const c of circleOfFifths()) { const b = document.createElement('button'); b.type = 'button'; const sg = c.signature; b.textContent = c.major + ' / ' + c.minor + ' · ' + (sg === 0 ? '0' : Math.abs(sg) + (sg > 0 ? '♯' : '♭')); b.setAttribute('aria-label', c.major + ' major, ' + c.minor.replace('m', '') + ' minor, ' + (sg === 0 ? 'no sharps or flats' : Math.abs(sg) + (sg > 0 ? ' sharps' : ' flats'))); b.onclick = () => { const r = c.major.replace('b', 'b'); $('sRoot').value = NOTE_NAMES.includes(r) ? r : NOTE_NAMES[pitchClass(r)]; $('sType').value = 'major'; scaleView(); $('sName').scrollIntoView({ block: 'center' }); }; box.append(b); }
}
function transposeView() { const by = num($('trBy'), -11, 11, 0), flats = by < 0 || /b/.test($('trIn').value); $('trOut').textContent = $('trIn').value.split(/\s+/).filter(Boolean).map((s) => transposeSymbol(s, by, flats)).join(' '); }

boot('/chords/', say_); mountRelated($('related'), '/chords/');
const sym = (q.get('chord') || q.get('q') || '').trim(), m = /^([A-Ga-g][#b]?)(.*)$/.exec(sym);
if (m) { const root = NOTE_NAMES.includes(m[1].toUpperCase()) ? m[1].toUpperCase() : NOTE_NAMES[pitchClass(m[1])]; if (CHORD_TYPES[m[2]] && root) { $('cRoot').value = root; $('cType').value = m[2]; } }
const sc = (q.get('scale') || '').trim(), sm = /^([A-Ga-g][#b]?)\s*(.*)$/.exec(sc);
if (sm) { const r = NOTE_NAMES[pitchClass(sm[1])]; const key = Object.keys(SCALE_TYPES).find((k) => SCALE_TYPES[k].name.toLowerCase().startsWith(sm[2].toLowerCase()) && sm[2]) || (/^min/i.test(sm[2]) ? 'minor' : 'major'); if (r) { $('sRoot').value = r; $('sType').value = key; } }
for (const id of ['cRoot', 'cType', 'cInv']) wire($(id), 'change', chordView); for (const id of ['sRoot', 'sType', 'sev']) wire($(id), 'change', scaleView);
wire($('cPlay'), 'click', () => playMidis(chordMidi($('cRoot').value, $('cType').value, 3, +$('cInv').value))); wire($('cArp'), 'click', () => playMidis(chordMidi($('cRoot').value, $('cType').value, 3, +$('cInv').value), 0.22));
wire($('sPlay'), 'click', () => { const s = scaleOf($('sRoot').value, $('sType').value); if (s) playMidis([...s.intervals.map((i) => 60 + s.root + i), 72 + s.root], 0.28); });
for (const b of $('pickNotes').children) wire(b, 'click', () => { const pc = pitchClass(b.dataset.pc); if (picked.has(pc)) picked.delete(pc); else picked.add(pc); b.setAttribute('aria-pressed', String(picked.has(pc))); pickView(); });
wire($('trIn'), 'input', transposeView); wire($('trBy'), 'change', transposeView);
for (const sel of $('neckSel').querySelectorAll('select')) wire(sel, 'change', () => { held[+sel.dataset.s] = sel.value === 'x' ? null : +sel.value; neckSync(); });
wire($('neckClear'), 'click', () => { held.fill(null); neckSync(); });
chordView(); scaleView(); pickView(); circle(); transposeView(); neckView(); pickNeck();
