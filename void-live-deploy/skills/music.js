/**
 * music skill - "make me a song", "make a beat", "a lullaby", "music for a rainy day": Verse composes an original short piece (owner, 2026-10-17:
 * "void should also learn how to make music"). The tempo, key, scale, chords, melody and drum pattern come from the mood word and a seed made of the
 * ask's own words (lib/compose.js), so the same ask gives the same piece. It plays in the browser with Web Audio on real recordings (owner,
 * 2026-10-30: "needs real beats and music ... not just rap all music"): a Steinway grand piano and a recorded drum kit or TR-808, loaded before
 * the first note; a part whose recordings do not load is synthesised, and the card says which. No model, no paid service. The card shows what was composed as a piano roll, plays and stops it, saves it as a WAV (OfflineAudioContext) and copies the notes.
 * Sung songs: when the owner's Modal singer is switched on (functions/api/sing.js, lib/sing.js), the owner and members also get "Sing it": the same
 * ask sung by ACE-Step 1.5 in Verse's own haunting voice, with words the free model writes. The button is not shown to anyone else.
 * Evidence: a new skill starts as an experiment (tools/families.mjs rates it from its tests; nothing here claims more).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { compose, describe, notesText, renderWav, schedule, noteName, instrumentsFor, playedLine } from '../lib/compose.js';
import { arrange, scheduleArranged, arrangedWav, sectionsLine, sectionsSvg, arrangedLine } from '../lib/arrange.js'; // a heavy ask (lib/arrange.js): a song with a shape

const KINDS = '(?:song|songs|tune|beat|beats|lullaby|melody|jingle|music|soundtrack|ditty|loop)';
const WHEN = new RegExp('^(?!.*\\b(?:list|lyrics|playlist|chords|sheet)\\b)(?:please\\s+|can you\\s+|could you\\s+|will you\\s+)?(?:(?:make|compose|write|create|generate|give|play|cook up)(?:\\s+(?:me|us))?\\s+(?:a\\s+|an\\s+|some\\s+|my\\s+|another\\s+|new\\s+)?(?:[a-z]+\\s+){0,3}?' + KINDS + '(?:\\s+(?:for|about|to|in|with)\\s+.{1,60})?|music\\s+for\\s+.{2,60}|(?:a|an)\\s+(?:[a-z]+\\s+){0,2}' + KINDS + '\\s+(?:for|about)\\s+.{2,60})\\s*[?.!]*$', 'i');
// "play some music" and "play me a song" ask for a recording, not for Verse to compose one
const PLAY_ONLY = /^(?:please\s+)?play\b(?!.*\b(?:made|new|original)\b)/i;

const esc2 = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** the piano roll as inline SVG: chords as a faint band, melody and bass notes as bars by pitch, drums as three rows of ticks. Pure. */
export function rollSvg(p) {
  const W = 320, H = p.sections ? 172 : 150, rollH = 100, x = (s) => (s / p.steps) * W;
  const midis = [...p.melody, ...p.bass].map((n) => n.midi), lo = Math.min(...midis), hi = Math.max(...midis), span = Math.max(12, hi - lo + 1), y = (m) => rollH - 6 - ((m - lo) / span) * (rollH - 12);
  let s = '<svg class="mu-roll" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc2('Piano roll of ' + p.title + ': ' + p.melody.length + ' melody notes, ' + p.bars + ' bars') + '" style="background:rgba(255,255,255,.04);border-radius:6px">';
  for (let b = 0; b < p.bars; b++) s += '<rect x="' + x(b * p.stepsPerBar).toFixed(1) + '" y="0" width="' + (W / p.bars - 1).toFixed(1) + '" height="' + rollH + '" fill="currentColor" opacity="' + (b % 2 ? 0.05 : 0.09) + '"/>';
  for (const n of p.bass) s += '<rect x="' + x(n.step).toFixed(1) + '" y="' + y(n.midi).toFixed(1) + '" width="' + Math.max(1.5, x(n.len) - 0.5).toFixed(1) + '" height="3" fill="currentColor" opacity=".45"/>';
  for (const n of p.melody) s += '<rect class="mu-note" x="' + x(n.step).toFixed(1) + '" y="' + y(n.midi).toFixed(1) + '" width="' + Math.max(1.5, x(n.len) - 0.5).toFixed(1) + '" height="4" rx="1" fill="hsl(' + (p.seed % 360) + ' 70% 65%)"><title>' + esc2(noteName(n.midi)) + '</title></rect>';
  [['kick', 0.9], ['snare', 0.6], ['hat', 0.35]].forEach(([k, o], i) => { for (const st of p.drums[k]) s += '<rect x="' + x(st).toFixed(1) + '" y="' + (rollH + 6 + i * 13) + '" width="2" height="9" fill="currentColor" opacity="' + o + '"/>'; });
  if (p.sections) s += sectionsSvg(p, W, 150); // the form under the roll: each section, as tall as its tension
  return s + '<line class="mu-head" x1="0" x2="0" y1="0" y2="' + rollH + '" stroke="currentColor" stroke-width="1.5" opacity="0"/></svg>';
}

