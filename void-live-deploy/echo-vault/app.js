const STORAGE_KEY = 'echo-vault-read-v1';

const find = document.getElementById('find');
const none = document.getElementById('none');
const stats = document.getElementById('stats');
const surpriseBtn = document.getElementById('surprise');
const resetReadBtn = document.getElementById('reset-read');
const vibeButtons = Array.from(document.querySelectorAll('[data-vibe-filter]'));
const articles = Array.from(document.querySelectorAll('main article[id]'));

const reader = document.getElementById('reader');
const readerVibe = document.getElementById('reader-vibe');
const readerTitle = document.getElementById('reader-title');
const readerBody = document.getElementById('reader-body');
const readerStatus = document.getElementById('reader-status');
const readerToggleRead = document.getElementById('reader-toggle-read');
const readerNext = document.getElementById('reader-next');
const readerClose = document.getElementById('reader-close');

let activeVibe = 'all';
let activeId = null;

function loadReadSet() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((item) => typeof item === 'string')) : new Set();
  } catch (err) {
    console.warn('Echo Vault: unable to read progress from localStorage.', err);
    return new Set();
  }
}

function saveReadSet(set) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn('Echo Vault: unable to save progress to localStorage.', err);
  }
}

const readSet = loadReadSet();

function syncReadBadges() {
  for (const article of articles) {
    const isRead = readSet.has(article.id);
    article.dataset.read = isRead ? 'true' : 'false';
    const badge = article.querySelector('.vault-read-badge');
    if (badge) {
      badge.textContent = isRead ? 'Read' : 'Unread';
    }
  }
  if (activeId) {
    const isRead = readSet.has(activeId);
    readerStatus.textContent = isRead ? 'Read' : 'Unread';
    readerToggleRead.textContent = isRead ? 'Mark unread' : 'Mark read';
  }
}

function updateStats(shown) {
  const readCount = articles.filter((a) => readSet.has(a.id)).length;
  if (stats) {
    stats.textContent = `${shown} of ${articles.length} stories shown · ${readCount} of ${articles.length} read`;
  }
  if (resetReadBtn) {
    resetReadBtn.hidden = readCount === 0;
  }
}

function apply() {
  const q = find ? find.value.trim().toLowerCase() : '';
  let shown = 0;
  for (const article of articles) {
    const vibe = (article.dataset.vibe || '').toLowerCase();
    const vibeMatch = activeVibe === 'all' || vibe === activeVibe;
    const hay = [
      article.dataset.words || '',
      article.dataset.vibeLabel || '',
      article.dataset.year || '',
      article.textContent || ''
    ].join(' ').toLowerCase();
    const queryMatch = !q || hay.includes(q);
    const on = vibeMatch && queryMatch;
    article.hidden = !on;
    if (on) shown += 1;
  }
  if (none) {
    none.hidden = shown > 0;
  }
  updateStats(shown);
  syncReadBadges();
}

function openStory(id, { markRead = true, scroll = true } = {}) {
  const article = articles.find((a) => a.id === id);
  if (!article || !reader) return;

  activeId = article.id;
  if (markRead) {
    readSet.add(article.id);
    saveReadSet(readSet);
  }

  const titleEl = article.querySelector('h2');
  readerTitle.textContent = titleEl ? titleEl.textContent : article.id;
  const vibeLabel = article.dataset.vibeLabel || article.dataset.vibe || 'Lore';
  const yearLabel = article.dataset.year ? ` · ${article.dataset.year}` : '';
  readerVibe.textContent = `${vibeLabel}${yearLabel}`;

  readerBody.replaceChildren();
  const paragraphs = article.querySelectorAll('p:not(.vault-meta)');
  for (const p of paragraphs) {
    readerBody.appendChild(p.cloneNode(true));
  }

  reader.hidden = false;
  for (const card of articles) {
    card.classList.toggle('is-active', card.id === article.id);
  }

  syncReadBadges();
  const shown = articles.filter((a) => !a.hidden).length;
  updateStats(shown);

  if (scroll) {
    reader.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function closeStory() {
  if (!reader) return;
  reader.hidden = true;
  activeId = null;
  for (const card of articles) {
    card.classList.remove('is-active');
  }
}

function pickRandomUnread() {
  const visibleUnread = articles.filter((a) => !a.hidden && !readSet.has(a.id) && a.id !== activeId);
  const allUnread = articles.filter((a) => !readSet.has(a.id) && a.id !== activeId);
  const fallbackPool = articles.filter((a) => !a.hidden && a.id !== activeId);
  const pool = visibleUnread.length > 0
    ? visibleUnread
    : allUnread.length > 0
      ? allUnread
      : fallbackPool.length > 0
        ? fallbackPool
        : articles;

  if (pool.length === 0) return;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  if (chosen.hidden) {
    activeVibe = 'all';
    if (find) find.value = '';
    for (const btn of vibeButtons) {
      btn.setAttribute('aria-pressed', btn.dataset.vibeFilter === 'all' ? 'true' : 'false');
    }
    apply();
  }
  openStory(chosen.id, { markRead: true, scroll: true });
}

if (find) {
  find.addEventListener('input', apply);
}

for (const btn of vibeButtons) {
  btn.addEventListener('click', () => {
    activeVibe = btn.dataset.vibeFilter || 'all';
    for (const other of vibeButtons) {
      other.setAttribute('aria-pressed', other === btn ? 'true' : 'false');
    }
    apply();
  });
}

for (const article of articles) {
  article.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    openStory(article.id, { markRead: true, scroll: true });
  });
}

if (surpriseBtn) {
  surpriseBtn.addEventListener('click', pickRandomUnread);
}

if (readerNext) {
  readerNext.addEventListener('click', pickRandomUnread);
}

if (readerToggleRead) {
  readerToggleRead.addEventListener('click', () => {
    if (!activeId) return;
    if (readSet.has(activeId)) {
      readSet.delete(activeId);
    } else {
      readSet.add(activeId);
    }
    saveReadSet(readSet);
    syncReadBadges();
    const shown = articles.filter((a) => !a.hidden).length;
    updateStats(shown);
  });
}

if (readerClose) {
  readerClose.addEventListener('click', closeStory);
}

if (resetReadBtn) {
  resetReadBtn.addEventListener('click', () => {
    readSet.clear();
    saveReadSet(readSet);
    syncReadBadges();
    const shown = articles.filter((a) => !a.hidden).length;
    updateStats(shown);
  });
}

apply();

const entry = new URLSearchParams(location.search).get('entry') || location.hash.replace(/^#/, '');
if (entry) {
  const target = articles.find((a) => a.id === entry);
  if (target) {
    openStory(target.id, { markRead: true, scroll: true });
  }
}
