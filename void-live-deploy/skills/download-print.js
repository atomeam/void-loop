/**
 * download-print skill — "download the print file".
 * Reuses the stage 3MF already built by print-file.js. The package is a
 * STORE zip of local model parts only, so it stays valid offline.
 * An empty stage stays empty: no stand-in cube, no published page.
 */
import { printFileOf, stage3mf } from './print-file.js';

const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function downloadPrintOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?download the print file$/.test(t)) return { what: 'stage' };
  if (/^(?:please\s+)?download the stage print file$/.test(t)) return { what: 'stage' };
  if (/^(?:please\s+)?save the print file offline$/.test(t)) return { what: 'stage' };
  if (/^(?:please\s+)?download the 3mf$/.test(t)) return { what: 'stage' };
  return null;
}

/** A slicer can open this with no network: zip local parts, no remote mesh URLs. */
export function offlineOk(bytes) {
  if (!bytes || bytes.length < 22) return false;
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  let text = '';
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  const urls = text.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  const remote = urls.filter((u) => !/schemas\.microsoft\.com|schemas\.openxmlformats\.org/i.test(u));
  if (remote.length) return false;
  return text.includes('3D/3dmodel.model') && text.includes('[Content_Types].xml');
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
  if (!file || !offlineOk(file)) {
    if (api.say) api.say('the stage is empty');
    return 'download-print';
  }
  if (typeof document !== 'undefined') save3mf(file);
  if (api.say) api.say('void-stage.3mf · offline');
  return 'download-print';
}

export default {
  name: 'download-print',
  examples: ['download the print file', 'download the stage print file', 'save the print file offline', 'download the 3mf'],
  nearMisses: ['download motelet', 'export a print file', 'download a 3mf of the stage', 'what is a slicer'],
  downloadPrintOf,
  offlineOk,
  match(lower, text) { return !!downloadPrintOf(text); },
  run,
  suite() {
    const empty = stage3mf({});
    const file = stage3mf({ c: { id: 'c', kind: 'fig3d', model: 'chair' } });
    const ok = !!downloadPrintOf('download the print file') && printFileOf('download the print file') === null
      && empty === null && file && offlineOk(file) && downloadPrintOf('download motelet') === null;
    return { ok, got: ok ? 'offline 3mf' : 'miss' };
  }
};
