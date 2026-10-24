/**
 * service-health skill — "service health", "are the services up", "is uber down": every service Verse hands you to, checked from your browser.
 * Asked by Verse, 2026-10-16: "Create a 'Service Health' dashboard card that monitors the connectivity and response
 * speed of the new adapters (Waymo, Uber, Crypto, etc.) so I know w…". Also "is coingecko working", "check the adapters". One status-page card: every adapter in skills/providers.js and the public APIs the stage
 * calls (lib/service-health.js APIS), each with a dot (up, slow, down) and its response time, checked from this browser when the card
 * opens or "Check again" is tapped. No server, nothing kept. The law and the HTML are lib/service-health.js (pure, tested). Verse itself is
 * a service on the card too (asked by Verse, 2026-10-18): a stability dial over incidents.json (how often the suite on main went red in 7
 * days) that is redrawn on "Check again" and once a minute while the card is open, so it moves as incidents land or age out.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { PROVIDERS } from './providers.js';
import { servicesOf, check, healthHtml, gaugeHtml, GAUGE_EVERY_MS } from '../lib/service-health.js';
import { stabilityOf } from '../lib/autopsy.js';

const NAMES = '(?:uber(?: eats)?|waymo|lyft|door ?dash|coingecko|bluesky)';
const WHEN = new RegExp('^(?:(?:show (?:me )?)?(?:the )?(?:service|adapter)s? (?:health|status)|(?:are|is) (?:the |my |your )?(?:services|adapters) (?:up|down|working|ok)'
  + '|check (?:the |my |your )?(?:services|adapters)|is ' + NAMES + ' (?:up|down|working|ok)(?: right now| now)?)$', 'i');
const CSS = '.sh-list{list-style:none;padding:0;margin:8px 0}.sh-row{display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.08)}'
  + '.sh-dot{width:10px;height:10px;border-radius:50%;background:#888;align-self:center}.sh-row[data-state=up] .sh-dot{background:#3fb950}'
  + '.sh-row[data-state=slow] .sh-dot{background:#d29922}.sh-row[data-state=down] .sh-dot{background:#f85149}.sh-row[data-state=checking] .sh-dot{animation:sh-p 1s infinite alternate}'
  + '@keyframes sh-p{to{opacity:.3}}.sh-kind{opacity:.65;font-size:.85em}.sh-said{margin-left:auto}.sh-sum{font-weight:600}'
  + '.sh-gauge{display:flex;gap:10px;align-items:center;margin:6px 0 2px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)}.sh-gauge .sh-said{margin-left:0}'
  + '.sh-needle{transition:transform .9s cubic-bezier(.3,.7,.3,1)}@media (prefers-reduced-motion: reduce){.sh-needle{transition:none}}';

function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  if (!document.getElementById('sh-css')) { const st = document.createElement('style'); st.id = 'sh-css'; st.textContent = CSS; document.head.appendChild(st); }
  const services = servicesOf(PROVIDERS);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Service health</h2><div class="sub">Each service Verse hands you to, reached from your browser just now. A link-only adapter is timed reaching its site; an API is asked for its health answer.</div>'
      + '<div data-sh-gauge></div><div data-sh-out></div><p><button type="button" data-sh-again>Check again</button></p>'
      + '<div class="src">Checked only when you open this card or tap Check again; the stability dial reads the site\'s own incidents.json again every minute while the card is open; nothing is kept or sent to Verse.</div>'; // void-review: ok (constant text)
  });
  const out = el.querySelector('[data-sh-out]'), again = el.querySelector('[data-sh-again]'), dial = el.querySelector('[data-sh-gauge]');
  const still = () => !_pageStill || _pageStill(el);
  // the dial: Verse's own suite, from incidents.json (the file is public and tiny; a failed read leaves the last reading up)
  const gauge = () => fetch('/incidents.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && still()) { dial.innerHTML = gaugeHtml(esc, stabilityOf(j)); dial.dataset.reads = String((+dial.dataset.reads || 0) + 1); } }).catch(() => {}); // void-review: ok (gaugeHtml escapes every value)
  const go = () => {
    const results = new Array(services.length); again.disabled = true;
    out.innerHTML = healthHtml(esc, services, results); // void-review: ok (healthHtml escapes every value)
    gauge();
    return Promise.all(services.map((s, i) => check(s).then((r) => { results[i] = r; if (still()) out.innerHTML = healthHtml(esc, services, results); }))) // void-review: ok (escaped by healthHtml)
      .finally(() => { again.disabled = false; el.dataset.checked = String((+el.dataset.checked || 0) + 1); });
  };
  again.addEventListener('click', (e) => { e.stopPropagation(); go(); });
  go();
  const tick = setInterval(() => { if (!still()) return clearInterval(tick); gauge(); }, GAUGE_EVERY_MS); // real time without a server: the needle moves as incidents land or age out
  return 'service-health';
}

export default {
  name: 'service-health',
  examples: [
    'service health',
    'are the services up',
    'is uber down',
    'is coingecko working',
    'check the adapters',
  ],
  nearMisses: [
    'what services does void offer',
    'customer service phone number',
    'uber to the airport',
    'is uber safe',
  ],
  match(lower) { return WHEN.test(lower.trim().replace(/[?!.]+$/, '')); },
  run,
};
