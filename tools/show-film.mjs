// A Short as a moving picture: a shifting field, a word that slides in on each beat, and captions that change with the spoken word.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { W, H, gate } from './video-gate.mjs';

const assTime = (s) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, sec = Math.floor(cs / 100) % 60, c = cs % 100;
  return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0') + '.' + String(c).padStart(2, '0');
};
const esc = (s) => String(s).replace(/[{}\\]/g, '');

/** groups of a few words, each on screen only while those words are spoken. Pure. */
export function captionCues(words) {
  const cues = [];
  for (let i = 0; i < words.length; i += 3) {
    const g = words.slice(i, i + 3);
    if (!g.length) continue;
    cues.push({ text: g.map((w) => w.w).join(' '), from: g[0].from, to: g[g.length - 1].to, words: g });
  }
  return cues;
}

function assOf(words, beats) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,DejaVu Sans,72,&H0000F0FF,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,8,0,5,80,80,0,1
Style: Beat,DejaVu Sans,60,&H0000F0FF,&H0000F0FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,8,80,80,200,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines = [];
  for (const b of beats) {
    lines.push(`Dialogue: 0,${assTime(b.from)},${assTime(b.to)},Beat,,0,0,0,,{\\an8\\pos(540,280)}${esc(b.label)}`);
  }
  for (const cue of captionCues(words)) {
    let t = cue.from;
    const parts = cue.words.map((w) => {
      const k = Math.max(1, Math.round((w.to - w.from) * 100));
      t = w.to;
      return `{\\k${k}}${esc(w.w)} `;
    }).join('');
    lines.push(`Dialogue: 1,${assTime(cue.from)},${assTime(Math.max(cue.to, t))},Cap,,0,0,0,,${parts.trim()}`);
  }
  return header + lines.join('\n') + '\n';
}

/** Burn the moving field, the sliding beat title, and the word captions onto the voice. */
export function renderShow(audio, words, beats, file, meta) {
  const ass = file.replace(/\.mp4$/, '.ass');
  writeFileSync(ass, assOf(words, beats));
  const dur = beats.length ? beats[beats.length - 1].to + 0.4 : 30;
  const assName = ass.replace(/:/g, '\\:');
  const args = ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `gradients=s=${W}x${H}:c0=0x16324f:c1=0xd4a24a:c2=0x1a4a44:nb_colors=3:x0=0:y0=0:x1=${W}:y1=${H}:d=${dur.toFixed(2)},hue=H=t*28,fps=30`,
    '-i', audio,
    '-filter_complex', `[0:v]ass=${assName}[v];[1:a]loudnorm=I=-14:TP=-1.5:LRA=7[a]`,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', file];
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('film ' + String(r.stderr).slice(-400));
  const cues = captionCues(words);
  meta.captions = cues.map((c) => ({ text: c.text, raw: c.text, size: 78, x: 90, y: 780, w: 820, h: 200, box: true, rect: true, from: +c.from.toFixed(3), to: +c.to.toFixed(3) }));
  meta.speech = beats.map((b) => ({ from: b.from, to: b.to }));
  meta.hook = meta.hook || (beats[0] && beats[0].text) || '';
  meta.kind = 'show';
  meta.format = 'show';
  meta.voice = true;
  meta.footage = { kind: 'studio', source: meta.page || 'https://a-to-mind.com/', frames: Math.round(dur * 30), fps: 30 };
  meta.gate = gate(file, meta);
  return meta;
}

/** Captions and the spoken track over a screen recording of the real page. */
export function renderOver(video, audio, words, beats, file, meta) {
  const ass = file.replace(/\.mp4$/, '.ass');
  writeFileSync(ass, assOf(words, beats));
  const dur = beats.length ? beats[beats.length - 1].to + 0.4 : 30;
  const assName = ass.replace(/:/g, '\\:');
  const args = ['-y', '-hide_banner', '-loglevel', 'error',
    '-stream_loop', '-1', '-i', video, '-i', audio,
    '-filter_complex', `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=30,trim=duration=${dur.toFixed(2)},setpts=PTS-STARTPTS,ass=${assName}[v];[1:a]loudnorm=I=-14:TP=-1.5:LRA=7,atrim=duration=${dur.toFixed(2)}[a]`,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', file];
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('over ' + String(r.stderr).slice(-400));
  const cues = captionCues(words);
  meta.captions = cues.map((c) => ({ text: c.text, raw: c.text, size: 64, x: 90, y: 1100, w: 820, h: 220, box: true, rect: true, from: +c.from.toFixed(3), to: +c.to.toFixed(3) }));
  meta.speech = beats.map((b) => ({ from: b.from, to: b.to }));
  meta.hook = meta.hook || (beats[0] && beats[0].text) || '';
  meta.kind = 'show';
  meta.format = 'show';
  meta.voice = true;
  meta.footage = { url: meta.page || 'https://a-to-mind.com/', answerSeen: true, answer: meta.answer || '' };
  meta.gate = gate(file, meta);
  return meta;
}
