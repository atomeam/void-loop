/**
 * bmi skill — body mass index from height (cm) and weight (kg).
 * Empty surface stays empty: shows an outcome page, summons nothing.
 */
export function bmiOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (!/\bbmi\b/.test(t) && !/body mass index/.test(t)) return null;
  const cm = t.match(/(\d+(?:\.\d+)?)\s*cm\b/);
  const kg = t.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (!cm || !kg) return null;
  const height = parseFloat(cm[1]), weight = parseFloat(kg[1]);
  if (height < 50 || height > 250 || weight < 20 || weight > 400) return null;
  return { height, weight };
}
export function computeBmi({ height, weight }) {
  const m = height / 100;
  const bmi = weight / (m * m);
  let cat = 'normal weight';
  if (bmi < 18.5) cat = 'underweight';
  else if (bmi < 25) cat = 'normal weight';
  else if (bmi < 30) cat = 'overweight';
  else cat = 'obese';
  return { bmi: Math.round(bmi * 10) / 10, cat };
}
async function run(text, api) {
  const q = bmiOf(text);
  if (!q) return 'none';
  const r = computeBmi(q);
  const { showPage, esc } = api;
  showPage((p) => {
    p.innerHTML = '<h2>BMI</h2><div style="font-size:48px;font-weight:300;line-height:1.1">' + r.bmi + '</div>'
      + '<div class="sub">' + esc(r.cat) + ' · ' + q.height + ' cm, ' + q.weight + ' kg</div>'
      + '<p style="color:#8a8a8a;font-size:13px">Rough screen only. Not medical advice.</p>';
  });
  return 'bmi';
}
export function suite() {
  const q = bmiOf('bmi for 175 cm 70 kg');
  const r = q && computeBmi(q);
  const ok = !!q && Math.abs(r.bmi - 22.9) < 0.2 && r.cat === 'normal weight' && bmiOf('what is bmi') === null && bmiOf('175cm') === null;
  return { ok, got: ok ? String(r.bmi) : 'miss' };
}
export default {
  name: 'bmi',
  examples: ['bmi for 175 cm 70 kg', 'what\'s my bmi 180cm 75kg', 'calculate bmi 165 cm and 60 kg'],
  nearMisses: ['what is bmi', 'bmi calculator', 'how much do I weigh'],
  match(lower, text) { return !!bmiOf(text); },
  run,
  suite
};
