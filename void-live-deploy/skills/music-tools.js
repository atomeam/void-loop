/**
 * music-tools skill (owner, 2026-10-26: "we have to have everything all the sites have"): the music tool pages as a card on the stage. "metronome 120 bpm",
 * "online piano", "guitar tuner", "tap tempo", "am7 chord", "c major scale", "circle of fifths" answer with the page that does it, opened on the thing asked
 * (the tempo, the chord, the scale), and the other music pages beside it. "play a D minor 9 chord at 432 Hz" plays it right on the card with Web Audio
 * (extended chord suffixes m9/min9/maj9/9/11/13/7sus4/7b9/mmaj7, word forms like "D minor 9", and a custom A4 reference pitch, default 440). Nothing is
 * made here that the pages do not already know: every chord is validated against lib/music-tools.js (chordOf) and every frequency is freqOfMidi(midi, hz).
 * "make me a song" stays with the music skill. Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { chordMidi, chordToken, freqOfMidi } from '../lib/music-tools.js';
const NOTE = '[a-g][#b]?';
const PAGES = [['/metronome/', 'Metronome', 'tap tempo, accents, subdivisions, 9 sounds, a timer and setlists'], ['/piano/', 'Piano', 'computer keys, touch and MIDI, 12 instruments, sustain, sheets'], ['/tuner/', 'Tuner', 'microphone, guitar, bass, ukulele, violin and more'], ['/bpm/', 'BPM counter', 'tap to the beat, note lengths, the tempo of a file'], ['/chords/', 'Chords and scales', 'finder, guitar shapes, keys and the circle of fifths'], ['/music/', 'Setlists and catalogue', 'saved tempos, tempo words, practice recommendations']];
const RULES = [
  [new RegExp('^(?:an? |the |online |free )*metronome(?: (?:at|for))? ?(\\d{2,3}) ?(?:bpm)?(?: (\\d{1,2}/\\d{1,2}))?$|^(\\d{2,3}) ?bpm ?(?:(\\d{1,2}/\\d{1,2}) ?)?metronome$', 'i'), (m) => ['/metronome/?bpm=' + (m[1] || m[3]) + (m[2] || m[4] ? '&sig=' + encodeURIComponent(m[2] || m[4]) : ''), 'Metronome at ' + (m[1] || m[3]) + ' BPM' + (m[2] || m[4] ? ' in ' + (m[2] || m[4]) : '')]],
  [/^(?:an? |the |online |free |open )*(?:metronome|click track)(?: online)?$/i, () => ['/metronome/', 'Metronome']],
  [/^(?:an? |the |online |free |virtual |play )*(?:piano|keyboard piano|virtual keyboard)(?: online)?$/i, () => ['/piano/', 'Online piano']],
  [/^(?:an? |the |online |free |chromatic |instrument )*(?:guitar |bass |ukulele |violin |cello )?tuner(?: online)?$|^tune (?:my |a |the )?(?:guitar|bass|ukulele|violin|cello)$/i, (m, t) => [/ukulele/i.test(t) ? '/tuner/?tun=ukulele' : /bass/i.test(t) ? '/tuner/?tun=bass4' : /violin/i.test(t) ? '/tuner/?tun=violin' : /cello/i.test(t) ? '/tuner/?tun=cello' : '/tuner/', 'Tuner']],
  [/^(?:tap tempo|tap bpm|bpm counter|bpm tapper|bpm finder|find (?:the )?bpm|what(?:'s| is) the bpm)$/i, () => ['/bpm/', 'BPM counter']],
  [/^play\s+(?:a\s+|an\s+|the\s+)?(.+?)\s+chord(?:\s+at\s+(\d{2,4})\s*hz)?$/i, (m) => {
    const c = chordToken(m[1]);
    if (!c) return null;
    let hz = +(m[2] || 440);
    if (!(hz >= 100 && hz <= 1000)) hz = 440;
    return ['/chords/?chord=' + encodeURIComponent(c.symbol), c.symbol + ' chord' + (hz === 440 ? '' : ' at ' + hz + ' Hz'), { root: c.root, type: c.type, hz }];
  }],
  [new RegExp('^(' + NOTE + '.+?) chord$', 'i'), (m) => {
    const c = chordToken(m[1]);
    return c ? ['/chords/?chord=' + encodeURIComponent(c.symbol), c.symbol + ' chord'] : null;
  }],
  [new RegExp('^(' + NOTE + ') (major|minor|dorian|mixolydian|lydian|phrygian|blues|pentatonic) scale$', 'i'), (m) => ['/chords/?scale=' + encodeURIComponent(m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2]), m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2] + ' scale']],
  [/^(?:an? |the )*(?:chord|chords|scale|scales) (?:finder|chart|dictionary|identifier)$|^circle of fifths$/i, () => ['/chords/', 'Chords and scales']],
  [/^(?:music tools|musician tools|music practice tools|my setlists?|setlists?)$/i, () => ['/music/', 'Music tools']],
];
const pick = (t) => { for (const [re, f] of RULES) { const m = re.exec(t); if (m) { const hit = f(m, t); if (hit) return hit; } } return null; };

/** the chord's frequencies at A4 = hz, one per note, rounded to one decimal. Pure. */
export function chordFreqs(root, type, hz) {
  return chordMidi(root, type).map((midi) => Math.round(freqOfMidi(midi, hz) * 10) / 10);
}

