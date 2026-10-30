/**
 * music-tools skill (owner, 2026-10-26: "we have to have everything all the sites have"): the music tool pages as a card on the stage. "metronome 120 bpm",
 * "online piano", "guitar tuner", "tap tempo", "am7 chord", "c major scale", "circle of fifths" answer with the page that does it, opened on the thing asked
 * (the tempo, the chord, the scale), and the other music pages beside it. Nothing is made here: the pages make the sound. "make me a song" stays with the
 * music skill. Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const NOTE = '[a-g][#b]?', CHORD = '(?:m|maj7|m7|7|dim|dim7|aug|sus2|sus4|add9|m7b5|maj9|9|6|m6|5)?';
const PAGES = [['/metronome/', 'Metronome', 'tap tempo, accents, subdivisions, 9 sounds, a timer and setlists'], ['/piano/', 'Piano', 'computer keys, touch and MIDI, 12 instruments, sustain, sheets'], ['/tuner/', 'Tuner', 'microphone, guitar, bass, ukulele, violin and more'], ['/bpm/', 'BPM counter', 'tap to the beat, note lengths, the tempo of a file'], ['/chords/', 'Chords and scales', 'finder, guitar shapes, keys and the circle of fifths'], ['/music/', 'Setlists and catalogue', 'saved tempos, tempo words, practice recommendations']];
const RULES = [
  [new RegExp('^(?:an? |the |online |free )*metronome(?: (?:at|for))? ?(\\d{2,3}) ?(?:bpm)?(?: (\\d{1,2}/\\d{1,2}))?$|^(\\d{2,3}) ?bpm ?(?:(\\d{1,2}/\\d{1,2}) ?)?metronome$', 'i'), (m) => ['/metronome/?bpm=' + (m[1] || m[3]) + (m[2] || m[4] ? '&sig=' + encodeURIComponent(m[2] || m[4]) : ''), 'Metronome at ' + (m[1] || m[3]) + ' BPM' + (m[2] || m[4] ? ' in ' + (m[2] || m[4]) : '')]],
  [/^(?:an? |the |online |free |open )*(?:metronome|click track)(?: online)?$/i, () => ['/metronome/', 'Metronome']],
  [/^(?:an? |the |online |free |virtual |play )*(?:piano|keyboard piano|virtual keyboard)(?: online)?$/i, () => ['/piano/', 'Online piano']],
  [/^(?:an? |the |online |free |chromatic |instrument )*(?:guitar |bass |ukulele |violin |cello )?tuner(?: online)?$|^tune (?:my |a |the )?(?:guitar|bass|ukulele|violin|cello)$/i, (m, t) => [/ukulele/i.test(t) ? '/tuner/?tun=ukulele' : /bass/i.test(t) ? '/tuner/?tun=bass4' : /violin/i.test(t) ? '/tuner/?tun=violin' : /cello/i.test(t) ? '/tuner/?tun=cello' : '/tuner/', 'Tuner']],
  [/^(?:tap tempo|tap bpm|bpm counter|bpm tapper|bpm finder|find (?:the )?bpm|what(?:'s| is) the bpm)$/i, () => ['/bpm/', 'BPM counter']],
  [new RegExp('^(' + NOTE + CHORD + ') chord$', 'i'), (m) => ['/chords/?chord=' + encodeURIComponent(m[1][0].toUpperCase() + m[1].slice(1)), m[1][0].toUpperCase() + m[1].slice(1) + ' chord']],
  [new RegExp('^(' + NOTE + ') (major|minor|dorian|mixolydian|lydian|phrygian|blues|pentatonic) scale$', 'i'), (m) => ['/chords/?scale=' + encodeURIComponent(m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2]), m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2] + ' scale']],
  [/^(?:an? |the )*(?:chord|chords|scale|scales) (?:finder|chart|dictionary|identifier)$|^circle of fifths$/i, () => ['/chords/', 'Chords and scales']],
  [/^(?:music tools|musician tools|music practice tools|my setlists?|setlists?)$/i, () => ['/music/', 'Music tools']],
];
const pick = (t) => { for (const [re, f] of RULES) { const m = re.exec(t); if (m) return f(m, t); } return null; };

function run(text, api) {
  const { showPage, esc } = api, hit = pick(String(text || '').trim().replace(/[?!.]+$/, '')) || ['/music/', 'Music tools'];
  showPage((el) => {
    el.dataset.page = hit[0].replace(/\?.*$/, '');
    el.innerHTML = '<h2>' + esc(hit[1]) + '</h2><p>Free music tools that run on your device: every sound is made in your browser, nothing is sent, and they work offline.</p>' // void-review: ok: fixed text
      + '<p><a href="' + esc(hit[0]) + '" style="font-weight:600">' + esc('Open ' + hit[1] + ' →') + '</a></p><ul style="padding-left:18px;margin:6px 0">'
      + PAGES.map(([h, n, d]) => '<li><a href="' + h + '">' + esc(n) + '</a>: ' + esc(d) + '</li>').join('') + '</ul>' // void-review: ok: fixed text and escaped
      + '<div class="src">Made by Verse · public-domain songs only · as of 2026-10</div>';
  });
  return 'music-tools';
}

export default {
  name: 'music-tools',
  examples: ['metronome 120 bpm', 'online piano', 'guitar tuner', 'tap tempo', 'am7 chord', 'c major scale', 'circle of fifths', 'music tools'],
  nearMisses: ['make me a song', 'play some music', 'a heavy metal song'],
  match(lower) { return !!pick(lower.trim().replace(/[?!.]+$/, '')); },
  run,
};
