/**
 * age skill - how old is someone born on a date (no key; pure date math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "how old is someone born 1995-03-15", "age from 1980", "born March 15 1990",
 * "what age is a person born in 2000".
 * Shows years, months, days. Better than a bare year count: full breakdown.
 */
function parseAge(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!/\b(?:age|born|birthday|years old|how old)\b/.test(t)) return null;
  if (/\b(?:age of consent|age of majority|dark ages|golden age|ice age|age of empires)\b/.test(t)) return null;

  // ISO date
  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3] };

  // month name day year
  const months = { january:1, jan:1, february:2, feb:2, march:3, mar:3, april:4, apr:4, may:5, june:6, jun:6, july:7, jul:7, august:8, aug:8, september:9, sep:9, sept:9, october:10, oct:10, november:11, nov:11, december:12, dec:12 };
  m = t.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/);
  if (m) return { y: +m[3], mo: months[m[1]], d: +m[2] };

  // year only
  m = t.match(/\b(?:born|from|in)\s+(\d{4})\b/);
  if (m) return { y: +m[1], mo: 1, d: 1, yearOnly: true };

  return null;
}

function ageOf(birth, now = new Date()) {
  let y = now.getFullYear() - birth.y;
  let mo = now.getMonth() + 1 - birth.mo;
  let d = now.getDate() - birth.d;
  if (d < 0) {
    mo -= 1;
    const prev = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    d += prev;
  }
  if (mo < 0) { y -= 1; mo += 12; }
  return { y, mo, d };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const b = parseAge(text);
  if (!b) return 'none';
  const a = ageOf(b);
  const page = showPage((el) => {
    let html = '<h2>Age</h2>';
    const born = b.yearOnly ? String(b.y) : b.y + '-' + String(b.mo).padStart(2, '0') + '-' + String(b.d).padStart(2, '0');
    html += '<div class="src">born ' + esc(born) + '</div>';
    html += '<p style="font-size:36px;margin:12px 0">' + a.y + ' years' + (b.yearOnly ? '' : ', ' + a.mo + ' months, ' + a.d + ' days') + '</p>';
    el.innerHTML = html;
  });
  return 'age';
}

export default {
  name: 'age',
  examples: ['how old is someone born 1995-03-15', 'age from 1980', 'what age is a person born in 2000'],
  nearMisses: ['what is the age of consent', 'dark ages', 'how old is the universe'],
  match(lower, text) { return !!parseAge(text); },
  run,
  suite() {
    const iso = parseAge('how old is someone born 1995-03-15');
    const yr = parseAge('age from 1980');
    const named = parseAge('born March 15 1990');
    const miss = parseAge('what is the age of consent');
    const a = ageOf({ y: 2000, mo: 1, d: 1 }, new Date(2026, 9, 17)); // Oct 17 2026
    const ok = iso && iso.y === 1995 && iso.mo === 3 && iso.d === 15
      && yr && yr.yearOnly && yr.y === 1980
      && named && named.y === 1990 && named.mo === 3
      && miss === null
      && a.y === 26 && a.mo === 9 && a.d === 16;
    return { ok, got: ok ? 'age parses' : 'miss' };
  }
};
