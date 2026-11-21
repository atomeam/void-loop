#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

export const DEFAULT_STOPS_PATH = '.git/verse-loop.stops.jsonl';

/**
 * Read and parse a verse-loop.stops.jsonl file line-by-line.
 * Skips blank lines and logs a warning on malformed JSON lines.
 */
export async function readStops(filePath = DEFAULT_STOPS_PATH, filters = {}) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  const stops = [];
  const stream = fs.createReadStream(resolvedPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber += 1;
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const entry = JSON.parse(trimmed);
      if (matchesFilters(entry, filters)) {
        stops.push(entry);
      }
    } catch (err) {
      console.warn(`[stops-reader] Malformed JSON at line ${lineNumber}: ${err.message}`);
    }
  }

  if (Number.isInteger(filters.limit) && filters.limit > 0) {
    return stops.slice(-filters.limit);
  }
  return stops;
}

function matchesFilters(entry, filters) {
  if (!entry || typeof entry !== 'object') return false;
  if (filters.reason) {
    const reason = String(entry.reason || entry.cause || entry.type || '').toLowerCase();
    if (!reason.includes(String(filters.reason).toLowerCase())) return false;
  }
  if (filters.status) {
    const status = String(entry.status || entry.outcome || '').toLowerCase();
    if (status !== String(filters.status).toLowerCase()) return false;
  }
  return true;
}

export function summarizeStops(stops) {
  const byReason = new Map();
  for (const stop of stops) {
    const key = String(stop.reason || stop.cause || stop.type || 'unknown');
    byReason.set(key, (byReason.get(key) || 0) + 1);
  }
  return {
    total: stops.length,
    byReason: Object.fromEntries(byReason.entries()),
  };
}

function formatStopLine(stop, index) {
  const ts = stop.ts || stop.timestamp || stop.at || '-';
  const reason = stop.reason || stop.cause || stop.type || 'stop';
  const msg = stop.message || stop.summary || stop.note || stop.detail || '';
  return `${index + 1}. [${ts}] ${reason}${msg ? `: ${msg}` : ''}`;
}

function parseArgs(argv) {
  const args = { file: DEFAULT_STOPS_PATH, reason: '', status: '', limit: 0, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file' || arg === '-f') args.file = argv[++i] || DEFAULT_STOPS_PATH;
    else if (arg === '--reason' || arg === '-r') args.reason = argv[++i] || '';
    else if (arg === '--status' || arg === '-s') args.status = argv[++i] || '';
    else if (arg === '--limit' || arg === '-n') args.limit = Number.parseInt(argv[++i] || '0', 10) || 0;
    else if (arg === '--json') args.json = true;
    else if (!arg.startsWith('-') && args.file === DEFAULT_STOPS_PATH) args.file = arg;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stops = await readStops(args.file, {
    reason: args.reason,
    status: args.status,
    limit: args.limit,
  });

  if (args.json) {
    console.log(JSON.stringify({ summary: summarizeStops(stops), stops }, null, 2));
    return;
  }

  const summary = summarizeStops(stops);
  console.log(`Stops read from ${args.file}: ${summary.total}`);
  const reasons = Object.entries(summary.byReason);
  if (reasons.length > 0) {
    console.log(`By reason: ${reasons.map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }
  for (let i = 0; i < stops.length; i += 1) {
    console.log(formatStopLine(stops[i], i));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`[stops-reader] ${err.message}`);
    process.exitCode = 1;
  });
}
