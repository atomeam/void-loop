/**
 * yes-no skill — a fair yes/no (or true/false) for quick decisions (pure)
 * "yes or no", "should I", "true or false", "decide for me"
 */
const YES = ['Yes', 'Yes — go for it', 'Yes', 'Absolutely', 'Yes'];
const NO = ['No', 'No — not this time', 'No', 'Better not', 'No'];

export function wantsYesNo(lower) {
  const t = String(lower || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:yes\s+or\s+no|true\s+or\s+false|should\s+i|decide\s+for\s+me|coin\s+flip\s+yes\s+or\s+no|give\s+me\s+a\s+yes\s+or\s+no)$/i.test(t);
}

export function pickYesNo() {
  return Math.random() < 0.5 ? YES[Math.floor(Math.random() * YES.length)] : NO[Math.floor(Math.random() * NO.length)];
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!wantsYesNo(text)) {
    showPage((p) => { p.innerHTML = '<h2>Yes or no</h2><p>Say <b>yes or no</b> or <b>should I</b>.</p>'; });
    return 'yes-no';
  }
  const ans = pickYesNo();
  showPage((p) => { p.innerHTML = '<h2>Yes or no</h2><p style="font-size:36px;font-weight:700">' + esc(ans) + '</p><div class="sub">ask again for another flip</div>'; });
  return 'yes-no';
}

export default {
  name: 'yes-no',
  examples: ['yes or no', 'should I', 'true or false', 'decide for me'],
  nearMisses: ['what is yes', 'yes man', 'true story'],
  match(lower) { return wantsYesNo(lower); },
  run,
  suite() {
    const ok = wantsYesNo('yes or no') && wantsYesNo('should I') && !wantsYesNo('what is yes') && typeof pickYesNo() === 'string';
    return { ok };
  },
};
