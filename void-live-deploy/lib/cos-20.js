// COS-20: adult-intent cards (blur + 18+ tap, owner exempt). Images only with a free-reuse licence (lib/free-pics.js licenceOf), credit, and a person verified adult from metadata/text (never pixels or a fetched image body). Never leaked, paparazzi, unlicensed or non-consensual. Minors stay fully blocked. Tests: tools/safe-meanings.test.mjs
import { licenceOf } from './free-pics.js';
import { adultIntent, entityFromAdultAsk } from './content-safety.js';

const BAD = /\b(?:leaked|leak|paparazzi|stolen|hacked|non-?consensual|unauthorized|private snap)\b/i;
const MINOR = /\b(?:child(?:ren)?|kids?|toddler|infant|minor|under-?age|teen(?:ager)?s?|boy|girl|pre-?teen)\b/i;
export const isFreeReuseLicense = (s) => !!licenceOf(s).ok;
export const isVerifiedAdult = ({ birthYear, year = new Date().getFullYear() } = {}) => { const y = +birthYear; return y >= 1800 && y <= year - 18; };
const val = (x) => { if (x == null) return ''; const v = x.value != null ? x.value : x; return String(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); };

export function mayShowLicensedAdultImage({ src, credit, license, birthYear, name, note = '', person = false, categories = '' } = {}) {
  if (MINOR.test([name, note, categories].join(' '))) return false;
  if (!/^https:\/\//i.test(String(src || '')) || !String(credit || '').trim() || !isFreeReuseLicense(license)) return false;
  if (BAD.test([name, credit, note, license].join(' '))) return false;
  if (person && !isVerifiedAdult({ birthYear })) return false;
  if (!person && birthYear != null && birthYear !== '' && !isVerifiedAdult({ birthYear })) return false;
  return true;
}

export function fromCommonsMeta(meta, { birthYear, name, person = false } = {}) {
  const em = (meta && (meta.extmetadata || meta)) || {};
  const hit = { src: meta && (meta.url || meta.thumburl) || '', credit: val(em.Artist) || val(em.Credit), license: val(em.LicenseShortName) || val(em.UsageTerms), birthYear, name, note: val(em.ImageDescription), person, categories: val(em.Categories) };
  return mayShowLicensedAdultImage(hit) ? hit : null;
}

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function show(el, ask, { owner = false, src = '', credit = '', license = '', name = '', birthYear, note = '', person = false, categories = '' } = {}) {
  if (!el) return;
  const ok = mayShowLicensedAdultImage({ src, credit, license, birthYear, name, note, person, categories });
  const blur = !owner && ok;
  const img = ok ? '<img alt="" src="' + esc(src) + '" data-adult-gated="1" style="max-width:100%;' + (blur ? 'filter:blur(28px)' : '') + '">' : '';
  const creditLine = ok ? '<p class="thin">' + esc(credit) + (license ? ' · ' + esc(license) : '') + '</p>' : '';
  el.dataset.cos20 = '1';
  el.innerHTML = '<h2>' + esc(name || ask) + '</h2><div class="sub">Adult · 18+</div>' + img + creditLine
    + (owner || !ok ? '' : '<p><button type="button" class="adult-open">I am 18+ · show</button></p>');
  const btn = el.querySelector('.adult-open');
  if (btn) btn.addEventListener('click', () => { const im = el.querySelector('img'); if (im) im.style.filter = ''; btn.remove(); });
}

export async function adultRoute(topic, el) {
  if (!adultIntent(topic)) return { topic, routed: false };
  const ent = entityFromAdultAsk(topic);
  if (ent) return { topic: ent, routed: false };
  let owner = false; try { owner = !!localStorage.getItem('a2m.void.owner.v1'); } catch (_) {}
  show(el, topic, { owner });
  return { topic, routed: true };
}