// a whole sung song (functions/api/sing.js, lib/sing.js): ACE-Step on the owner's Modal account, for the owner and members. The button shows
// only when the server says singing is on and this visitor may sing; the first song after a quiet spell starts a GPU, so it can take minutes.
const me = () => { try { return JSON.parse(localStorage.getItem('a2m.void.me.v1') || 'null'); } catch (_) { return null; } };
const auth = () => { const m = me(), h = { 'content-type': 'application/json' }; if (m && m.token) h.authorization = 'Bearer ' + m.token; return h; };
function singButton(el, text, q, msg) {
  const b = q('.mu-sing'); if (!b || typeof fetch !== 'function') return;
  fetch('/api/sing', { headers: auth() }).then((r) => r.json()).then((s) => {
    if (!s || !s.on || !s.member || !el.isConnected) return;
    b.hidden = false; b.title = (s.left != null ? s.left + ' of ' + s.perDay : s.perDay) + ' sung songs left today';
  }).catch(() => {});
  let busy = false;
  b.addEventListener('click', async () => {
    if (busy) return; busy = true; b.disabled = true; msg('Verse is singing… the first song after a quiet spell can take a few minutes');
    try {
      const r = await fetch('/api/sing', { method: 'POST', headers: auth(), body: JSON.stringify({ ask: text }) });
      if (!r.ok) { let why = 'Verse could not sing just now'; try { why = (await r.json()).error || why; } catch (_) {} msg(why); return; }
      const blob = await r.blob(), u = URL.createObjectURL(blob), box = q('.mu-sung'); box.textContent = '';
      const a = document.createElement('audio'); a.controls = true; a.src = u; a.style.cssText = 'width:100%;margin:6px 0';
      const dl = document.createElement('a'); dl.href = u; dl.download = 'verse-sings.mp3'; dl.textContent = 'Save the sung song (MP3)';
      let words = ''; try { words = decodeURIComponent(r.headers.get('x-verse-lyrics') || ''); } catch (_) {}
      box.append(a, dl);
      if (words) { const d = document.createElement('details'), s = document.createElement('summary'), pre = document.createElement('pre'); s.textContent = 'The words Verse sang'; pre.textContent = words; pre.style.cssText = 'white-space:pre-wrap;font-size:13px'; d.append(s, pre); box.append(d); }
      msg(r.headers.get('x-verse-sing') === 'cached' ? 'sung before; here it is again' : 'sung by Verse with ACE-Step 1.5');
      a.play && a.play().catch(() => {});
    } catch (_) { msg('Verse could not sing just now'); } finally { busy = false; b.disabled = false; }
  });
}

