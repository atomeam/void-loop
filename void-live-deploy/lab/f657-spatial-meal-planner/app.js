const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
let meals = [];
let assignments = {}; // day -> [mealId]
let nextId = 1;

function load() {
  const hash = location.hash.slice(1);
  if (hash) {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(hash))));
      meals = data.meals || [];
      assignments = data.assignments || {};
      nextId = Math.max(0, ...meals.map(m => m.id)) + 1;
      return;
    } catch (e) { console.debug("lab f657-spatial-meal-planner:", e); }
  }
  const saved = localStorage.getItem('verse-f657-meal');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      meals = data.meals || [];
      assignments = data.assignments || {};
      nextId = Math.max(0, ...meals.map(m => m.id)) + 1;
      return;
    } catch (e) { console.debug("lab f657-spatial-meal-planner:", e); }
  }
  // samples
  meals = [
    {id: nextId++, name: 'Oatmeal', ingredients: 'oats 1 cup\nmilk 1 cup\nbanana 1'},
    {id: nextId++, name: 'Chicken salad', ingredients: 'chicken breast 200g\nlettuce 1 head\ntomato 2\nolive oil 2 tbsp'},
    {id: nextId++, name: 'Pasta', ingredients: 'pasta 200g\ntomato sauce 1 jar\nparmesan 50g'}
  ];
  assignments = { Mon: [1], Tue: [2] };
}

function save() {
  const data = { meals, assignments };
  localStorage.setItem('verse-f657-meal', JSON.stringify(data));
  const hash = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  history.replaceState(null, '', '#' + hash);
}

function render() {
  const mealsEl = document.getElementById('meals');
  mealsEl.innerHTML = '';
  meals.forEach(m => {
    const card = document.createElement('div');
    card.className = 'meal-card';
    card.draggable = true;
    card.dataset.id = m.id;
    card.innerHTML = `<h3>${m.name}</h3><small>${m.ingredients}</small>`;
    card.ondragstart = e => e.dataTransfer.setData('text/plain', m.id);
    card.onclick = () => editMeal(m);
    mealsEl.appendChild(card);
  });

  const daysEl = document.getElementById('days');
  daysEl.innerHTML = '';
  DAYS.forEach(day => {
    const col = document.createElement('div');
    col.className = 'day';
    col.dataset.day = day;
    col.innerHTML = `<h4>${day}</h4>`;
    (assignments[day] || []).forEach(id => {
      const m = meals.find(x => x.id === id);
      if (m) {
        const mini = document.createElement('div');
        mini.className = 'meal-card';
        mini.style.fontSize = '0.85rem';
        mini.textContent = m.name;
        mini.draggable = true;
        mini.ondragstart = e => e.dataTransfer.setData('text/plain', m.id);
        col.appendChild(mini);
      }
    });
    col.ondragover = e => { e.preventDefault(); col.classList.add('drag-over'); };
    col.ondragleave = () => col.classList.remove('drag-over');
    col.ondrop = e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const id = +e.dataTransfer.getData('text/plain');
      if (!assignments[day]) assignments[day] = [];
      if (!assignments[day].includes(id)) assignments[day].push(id);
      // remove from other days
      DAYS.forEach(d => {
        if (d !== day && assignments[d]) assignments[d] = assignments[d].filter(x => x !== id);
      });
      save();
      render();
    };
    daysEl.appendChild(col);
  });

  // grocery
  const items = new Set();
  DAYS.forEach(day => {
    (assignments[day] || []).forEach(id => {
      const m = meals.find(x => x.id === id);
      if (m) m.ingredients.split('\n').forEach(line => {
        const t = line.trim();
        if (t) items.add(t);
      });
    });
  });
  document.getElementById('grocery').innerHTML = [...items].sort().map(i => `<li>${i}</li>`).join('');
}

function editMeal(m) {
  const name = prompt('Meal name', m.name);
  if (name === null) return;
  const ings = prompt('Ingredients (one per line)', m.ingredients);
  if (ings === null) return;
  m.name = name;
  m.ingredients = ings;
  save();
  render();
}

document.getElementById('addMeal').onclick = () => {
  const name = prompt('Meal name');
  if (!name) return;
  const ings = prompt('Ingredients (one per line)') || '';
  meals.push({ id: nextId++, name, ingredients: ings });
  save();
  render();
};

document.getElementById('copyPlan').onclick = () => {
  let text = 'Weekly Meal Plan\n\n';
  DAYS.forEach(day => {
    const names = (assignments[day] || []).map(id => meals.find(m => m.id === id)?.name).filter(Boolean);
    text += `${day}: ${names.join(', ') || '—'}\n`;
  });
  text += '\nGrocery list:\n' + [...document.getElementById('grocery').querySelectorAll('li')].map(li => '- ' + li.textContent).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const t = document.getElementById('toast');
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 1500);
  });
};

document.getElementById('download').onclick = () => {
  let csv = 'Day,Meals\n';
  DAYS.forEach(day => {
    const names = (assignments[day] || []).map(id => meals.find(m => m.id === id)?.name).filter(Boolean).join('; ');
    csv += `${day},"${names}"\n`;
  });
  csv += '\nGrocery\n';
  [...document.getElementById('grocery').querySelectorAll('li')].forEach(li => csv += `"${li.textContent}"\n`);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
  a.download = 'meal-plan.csv';
  a.click();
};

document.getElementById('clear').onclick = () => {
  if (confirm('Clear all meals and assignments?')) {
    meals = [];
    assignments = {};
    nextId = 1;
    save();
    render();
  }
};

load();
render();
