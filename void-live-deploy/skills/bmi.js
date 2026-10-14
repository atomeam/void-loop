/**
 * bmi skill — body mass index from weight and height in the ask.
 * "what's my bmi", "bmi for 70 kg 175 cm", "my bmi is weight 180 lb height 5'10\"".
 * Shows BMI, category, and a short note. Empty stage stays empty (card only).
 */
function num(s) {
  if (s == null) return NaN;
  return parseFloat(String(s).replace(/,/g, ''));
}

function parseBMI(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').trim();
  if (!/\bbmi\b/.test(t)) return null;
  let kg = NaN, cm = NaN;
  // kg and cm anywhere
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)\b/);
  if (m) kg = num(m[1]);
  m = t.match(/(\d+(?:\.\d+)?)\s*(?:cm|centimeters?)\b/);
  if (m) cm = num(m[1]);
  // lb / ft in
  if (!Number.isFinite(kg)) {
    m = t.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/);
    if (m) kg = num(m[1]) * 0.453592;
  }
  if (!Number.isFinite(cm)) {
    m = t.match(/(\d+)\s*['′]\s*(\d+)/) || t.match(/(\d+)\s*(?:ft|feet)\s*(\d+)\s*(?:in|inches)?/);
    if (m) cm = (num(m[1]) * 12 + num(m[2] || 0)) * 2.54;
  }
  if (!Number.isFinite(kg) || !Number.isFinite(cm) || cm < 50 || cm > 250 || kg < 20 || kg > 400) return null;
  const meters = cm / 100;
  const bmi = kg / (meters * meters);
  return { bmi, kg, cm };
}

function category(bmi) {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'healthy weight';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

function run(text, api) {
  const { showPage, esc } = api;
  const parsed = parseBMI(text);
  if (!parsed) {
    showPage((el) => {
      el.innerHTML = '<h2>BMI</h2><p>Give weight and height, like “bmi for 70 kg 175 cm” or “180 lb 5\'10\"”.</p><div class="src">Source: standard BMI formula · as of 2026-10</div>';
    });
    return 'bmi';
  }
  const cat = category(parsed.bmi);
  const bmiStr = parsed.bmi.toFixed(1);
  showPage((el) => {
    el.innerHTML = '<h2>BMI ' + esc(bmiStr) + '</h2><p>' + esc(cat) + '</p><p style="font-size:14px;color:#888">' + esc(parsed.kg.toFixed(0)) + ' kg · ' + esc(parsed.cm.toFixed(0)) + ' cm</p><div class="src">Source: kg / m² · as of 2026-10</div>';
  });
  return 'bmi';
}

function suite() {
  const p = parseBMI('bmi for 70 kg 175 cm');
  const ok = p && Math.abs(p.bmi - 22.9) < 0.2 && category(p.bmi) === 'healthy weight' && !parseBMI('what is bmi');
  return { ok, got: ok ? 'pass' : JSON.stringify(p) };
}

export default {
  name: 'bmi',
  examples: [
    "what's my bmi",
    "bmi for 70 kg 175 cm"
  ],
  nearMisses: [
    "what is bmi",
    "body mass"
  ],
  match(lower) { return /\bbmi\b/.test(lower) && (/\d/.test(lower) || /my\b/.test(lower) || /for\b/.test(lower)); },
  run,
  suite
};
