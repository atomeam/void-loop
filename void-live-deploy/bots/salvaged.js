// Bots autosalvage unified into Verse from past work and free outside work (owner, 2026-11-03: "autosalvage was meant to unify all work
// into verse"; "even free stuff thats not ours can be salvaged and credited"). Each names the archived piece it came from as its lineage,
// so /bots/ shows where it came from and tools/bot-factory.mjs checks that the piece is real; each probe is a real task, and
// tools/salvaged-bots.test.mjs checks a second one. Pure, no network. Outside work carries its credit and shows on /credits/.
const nums = (s) => (String(s).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

export const SALVAGED = [
  // EU Cyber Resilience Act Art. 14 reporting clock, from hold's bridge (src/cra/clock.ts): "AEV|SI <awareness ISO time>" -> the four deadlines
  { id: 'cra-clock', cat: 'ops', job: 'EU Cyber Resilience Act reporting deadlines from when you became aware: "AEV 2026-11-01T10:00:00Z"', from: ['archive/repos/hold/apps/bridge'], run: (s) => { const m = /^(AEV|SI)\s+(\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?Z)$/i.exec(String(s).trim()); if (!m) return 'say AEV (actively exploited vulnerability) or SI (severe incident), then the UTC time you became aware'; const a = Date.parse(m[2]), h = 3600e3, d = 24 * h, iso = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; const k = m[1].toUpperCase(); return 'early warning ' + iso(a + 24 * h) + ' · notification ' + iso(a + 72 * h) + ' · final report ' + (k === 'AEV' ? iso(a + 14 * d) + ' (14 days after a fix is available)' : iso(a + 72 * h + 30 * d) + ' (1 month after the notification)'); }, probe: ['AEV 2026-11-01T10:00:00Z', 'early warning 2026-11-02 10:00 UTC · notification 2026-11-04 10:00 UTC · final report 2026-11-15 10:00 UTC (14 days after a fix is available)'] },
];
