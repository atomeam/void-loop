#!/usr/bin/env node
// Rebuild florida-heat-dose-2023-2026.csv from NOAA Coral Reef Watch 5 km
// single-pixel virtual stations (experimental collaborator product).
// Usage: node domains/forethinkers/experiments/heat-dose.mjs
// Source index: https://coralreefwatch.noaa.gov/product/vs_single_pixel_exp/florida_keys.php
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://coralreefwatch.noaa.gov/product/vs_single_pixel_exp/data/';
const STATIONS = [
  { name: 'Key Biscayne Cluster', file: 'AtlanticOcean_Florida_SoutheastFlorida_KeyBiscayneCluster.txt' },
  { name: 'Dry Tortugas Nursery', file: 'AtlanticOcean_Florida_FloridaKeys_DryTortugasNursery.txt' },
  { name: 'Carysfort Reef', file: 'AtlanticOcean_Florida_FloridaKeys_CarysfortReef.txt' },
  { name: 'Looe Key Reef', file: 'AtlanticOcean_Florida_FloridaKeys_LooeKeyReef.txt' },
];
const YEARS = [2023, 2024, 2025, 2026];

function parse(text) {
  const lines = text.split(/\r?\n/);
  const meta = {};
  for (let i = 0; i < 20; i++) {
    if (lines[i] === 'Latitude:') meta.lat = lines[i + 1].trim();
    if (lines[i] === 'Longitude:') meta.lon = lines[i + 1].trim();
  }
  const h = lines.findIndex((l) => l.startsWith('YYYY,'));
  const rows = [];
  for (const l of lines.slice(h + 1)) {
    if (!l.trim()) continue;
    const p = l.split(',').map((x) => x.trim());
    if (p.length < 8 || !/^\d{4}$/.test(p[0])) continue;
    rows.push({
      y: +p[0], m: +p[1], d: +p[2],
      sst: +p[3], dhw: +p[6], baa: +p[7],
    });
  }
  return { meta, rows };
}

function seasonStats(rows, year) {
  const season = rows.filter((r) => r.y === year && r.m >= 5 && r.m <= 11);
  if (!season.length) return null;
  const peak = season.reduce((a, b) => (b.dhw >= a.dhw ? b : a));
  const hot = season.reduce((a, b) => (b.sst >= a.sst ? b : a));
  const last = season[season.length - 1];
  const iso = (r) => `${r.y}-${String(r.m).padStart(2, '0')}-${String(r.d).padStart(2, '0')}`;
  return {
    peak_dhw: peak.dhw, peak_date: iso(peak),
    max_sst: hot.sst, max_sst_date: iso(hot),
    days31: season.filter((r) => r.sst >= 31).length,
    days4: season.filter((r) => r.dhw >= 4).length,
    days8: season.filter((r) => r.dhw >= 8).length,
    max_baa: Math.max(...season.map((r) => r.baa)),
    last_date: iso(last), last_dhw: last.dhw, last_baa: last.baa,
  };
}

const outDir = dirname(fileURLToPath(import.meta.url));
const lines = ['station,lat,lon,year,peak_dhw,peak_date,max_sst,max_sst_date,days_sst_ge_31,days_dhw_ge_4,days_dhw_ge_8,max_baa,last_date,last_dhw,last_baa,source_file'];
// Four public NOAA text files, fetched as one Promise.all batch (not a DB query loop).
const fetches = STATIONS.map((s) => fetch(BASE + s.file).then(async (res) => {
  if (!res.ok) throw new Error(`fetch ${s.file}: ${res.status}`);
  return { s, text: await res.text() };
}));
const texts = await Promise.all(fetches); // void-review: ok
for (const { s, text } of texts) {
  const { meta, rows } = parse(text);
  for (const year of YEARS) {
    const info = seasonStats(rows, year);
    if (!info) continue;
    lines.push([
      s.name, meta.lat || '', meta.lon || '', year,
      info.peak_dhw.toFixed(4), info.peak_date,
      info.max_sst.toFixed(4), info.max_sst_date,
      info.days31, info.days4, info.days8, info.max_baa,
      info.last_date, info.last_dhw.toFixed(4), info.last_baa, s.file,
    ].join(','));
  }
}
const out = join(outDir, 'florida-heat-dose-2023-2026.csv');
writeFileSync(out, lines.join('\n') + '\n');
console.log('wrote', out, 'rows', lines.length - 1);
