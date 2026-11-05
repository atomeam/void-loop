// The app shell on every Verse page that links it: the nav's current page, the command palette (Ctrl+K or ⌘K),
// speculation-rules prefetch, and a short haptic tick on a tap. The home page draws no chrome at all (owner, 2026-11-04).
// Team keeps its own Ctrl+K (the channel jump). Drawing is here; the wording is lib/verse-shell.js.
import { NAV, currentNav, commands, filterCommands, speculationRules, dressPath, revealScroll } from '/lib/verse-shell.js';

function ensureChrome() {
  if (!dressPath(location.pathname) || document.getElementById('verse-nav')) return;
  // the home page is the word and the input, nothing else (owner, 2026-11-04: "the words do not belong on verse homepage").
  // The pages it used to list are still on ⌘K (commands()), and a page is never left without a way back.
  if (location.pathname === '/') return;
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
  // the bar scrolls sideways on its own even before /verse.css has loaded, so a phone page never gets wider than the screen
  links.style.cssText = 'display:flex;flex:1;min-width:0;overflow-x:auto';
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
  document.body.prepend(header);
}

const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

function markCurrent() {
  const cur = currentNav(location.pathname);
  let current = null;
  for (const a of document.querySelectorAll('#verse-nav .vs-links a')) {
    if (cur && a.getAttribute('href') === cur.href) { a.setAttribute('aria-current', 'page'); current = a; }
    else a.removeAttribute('aria-current');
  }
  const bar = document.querySelector('#verse-nav .vs-links');
  if (!current || !bar) return;
  const box = bar.getBoundingClientRect(), r = current.getBoundingClientRect();
  bar.scrollLeft = revealScroll({ scrollLeft: bar.scrollLeft, clientWidth: bar.clientWidth, itemLeft: r.left - box.left, itemRight: r.right - box.left });
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

ensureChrome();
markCurrent();
addEventListener('resize', markCurrent);
addEventListener('load', markCurrent);
requestAnimationFrame(markCurrent);
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
