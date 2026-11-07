const KEY = 'verse-packing-list-v1';
const $ = id => document.getElementById(id);

const BASE = {
  documents: ['Passport or ID', 'Tickets / boarding passes', 'Insurance info', 'Emergency contacts'],
  toiletries: ['Toothbrush & toothpaste', 'Deodorant', 'Shampoo / soap', 'Medications', 'Sunscreen'],
  electronics: ['Phone charger', 'Power bank', 'Headphones'],
  clothes: ['Underwear', 'Socks', 'Sleepwear'],
  misc: ['Reusable water bottle', 'Snacks', 'Day bag / backpack']
};

const BY_TYPE = {
  beach: { clothes: ['Swimwear', 'Cover-up', 'Sandals', 'Sun hat', 'Sunglasses'], misc: ['Beach towel', 'Dry bag'] },
  hiking: { clothes: ['Hiking boots', 'Moisture-wicking shirts', 'Layers', 'Hat'], misc: ['Trail snacks', 'First aid kit', 'Map or offline maps'] },
  city: { clothes: ['Comfortable walking shoes', 'Casual outfits', 'Light jacket'], misc: ['Day bag', 'City map or offline guide'] },
  business: { clothes: ['Business attire', 'Dress shoes', 'Belt'], misc: ['Laptop', 'Notebook', 'Business cards'] },
  winter: { clothes: ['Warm coat', 'Gloves', 'Beanie', 'Thermal layers', 'Waterproof boots'], misc: ['Hand warmers', 'Lip balm'] },
  road: { clothes: ['Casual clothes', 'Comfortable shoes'], misc: ['Car charger', 'Cooler bag', 'Trash bags', 'Blanket'] }
};

const BY_WEATHER = {
  hot: { clothes: ['Light shirts', 'Shorts', 'Sun hat'], toiletries: ['Extra sunscreen'] },
  mild: { clothes: ['Light layers', 'Long pants option'] },
  cold: { clothes: ['Warm jacket', 'Sweater', 'Warm socks'], misc: ['Scarf'] },
  wet: { clothes: ['Waterproof jacket', 'Extra socks'], misc: ['Umbrella', 'Plastic bags for wet items'] }
};

let items = []; // {id, cat, name, done}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      items = data.items || [];
      $('tripName').value = data.tripName || '';
      $('days').value = data.days || 7;
      $('type').value = data.type || 'beach';
      $('weather').value = data.weather || 'mild';
    }
  } catch (e) { console.debug("lab f615-packing-list-maker:", e); }
  render();
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      items, tripName: $('tripName').value, days: $('days').value,
      type: $('type').value, weather: $('weather').value
    }));
  } catch (e) {
    console.warn('save failed', e);
  }
}

function generate() {
  const type = $('type').value;
  const weather = $('weather').value;
  const days = Math.max(1, parseInt($('days').value, 10) || 7);
  const newItems = [];

  function add(cat, name) {
    newItems.push({ id: uid(), cat, name, done: false });
  }

  Object.keys(BASE).forEach(cat => BASE[cat].forEach(n => add(cat, n)));
  if (BY_TYPE[type]) {
    Object.keys(BY_TYPE[type]).forEach(cat => BY_TYPE[type][cat].forEach(n => add(cat, n)));
  }
  if (BY_WEATHER[weather]) {
    Object.keys(BY_WEATHER[weather]).forEach(cat => BY_WEATHER[weather][cat].forEach(n => add(cat, n)));
  }
  // Scale some clothing roughly
  const extraUndies = Math.min(days, 10);
  for (let i = 0; i < Math.max(0, extraUndies - 3); i++) add('clothes', 'Extra underwear');

  items = newItems;
  save();
  render();
}

function render() {
  const list = $('list');
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<div class="empty">No items yet. Generate a list or add custom items.</div>';
    $('progress').textContent = '';
    return;
  }
  const cats = {};
  items.forEach(it => {
    if (!cats[it.cat]) cats[it.cat] = [];
    cats[it.cat].push(it);
  });
  const order = ['documents', 'clothes', 'toiletries', 'electronics', 'misc'];
  Object.keys(cats).sort((a, b) => order.indexOf(a) - order.indexOf(b) || a.localeCompare(b)).forEach(cat => {
    const div = document.createElement('div');
    div.className = 'cat';
    div.innerHTML = `<h2>${cat.charAt(0).toUpperCase() + cat.slice(1)}</h2>`;
    cats[cat].forEach(it => {
      const row = document.createElement('div');
      row.className = 'item' + (it.done ? ' done' : '');
      row.innerHTML = `
        <input type="checkbox" ${it.done ? 'checked' : ''} data-id="${it.id}">
        <span>${escapeHtml(it.name)}</span>
        <button data-id="${it.id}" title="Remove">×</button>
      `;
      div.appendChild(row);
    });
    list.appendChild(div);
  });
  const done = items.filter(i => i.done).length;
  $('progress').textContent = `${done} of ${items.length} packed`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function toggle(id) {
  const it = items.find(i => i.id === id);
  if (it) { it.done = !it.done; save(); render(); }
}

function remove(id) {
  items = items.filter(i => i.id !== id);
  save();
  render();
}

function addCustom() {
  const name = prompt('Item name:');
  if (!name || !name.trim()) return;
  const cat = prompt('Category (documents, clothes, toiletries, electronics, misc):', 'misc') || 'misc';
  items.push({ id: uid(), cat: cat.toLowerCase().trim(), name: name.trim(), done: false });
  save();
  render();
}

function textList(onlyUnchecked = false) {
  const lines = [];
  const trip = $('tripName').value || 'Trip';
  lines.push(trip);
  lines.push('---');
  const cats = {};
  items.forEach(it => {
    if (onlyUnchecked && it.done) return;
    if (!cats[it.cat]) cats[it.cat] = [];
    cats[it.cat].push(it);
  });
  Object.keys(cats).forEach(cat => {
    lines.push(cat.toUpperCase());
    cats[cat].forEach(it => lines.push((it.done ? '[x] ' : '[ ] ') + it.name));
    lines.push('');
  });
  return lines.join('\n');
}

function copy(onlyUnchecked) {
  const text = textList(onlyUnchecked);
  navigator.clipboard.writeText(text).then(() => alert('Copied')).catch(() => alert('Copy failed — select and copy manually'));
}

function download() {
  const rows = [['Category', 'Item', 'Packed']];
  items.forEach(it => rows.push([it.cat, it.name, it.done ? 'yes' : 'no']));
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = ($('tripName').value || 'packing-list').replace(/\s+/g, '-') + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function clearAll() {
  if (confirm('Clear the whole list?')) {
    items = [];
    save();
    render();
  }
}

$('generate').onclick = generate;
$('addCustom').onclick = addCustom;
$('copy').onclick = () => copy(true);
$('copyAll').onclick = () => copy(false);
$('download').onclick = download;
$('clear').onclick = clearAll;
$('list').addEventListener('change', e => {
  if (e.target.matches('input[type=checkbox]')) toggle(e.target.dataset.id);
});
$('list').addEventListener('click', e => {
  if (e.target.matches('button')) remove(e.target.dataset.id);
});

['tripName', 'days', 'type', 'weather'].forEach(id => {
  $(id).addEventListener('change', save);
  $(id).addEventListener('input', save);
});

load();