function run(text, api) {
  const { showPage, esc } = api, hit = pick(String(text || '').trim().replace(/[?!.]+$/, '')) || ['/music/', 'Music tools'];
  showPage((el) => {
    el.dataset.page = hit[0].replace(/\?.*$/, '');
    const play = hit[2];
    let inner = '<h2>' + esc(hit[1]) + '</h2>';
    if (play) {
      const c = chordToken(play.root + play.type) || chordToken(play.root + ' ' + play.type);
      const freqs = chordFreqs(play.root, play.type, play.hz);
      const notes = (c ? c.notes : []).map((n, i) => n + ' ' + freqs[i] + ' Hz').join(' · ');
      inner += '<p>' + esc((c ? c.name : play.root + play.type) + (play.hz === 440 ? '' : ' · A4 = ' + play.hz + ' Hz')) + '</p>'
        + '<p>' + esc(notes) + '</p>'
        + '<p><button type="button" class="ms-play" style="font:inherit;padding:6px 22px;border-radius:16px;border:1px solid rgba(255,255,255,.4);background:rgba(143,180,255,.22);color:inherit;cursor:pointer;min-height:36px">Play</button></p>'
        + '<p><a href="' + esc(hit[0]) + '" style="font-weight:600">' + esc('Open in the Chords finder →') + '</a></p>';
    } else {
      inner += '<p>Free music tools that run on your device: every sound is made in your browser, nothing is sent, and they work offline.</p>' // void-review: ok: fixed text
        + '<p><a href="' + esc(hit[0]) + '" style="font-weight:600">' + esc('Open ' + hit[1] + ' →') + '</a></p>';
    }
    inner += '<ul style="padding-left:18px;margin:6px 0">'
      + PAGES.map(([h, n, d]) => '<li><a href="' + h + '">' + esc(n) + '</a>: ' + esc(d) + '</li>').join('') + '</ul>' // void-review: ok: fixed text and escaped
      + '<div class="src">Made by Verse · public-domain songs only · as of 2026-10</div>';
    el.innerHTML = inner; // void-review: ok: built only from fixed text and escaped values, Play wired below
    if (play && typeof el.querySelector === 'function') {
      const btn = el.querySelector('.ms-play');
      let ctx = null;
      const stop = () => { try { ctx && ctx.close(); } catch (_) { /* already closed */ } ctx = null; if (btn) btn.textContent = 'Play'; };
      btn && btn.addEventListener('click', () => {
        if (ctx) { stop(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { btn.textContent = 'No audio here'; return; }
        ctx = new AC();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const t0 = ctx.currentTime + 0.05;
        for (const f of chordFreqs(play.root, play.type, play.hz)) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'triangle'; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.22, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
          o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + 2.4);
        }
        btn.textContent = 'Stop';
        setTimeout(() => { if (ctx && btn.textContent === 'Stop') stop(); }, 2600);
      });
    }
  });
  return 'music-tools';
}

export default {
  name: 'music-tools',
  examples: ['metronome 120 bpm', 'online piano', 'guitar tuner', 'tap tempo', 'am7 chord', 'dm9 chord', 'd minor 9 chord', 'play a d minor 9 chord at 432 hz', 'c major scale', 'circle of fifths', 'music tools'],
  nearMisses: ['make me a song', 'play some music', 'a heavy metal song'],
  match(lower) { return !!pick(lower.trim().replace(/[?!.]+$/, '')); },
  run,
};
