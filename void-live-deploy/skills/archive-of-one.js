/**
 * archive-of-one - "walk the archive": a full-screen guided gallery of everything you have kept on this device (the kept cards and answers,
 * figures, notes, lists, links), one at a time. Next / Back (or the arrow keys), soft fades (none under reduced motion), Escape closes.
 * Asked by the owner, 2026-10-18 (stage pack D). It is the quiet cousin of skills/showcase.js ("show me everything you made" walks what Verse
 * BUILT; this walks what YOU kept): it reads only the stage the page already keeps in this browser, sends nothing, and an empty stage
 * says so instead of opening an empty gallery. "internet archive" and "archive this email" stay where they go now.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const ASK_RE = /^(?:please\s+)?(?:walk|tour|wander|stroll)\s+(?:me\s+)?(?:through\s+)?(?:the\s+|my\s+)?(?:archive|archive of one)$|^(?:please\s+)?(?:walk\s+me\s+through\s+the\s+archive)$|^(?:please\s+)?(?:walk\s+the\s+archive)$|^(?:please\s+)?(?:open|show(?:\s+me)?)\s+(?:the\s+|my\s+)archive of one$/;
const clean = (s) => String(s || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

/** the ask wants the archive walk. Pure. */
export function archiveAsk(text) { return ASK_RE.test(clean(text)); }

