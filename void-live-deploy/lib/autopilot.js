// What Verse did on its own (a-to-mind.com/autopilot/, /api/autopilot; owner 2026-10-30: "making Verse autonomous without you").
// Pure helpers: which commits on main are Verse's own loops at work, what kind of work each is, and the counts the page shows.
// "On its own" = a commit on main whose author is one of Verse's own loops (github-actions[bot] running a Verse workflow, or verse-loop),
// minus housekeeping (merge commits, regenerated files, the conductor's hourly record). Nothing here estimates: every count is of real records.

export const REPO = 'atomeam/void-loop';
export const OWN_EMAILS = ['41898282+github-actions[bot]@users.noreply.github.com', 'verse-loop@users.noreply.github.com'];

// subject -> kind; the first match wins. null = housekeeping, not shown and not counted
const KINDS = [
  [/^Merge (pull request|remote-tracking|branch)\b/, null],
  [/^Regenerate the generated files/, null],
  [/^Conductor:/, null],
  [/^Revert "/, 'revert'],
  [/^Incident:/, 'watch'],
  [/^(Verse fixes|Spotter:)/, 'fix'],
  [/^(Tower gate|Tower size|Versus by itself)/, 'assimilate'],
  [/^(Better at|Growth|Grow\b|Verse learns|Verse builds)/, 'build'],
  [/^(Site test|Bench|Latency|Probe)/, 'measure'],
];

/** the kind of work a commit subject records, or null for housekeeping. Pure. */
export function kindOf(subject) {
  const s = String(subject || '').trim();
  for (const [re, k] of KINDS) if (re.test(s)) return k;
  return 'other';
}

/** a merge of a pull request by Verse's auto-merge: its number, or 0. Pure. */
export const mergedPr = (subject) => { const m = /^Merge pull request #(\d+)\b/.exec(String(subject || '')); return m ? Number(m[1]) : 0; };

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** GitHub commit objects -> { own: [{ sha, at, kind, title, url }], merged: n }, newest first, each sha once. Pure. */
export function summarize(commits, sinceMs = 0) {
  const seen = new Set(), own = []; let merged = 0;
  for (const c of Array.isArray(commits) ? commits : []) {
    const sha = c && typeof c.sha === 'string' ? c.sha : ''; if (!/^[0-9a-f]{40}$/.test(sha) || seen.has(sha)) continue; seen.add(sha);
    const meta = c.commit || {}, at = (meta.committer && meta.committer.date) || (meta.author && meta.author.date) || '';
    const t = Date.parse(at); if (!Number.isFinite(t) || t < sinceMs) continue;
    const email = String((meta.author && meta.author.email) || '').toLowerCase(); if (!OWN_EMAILS.includes(email)) continue;
    const title = clean(String(meta.message || '').split('\n')[0], 160);
    if (mergedPr(title)) { merged++; continue; }
    const kind = kindOf(title); if (!kind) continue;
    own.push({ sha, at: new Date(t).toISOString(), kind, title, url: 'https://github.com/' + REPO + '/commit/' + sha });
  }
  own.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return { own, merged };
}

/** how many of each kind. Pure. */
export function kindCounts(own) {
  const out = {}; for (const c of Array.isArray(own) ? own : []) out[c.kind] = (out[c.kind] || 0) + 1; return out;
}

/** the conductor's ticks -> jobs started in each of the 24 hours before `now` (index 23 = the latest hour). Pure. */
export function startedByHour(ticks, now = Date.now()) {
  const out = new Array(24).fill(0), H = 3600e3;
  for (const t of Array.isArray(ticks) ? ticks : []) {
    const at = Date.parse(t && t.at); if (!Number.isFinite(at)) continue;
    const back = Math.floor((now - at) / H); if (back < 0 || back > 23) continue;
    out[23 - back] += Array.isArray(t.started) ? t.started.length : 0;
  }
  return out;
}

/** incidents -> { open, healed: [{ minutes }], since window }. Pure. */
export function incidentsIn(list, sinceMs = 0) {
  const all = Array.isArray(list) ? list : [];
  const open = all.filter((i) => i && !i.closedAt).length;
  const healed = all.filter((i) => i && i.closedAt && Date.parse(i.closedAt) >= sinceMs && Number.isFinite(i.minutes)).map((i) => i.minutes);
  return { open, healed: healed.length, medianMinutes: healed.length ? healed.slice().sort((a, b) => a - b)[Math.floor(healed.length / 2)] : null };
}
