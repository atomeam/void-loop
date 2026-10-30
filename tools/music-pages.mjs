// Writes the music pages' HTML (owner, 2026-10-26: "we have to have everything all the sites have"; docs/RULES.md: every lane site gets a page of its own):
// /metronome/ (metronomeonline.com), /piano/ (virtualpiano.net), /tuner/ (a tuner), /bpm/ (a BPM counter), /chords/ (a chord and scale finder) and the hub /music/
// (Spotify's floor: setlists, a catalogue, recommendations). The six share one look, so their shell is written once here; each page's words and controls are in
// its body below, all in the first paint (the page's module, <page>/app.js, only wires them after the load event). The seo block and the asks row inside
// the markers are filled by tools/seo-pages.mjs, the module preloads by tools/preload.mjs. `node tools/music-pages.mjs` rewrites the six files.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { noteLengths } from '../void-live-deploy/lib/music-tools.js';
const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');

const CSS = `
  :root { color-scheme: light; --bg: #f7f6fb; --ink: #15131c; --soft: #5d5a6b; --line: #cfcbdc; --accent: #5b36f0; --on-accent: #fff; --box: #fff; --tint: #efe9ff; --bad: #c62a40; --good: #12795a; --key: #fff; --blk: #1b1826; --hit: #8f73ff; }
  :root:not([data-theme=light]) { color-scheme: dark; --bg: #0b0a10; --ink: #ecebf5; --soft: #aaa7ba; --line: #3a3649; --accent: #a58bff; --on-accent: #15131c; --box: #14121c; --tint: #221c3a; --bad: #ff6b7e; --good: #4fd6a8; --key: #e9e7f2; --blk: #0b0a10; --hit: #a58bff; }
  :root[data-theme=dark] { --bg: #0b0a10; --ink: #ecebf5; --soft: #aaa7ba; --line: #3a3649; --accent: #a58bff; --on-accent: #15131c; --box: #14121c; --tint: #221c3a; --bad: #ff6b7e; --good: #4fd6a8; --key: #e9e7f2; --blk: #0b0a10; --hit: #a58bff; }
  html, body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 18px 16px 40px; }
  h1 { font-size: 20px; margin: 0 0 4px; text-align: center; font-weight: 650; }
  h2 { font-size: 16px; margin: 0 0 8px; }
  .sub { font-size: 13px; color: var(--soft); text-align: center; margin: 0 0 10px; min-height: 40px; }
  .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  #mnav { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 0 0 12px; min-height: 120px; align-content: flex-start; }
  #mnav a { font-size: 14px; padding: 8px 12px; min-height: 24px; border: 1px solid var(--line); border-radius: 999px; color: var(--ink); text-decoration: none; background: var(--box); }
  #mnav a[aria-current=page] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 600; }
  input, select, textarea { font: inherit; font-size: 16px; color: inherit; background: var(--box); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; min-height: 44px; box-sizing: border-box; max-width: 100%; }
  textarea { width: 100%; min-height: 92px; font-family: ui-monospace, monospace; font-size: 14px; }
  input[type=range] { padding: 0; accent-color: var(--accent); min-height: 44px; }
  input:focus-visible, select:focus-visible, button:focus-visible, a:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button { font: inherit; font-size: 15px; border: 1px solid var(--line); border-radius: 999px; padding: 7px 14px; min-height: 44px; min-width: 44px; background: var(--box); color: var(--ink); cursor: pointer; }
  button[aria-pressed=true], button.go, button[aria-selected=true] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 600; }
  button:disabled { opacity: .5; cursor: default; }
  .pane { border: 1px solid var(--line); border-radius: 14px; padding: 12px; margin: 10px 0; background: var(--box); }
  #tries a { padding: 8px 4px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
  .row > label { font-size: 13px; color: var(--soft); display: flex; flex-direction: column; gap: 2px; flex: 1 1 130px; min-width: 0; }
  .row > label select, .row > label input { width: 100%; }
  .row.c { justify-content: center; }
  .chk { flex: 0 1 auto !important; flex-direction: row !important; align-items: center; gap: 8px !important; color: var(--ink) !important; font-size: 15px !important; min-height: 44px; }
  .row > label.chk input { min-height: 0; width: 20px; height: 20px; flex: 0 0 auto; }
  .note { font-size: 13px; color: var(--soft); margin: 4px 0; min-height: 20px; }
  .big { text-align: center; font-size: 64px; font-weight: 700; line-height: 1.05; font-variant-numeric: tabular-nums; min-height: 70px; }
  .big small { font-size: 18px; font-weight: 500; color: var(--soft); }
  .dots { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; min-height: 56px; align-items: center; }
  .dot { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--line); background: var(--box); padding: 0; min-height: 40px; min-width: 40px; font-size: 12px; color: var(--soft); }
  .dot[data-lv="3"] { border-color: var(--accent); } .dot[data-lv="2"] { border-color: var(--soft); } .dot[data-lv="0"] { opacity: .45; border-style: dashed; }
  .dot.on { background: var(--accent); color: var(--on-accent); transform: scale(1.12); }
  .flash { transition: background .08s; } .flash.on { background: var(--tint); }
  .pend { position: relative; height: 90px; overflow: hidden; } .pend i { position: absolute; left: 50%; bottom: 0; width: 4px; height: 82px; background: var(--accent); border-radius: 2px; transform-origin: 50% 100%; transform: translateX(-50%) rotate(-22deg); } .pend i::after { content: ''; position: absolute; left: -7px; top: 6px; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); }
  .tapbtn { width: 100%; min-height: 96px; font-size: 22px; border-radius: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; } th, td { border-bottom: 1px solid var(--line); padding: 6px 8px; text-align: left; } th { color: var(--soft); font-weight: 600; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 6px 0; list-style: none; }
  .chips li { border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; background: var(--tint); font-size: 15px; min-height: 24px; }
  .kb { position: relative; display: flex; overflow-x: auto; overscroll-behavior-x: contain; padding-bottom: 6px; height: 190px; border: 1px solid var(--line); border-radius: 10px; background: var(--box); touch-action: pan-x; user-select: none; -webkit-user-select: none; }
  .wk { flex: 0 0 44px; height: 180px; border: 1px solid var(--line); border-radius: 0 0 8px 8px; background: var(--key); color: #444; font-size: 11px; padding: 0 0 6px; display: flex; align-items: flex-end; justify-content: center; position: relative; min-height: 0; min-width: 0; box-sizing: border-box; z-index: 1; text-align: center; line-height: 1.1; }
  .wk.on { background: var(--hit); color: #fff; }
  .bk { position: absolute; top: 0; width: 28px; height: 112px; margin-left: -14px; background: var(--blk); border: 1px solid var(--line); border-radius: 0 0 6px 6px; color: #ddd; font-size: 10px; padding: 0 0 4px; display: flex; align-items: flex-end; justify-content: center; z-index: 3; min-height: 0; min-width: 0; box-sizing: border-box; }
  .bk.on { background: var(--hit); }
  .kbi { position: relative; display: flex; flex: 0 0 auto; }
  .strobe { height: 54px; border-radius: 10px; margin: 8px 0; background: repeating-linear-gradient(90deg, var(--accent) 0 14px, var(--tint) 14px 28px); background-size: 28px 100%; } .strobe.ok { background: repeating-linear-gradient(90deg, var(--good) 0 14px, var(--tint) 14px 28px); }
  .neck { width: 100%; min-height: 150px; } .neck svg { width: 100%; height: auto; display: block; } .neck text { fill: var(--ink); font: 9px system-ui; }
  .meter { position: relative; height: 54px; border-radius: 10px; background: var(--tint); overflow: hidden; margin: 8px 0; }
  .meter i { position: absolute; top: 0; bottom: 0; width: 4px; left: 50%; margin-left: -2px; background: var(--accent); transition: left .12s; } .meter b { position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; background: var(--good); }
  .meter.ok i { background: var(--good); }
  .read { text-align: center; font-size: 56px; font-weight: 700; line-height: 1.1; min-height: 62px; } .read small { font-size: 16px; font-weight: 500; color: var(--soft); display: block; }
  .strings { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; min-height: 48px; }
  svg.dia { width: 100%; max-width: 360px; height: auto; display: block; margin: 0 auto; } svg.dia text { fill: var(--ink); font: 11px system-ui; } svg.dia line, svg.dia rect.fr { stroke: var(--soft); } svg.dia .dotf { fill: var(--accent); }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  details { margin: 8px 0; } summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; }
  #related, #asks { margin-top: 14px; } footer { font-size: 13px; color: var(--soft); text-align: center; margin-top: 10px; } footer a { color: var(--soft); }
  .tk-row { display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 13px; color: var(--soft); } .tk-row a { color: var(--soft); }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  @media print { #mnav, button, .row { display: none !important; } }`;