const squeeze = (s) => String(s || '').replace(/\s+/g, ' ').trim();
/** the words of a stored card's html, with no tags (display text only: it is escaped again when drawn). Pure. */
export function stripHtml(html) {
  return squeeze(String(html || '').replace(/<(style|script|svg|button)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
}

const KIND_WORD = { kept: 'kept card', figure: 'figure', sticky: 'sticky note', notepad: 'notepad', list: 'list', link: 'link', image: 'picture' };
/** a short name for a stage thing: its title, label, first words, or the kind. Pure. */
export function nameOf(th) {
  const t = th || {};
  const raw = t.name || t.title || t.label || t.text || (Array.isArray(t.items) && t.items[0] && (t.items[0].text || t.items[0])) || stripHtml(t.html) || KIND_WORD[t.kind] || t.kind || 'thing';
  const s = squeeze(raw); return s.length > 40 ? s.slice(0, 39).trimEnd() + '…' : s; // ellipsis-ok: drawn picture or short label, the full text is on the card
}

/** every kept thing as { id, kind, label, title, text }, oldest first as the stage holds them. Pure. */
export function archiveItems(things) {
  const out = [];
  for (const t of Object.values(things || {})) {
    if (!t || !KIND_WORD[t.kind]) continue;
    let text = '';
    if (t.kind === 'kept') text = stripHtml(t.html);
    else if (t.kind === 'list') text = (Array.isArray(t.items) ? t.items : []).map((i) => (i && i.done ? '✓ ' : '• ') + squeeze(i && i.text !== undefined ? i.text : i)).join('\n');
    else if (t.kind === 'figure') text = squeeze(t.line || t.script || '');
    else if (t.kind === 'link') text = squeeze(t.url || t.href || t.text || '');
    else if (t.kind === 'image') text = squeeze(t.caption || t.alt || '');
    else text = String(t.text || '').trim();
    const title = nameOf(t);
    if (!text && title === KIND_WORD[t.kind]) continue; // an empty note or blank card is nothing to look at
    out.push({ id: t.id, kind: t.kind, label: KIND_WORD[t.kind], title, text });
  }
  return out;
}

/** the index after a step, never past either end. Pure. */
export function stepIndex(i, n, dir) { return n <= 0 ? 0 : Math.min(n - 1, Math.max(0, i + (dir < 0 ? -1 : 1))); }

/** one slide's inside: every value escaped. */
export function slideHtml(esc, item, i, n) {
  const body = String(item.text || '').split('\n').filter(Boolean).map((l) => '<p>' + esc(l) + '</p>').join('');
  return '<div class="ao-kind">' + esc(item.label) + ' · ' + (i + 1) + ' of ' + n + '</div><h2>' + esc(item.title) + '</h2>' + (body || '<p class="ao-quiet">no words on this one</p>');
}

const CSS = '.void-archive{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px 16px;background:radial-gradient(ellipse at 50% 40%,#12122a,#030308 80%);color:#e8e8f4;font:16px/1.5 system-ui,sans-serif}'
  + '.void-archive .ao-slide{width:min(640px,100%);max-height:62vh;overflow:auto;padding:22px 24px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(255,255,255,.04);transition:opacity .35s ease}'
  + '.void-archive.calm .ao-slide{transition:none}.void-archive .ao-slide.out{opacity:0}'
  + '.void-archive h2{margin:4px 0 10px;font-weight:500;font-size:22px;overflow-wrap:anywhere}.void-archive p{margin:0 0 8px;overflow-wrap:anywhere;white-space:pre-wrap}'
  + '.void-archive .ao-kind{font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.65}.void-archive .ao-quiet{opacity:.6}'
  + '.void-archive .ao-bar{display:flex;gap:10px}.void-archive button{font:inherit;padding:8px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:inherit;cursor:pointer}'
  + '.void-archive button:disabled{opacity:.35;cursor:default}.void-archive .ao-hint{font-size:12px;opacity:.55}';

let openArchive = null;
/** open the gallery over the page; resolves nothing, closes itself on Escape or Close. */
export function walk(items, esc) {
  if (openArchive) openArchive.close();
  let calm = false; try { calm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
  const back = document.activeElement;
  const root = document.createElement('div');
  root.className = 'void-archive' + (calm ? ' calm' : ''); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Archive of One');
  root.innerHTML = '<style>' + CSS + '</style><div class="ao-slide" aria-live="polite"></div><div class="ao-bar"><button type="button" class="ao-back">Back</button><button type="button" class="ao-next">Next</button><button type="button" class="ao-close">Close</button></div><div class="ao-hint">arrow keys to move · Escape to leave</div>';
  const slide = root.querySelector('.ao-slide'), bBack = root.querySelector('.ao-back'), bNext = root.querySelector('.ao-next');
  let i = 0;
  const paint = () => { slide.innerHTML = slideHtml(esc, items[i], i, items.length); bBack.disabled = i === 0; bNext.disabled = i === items.length - 1; slide.classList.remove('out'); };
  const go = (dir) => {
    const j = stepIndex(i, items.length, dir); if (j === i) return;
    if (calm) { i = j; paint(); return; }
    slide.classList.add('out'); setTimeout(() => { i = j; paint(); }, 220);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  };
  function close() { document.removeEventListener('keydown', onKey, true); root.remove(); openArchive = null; try { if (back && back.focus) back.focus(); } catch (_) {} }
  bBack.addEventListener('click', () => go(-1)); bNext.addEventListener('click', () => go(1)); root.querySelector('.ao-close').addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);
  paint(); document.body.appendChild(root); root.tabIndex = -1; root.focus(); // the dialog itself, not Next: the Enter that sent the ask must not press it
  openArchive = { close };
  return openArchive;
}

async function run(text, api) {
  if (!archiveAsk(text)) return 'none';
  const items = archiveItems(api.stage.things());
  if (!items.length) { api.say('nothing kept on this device yet · keep an answer, or put a note on the stage, and I will walk you through them'); return 'archive-of-one'; }
  walk(items, api.esc);
  return 'archive-of-one';
}

export default {
  name: 'archive-of-one',
  examples: ['walk the archive', 'walk me through the archive', 'open my archive of one'],
  nearMisses: ['internet archive', 'archive this email', 'wayback machine archive', 'archive of our own', 'walk the dog', 'show me everything you made'],
  archiveAsk, archiveItems, stepIndex, nameOf,
  match(lower, text) { return archiveAsk(text || lower); },
  run,
};
