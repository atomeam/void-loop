/**
 * age skill — age from a birth year or date (no key; pure date math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "how old if born 1990", "age of someone born on 1995-05-15", "years old from 2000".
 */
function parseAge(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  const m = t.match(/(?:how\s+old|age|years?\s+old).*(?:born|birth(?:day|date)?)\s+(?:in\s+|on\s+)?(\d{4}(?:-\d{2}(?:-\d{2})?)?)/) ||
            t.match(/born\s+(?:in\s+|on\s+)?(\d{4}(?:-\d{2}(?:-\d{2})?)?)/) ||
            t.match(/(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s+birth/);
  if (!m) return null;
  const dateStr = m[1];
  let year, month = 1, day = 1;
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-').map(Number);
    year = parts[0]; month = parts[1] || 1; day = parts[2] || 1;
  } else {
    year = Number(dateStr);
  }
  if (year < 1900 || year > 2100) return null;
  return { year, month, day, raw: dateStr };
}

function ageOf(born) {
  const now = new Date();
  let age = now.getFullYear() - born.year;
  const m = now.getMonth() + 1 - born.month;
  if (m < 0 || (m === 0 && now.getDate() < born.day)) age--;
  return Math.max(0, age);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseAge(text);
  if (!q) return 'none';
  const age = ageOf(q);
  showPage((p) => {
    p.innerHTML = '<h2>Age</h2><div style="font-size:48px;font-weight:300;margin:8px 0">' + age + '</div>'
      + '<div class="sub">born ' + esc(q.raw) + '</div>'
      + '<div class="src">as of ' + new Date().toISOString().slice(0, 10) + '</div>';
  });
  return 'age';
}

export default {
  name: 'age',
  examples: ['how old if born 1990', 'age of someone born on 1995-05-15', 'years old from 2000', 'born in 1985'],
  nearMisses: ['how old is the universe', 'age of consent', 'what year is it'],
  match(lower, text) { return !!parseAge(text); },
  run
};
