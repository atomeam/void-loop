/**
 * qr-scan skill — tools pack 1 (owner, 2026-10-18): "scan a qr code", "read a barcode". A card with a button to take a photo (on a phone) or choose a picture of
 * a QR code or barcode; the browser's own BarcodeDetector reads it on this device and the result becomes a sticky note on the stage (a web address is only
 * shown, never opened for you). A browser without BarcodeDetector (most desktop Firefox and Safari, some Linux Chrome) says so plainly and offers nothing else:
 * no library is loaded and no picture leaves the page. Making a code ("qr code for my wifi") is another skill (util).
 */
import { scanValue } from '../lib/note-tools.js';
import { addThing } from '../lib/stage-pack.js';

const ASK = /^(?:please\s+)?(?:(?:scan|read|decode)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+|this\s+|my\s+)?(?:qr(?:\s*code)?|barcode|bar\s+code|qr\s*\/\s*barcode)|(?:qr(?:\s*code)?|barcode)\s+(?:scanner|reader))(?:\s+(?:from|in|on)\s+(?:a\s+)?(?:photo|picture|image))?$/i;

/** true for an ask to scan or read a code. Pure. */
export const wantsScan = (raw) => ASK.test(String(raw || '').trim().replace(/[.!?]+$/, ''));

/** whether this browser can read codes at all */
export const canScan = () => typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function';

/** the codes in one picture: [{ format, value }] */
export async function detect(file) {
  const det = new window.BarcodeDetector();
  const bmp = await createImageBitmap(file);
  try { return (await det.detect(bmp)).map((b) => ({ format: String(b.format || 'code'), value: String(b.rawValue || '') })).filter((b) => b.value); }
  finally { try { bmp.close(); } catch (_) {} }
}

function run(text, api) {
  const { showPage, say } = api, stageApi = api.stage;
  const el = showPage((p) => {
    const h = document.createElement('h2'); h.textContent = 'Scan a code';
    const note = document.createElement('div'); note.className = 'sub'; note.setAttribute('data-qr-status', ''); note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
    p.append(h, note);
    if (!canScan()) {
      note.textContent = 'This browser cannot read QR codes or barcodes (it has no BarcodeDetector). Chrome on Android, Chrome or Edge on Mac and Windows, and Safari on recent iPhones do. Nothing was loaded and no picture was taken.';
      note.setAttribute('data-qr-unsupported', '');
      return;
    }
    note.textContent = 'Take a photo of a code, or choose a picture of one. It is read here on your device; the picture goes nowhere.';
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment'); inp.setAttribute('data-qr-file', ''); inp.setAttribute('aria-label', 'Take or choose a picture of a QR code or barcode');
    const out = document.createElement('div'); out.setAttribute('data-qr-result', '');
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      note.textContent = 'Reading…'; out.textContent = '';
      let codes = [];
      try { codes = await detect(f); } catch (_) { note.textContent = 'I could not read that picture.'; return; }
      if (!codes.length) { note.textContent = 'No code found in that picture. Try it closer, flatter and well lit.'; return; }
      note.textContent = codes.length + (codes.length === 1 ? ' code found' : ' codes found') + ', put on the stage as a note.';
      for (const c of codes.slice(0, 5)) {
        const v = scanValue(c.value);
        addThing(stageApi, 'sticky', { text: v.value + '\n(' + c.format.replace(/_/g, ' ') + (v.type === 'link' ? ', a web address: check it before you open it' : '') + ')', color: '#b6f5a8' });
        const line = document.createElement('div'); line.setAttribute('data-qr-code', v.type); line.textContent = c.format.replace(/_/g, ' ') + ': ' + v.value; out.appendChild(line);
      }
      stageApi.save(); stageApi.render(); say('code put on the stage as a note');
    });
    p.append(inp, out);
  });
  return el ? 'qr-scan' : 'qr-scan';
}

export default {
  name: 'qr-scan',
  examples: ['scan a qr code', 'read a barcode', 'qr code scanner', 'scan a barcode from a photo'],
  nearMisses: ['make a qr code for my wifi', 'qr code for https://example.com', 'what is a barcode', 'scan my documents', 'barcode lookup for 0123456789'],
  wantsScan,
  match(lower, text) { return wantsScan(text || lower); },
  run,
};
