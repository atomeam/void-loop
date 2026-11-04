// The app shell on every Verse page that links it: the nav's current page, the command palette (Ctrl+K or ⌘K),
// a one-line live proof on the home page, speculation-rules prefetch, and a short haptic tick on a tap.
// Team keeps its own Ctrl+K (the channel jump). Drawing is here; the wording is lib/verse-shell.js.
import { NAV, currentNav, proofLine, commands, filterCommands, speculationRules, dressPath } from '/lib/verse-shell.js';

function ensureChrome() {
  if (!dressPath(location.pathname) || document.getElementById('verse-nav')) return;
  const header = document.createElement('header');
  header.className = 'vs-chrome';
  const nav = document.createElement('nav');
  nav.id = 'verse-nav';
  nav.className = 'vs-app';
  nav.setAttribute('aria-label', 'Verse');
  const brand = document.createElement('a');
  brand.className = 'vs-brand';
  brand.href = '/';
  brand.textContent = 'Verse';
  const links = document.createElement('div');
  links.className = 'vs-links';
  for (const item of NAV) {
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.label;
    links.append(a);
  }
  const k = document.createElement('button');
  k.type = 'button';
  k.className = 'vs-k';
  k.setAttribute('aria-label', 'Commands ⌘K');
  k.setAttribute('aria-keyshortcuts', 'Control+K Meta+K');
  const shown = document.createElement('span');
  shown.setAttribute('aria-hidden', 'true');
  shown.textContent = '⌘K';
  k.append(shown);
  nav.append(brand, links, k);
  header.append(nav);
  if (location.pathname === '/') {
    const proof = document.createElement('p');
    proof.id = 'verse-proof';
    proof.className = 'vs-proof';
    proof.setAttribute('role', 'status');
    proof.textContent = 'Verse, live';
    header.append(proof);
  }
  document.body.prepend(header);
}

const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

function markCurrent() {
  const cur = currentNav(location.pathname);
  for (const a of document.querySelectorAll('#verse-nav .vs-links a')) {
    if (cur && a.getAttribute('href') === cur.href) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function tick() {
  if (reduce()) return;
  try { if (navigator.vibrate) navigator.vibrate(8); } catch (_) {}
}

function armSpeculation() {
  if (document.querySelector('script[type="speculationrules"]')) return;
  const s = document.createElement('script');
  s.type = 'speculationrules';
  s.textContent = JSON.stringify(speculationRules(NAV));
  document.head.appendChild(s);
}

function palette() {
  if (document.getElementById('verse-palette')) return document.getElementById('verse-palette');
  const dlg = document.createElement('dialog');
  dlg.id = 'verse-palette';
  dlg.className = 'vs-pal';
  dlg.setAttribute('aria-label', 'Commands');
  const form = document.createElement('form');
  form.method = 'dialog';
  const input = document.createElement('input');
  input.type = 'text';
  input.setAttribute('aria-label', 'Command');
  input.setAttribute('aria-controls', 'verse-palette-list');
  input.setAttribute('aria-autocomplete', 'list');
  input.placeholder = 'Jump to…';
  input.autocomplete = 'off';
  const list = document.createElement('ul');
  list.id = 'verse-palette-list';
  list.setAttribute('role', 'listbox');
  form.append(input, list);
  dlg.append(form);
  document.body.append(dlg);

  let items = commands(location.pathname);
  let sel = 0;
  const draw = () => {
    items = filterCommands(commands(location.pathname), input.value);
    sel = Math.min(sel, Math.max(0, items.length - 1));
    list.replaceChildren();
    items.forEach((item, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.id = 'verse-cmd-' + i;
      b.setAttribute('aria-selected', i === sel ? 'true' : 'false');
      b.textContent = item.label;
      b.addEventListener('click', () => go(item));
      li.append(b);
      list.append(li);
    });
    input.setAttribute('aria-activedescendant', items.length ? 'verse-cmd-' + sel : '');
  };
  const go = (item) => {
    if (!item) return;
    dlg.close();
    tick();
    if (item.href === '#ask') {
      const ask = document.getElementById('input');
      if (ask) { ask.focus(); ask.select(); }
      return;
    }
    location.href = item.href;
  };
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      draw();
    } else if (e.key === 'Enter') { e.preventDefault(); go(items[sel]); }
  });
  dlg.addEventListener('close', () => { input.value = ''; });
  dlg._open = () => { sel = 0; input.value = ''; draw(); dlg.showModal(); input.focus(); };
  return dlg;
}

function openPalette() {
  const dlg = palette();
  if (typeof dlg._open === 'function') dlg._open();
}

function onKey(e) {
  if (location.pathname === '/team' || location.pathname.startsWith('/team/')) return;
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    e.stopImmediatePropagation();
    openPalette();
  }
}

async function paintProof() {
  const el = document.getElementById('verse-proof');
  if (!el) return;
  try {
    const [crewRes, selfRes] = await Promise.all([
      fetch('/api/crew').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/self.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    const beaten = selfRes && selfRes.tower ? selfRes.tower.beaten : undefined;
    const line = proofLine({ crew: crewRes && crewRes.crew, beaten });
    if (line) el.textContent = line;
  } catch (_) {}
}

ensureChrome();
markCurrent();
armSpeculation();
document.addEventListener('keydown', onKey, true);
document.addEventListener('pointerdown', (e) => {
  const t = e.target && e.target.closest && e.target.closest('#go, #mic, .vs-links a, .vs-k, .vs-brand');
  if (t) tick();
}, { passive: true });
const k = document.querySelector('.vs-k');
if (k) k.addEventListener('click', () => {
  if (location.pathname === '/team' || location.pathname.startsWith('/team/')) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    return;
  }
  openPalette();
});
if (document.getElementById('verse-proof')) {
  const run = () => { if (document.visibilityState !== 'hidden') paintProof(); };
  if (document.readyState === 'complete') run(); else addEventListener('load', run);
  setInterval(run, 30000);
}
