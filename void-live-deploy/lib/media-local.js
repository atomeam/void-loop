// Tools pack 5, media light (owner, 2026-10-18; numbers 111 to 120): local audio and video, a playlist of local files, a thumbnail strip
// of local pictures, rotate, crop, pause a GIF, mute everything, a volume for each card and subtitles from a file. Pure helpers; the
// card is skills/media-object.js. The files never leave the device: they are played from the browser's own blob addresses, not saved
// with the stage (a reload asks for them again) and not uploaded.
import { tidy } from './stage-pack.js';

export const MAX_FILES = 40, MAX_SRT_BYTES = 600000;
export const CROPS = { none: null, square: [1, 1], '4:3': [4, 3], '16:9': [16, 9] };

/** the kind of a chosen file from its MIME type or, when the browser gives none, its extension: 'audio' | 'video' | 'image' | 'gif' | 'sub' | null. Pure. */
export function fileKind(f) {
  const type = String((f && f.type) || '').toLowerCase(), name = String((f && f.name) || '').toLowerCase();
  const ext = (name.match(/\.([a-z0-9]{2,5})$/) || [])[1] || '';
  if (type === 'image/gif' || ext === 'gif') return 'gif';
  if (type.startsWith('image/') && type !== 'image/svg+xml') return 'image';
  if (['png', 'jpg', 'jpeg', 'webp', 'avif', 'bmp'].includes(ext)) return 'image';
  if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba'].includes(ext)) return 'audio';
  if (type.startsWith('video/') || ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mkv'].includes(ext)) return 'video';
  if (['srt', 'vtt'].includes(ext) || type === 'text/vtt' || type === 'application/x-subrip') return 'sub';
  return null;
}

/** the chosen files that can sit on one card, their kinds, in the order chosen: { items, left }. Pure. */
export function pickItems(files) {
  const items = [];
  let left = 0;
  for (const f of Array.from(files || [])) {
    const k = fileKind(f);
    if (!k || k === 'sub' || items.length >= MAX_FILES) { left++; continue; }
    items.push({ name: String(f.name || 'file').slice(0, 80), kind: k, size: +f.size || 0 });
  }
  return { items, left };
}

/** 'player' when the first chosen file is audio or video, 'images' when it is a picture. Pure. */
export const modeOf = (items) => (items.length && (items[0].kind === 'audio' || items[0].kind === 'video') ? 'player' : 'images');

/** the same card's next or previous index in a playlist; wraps only when `loop`. -1 at the end. Pure. */
export function stepIndex(i, len, dir, loop) {
  if (len <= 0) return -1;
  const n = i + dir;
  if (n >= 0 && n < len) return n;
  return loop ? (n + len) % len : -1;
}

/** SubRip text as WebVTT (a header, dots in the times, no cue numbers needed), or null when it holds no cue. Pure. */
export function srtToVtt(text) {
  const s = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (s.length > MAX_SRT_BYTES) return null;
  const blocks = s.trim().replace(/^WEBVTT[^\n]*\n+/, '').split(/\n{2,}/);
  const out = [];
  for (const b of blocks) {
    const lines = b.split('\n').filter((l, i, a) => !(i === 0 && /^\d+$/.test(l.trim()) && a.length > 1));
    const ti = lines.findIndex((l) => /\d{1,2}:\d{2}(?::\d{2})?[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?[,.]\d{1,3}/.test(l));
    if (ti < 0) continue;
    const m = /(\d{1,2}:\d{2}(?::\d{2})?)[,.](\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?)[,.](\d{1,3})/.exec(lines[ti]);
    const fix = (t, ms) => (t.split(':').length === 2 ? '00:' + t.padStart(5, '0') : t.padStart(8, '0')) + '.' + ms.padEnd(3, '0');
    const body = lines.slice(ti + 1).map((l) => l.replace(/\{\\an?\d\}/g, '')).filter((l) => l.trim());
    if (!body.length) continue;
    out.push(fix(m[1], m[2]) + ' --> ' + fix(m[3], m[4]) + '\n' + body.join('\n'));
  }
  return out.length ? 'WEBVTT\n\n' + out.join('\n\n') + '\n' : null;
}

/** a rotation after one 90 degree turn (dir 1 = clockwise, -1 = anticlockwise). Pure. */
export const turn = (rot, dir) => (((+rot || 0) + 90 * (dir < 0 ? -1 : 1)) % 360 + 360) % 360;

/** the size of a w x h picture after rotating `rot` degrees. Pure. */
export const rotatedSize = (w, h, rot) => (rot % 180 === 0 ? { w, h } : { w: h, h: w });

/** the centred box of ratio rw:rh inside w x h (the whole picture when ratio is null). Pure. */
export function cropBox(w, h, ratio) {
  if (!ratio) return { x: 0, y: 0, w, h };
  const [rw, rh] = ratio, target = rw / rh;
  let cw = w, ch = Math.round(w / target);
  if (ch > h) { ch = h; cw = Math.round(h * target); }
  return { x: Math.floor((w - cw) / 2), y: Math.floor((h - ch) / 2), w: cw, h: ch };
}

export const clampVol = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, Math.round(n * 100) / 100)) : 1; };