const NAV = [['/metronome/', 'Metronome'], ['/piano/', 'Piano'], ['/tuner/', 'Tuner'], ['/bpm/', 'BPM counter'], ['/chords/', 'Chords and scales'], ['/music/', 'Setlists and catalogue'], ['/?q=make%20me%20a%20song', 'Make me a song']];
const opt = (pairs, sel) => pairs.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`).join('');
const NOTES_OPT = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((n) => [n, n]);
const CHORD_OPT = [['', 'major'], ['m', 'minor'], ['7', '7'], ['maj7', 'maj7'], ['m7', 'm7'], ['dim', 'dim'], ['dim7', 'dim7'], ['m7b5', 'm7b5'], ['aug', 'aug'], ['sus2', 'sus2'], ['sus4', 'sus4'], ['6', '6'], ['m6', 'm6'], ['add9', 'add9'], ['9', '9'], ['maj9', 'maj9'], ['m9', 'm9'], ['11', '11'], ['13', '13'], ['5', 'power (5)'], ['7sus4', '7sus4'], ['7b9', '7b9'], ['7#9', '7#9'], ['7#5', '7#5'], ['7b5', '7b5'], ['mmaj7', 'm(maj7)'], ['madd9', 'm(add9)'], ['6/9', '6/9']];
const SCALE_OPT = [['major', 'Major (Ionian)'], ['minor', 'Natural minor (Aeolian)'], ['harmonicMinor', 'Harmonic minor'], ['melodicMinor', 'Melodic minor'], ['dorian', 'Dorian'], ['phrygian', 'Phrygian'], ['lydian', 'Lydian'], ['mixolydian', 'Mixolydian'], ['locrian', 'Locrian'], ['majorPentatonic', 'Major pentatonic'], ['minorPentatonic', 'Minor pentatonic'], ['blues', 'Blues'], ['majorBlues', 'Major blues'], ['wholeTone', 'Whole tone'], ['diminishedWH', 'Diminished (whole-half)'], ['diminishedHW', 'Diminished (half-whole)'], ['phrygianDominant', 'Phrygian dominant'], ['hungarianMinor', 'Hungarian minor'], ['bebopDominant', 'Bebop dominant'], ['altered', 'Altered'], ['lydianDominant', 'Lydian dominant'], ['chromatic', 'Chromatic']];
const SIGS = ['2/4', '3/4', '4/4', '5/4', '6/4', '7/4', '3/8', '5/8', '6/8', '7/8', '9/8', '12/8', '2/2'].map((s) => [s, s]);
const SUBS = [['none', 'Quarter notes (none)'], ['eighth', 'Eighth notes'], ['triplet', 'Triplets'], ['sixteenth', 'Sixteenth notes'], ['quintuplet', 'Quintuplets'], ['sextuplet', 'Sextuplets'], ['swing', 'Swing (long-short)'], ['offbeat', 'Off-beat only']];
const SOUNDS = [['click', 'Click'], ['wood', 'Wood block'], ['hihat', 'Hi-hat'], ['cowbell', 'Cowbell'], ['beep', 'Beep'], ['rimshot', 'Rim shot'], ['kick', 'Kick drum'], ['tick', 'Soft tick'], ['clap', 'Clap']];
const INSTR = [['piano', 'Grand piano'], ['epiano', 'Electric piano'], ['organ', 'Organ'], ['strings', 'Strings'], ['synth', 'Synth lead'], ['bell', 'Bell'], ['flute', 'Flute'], ['guitar', 'Plucked guitar'], ['marimba', 'Marimba'], ['harpsichord', 'Harpsichord'], ['musicbox', 'Music box'], ['choir', 'Choir pad']];
const TUNINGS = [['guitar-standard', 'Guitar, standard (E A D G B E)'], ['guitar-dropd', 'Guitar, drop D'], ['guitar-dadgad', 'Guitar, DADGAD'], ['guitar-opeg', 'Guitar, open G'], ['guitar-opend', 'Guitar, open D'], ['guitar-halfdown', 'Guitar, half step down'], ['guitar-7', 'Guitar, 7-string'], ['bass4', 'Bass, 4-string'], ['bass5', 'Bass, 5-string'], ['ukulele', 'Ukulele (G C E A)'], ['violin', 'Violin (G D A E)'], ['viola', 'Viola (C G D A)'], ['cello', 'Cello (C G D A)'], ['mandolin', 'Mandolin (G D A E)'], ['banjo', 'Banjo, open G'], ['chromatic', 'Any note (chromatic)']];
const TEMPOS = [['Largo', 50], ['Adagio', 70], ['Andante', 92], ['Moderato', 114], ['Allegro', 132], ['Presto', 180]];

const PAGES = {
  metronome: { path: '/metronome/', title: 'Metronome online: tap tempo, accents, subdivisions · Verse', h1: 'Metronome: a steady click to keep time', desc: 'A free online metronome from 20 to 400 BPM with tap tempo, every time signature, accents on each beat, subdivisions, nine sounds, a visual beat, a practice timer, a speed trainer and setlists. No account; it works offline.',
    lead: '<strong>For practising an instrument, a workout, a dance or a speech.</strong> Press Start, or open a ready tempo:', tries: [['Piano practice 80', '?bpm=80&amp;sig=4%2F4'], ['Running 170 steps a minute', '?bpm=170&amp;sig=2%2F4'], ['A slow speech 60', '?bpm=60&amp;sig=4%2F4'], ['A waltz 100', '?bpm=100&amp;sig=3%2F4']],
    sub: 'A free online metronome: 20 to 400 BPM, tap tempo, any time signature, accents, subdivisions, nine sounds, a visual beat, a practice timer and setlists. Nothing leaves your device; it works offline.',
    body: `
  <section class="pane flash" id="stage" aria-label="Metronome">
    <div class="dots" id="dots" role="group" aria-label="Beats of the bar, press one to change its accent"><button class="dot" type="button" data-lv="3" aria-label="Beat 1, strong">1</button><button class="dot" type="button" data-lv="1" aria-label="Beat 2, soft">2</button><button class="dot" type="button" data-lv="1" aria-label="Beat 3, soft">3</button><button class="dot" type="button" data-lv="1" aria-label="Beat 4, soft">4</button></div>
    <div class="big"><output id="bpmOut" for="bpm">120</output> <small>BPM</small></div>
    <p class="note" id="tempoWord" style="text-align:center">Allegro · 500 ms per beat</p>
    <div class="pend" id="pend" aria-hidden="true"><i id="rod"></i></div>
    <div class="row"><button type="button" id="m10" aria-label="10 slower">−10</button><button type="button" id="m1" aria-label="1 slower">−</button><input type="range" id="bpm" min="20" max="400" value="120" step="1" aria-label="Beats per minute" style="flex:1 1 120px"><button type="button" id="p1" aria-label="1 faster">+</button><button type="button" id="p10" aria-label="10 faster">+10</button></div>
    <div class="row"><button type="button" id="play" class="go" style="flex:1 1 140px" aria-pressed="false">Start</button><button type="button" id="tap" style="flex:1 1 140px">Tap tempo</button></div>
    <p class="note" id="status" role="status" aria-live="polite">Press Start, or the space bar. Tap the beat circles to set each beat strong, medium, soft or silent.</p>
  </section>
  <section class="pane" aria-label="Rhythm and sound">
    <h2>Time signature, subdivisions and sound</h2>
    <div class="row"><label>Time signature<select id="sig">${opt(SIGS, '4/4')}</select></label><label>Subdivision<select id="sub">${opt(SUBS, 'none')}</select></label><label>Sound<select id="snd">${opt(SOUNDS, 'click')}</select></label></div>
    <div class="row"><label>Polyrhythm: a second pulse of this many in each bar<select id="poly"><option value="0">Off</option>${[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<option value="${n}">${n} against the bar</option>`).join('')}</select></label></div>
    <div class="row"><label>Volume<input type="range" id="vol" min="0" max="100" value="80" aria-label="Volume"></label><label>Beats per minute<input type="number" id="bpmIn" min="20" max="400" value="120" inputmode="numeric" aria-label="Type the tempo"></label></div>
    <div class="row"><label class="chk"><input type="checkbox" id="voice"> Voice count (says 1 2 3 4)</label><label class="chk"><input type="checkbox" id="vis" checked> Visual beat (flash)</label><label class="chk"><input type="checkbox" id="stress" checked> Accent the first beat</label></div>
    <h2>Tempo presets</h2>
    <div class="row" id="presets">${[['Slow speech', 60], ['Piano practice', 80], ['Running', 170]].concat(TEMPOS).map(([n, b]) => `<button type="button" data-bpm="${b}">${n} ${b}</button>`).join('')}</div>
  </section>
  <section class="pane" aria-label="Practice tools">
    <h2>Practice timer, speed trainer and silent bars</h2>
    <div class="row"><label>Practice timer (minutes, 0 = off)<input type="number" id="timer" min="0" max="180" value="0" inputmode="numeric"></label><label>Timer left<output id="timerLeft">off</output></label></div>
    <div class="row"><label>Speed trainer: raise by (BPM)<input type="number" id="rampStep" min="0" max="40" value="0" inputmode="numeric"></label><label>every (bars)<input type="number" id="rampEvery" min="1" max="64" value="4" inputmode="numeric"></label><label>up to (BPM)<input type="number" id="rampTo" min="20" max="400" value="160" inputmode="numeric"></label></div>
    <div class="row"><label>Silent bars: play (bars)<input type="number" id="playBars" min="1" max="16" value="4" inputmode="numeric"></label><label>then rest (bars, 0 = off)<input type="number" id="restBars" min="0" max="16" value="0" inputmode="numeric"></label></div>
    <p class="note" id="ladder">Practice ladder for this tempo: 60%, 75%, 90%, then 100%.</p>
  </section>
  <section class="pane" aria-label="Setlist">
    <h2>Setlist</h2>
    <div class="row"><label>Name<input id="entryName" maxlength="40" placeholder="Verse, Chorus, Etude no. 3"></label><button type="button" id="saveEntry" style="flex:0 0 auto">Save to a setlist</button></div>
    <ol id="setlist" aria-label="Saved tempos" style="padding-left:20px;margin:6px 0;min-height:24px"></ol>
    <div class="row"><button type="button" id="copyLink">Copy link to this setlist</button><button type="button" id="theme" aria-pressed="false">Light or dark</button></div>
  </section>
  <p class="note" id="about">Counts the beat in the signature you pick (6/8 has six beats). All sounds are made in your browser; no file is loaded and nothing is sent. Space starts and stops, the arrow keys change the tempo, T taps.</p>` },

  piano: { path: '/piano/', title: 'Online piano: play with your keyboard or touch · Verse', h1: 'Piano', desc: 'A free online piano you play with the computer keyboard, the mouse, a touch screen or a MIDI keyboard: twelve instruments, a sustain pedal, key labels, sheet music in plain letters, record and replay, transpose and reverb. No account; it works offline.',
    sub: 'A free online piano: play with your computer keyboard, a touch screen or a MIDI keyboard. Twelve instruments, sustain, key labels, sheets in plain letters, recording and reverb. Nothing is loaded or sent; it works offline.',
    body: `
  <section class="pane" aria-label="Piano">
    <div class="row"><label>Instrument<select id="ins">${opt(INSTR, 'piano')}</select></label><label>Octave<select id="oct"><option value="-12">Octave down</option><option value="0" selected>Middle</option><option value="12">Octave up</option></select></label><label>Transpose (half steps)<input type="number" id="trans" min="-12" max="12" value="0" inputmode="numeric"></label></div>
    <div class="kb" id="kb" role="group" aria-label="Piano keyboard, press a key"><div class="kbi" id="kbi"></div></div>
    <div class="row"><button type="button" id="sus" aria-pressed="false">Sustain (hold the space bar)</button><label class="chk"><input type="checkbox" id="lab" checked> Show the computer key on each note</label><label class="chk"><input type="checkbox" id="rev"> Reverb</label><label class="chk"><input type="checkbox" id="midi"> MIDI keyboard</label></div>
    <p class="note" id="status" role="status" aria-live="polite">Play with the keys 1 2 3 4 5 6 7 8 9 0 q w e r t y u i o p a s d f g h j k l z x c v b n m. Hold Shift for a sharp. Tap or click the keys on a touch screen.</p>
  </section>
  <section class="pane" aria-label="Record and replay">
    <h2>Record and replay</h2>
    <div class="row"><button type="button" id="rec" aria-pressed="false">Record</button><button type="button" id="replay" disabled>Play it back</button><button type="button" id="copyRec" disabled>Copy as sheet</button><button type="button" id="clearRec" disabled>Clear</button></div>
    <p class="note" id="recNote">Nothing recorded yet. Your playing is turned into a sheet in plain letters you can copy, edit and play again.</p>
  </section>
  <section class="pane" aria-label="Sheets">
    <h2>Sheets in plain letters</h2>
    <div class="row"><label>Song<select id="song"></select></label><label>Tempo (BPM)<input type="number" id="songBpm" min="30" max="300" value="100" inputmode="numeric"></label></div>
    <label class="vh" for="sheet">Sheet text</label>
    <textarea id="sheet" spellcheck="false" aria-label="Sheet text, one note per word">E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:0.5 D4:2</textarea>
    <div class="row"><button type="button" id="playSheet" class="go">Play the sheet</button><button type="button" id="stopSheet">Stop</button></div>
    <p class="note" id="sheetNote">A note is a letter and an octave (C4 is middle C, F#4, Bb3). :2 holds it two beats, [C4 E4 G4] is a chord, - is a rest, | is a bar line. Songs here are in the public domain.</p>
  </section>` },

  tuner: { path: '/tuner/', title: 'Online tuner: guitar, bass, ukulele, violin · Verse', h1: 'Tuner', desc: 'A free online chromatic tuner that listens through your microphone: guitar, bass, ukulele, violin, viola, cello, mandolin and banjo presets and alternate tunings, a needle in cents, an adjustable A4 reference and reference tones. The sound never leaves your device.',
    sub: 'A free online tuner: it listens through your microphone, finds the note and shows how many cents flat or sharp. Guitar, bass, ukulele, violin and more, alternate tunings, reference tones. The sound never leaves your device.',
    body: `
  <section class="pane" aria-label="Tuner">
    <div class="row"><label>Instrument and tuning<select id="tun">${opt(TUNINGS, 'guitar-standard')}</select></label><label>Reference pitch A4 (Hz)<input type="number" id="a4" min="410" max="470" value="440" step="1" inputmode="numeric"></label></div>
    <div class="read" id="note" aria-live="polite">–<small id="hz">Turn the microphone on and play a note</small></div>
    <div class="row c" role="group" aria-label="Display"><button type="button" id="dispNeedle" aria-pressed="true">Needle</button><button type="button" id="dispStrobe" aria-pressed="false">Strobe</button></div>
    <div class="meter" id="meter" role="img" aria-label="How flat or sharp the note is"><b></b><i id="needle"></i></div>
    <div class="strobe" id="strobe" role="img" aria-label="Strobe: the stripes stand still when the note is in tune" hidden></div>
    <p class="note" id="verdict" role="status" aria-live="polite" style="text-align:center;font-size:16px;color:var(--ink)">Waiting for a note.</p>
    <div class="row c"><button type="button" id="mic" class="go" aria-pressed="false">Turn the microphone on</button></div>
    <p class="note" id="status" role="status" aria-live="polite">The microphone is used only to find the pitch, on this device. Nothing is recorded or sent.</p>
  </section>
  <section class="pane" aria-label="Strings and reference tones">
    <h2>Strings and reference tones</h2>
    <div class="strings" id="strings" role="group" aria-label="Press a string to hear its note"></div>
    <div class="row"><label>Any note (pitch pipe)<select id="pipe">${opt(NOTES_OPT, 'A')}</select></label><label>Octave<input type="number" id="pipeOct" min="0" max="8" value="4" inputmode="numeric"></label><button type="button" id="pipeBtn" style="flex:0 0 auto" aria-pressed="false">Play the note</button></div>
    <p class="note">The usual reference is A4 = 440 Hz; change it above for other pitch standards. Press a string to hear its note and tune to it by ear. The tuner picks the nearest string by itself and shows how far off you are; within 5 cents is in tune.</p>
  </section>` },

  bpm: { path: '/bpm/', title: 'BPM counter: tap the beat to find the tempo · Verse', h1: 'Find how fast a song is: a beats-per-minute counter', desc: 'A free BPM counter: tap any key or the button along with a song to find its tempo, with half and double, the average of your taps, note lengths in milliseconds and Hz, and the tempo of an audio file worked out on your device. No account, nothing uploaded.',
    lead: '<strong>Tap along for a workout, a dance class, a DJ set or a rehearsal.</strong> <a href="#tap">Tap a song</a>, or see a ready tempo:', tries: [['A running pace 170', '?bpm=170'], ['A resting heartbeat 70', '?bpm=70'], ['A dance class 128', '?bpm=128'], ['A walk 90', '?bpm=90']],
    sub: 'A free BPM counter: tap along with a song to find its tempo, fix half or double time, see the length of every note value, or find the BPM of an audio file on your device. Nothing is uploaded.',
    body: `
  <section class="pane" aria-label="BPM counter">
    <div class="big"><output id="bpmOut">–</output> <small>BPM</small></div>
    <p class="note" id="info" role="status" aria-live="polite" style="text-align:center">Tap the button, or any key, to the beat.</p>
    <button type="button" id="tap" class="tapbtn go">Tap here to the beat</button>
    <div class="row c"><button type="button" id="half">Half time (÷2)</button><button type="button" id="dbl">Double time (×2)</button><button type="button" id="rst">Reset</button><button type="button" id="click" aria-pressed="false">Click on each tap</button></div>
    <div class="row"><label>Average the last (taps)<select id="keep"><option>4</option><option>8</option><option selected>12</option><option>24</option></select></label><label>Start over after a pause of (s)<select id="gap"><option>1.5</option><option selected>2.5</option><option>4</option></select></label><label class="chk"><input type="checkbox" id="whole"> Round to whole BPM</label></div>
    <p class="note" id="tempoWord" style="text-align:center">10 to 15 taps give the most reliable tempo.</p>
  </section>
  <section class="pane" aria-label="Note lengths">
    <h2>Note lengths at this tempo</h2>
    <p class="note" id="lensFor">At 120 BPM until you tap a tempo (ms per note; Hz is how often it falls each second):</p>
    <table id="lens"><thead><tr><th>Note</th><th>ms</th><th>Dotted</th><th>Triplet</th><th>Hz</th></tr></thead><tbody>${noteLengths(120).map((n) => `<tr><td>${n.note}</td><td>${n.ms}</td><td>${n.dotted}</td><td>${n.triplet}</td><td>${n.hz}</td></tr>`).join('')}</tbody></table>
    <div class="row"><label>Time signature<select id="sig">${opt(SIGS, '4/4')}</select></label><label>Bars<input type="number" id="bars" min="1" max="999" value="32" inputmode="numeric"></label><label>Length<output id="songLen">1:04</output></label></div>
  </section>
  <section class="pane" aria-label="BPM of an audio file">
    <h2>Find the BPM of an audio file</h2>
    <div class="row"><label>Choose a song or a loop<input type="file" id="file" accept="audio/*"></label></div>
    <p class="note" id="fileNote" role="status" aria-live="polite">The file is read and measured in your browser. It is not uploaded.</p>
  </section>` },

  chords: { path: '/chords/', title: 'Chord and scale finder for piano and guitar · Verse', h1: 'Chords and scales', desc: 'A free chord and scale finder: pick a chord to see its notes, piano keys and guitar fingerings and hear it, name a chord from the notes you pick, find every scale that holds them, see the chords of a key with roman numerals, the circle of fifths and chord progressions.',
    sub: 'A free chord and scale finder for piano and guitar: notes, keys and fingerings for 28 chord types and 22 scales, the chord you are playing named, the chords of any key and the circle of fifths. Plays what it shows.',
    body: `
  <section class="pane" aria-label="Chord finder">
    <h2>Chord finder</h2>
    <div class="row"><label>Root<select id="cRoot">${opt(NOTES_OPT, 'C')}</select></label><label>Chord<select id="cType">${opt(CHORD_OPT, '')}</select></label><label>Inversion<select id="cInv"><option value="0">Root position</option><option value="1">1st inversion</option><option value="2">2nd inversion</option><option value="3">3rd inversion</option></select></label></div>
    <p class="read" id="cName" style="font-size:36px;min-height:44px" aria-live="polite">C <small id="cNotes">C E G</small></p>
    <h2>On the piano keyboard</h2>
    <div class="kb" id="cKb" style="height:130px" aria-label="Chord on a piano keyboard"><div class="kbi" id="cKbi"></div></div>
    <div class="row c"><button type="button" id="cPlay" class="go">Play the chord</button><button type="button" id="cArp">Play it broken</button></div>
    <h2>Guitar fingerings</h2>
    <div class="grid2" id="gtr" aria-live="polite"></div>
  </section>
  <section class="pane" aria-label="Which chord is this?">
    <h2>Which chord is this? Pick the notes</h2>
    <div class="row" id="pickNotes" role="group" aria-label="Notes to name">${NOTES_OPT.map(([n]) => `<button type="button" data-pc="${n}" aria-pressed="false">${n}</button>`).join('')}</div>
    <p class="note" id="idOut" role="status" aria-live="polite">Pick two or more notes to name the chord, and to see every scale that holds them.</p>
    <ul class="chips" id="idScales" aria-label="Scales that hold the picked notes"></ul>
  </section>
  <section class="pane" aria-label="Choose a chord on the neck">
    <h2>Choose a chord on the guitar neck</h2>
    <div class="neck" id="pickNeck" aria-label="Tap the frets you hold, one per string"></div>
    <div class="grid2" id="neckSel">${['Low E', 'A', 'D', 'G', 'B', 'High E'].map((n, i) => `<label class="note">${n} string<select data-s="${i}"><option value="x">Not played</option><option value="0">Open</option>${Array.from({ length: 12 }, (_, f) => `<option value="${f + 1}">Fret ${f + 1}</option>`).join('')}</select></label>`).join('')}</div>
    <p class="note" id="neckOut" role="status" aria-live="polite">Tap the neck or use the lists to hold frets; the chord is named here.</p>
    <div class="row"><button type="button" id="neckClear">Clear the neck</button></div>
  </section>
  <section class="pane" aria-label="Scale finder">
    <h2>Scale finder</h2>
    <div class="row"><label>Root<select id="sRoot">${opt(NOTES_OPT, 'C')}</select></label><label>Scale<select id="sType">${opt(SCALE_OPT, 'major')}</select></label></div>
    <p class="read" id="sName" style="font-size:28px;min-height:36px" aria-live="polite">C Major <small id="sNotes">C D E F G A B</small></p>
    <p class="note" id="sSteps" style="text-align:center">W W H W W W H</p>
    <div class="kb" id="sKb" style="height:130px" aria-label="Scale on a piano keyboard"><div class="kbi" id="sKbi"></div></div>
    <h2>On the guitar neck</h2>
    <div class="neck" id="neck" aria-label="The scale on a guitar fretboard, 12 frets, root notes filled"></div>
    <div class="row c"><button type="button" id="sPlay" class="go">Play the scale</button></div>
    <h2>Chords in this key</h2>
    <div class="row"><label class="chk"><input type="checkbox" id="sev"> Seventh chords</label></div>
    <table id="keyChords"><thead><tr><th>Step</th><th>Chord</th><th>Notes</th><th>Often goes to</th></tr></thead><tbody></tbody></table>
    <p class="note" id="sig">Key signature: no sharps or flats.</p>
  </section>
  <section class="pane" aria-label="Progressions and the circle of fifths">
    <h2>Progressions in this key</h2>
    <ul class="chips" id="progs"></ul>
    <h2>Circle of fifths</h2>
    <div class="grid2" id="circle"></div>
    <h2>Transpose a chord chart</h2>
    <div class="row"><label>Chords<input id="trIn" value="C Am F G7" maxlength="120"></label><label>Half steps<input type="number" id="trBy" min="-11" max="11" value="2" inputmode="numeric"></label></div>
    <p class="read" id="trOut" style="font-size:24px;min-height:32px" aria-live="polite"></p>
  </section>` },

  music: { path: '/music/', title: 'Music tools: metronome, piano, tuner, setlists · Verse', h1: 'Music', desc: 'Free music tools that run on your device: a metronome, an online piano, a tuner, a BPM counter and a chord and scale finder, with your setlists of saved tempos, a catalogue of tempo terms, scales, chords and tunings, and practice recommendations. No account, no ads, no songs to pay for; it works offline.',
    sub: 'Free music tools that run on your device: a metronome, a piano, a tuner, a BPM counter and a chord and scale finder, your setlists, a catalogue of tempo words, scales, chords and tunings, and practice recommendations. No account.',
    body: `
  <section class="pane" aria-label="Playlists">
    <h2>Playlists: your setlists</h2>
    <p class="note" id="plNote">Setlists are lists of saved tempos (name, BPM, time signature, subdivision) from the metronome, kept on this device and shared by link.</p>
    <ol id="setlist" aria-label="Saved tempos" style="padding-left:20px;margin:6px 0;min-height:48px"></ol>
    <div class="row"><button type="button" id="playList" class="go">Play the setlist in the metronome</button><button type="button" id="copyLink">Copy link to this setlist</button></div>
  </section>
  <section class="pane" aria-label="Catalogue">
    <h2>Catalogue: tempo words, scales, chords and tunings</h2>
    <div class="row" role="tablist" aria-label="Catalogue sections"><button type="button" role="tab" data-cat="tempo" aria-selected="true">Tempo words</button><button type="button" role="tab" data-cat="scale" aria-selected="false">Scales</button><button type="button" role="tab" data-cat="chord" aria-selected="false">Chords</button><button type="button" role="tab" data-cat="tuning" aria-selected="false">Tunings</button><button type="button" role="tab" data-cat="song" aria-selected="false">Songs to play</button></div>
    <table id="cat" aria-live="polite"><tbody><tr><td>Largo</td><td>40 to 60 BPM</td><td>broad and slow</td></tr><tr><td>Andante</td><td>76 to 108 BPM</td><td>at a walking pace</td></tr><tr><td>Allegro</td><td>120 to 156 BPM</td><td>fast and bright</td></tr><tr><td>Presto</td><td>176 to 200 BPM</td><td>very fast</td></tr></tbody></table>
  </section>
  <section class="pane" aria-label="Recommendations">
    <h2>Recommendations</h2>
    <div class="row"><label>Practice a piece at (BPM)<input type="number" id="target" min="30" max="300" value="120" inputmode="numeric"></label><label>In the key of<select id="rk">${opt(NOTES_OPT, 'C')}</select></label><label class="chk"><input type="checkbox" id="rmin"> minor</label></div>
    <p class="note" id="ladder">Start at 72, then 90, 108 and 120 BPM.</p>
    <p class="note" id="recChords">In C major: I (C) goes to IV, V or vi; V (G) goes to I, vi or IV.</p>
    <p class="note" id="recScales">Scales to improvise over C: C major, C major pentatonic, C mixolydian.</p>
  </section>` },
};

