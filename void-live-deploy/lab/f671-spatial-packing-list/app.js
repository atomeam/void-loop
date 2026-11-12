const KEY = 'verse-f671-packing';
let items = [];
let dragEl = null;

function load() {
  try {
    const hash = location.hash.slice(1);
    if (hash) {
      const data = JSON.parse(decodeURIComponent(hash));
      if (data.items) items = data.items;
      if (data.days) document.getElementById('days').value = data.days;
      if (data.type) document.getElementById('type').value = data.type;
      if (data.weather) document.getElementById('weather').value = data.weather;
    } else {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const data = JSON.parse(saved);
        items = data.items || [];
        if (data.days) document.getElementById('days').value = data.days;
        if (data.type) document.getElementById('type').value = data.type;
        if (data.weather) document.getElementById('weather').value = data.weather;
      }
    }
  } catch (e) { console.debug("lab f671-spatial-packing-list:", e); }
  render();
}

function save() {
  const data = {
    items,
    days: document.getElementById('days').value,
    type: document.getElementById('type').value,
    weather: document.getElementById('weather').value
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.debug("lab f671-spatial-packing-list:", e); }
  location.hash = encodeURIComponent(JSON.stringify(data));
}

function addItem() {
  const name = document.getElementById('itemName').value.trim();
  if (!name) return;
  const weight = parseInt(document.getElementById('itemWeight').value, 10) || 0;
  items.push({ id: Date.now() + Math.random(), name, weight, zone: 'carry' });
  document.getElementById('itemName').value = '';
  document.getElementById('itemWeight').value = '';
  render();
  save();
}

function suggest() {
  const type = document.getElementById('type').value;
  const weather = document.getElementById('weather').value;
  const days = parseInt(document.getElementById('days').value, 10) || 1;
  const rules = {
    beach: { hot: ['swimsuit', 'sunscreen', 'sunglasses', 'towel', 'flip-flops'], mild: ['swimsuit', 'light jacket', 'sandals'] },
    city: { hot: ['comfortable shoes', 'hat', 'water bottle'], mild: ['walking shoes', 'light jacket'], cold: ['warm coat', 'scarf', 'gloves'] },
    hiking: { mild: ['hiking boots', 'backpack', 'water bottle', 'map'], cold: ['warm layers', 'gloves', 'beanie'], wet: ['rain jacket', 'waterproof bag'] },
    business: { mild: ['blazer', 'dress shoes', 'laptop', 'notebook'], cold: ['overcoat', 'dress shoes'] }
  };
  const list = (rules[type] && rules[type][weather]) || ['underwear', 'socks', 'toothbrush', 'phone charger'];
  if (days > 3) list.push('extra underwear', 'laundry bag');
  const existing = new Set(items.map(i => i.name.toLowerCase()));
  list.forEach(n => {
    if (!existing.has(n.toLowerCase())) {
      items.push({ id: Date.now() + Math.random(), name: n, weight: 50, zone: 'carry' });
    }
  });
  render();
  save();
}

function render() {
  document.querySelectorAll('.bag').forEach(b => {
    const zone = b.dataset.zone;
    const header = b.querySelector('h3');
    b.innerHTML = '';
    b.appendChild(header);
    items.filter(i => i.zone === zone).forEach(item => {
      const el = document.createElement('div');
      el.className = 'item';
      el.draggable = true;
      el.dataset.id = item.id;
      el.innerHTML = `<span>${item.name}</span><span>${item.weight}g</span>`;
      el.addEventListener('dragstart', e => {
        dragEl = el;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        dragEl = null;
      });
      b.appendChild(el);
    });
  });
  const total = items.reduce((s, i) => s + (i.weight || 0), 0);
  document.getElementById('status').textContent = `Total weight: ${total} g · ${items.length} items`;
}

document.querySelectorAll('.bag').forEach(bag => {
  bag.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  bag.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragEl) return;
    const id = dragEl.dataset.id;
    const item = items.find(i => String(i.id) === id);
    if (item) item.zone = bag.dataset.zone;
    render();
    save();
  });
});

function getListText() {
  const zones = ['carry', 'checked', 'personal'];
  let text = `Packing list (${document.getElementById('days').value} days, ${document.getElementById('type').value}, ${document.getElementById('weather').value})\n\n`;
  zones.forEach(z => {
    text += z.toUpperCase() + ':\n';
    items.filter(i => i.zone === z).forEach(i => { text += `- ${i.name} (${i.weight}g)\n`; });
    text += '\n';
  });
  text += `Total weight: ${items.reduce((s,i)=>s+(i.weight||0),0)} g`;
  return text;
}

function copyList() {
  navigator.clipboard.writeText(getListText()).then(() => alert('Copied'));
}

function downloadTxt() {
  const blob = new Blob([getListText()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'packing-list.txt';
  a.click();
}

function downloadPng() {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 800, 600);
  ctx.fillStyle = '#eee';
  ctx.font = '16px system-ui';
  ctx.fillText('Packing list', 20, 30);
  let y = 60;
  const zones = ['carry', 'checked', 'personal'];
  zones.forEach(z => {
    ctx.fillStyle = '#8cf';
    ctx.fillText(z.toUpperCase(), 20, y);
    y += 24;
    items.filter(i => i.zone === z).forEach(i => {
      ctx.fillStyle = '#ccc';
      ctx.fillText(`• ${i.name} (${i.weight}g)`, 40, y);
      y += 20;
    });
    y += 10;
  });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'packing-board.png';
  a.click();
}

document.getElementById('itemName').addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });
load();
