const listEl = document.getElementById('list');
const gpaEl = document.getElementById('gpa');
const creditsEl = document.getElementById('credits');
const barsEl = document.getElementById('bars');
const scaleEl = document.getElementById('scale');
let courses = [];
const KEY = 'verse-f616-gpa';

function gradeToPoints(g, scale) {
  if (scale === 'percent') {
    const n = parseFloat(g);
    if (isNaN(n)) return 0;
    if (n >= 90) return 4;
    if (n >= 80) return 3;
    if (n >= 70) return 2;
    if (n >= 60) return 1;
    return 0;
  }
  const map = { A:4, B:3, C:2, D:1, F:0, a:4, b:3, c:2, d:1, f:0 };
  return map[String(g).trim().toUpperCase()] ?? 0;
}

function recalc() {
  let totalPts = 0, totalCr = 0;
  courses.forEach(c => {
    const cr = parseFloat(c.credits) || 0;
    const pts = gradeToPoints(c.grade, scaleEl.value);
    totalPts += pts * cr;
    totalCr += cr;
  });
  const gpa = totalCr > 0 ? (totalPts / totalCr) : 0;
  gpaEl.textContent = gpa.toFixed(2);
  creditsEl.textContent = totalCr.toFixed(1) + ' credits';
  renderBars();
  save();
}

function render() {
  listEl.innerHTML = '';
  courses.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'course';
    div.innerHTML = `
      <input placeholder="Course name" value="${c.name||''}" data-i="${i}" data-f="name">
      <input type="number" min="0" step="0.5" placeholder="Credits" value="${c.credits||''}" data-i="${i}" data-f="credits">
      <input placeholder="${scaleEl.value==='percent'?'0-100':'A-F'}" value="${c.grade||''}" data-i="${i}" data-f="grade">
      <button data-i="${i}" class="secondary">×</button>
    `;
    listEl.appendChild(div);
  });
  listEl.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => {
      const i = +e.target.dataset.i;
      courses[i][e.target.dataset.f] = e.target.value;
      recalc();
    });
  });
  listEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', e => {
      courses.splice(+e.target.dataset.i, 1);
      render();
      recalc();
    });
  });
}

function renderBars() {
  barsEl.innerHTML = '';
  const max = Math.max(...courses.map(c => parseFloat(c.credits)||0), 1);
  courses.forEach(c => {
    const cr = parseFloat(c.credits)||0;
    const pts = gradeToPoints(c.grade, scaleEl.value);
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `<span style="width:80px;overflow:hidden">${c.name||'—'}</span>
      <div class="bar"><div style="width:${(cr/max*100)}%"></div></div>
      <span>${pts.toFixed(1)} × ${cr}</span>`;
    barsEl.appendChild(row);
  });
}

function save() {
  localStorage.setItem(KEY, JSON.stringify({ courses, scale: scaleEl.value }));
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    courses = d.courses || [{name:'',credits:'3',grade:'A'}];
    if (d.scale) scaleEl.value = d.scale;
  } catch { courses = [{name:'',credits:'3',grade:'A'}]; }
  render();
  recalc();
}

document.getElementById('add').onclick = () => {
  courses.push({name:'',credits:'3',grade: scaleEl.value==='percent'?'90':'A'});
  render();
  recalc();
};
document.getElementById('clear').onclick = () => {
  if (confirm('Clear all courses?')) { courses = []; render(); recalc(); }
};
scaleEl.onchange = () => { render(); recalc(); };
document.getElementById('copy').onclick = () => {
  const text = `GPA ${gpaEl.textContent} on ${creditsEl.textContent} (${scaleEl.value} scale)`;
  navigator.clipboard.writeText(text).then(() => alert('Copied'));
};
document.getElementById('csv').onclick = () => {
  let csv = 'Course,Credits,Grade,Points\n';
  courses.forEach(c => {
    const pts = gradeToPoints(c.grade, scaleEl.value);
    csv += `"${c.name||''}",${c.credits||0},${c.grade||''},${pts}\n`;
  });
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gpa.csv';
  a.click();
};
load();
