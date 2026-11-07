const palace = document.getElementById('palace');
const status = document.getElementById('status');
const DB_NAME = 'verse-f619-palace';
const STORE = 'cards';
let cards = []; // {id, front, back, x, y, ease, interval, reps, due}
let db, studying = null, revealed = false;

function now() { return Date.now(); }

function sm2(card, quality) { // quality 0-5
  if (quality < 3) {
    card.reps = 0;
    card.interval = 1;
  } else {
    if (card.reps === 0) card.interval = 1;
    else if (card.reps === 1) card.interval = 6;
    else card.interval = Math.round(card.interval * card.ease);
    card.reps += 1;
    card.ease = Math.max(1.3, card.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  }
  card.due = now() + card.interval * 86400000;
}

function addCard(front, back, x, y) {
  if (!front.trim()) return;
  const c = {
    id: Date.now() + Math.random(),
    front: front.trim(),
    back: (back || '').trim(),
    x: x ?? Math.random() * (palace.scrollWidth - 180) + 20,
    y: y ?? Math.random() * (palace.scrollHeight - 100) + 20,
    ease: 2.5, interval: 0, reps: 0, due: now()
  };
  cards.push(c);
  render();
  save();
}

function render() {
  palace.innerHTML = '';
  const dueCount = cards.filter(c => c.due <= now()).length;
  status.textContent = `${cards.length} cards · ${dueCount} due · drag to place`;
  cards.forEach(c => {
    const el = document.createElement('div');
    el.className = 'card' + (c.due <= now() ? ' due' : '') + (studying && studying.id === c.id ? ' studying' : '');
    el.innerHTML = `<div class="front">${escape(c.front)}</div><div class="back">${escape(c.back)}</div>`;
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    makeDraggable(el, c);
    el.onclick = () => { if (!studying) { studying = c; revealed = false; showStudy(); } };
    palace.appendChild(el);
  });
}

function escape(s) { return s.replace(/[&<>]/g, m => ({'&':'&','<':'<','>':'>'}[m])); }

function makeDraggable(el, c) {
  let ox, oy, dragging = false;
  el.onpointerdown = e => {
    if (e.button !== 0) return;
    dragging = true;
    ox = e.clientX - c.x; oy = e.clientY - c.y;
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  el.onpointermove = e => {
    if (!dragging) return;
    c.x = e.clientX - ox; c.y = e.clientY - oy;
    el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  };
  el.onpointerup = () => { if (dragging) { dragging = false; save(); } };
}

function showStudy() {
  if (!studying) return;
  document.getElementById('study').style.display = 'flex';
  document.getElementById('studyFront').textContent = studying.front;
  document.getElementById('reveal').style.display = 'inline-block';
  ['again','hard','good','easy'].forEach(id => document.getElementById(id).style.display = 'none');
  revealed = false;
  render();
}

function rate(q) {
  if (!studying) return;
  sm2(studying, q);
  studying = null;
  document.getElementById('study').style.display = 'none';
  render();
  save();
  const next = cards.filter(c => c.due <= now()).sort((a,b)=>a.due-b.due)[0];
  if (next) { studying = next; setTimeout(showStudy, 300); }
}

function speak() {
  if (!studying || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(studying.front);
  speechSynthesis.speak(u);
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    r.onsuccess = e => res(e.target.result);
    r.onerror = rej;
  });
}
async function save() {
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(cards, 'all');
}
async function load() {
  try {
    db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('all');
    req.onsuccess = () => {
      if (req.result) { cards = req.result; render(); }
    };
  } catch (e) { status.textContent = 'IDB unavailable — in-memory only'; }
}
load();

document.getElementById('addOne').onclick = () => {
  addCard(document.getElementById('front').value, document.getElementById('back').value);
  document.getElementById('front').value = ''; document.getElementById('back').value = '';
};
document.getElementById('addPaste').onclick = () => {
  const lines = document.getElementById('paste').value.split('\n').filter(l => l.trim());
  lines.forEach(l => {
    const parts = l.split(/,|\t/).map(s => s.trim());
    if (parts[0]) addCard(parts[0], parts[1] || '');
  });
  document.getElementById('paste').value = '';
};
document.getElementById('studyBtn').onclick = () => {
  const due = cards.filter(c => c.due <= now()).sort((a,b)=>a.due-b.due);
  if (due.length) { studying = due[0]; showStudy(); }
  else status.textContent = 'No cards due right now';
};
document.getElementById('reveal').onclick = () => {
  if (!studying) return;
  revealed = true;
  document.querySelector('.card.studying')?.classList.add('revealed');
  document.getElementById('reveal').style.display = 'none';
  ['again','hard','good','easy'].forEach(id => document.getElementById(id).style.display = 'inline-block');
  document.getElementById('studyFront').textContent = studying.front + ' → ' + studying.back;
};
document.getElementById('again').onclick = () => rate(1);
document.getElementById('hard').onclick = () => rate(3);
document.getElementById('good').onclick = () => rate(4);
document.getElementById('easy').onclick = () => rate(5);
document.getElementById('speak').onclick = speak;
document.getElementById('stopStudy').onclick = () => { studying = null; document.getElementById('study').style.display = 'none'; render(); };
document.getElementById('clear').onclick = () => { if (confirm('Clear all cards?')) { cards = []; render(); save(); } };
document.getElementById('exportJSON').onclick = () => {
  const blob = new Blob([JSON.stringify({cards, exported: now()}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'verse-memory-palace.json'; a.click();
};
document.getElementById('exportCSV').onclick = () => {
  const csv = 'front,back,ease,interval,reps,due\n' + cards.map(c =>
    `"${c.front.replace(/"/g,'""')}","${c.back.replace(/"/g,'""')}",${c.ease},${c.interval},${c.reps},${new Date(c.due).toISOString()}`
  ).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'verse-flashcards.csv'; a.click();
};

palace.style.width = '2000px'; palace.style.height = '1500px';
