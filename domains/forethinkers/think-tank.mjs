// Forethinkers runner.
// A cycle picks one node and fans only into the tracks that node touches.
// Dead runs write nothing. Established requires title, url, date, and part.
// Dry-run is the default for a manual Actions run.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export function parseMap(markdown) {
  const fence = markdown.match(/```yaml\n([\s\S]*?)```/);
  if (!fence) throw new Error("convergence.md has no yaml node block");
  return parseNodes(fence[1]);
}

function parseNodes(yaml) {
  const nodes = [];
  let cur = null;
  for (const raw of yaml.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("nodes:")) continue;
    if (line.trim().startsWith("- id:")) {
      if (cur) nodes.push(cur);
      cur = { tracks: [] };
      cur.id = valueOf(line);
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^\s{4}([a-z-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, rest] = m;
    if (key === "tracks") {
      cur.tracks = rest.replace(/[\[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      cur[key] = strip(rest);
    }
  }
  if (cur) nodes.push(cur);
  return nodes;
}

function valueOf(line) {
  return strip(line.split(":").slice(1).join(":"));
}

function strip(v) {
  return v.trim().replace(/^["']|["']$/g, "");
}

export function establishedOk(claim) {
  if (!claim || claim.status !== "established") return true;
  return Boolean(claim.title && claim.url && claim.date && claim.part);
}

export function selectTracks(node, activeTracks) {
  const touched = node.tracks || [];
  if (!activeTracks || activeTracks.length === 0) return touched;
  return touched.filter((t) => activeTracks.includes(t));
}

export function applyWorker(node, result) {
  const changed = Boolean(result && (result.changedNode || result.unblocked));
  if (!changed) {
    return { write: false, node, boardLine: null, reason: "dead run" };
  }
  const next = { ...node };
  if (result.status) next.status = result.status;
  if (result.claim) next.claim = result.claim;
  if (result.status === "established") {
    next.title = result.title;
    next.url = result.url;
    next.date = result.date;
    next.part = result.part;
    if (!establishedOk(next)) {
      next.status = "hypothesis";
      delete next.title;
      delete next.url;
      delete next.date;
      return {
        write: true,
        node: next,
        boardLine: null,
        reason: "established rejected, node stays hypothesis",
        rejected: true,
      };
    }
  }
  const boardLine = result.boardLine && result.sourceUrl ? result.boardLine : null;
  return { write: true, node: next, boardLine, reason: "node changed" };
}

export function renderMap(nodes, logLine) {
  const body = nodes.map((n) => {
    const tracks = `[${(n.tracks || []).join(", ")}]`;
    const lines = [
      `  - id: ${n.id}`,
      `    kind: ${n.kind || "shared-part"}`,
      `    status: ${n.status || "hypothesis"}`,
      `    part: ${yaml(n.part || "")}`,
    ];
    if (n.title) lines.push(`    title: ${yaml(n.title)}`);
    if (n.url) lines.push(`    url: ${n.url}`);
    if (n.date) lines.push(`    date: ${n.date}`);
    lines.push(`    tracks: ${tracks}`);
    lines.push(`    claim: ${yaml(n.claim || "")}`);
    return lines.join("\n");
  }).join("\n");
  return `# Convergence map\n\nEach node is one claim. A cycle picks one node and fans only into \`tracks\`.\n\n\`\`\`yaml\nnodes:\n${body}\n\`\`\`\n\n## Cycle log\n\n- ${logLine}\n`;
}

function yaml(v) {
  if (/[:#]/.test(v) || v.includes('"')) return JSON.stringify(v);
  return v;
}

export async function runCycle({
  nodes,
  pick,
  work,
  github,
  dryRun = true,
  activeTracks = [],
  maxSearches = 4,
}) {
  const picked = await pick(nodes);
  const node = nodes.find((n) => n.id === picked.id);
  if (!node) throw new Error(`pick returned unknown node ${picked.id}`);
  const tracks = selectTracks(node, activeTracks);
  const writes = [];
  const board = [];
  let log = `${new Date().toISOString()} node=${node.id} tracks=${tracks.join(",") || "none"}`;
  if (tracks.length === 0) {
    log += " dead run, no touched tracks in ACTIVE_TRACKS";
    return finish({ nodes, log, writes, board, dryRun, github, any: false });
  }
  let any = false;
  for (const track of tracks) {
    const result = await work({ node, track, maxSearches });
    const applied = applyWorker(node, result);
    if (!applied.write) continue;
    any = true;
    const idx = nodes.findIndex((n) => n.id === node.id);
    nodes[idx] = applied.node;
    writes.push({ path: `domains/forethinkers/tracks/${track}.md`, body: result.trackNote || "" });
    if (applied.boardLine) board.push(applied.boardLine);
    log += ` ${track}=${applied.reason}`;
  }
  if (!any) log += " dead run, wrote nothing";
  return finish({ nodes, log, writes, board, dryRun, github, any });
}

async function finish({ nodes, log, writes, board, dryRun, github, any }) {
  const map = renderMap(nodes, log);
  const plan = { map, writes: any ? writes : [], board: any ? board : [], log, dryRun };
  if (dryRun) {
    plan.printed = true;
    return plan;
  }
  if (github) await github.commit(plan);
  return plan;
}

async function main() {
  const markdown = await readFile(path.join(here, "convergence.md"), "utf8");
  const nodes = parseMap(markdown);
  const dryRun = (process.env.DRY_RUN || "true") !== "false";
  const activeTracks = (process.env.ACTIVE_TRACKS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const maxSearches = Number(process.env.MAX_SEARCHES || 4);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.log(`${new Date().toISOString()} no model call. dry_run=${dryRun}. nodes=${nodes.length}`);
    console.log(nodes.map((n) => `${n.id} ${n.status} tracks=${n.tracks.join(",")}`).join("\n"));
    return;
  }
  console.log("model key present. JSON contract is unproven against the live model.");
  console.log(JSON.stringify({ dryRun, activeTracks, maxSearches }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