function run(text, api) {
  const { showPage, esc } = api, p = arrange(text) || compose(text); // arrange(): null unless the ask is a heavy one
  showPage((el) => {
    el.dataset.cardKind = 'Song';
    el.innerHTML = '<h2>' + esc(p.title) + '</h2><p>' + esc(describe(p)) + '</p>' + (p.sections ? '<p class="mu-form">Built in sections: ' + esc(sectionsLine(p)) + '. Quiet intro and bridge, hard drop, breakdown and climax; the pad and lead duck on every kick.</p>' : '') + rollSvg(p)
      + '<p class="mu-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><button type="button" class="mu-play">Play</button><button type="button" class="mu-wav">Save as WAV</button><button type="button" class="mu-copy">Copy the notes</button><button type="button" class="mu-sing" hidden>Sing it</button><span class="mu-msg" role="status" style="align-self:center;color:var(--ink-3)"></span></p>'
      + '<p class="mu-played" style="color:var(--ink-3);margin:0 0 8px"></p>'
      + '<div class="mu-sung"></div>'
      + '<div class="src">Made by Verse from the words of your ask, played in this browser (Web Audio)' + (p.sections ? ' on real drum, piano, bass and guitar recordings (the guitar amp is simulated)' : ' on real piano and drum recordings') + '. Evidence: experiment, a new skill. Rows below the roll: kick, snare, hat.</div>';
    const q = (s) => el.querySelector(s), msg = (t) => { const m = q('.mu-msg'); if (m) m.textContent = t; };
    for (const ev of ['pointerdown', 'keydown']) for (const b of el.querySelectorAll('button')) b.addEventListener(ev, (e) => e.stopPropagation());
    let ac = null, timer = 0, raf = 0, t0 = 0, dur = 0, inst = null, busy = false;
    // the real instruments, loaded once per card; decoded buffers play on any context, live or offline
    const instruments = async (ctx) => { if (!inst) { inst = await instrumentsFor(p, ctx); const pl = q('.mu-played'); if (pl) pl.textContent = p.sections ? arrangedLine(p, inst) : playedLine(p, inst); } return inst; };
    const stop = () => { clearTimeout(timer); cancelAnimationFrame(raf); try { ac && ac.close(); } catch (_) {} ac = null; const h = q('.mu-head'); if (h) h.setAttribute('opacity', '0'); const b = q('.mu-play'); if (b) b.textContent = 'Play'; };
    q('.mu-play').addEventListener('click', async () => {
      if (busy) return;
      if (ac) { stop(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { msg('This browser has no Web Audio.'); return; }
      try { ac = new AC(); ac.resume && ac.resume(); } catch (_) { msg('Could not start sound.'); ac = null; return; }
      const mine = ac; busy = true; if (!inst) msg(p.sections ? 'loading the band…' : 'loading the piano…');
      const kit = await instruments(ac).catch(() => ({})); busy = false; if (ac !== mine) return;
      dur = (p.sections ? scheduleArranged : schedule)(ac, p, ac.currentTime + 0.1, kit); t0 = ac.currentTime + 0.1; q('.mu-play').textContent = 'Stop'; msg('');
      const head = q('.mu-head'), tick = () => { if (!ac) return; const f = Math.max(0, Math.min(1, (ac.currentTime - t0) / (p.steps * 60 / p.bpm / 4))); if (head) { head.setAttribute('x1', f * 320); head.setAttribute('x2', f * 320); head.setAttribute('opacity', '.8'); } raf = requestAnimationFrame(tick); };
      tick(); timer = setTimeout(stop, dur * 1000 + 300);
    });
    q('.mu-wav').addEventListener('click', async () => {
      msg('rendering…');
      try {
        const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) { msg('This browser cannot render audio offline.'); return; }
        const kit = await instruments(new OAC(1, 1, 48000)).catch(() => ({}));
        const bytes = await (p.sections ? arrangedWav(p, OAC, kit) : renderWav(p, OAC, kit)); if (!bytes) { msg('This browser cannot render audio offline.'); return; }
        const u = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })), a = document.createElement('a');
        a.href = u; a.download = (p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'song') + '.v01d.wav'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); msg('saved');
      } catch (_) { msg('could not render'); }
    });
    singButton(el, text, q, msg);
    q('.mu-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(notesText(p)); msg('copied'); } catch (_) { msg('select and copy'); const t = document.createElement('pre'); t.textContent = notesText(p); t.style.cssText = 'white-space:pre-wrap;font-size:12px'; el.appendChild(t); } });
  });
  return 'music';
}

export default {
  name: 'music',
  examples: ['make me a song', 'make me a lullaby', 'make a beat', 'music for a rainy day', 'compose a happy tune', 'write me a spooky song for halloween', 'make a heavy metal song'],
  nearMisses: ['play some music', 'song lyrics for hello', 'what song is this', 'make me a sandwich', 'play me a song', 'music theory', 'who wrote this song', 'make a list of songs'],
  match(lower, text) { const t = String(text || lower).trim(); return !PLAY_ONLY.test(t) && WHEN.test(t); },
  run
};