const hubNav = (cur) => `<nav id="mnav" aria-label="Music tools">${NAV.map(([h, l]) => `<a href="${h}"${h === cur ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
export function pageHtml(key) {
  const p = PAGES[key], dir = p.path;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${p.title}</title>
<meta name="description" content="${p.desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Verse">
<meta property="og:title" content="${p.h1} · Verse">
<meta property="og:description" content="${p.desc}">
<meta property="og:url" content="https://a-to-mind.com${dir}">
<meta property="og:image" content="https://a-to-mind.com/og.png">
<meta name="twitter:card" content="summary_large_image">
<style>${CSS}
</style>
<!-- seo -->
<!-- /seo -->
<script src="/visit.js" defer></script>
</head>
<body>
<main id="app">
  <h1>${p.h1}</h1>
${p.lead ? '  <p class="sub" id="lead">' + p.lead + '</p>\n  <nav class="row" id="tries" aria-label="Ready tempos">' + p.tries.map(([n, u]) => '<a href="' + u + '">' + n + '</a>').join(' ') + '</nav>\n' : ''}  <p class="sub" id="lede">${p.sub}</p>
  ${hubNav(dir)}${p.body}
  ${key === 'music' ? '' : '<!-- asks -->\n  <!-- /asks -->\n  '}<nav id="related" aria-label="Related tools"><!-- related --><!-- /related --></nav>
  <p class="note" id="trust" style="text-align:center;min-height:40px">Free, no account, no ads. Made in your browser: nothing leaves your device. Works offline.</p>
  <p class="note" id="share" style="text-align:center"><button type="button" id="shareBtn">Share this page</button></p>
  <footer><a href="/">Verse</a> · <a href="/tools/">every tool</a></footer>
</main>
<script type="module">
  // the page is whole before this runs: its words and controls are in the HTML, and the code that makes the sound is a small module its head preloads
  import '${dir}app.js';
</script>
<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); // opens offline after one visit (sw.js LATER, kept with its modules)</script>
</body>
</html>
`;
}
export const KEYS = Object.keys(PAGES);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const k of KEYS) {
    const file = path.join(site, PAGES[k].path, 'index.html'); fs.mkdirSync(path.dirname(file), { recursive: true });
    let html = pageHtml(k);
    try { const old = fs.readFileSync(file, 'utf8'); // keep the generated blocks seo-pages.mjs and preload.mjs wrote
      for (const [a, b] of [['<!-- seo -->', '<!-- /seo -->'], ['<!-- asks -->', '<!-- /asks -->'], ['<!-- related -->', '<!-- /related -->']]) { const i = old.indexOf(a), j = old.indexOf(b); if (i >= 0 && j > i) html = html.replace(new RegExp(a + '[\\s\\S]*?' + b), () => old.slice(i, j + b.length)); } } catch (_) { /* new page */ }
    fs.writeFileSync(file, html); console.log('wrote', path.relative(site, file));
  }
}
