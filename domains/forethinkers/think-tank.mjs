// Forethinkers runner. A conversation cycle does not wait for this file.
// This file is the even-hour backstop. It reads every track. It does not cut to four.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("domains");
const here = path.join(root, "forethinkers");
const skip = new Set([
  "void.agents.log.md",
  "void.queue.md",
  "void.surface-qa.md",
  "growth-inbox.md",
]);

const tracks = (await readdir(root))
  .filter((name) => name.endsWith(".md") && !skip.has(name))
  .sort();

const brief = await readFile(path.join(here, "THINK-TANK-BRIEF.md"), "utf8");
const map = await readFile(path.join(here, "convergence.md"), "utf8");
const stamp = new Date().toISOString();
const key = process.env.ANTHROPIC_API_KEY;
const model = process.env.MODEL || "";

let note = `${stamp} tracks=${tracks.length} model=${key ? model || "unset" : "no key"}\n`;
if (!key) {
  note += "no model call. schedule is live. a talking cycle still writes findings by hand.\n";
} else {
  note += "key present. one call sees every track. do not fan out per track.\n";
  note += `brief chars=${brief.length} map chars=${map.length}\n`;
}

await writeFile(path.join(here, "last-cycle.txt"), note + tracks.join("\n") + "\n");
console.log(note);
console.log(tracks.join("\n"));
