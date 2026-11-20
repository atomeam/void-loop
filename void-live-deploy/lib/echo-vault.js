// Sites with no tool to rebuild belong in Echo Vault, not on their own Tower floor
// (owner, 2026-11-13 and 2026-11-20). Pure.
import { STUB_BYTES, stubOf } from './tower.js';

const READING = /\b(?:brochure|manifesto|reading list|journal|obituar|track list|album list|silent (?:album|track)|nearly empty|inert stub)\b/i;

function num(v) {
  if (v == null || v === '') return null;
  return Number.isFinite(+v) ? +v : null;
}

/** a short plain-text result (an address, a yes or no) is a tool, even with nothing to press. Pure. */
export function isPlainTextTool(x = {}, bytes = num(x.bytes)) {
  if (x.plain) return true;
  const sample = String(x.sample || '');
  if (bytes != null && bytes <= 80 && sample && !/</.test(sample) && /[A-Za-z0-9.:]/.test(sample) && !/it works!?|this is id5/i.test(sample)) return true;
  return false;
}

/** why a site has no tool to rebuild and belongs in Echo Vault ('' when a visitor could use something). Pure. */
export function echoVaultOf(x = {}, size) {
  if (!x) return '';
  if ((x.status || x.as) === 'non-site') return 'a non-site with nothing to use';
  const host = x.host || x.site || x.id;
  const sz = (size && size.sites && size.sites[host]) || {};
  const row = {
    controls: num(x.controls) ?? num(sz.controls),
    bytes: num(x.bytes) ?? num(sz.bytes),
    forms: num(x.forms) ?? num(sz.forms),
    usable: num(x.usable) ?? num(sz.usable),
    sample: x.sample || sz.sample || '',
    plain: x.plain || sz.plain,
    kind: x.kind || x.title || sz.title || '',
  };
  if (isPlainTextTool(row, row.bytes)) return '';
  const kind = String(row.kind);
  const press = row.usable ?? row.forms ?? row.controls;
  if (READING.test(kind) && (press == null || press === 0)) return 'only something to read, not a tool';
  if (row.controls != null && row.bytes != null) {
    const stub = stubOf({ controls: row.controls, bytes: row.bytes });
    if (stub && (press == null || press === 0)) return 'nothing a visitor can use, only a page to read';
    if (press === 0 && row.bytes < STUB_BYTES) return 'nothing a visitor can use, only a page to read';
  }
  return '';
}