const LOCAL = '(?:local|my\\s+own|from\\s+my\\s+(?:device|computer|phone|files)|on\\s+my\\s+(?:device|computer|phone))';
/**
 * What a media ask wants, or null:
 *  { op: 'new', hint } "play a local audio file", "local video player", "playlist of local files", "thumbnail strip of my local pictures",
 *  "pause a local gif", "rotate a local image" (hint: 'audio' | 'video' | 'images' | 'any')
 *  { op: 'mute', on } "mute all media" / "unmute all media"    { op: 'volume', value } "set the media volume to 40%"
 * Asks without a local-file word are left to the video, music and image skills. Pure.
 */
export function mediaIntent(text) {
  const t = tidy(text).toLowerCase().replace(/[?!.\s]+$/, '');
  let m;
  if (/^(?:please\s+)?(mute|unmute)\s+(?:all|every)\s+(?:the\s+)?(?:media|audio(?:\s+and\s+video)?|sound|players|media\s+cards)$/.test(t)) return { op: 'mute', on: !/^(?:please\s+)?un/.test(t) };
  if ((m = /^(?:please\s+)?(?:set|turn|put)\s+(?:the\s+)?(?:media|player|card|picked\s+media)\s+volume\s+(?:to|at)\s+(\d{1,3})\s*(?:%|percent)?$/.exec(t))) return { op: 'volume', value: clampVol(+m[1] / 100) };
  const verbs = '(?:play|open|add|make|show|give\\s+me|start|build|create|put\\s+up|need)';
  if (new RegExp('^(?:please\\s+)?' + verbs + '\\s+(?:me\\s+)?(?:a\\s+|an\\s+|my\\s+)?' + LOCAL + '\\s+(audio|video|music|sound|mp3|mp4|media)(?:\\s+(?:file|files|player|clip))?$').test(t)
    || new RegExp('^(?:please\\s+)?' + verbs + '\\s+(?:me\\s+)?(?:a\\s+|an\\s+)?(audio|video|music|mp3|mp4)\\s+(?:file|files|clip)\\s+' + LOCAL + '$').test(t)) {
    const w = (/\b(audio|video|music|sound|mp3|mp4|media)\b/.exec(t) || [])[1] || 'media';
    return { op: 'new', hint: /video|mp4/.test(w) ? 'video' : /audio|music|sound|mp3/.test(w) ? 'audio' : 'any' };
  }
  if (new RegExp('^(?:please\\s+)?(?:local\\s+(audio|video|media|music)\\s+(?:player|card)|' + verbs + '\\s+(?:me\\s+)?(?:a\\s+)?(audio|video|media|music)\\s+player\\s+for\\s+' + LOCAL.replace('local|', '') + ')$').test(t)) return { op: 'new', hint: /video/.test(t) ? 'video' : /audio|music/.test(t) ? 'audio' : 'any' };
  if (new RegExp('^(?:please\\s+)?(?:' + verbs + '\\s+(?:me\\s+)?(?:a\\s+)?)?playlist\\s+of\\s+(?:my\\s+)?' + LOCAL + '\\s+(?:files|songs|tracks|videos|audio|media)$').test(t)
    || /^(?:please\s+)?(?:make|build|create|start)\s+(?:me\s+)?a\s+playlist\s+(?:from|of)\s+my\s+(?:files|device|computer)$/.test(t)) return { op: 'new', hint: 'any' };
  if (/^(?:please\s+)?(?:(?:open|make|add|show|give\s+me|build|create)\s+(?:me\s+)?(?:a\s+)?)?(?:local\s+)?(?:image|picture|photo)\s+(?:viewer|strip|cropper|rotator)(?:\s+(?:for|of)\s+(?:my\s+)?(?:local\s+)?(?:files|pictures|images|photos|device|computer))?$/.test(t) && /local|files|\bmy\b|device|computer/.test(t)) return { op: 'new', hint: 'images' };
  if (new RegExp('^(?:please\\s+)?(?:thumbnail\\s+strip|strip\\s+of\\s+thumbnails)\\s+(?:of|for)\\s+(?:my\\s+)?' + LOCAL.replace('local|', 'local\\s+|') + '\\s*(?:pictures|images|photos|files)$').test(t)) return { op: 'new', hint: 'images' };
  if (new RegExp('^(?:please\\s+)?(?:pause|play|open|show|rotate|crop|edit|view)\\s+(?:a\\s+|an\\s+|my\\s+)?(?:' + LOCAL + '\\s+)(gif|image|picture|photo)$').test(t)
    || new RegExp('^(?:please\\s+)?(?:pause|play|open|rotate|crop|edit|view)\\s+(?:a\\s+|an\\s+)?(gif|image|picture|photo)\\s+' + LOCAL + '$').test(t)) return { op: 'new', hint: 'images' };
  return null;
}
