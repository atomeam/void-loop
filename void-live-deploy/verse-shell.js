// The hidden command palette for every Verse page that links it. It creates no visible chrome.
// Team keeps its own Ctrl+K (the channel jump). The wording is lib/verse-shell.js.
import { NAV, commands, filterCommands, speculationRules, dressPath } from '/lib/verse-shell.js';

const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

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

function killInjectedChrome() {
  for (const el of document.querySelectorAll('.vs-chrome, #verse-nav, #verse-proof')) el.remove();
}

if (dressPath(location.pathname)) {
  document.addEventListener('keydown', onKey, true);
  if (window.MutationObserver) {
    const observer = new MutationObserver(killInjectedChrome);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    killInjectedChrome();
  }
  document.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest && e.target.closest('#go, #mic')) tick();
  }, { passive: true });
  armSpeculation();
}

function onKey(e) {
  if (location.pathname === '/team' || location.pathname.startsWith('/team/')) return;
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    e.stopImmediatePropagation();
    openPalette();
  }
}
