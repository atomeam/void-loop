/**
 * temp skill — convert between Celsius and Fahrenheit.
 * "convert 20 c to f", "20 celsius to fahrenheit", "98.6 f to c".
 * Shows the converted temperature. Empty stage stays empty (card only).
 */
function num(s) { return parseFloat(String(s).replace(/,/g, '')); }

function parseTemp(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').trim();
  if (!/\b(?:celsius|fahrenheit|°?[cf]\b|convert.*temp)/.test(t)) return null;
  const m = t.match(/(-?\d+(?:\.\d+)?)\s*(?:°\s*)?(c|f|celsius|fahrenheit)\b/);
  if (!m) return null;
  const value = num(m[1]);
  const from = /f/.test(m[2]) ? 'f' : 'c';
  if (!Number.isFinite(value)) return null;
  const to = from === 'c' ? 'f' : 'c';
  const result = from === 'c' ? (value * 9 / 5) + 32 : (value - 32) * 5 / 9;
  return { value, from, to, result };
}

function run(text, api) {
  const { showPage, esc } = api;
  const parsed = parseTemp(text);
  if (!parsed) {
    showPage((el) => {
      el.innerHTML = '<h2>Temperature</h2><p>Say “20 c to f” or “98.6 f to c”.</p><div class="src">Source: °C ↔ °F · as of 2026-10</div>';
    });
    return 'temp';
  }
  const unit = parsed.to === 'c' ? '°C' : '°F';
  const fromUnit = parsed.from === 'c' ? '°C' : '°F';
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(parsed.value + fromUnit) + ' = ' + esc(parsed.result.toFixed(1) + unit) + '</h2><div class="src">Source: standard conversion · as of 2026-10</div>';
  });
  return 'temp';
}

function suite() {
  const p = parseTemp('convert 20 c to f');
  const ok = p && Math.abs(p.result - 68) < 0.1 && parseTemp('98.6 f to c') && Math.abs(parseTemp('98.6 f to c').result - 37) < 0.1 && !parseTemp('what is temperature');
  return { ok, got: ok ? 'pass' : JSON.stringify(p) };
}

export default {
  name: 'temp',
  examples: [
    "convert 20 c to f",
    "20 celsius to fahrenheit"
  ],
  nearMisses: [
    "what is temperature"
  ],
  match(lower) { return /\b(?:celsius|fahrenheit|°?[cf]\b)/.test(lower) && /\d/.test(lower); },
  run,
  suite
};
