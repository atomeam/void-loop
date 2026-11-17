const STORAGE = 'verse-f768-packing';
const form = document.getElementById('form');
const listEl = document.getElementById('list');
const statusEl = document.getElementById('status');

const baseItems = [
  'Passport / ID',
  'Wallet',
  'Phone + charger',
  'Toothbrush & toothpaste',
  'Underwear',
  'Socks',
  'T-shirts',
  'Pants / shorts',
  'Toiletries',
  'Medications',
  'Snacks'
];

const rules = {
  weather: {
    hot: ['Sunscreen', 'Hat', 'Sunglasses', 'Light clothes', 'Water bottle'],
    cold: ['Warm jacket', 'Sweater', 'Gloves', 'Beanie', 'Thermal layers'],
    rainy: ['Rain jacket', 'Umbrella', 'Waterproof shoes', 'Quick-dry clothes'],
    mild: ['Light jacket', 'Comfortable walking shoes']
  },
  type: {
    beach: ['Swimsuit', 'Beach towel', 'Flip flops', 'Beach bag'],
    hiking: ['Hiking boots', 'Backpack', 'Water bottle', 'Trail snacks', 'First aid kit'],
    business: ['Formal clothes', 'Laptop', 'Business cards', 'Dress shoes'],
    city: ['Comfortable shoes', 'City map / app', 'Day bag'],
    camping: ['Tent', 'Sleeping bag', 'Headlamp', 'Camp stove fuel', 'Insect repellent']
  }
};

function getSuggestions() {
  const days = parseInt(document.getElementById('days').value) || 7;
  const weather = document.getElementById('weather').value;
  const type = document.getElementById('type').value;
  const customText = document.getElementById('custom').value.trim();
  const customs = customText ? customText.split('\n').map(s => s.trim()).filter(Boolean) : [];

  let items = [...baseItems];
  if (rules.weather[weather]) items = items.concat(rules.weather[weather]);
  if (rules.type[type]) items = items.concat(rules.type[type]);
  items = items.concat(customs);

  // Deduplicate, preserve order
  const seen = new Set();
  return items.filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE)) || { checks: {}, customs: '' };
  } catch { return { checks: {}, customs: '' }; }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(state));
  } catch (e) { console.debug("lab f768-packing-list-maker:", e); }
}

function render() {
  const items = getSuggestions();
  const state = loadState();
  listEl.innerHTML = '';
  items.forEach(item => {
    const id = 'item-' + item.replace(/\W+/g, '-');
    const checked = state.checks[item] || false;
    const div = document.createElement('div');
    div.className = 'item' + (checked ? ' checked' : '');
    div.innerHTML = `
      <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
      <label for="${id}">${item}</label>
    `;
    const cb = div.querySelector('input');
    cb.addEventListener('change', () => {
      const st = loadState();
      st.checks[item] = cb.checked;
      saveState(st);
      div.classList.toggle('checked', cb.checked);
    });
    listEl.appendChild(div);
  });
  statusEl.textContent = items.length ? `${items.length} items` : '';
}

function exportText() {
  const items = getSuggestions();
  const state = loadState();
  const lines = items.map(item => (state.checks[item] ? '[x] ' : '[ ] ') + item);
  return lines.join('\n');
}

document.getElementById('generate').addEventListener('click', () => {
  const state = loadState();
  state.customs = document.getElementById('custom').value;
  saveState(state);
  render();
  statusEl.textContent = 'List updated';
});

document.getElementById('copy').addEventListener('click', async () => {
  const text = exportText();
  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = 'Copied to clipboard';
  } catch {
    statusEl.textContent = 'Copy failed — select and copy manually';
  }
});

document.getElementById('clear').addEventListener('click', () => {
  const state = loadState();
  state.checks = {};
  saveState(state);
  render();
  statusEl.textContent = 'Checks cleared';
});

// Live update on input changes
['days', 'weather', 'type'].forEach(id => {
  document.getElementById(id).addEventListener('change', render);
});
document.getElementById('custom').addEventListener('input', () => {
  // Debounce a bit or just render on blur / button
});

// Initial
const init = loadState();
if (init.customs) document.getElementById('custom').value = init.customs;
render();
