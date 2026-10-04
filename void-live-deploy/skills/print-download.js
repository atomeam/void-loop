/**
 * print-download skill — "download the print file".
 * Reuses print-file.js (stage 3MF). The package is a STORE zip with no
 * network URLs, so it stays valid offline. Empty stage stays empty.
 */
import { stage3mf } from './print-file.js';

const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();

export function downloadPrintOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?download the print file$/.test(t)) return { what: 'stage' };
  if (/^(?:please\s+)?download the print file offline$/.test(t)) return { what: 'stage' };
  if (/^(?:please\s+)?save the print file for offline$/.test(t)) return { what: 'stage' };
  if (/^(?:please\s+)?get the print file$/.test(t)) return { what: 'stage' };
  return null;
}

/** Zip magic, local file targets only. Schema ids may be http; mesh targets may not. */
export function offlinePackage(bytes) {
  if (!bytes || bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return { ok: false, offline: false, published: false, html: '' };
  const text = new TextDecoder().decode(bytes);
  const targets = [...text.matchAll(/Target="([^"]+)"/g)].map((m) => m[1]);
  const offline = targets.length > 0 && targets.every((t) => t.startsWith('/')) && text.includes('3D/3dmodel.model') && !/Target="https?:/i.test(text);
  return { ok: offline, offline, published: false, html: '' };
}

function save3mf(bytes) {
  const blob = new Blob([bytes], { type: 'model/3mf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'void-stage.3mf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function run(text, api) {
  const hit = downloadPrintOf(text);
  if (!hit) return 'none';
  const things = api.stage && api.stage.things ? api.stage.things() : {};
  const file = stage3mf(things);
  if (!file || !offlinePackage(file).ok) {
    if (api.say) api.say('the stage is empty');
    return 'print-download';
  }
  save3mf(file);
  if (api.say) api.say('void-stage.3mf · offline');
  return 'print-download';
}

export default {
  name: 'print-download',
  examples: ['download the print file', 'download the print file offline', 'save the print file for offline', 'get the print file'],
  nearMisses: ['export a print file', 'download motelet', 'download a 3mf of the stage', 'what is a slicer'],
  downloadPrintOf,
  offlinePackage,
  match(lower, text) { return !!downloadPrintOf(text); },
  run,
  suite() {
    const empty = offlinePackage(stage3mf({}));
    const chair = offlinePackage(stage3mf({ c: { kind: 'fig3d', model: 'chair' } }));
    const ok = !!downloadPrintOf('download the print file') && downloadPrintOf('export a print file') === null
      && empty.ok === false && empty.published === false && chair.ok === true && chair.offline === true;
    return { ok, got: ok ? 'offline, empty stays empty' : 'miss' };
  }
};
