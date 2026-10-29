// Verse the appraiser (Adam, 2026-10-15: "Verse can decide, it's an appraiser, it's supposed to be an expert in value").
// Verse prices its own products, no per-item approval. Inputs come only from store data and Verse's own pipeline, never chat
// (lib/price-lock.js). The result carries a short public "why this price" note for the store log.
//   item: { name, kind, effortHours, files: [{ bytes, type }] }
//   comps: similar products [{ name, cents }]; demand: topic ask count (lib/product-gap.js); sales: units sold so far
// -> { cents, note, flags }. Sanity bound: a paid item is never $0 (floor $1); over 10x the comparables' median is flagged, not blocked.
const median = (xs) => { const s = xs.filter((x) => x > 0).sort((a, b) => a - b); if (!s.length) return 0; const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const round = (c) => (c < 1000 ? Math.max(100, Math.round(c / 100) * 100) : Math.round(c / 500) * 500) - (c >= 1000 ? 100 : 0); // $3, $7, $24, $49...
const usd = (c) => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));

export function appraise(item = {}, { comps = [], demand = 0, sales = 0 } = {}) {
  const med = median(comps.map((c) => Number(c.cents) || 0));
  const effort = Math.max(0, Number(item.effortHours) || 0);
  const files = item.files || [];
  const mb = files.reduce((s, f) => s + (Number(f.bytes) || 0), 0) / 1e6;
  const why = [];
  let base = med || 900;
  why.push(med ? `${comps.length} similar items sell for a median of ${usd(med)}` : 'no close comparables, so it starts at a modest $9');
  const effortF = 1 + Math.min(1, effort / 20) * 0.5; if (effort) why.push(`about ${effort}h of work`);
  const fileF = files.length ? 1 + Math.min(0.3, files.length * 0.05 + mb / 500) : 0.8; why.push(files.length ? `${files.length} file${files.length > 1 ? 's' : ''} (${mb.toFixed(1)} MB)` : 'no files yet, so priced lower');
  const demandF = 1 + Math.min(0.3, Math.log2(1 + Math.max(0, demand)) * 0.06); if (demand) why.push(`asked for ${demand} time${demand > 1 ? 's' : ''}`);
  const salesF = sales >= 20 ? 1.1 : sales === 0 && item.live ? 0.9 : 1; if (sales) why.push(`${sales} sold so far`);
  let cents = round(base * effortF * fileF * demandF * salesF);
  const flags = [];
  if (!(cents > 0)) { cents = 100; flags.push('floor'); }
  if (med && cents > 10 * med) flags.push('over-10x-median');
  return { cents, flags, note: `Why ${usd(cents)}: ` + why.join('; ') + '.' + (flags.includes('over-10x-median') ? ' Flagged: more than 10x comparable items.' : '') };
}
