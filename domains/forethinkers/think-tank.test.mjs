import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMap,
  establishedOk,
  selectTracks,
  applyWorker,
  runCycle,
} from "./think-tank.mjs";
import { readFile } from "node:fs/promises";

const map = parseMap(await readFile(new URL("./convergence.md", import.meta.url), "utf8"));

test("map seed: motor is established and joint stays hypothesis", () => {
  const motor = map.find((n) => n.id === "mit-printed-linear-motor");
  assert.equal(motor.status, "established");
  assert.equal(establishedOk(motor), true);
  const magnetize = map.find((n) => n.id === "magnetize-outside-printer");
  if (magnetize) {
    assert.equal(magnetize.status, "established");
    assert.equal(establishedOk(magnetize), true);
  }
  const bench = map.find((n) => n.id === "figure-scale-benchtop-magnetize");
  if (bench) {
    assert.equal(bench.status, "established");
    assert.equal(establishedOk(bench), true);
  }
  const fmt = map.find((n) => n.id === "multimaterial-export-3mf");
  if (fmt) {
    assert.equal(fmt.status, "established");
    assert.equal(establishedOk(fmt), true);
  }
  const seno = map.find((n) => n.id === "senolytics-mash-dq");
  if (seno) {
    assert.equal(seno.status, "established");
    assert.equal(establishedOk(seno), true);
  }
  const mind = map.find((n) => n.id === "offline-character-mind-module");
  if (mind) {
    assert.equal(mind.status, "established");
    assert.equal(establishedOk(mind), true);
    assert.deepEqual(mind.tracks, ["living-figures"]);
  }
  const joint = map.find((n) => n.id === "printed-actuator-moves-figure-joint");
  assert.equal(joint.status, "hypothesis");
  assert.deepEqual(joint.tracks, ["printing-working-machines", "living-figures"]);
  const exp = map.find((n) => n.id === "export-to-print");
  assert.equal(exp.status, "blocked");
});

test("fan-out touches two tracks, not four", () => {
  const joint = map.find((n) => n.id === "printed-actuator-moves-figure-joint");
  assert.deepEqual(selectTracks(joint, []), ["printing-working-machines", "living-figures"]);
  assert.deepEqual(selectTracks(joint, ["printing-working-machines"]), ["printing-working-machines"]);
});

test("dead run writes nothing, including the board", async () => {
  const github = { commits: [], async commit(plan) { this.commits.push(plan); } };
  const plan = await runCycle({
    nodes: structuredClone(map),
    dryRun: false,
    github,
    pick: async () => ({ id: "printed-actuator-moves-figure-joint" }),
    work: async () => ({ changedNode: false, unblocked: false, boardLine: "[think-tank] should not land" }),
  });
  assert.match(plan.log, /dead run, wrote nothing/);
  assert.equal(plan.board.length, 0);
  assert.equal(plan.writes.length, 0);
  assert.equal(github.commits.length, 1);
  assert.equal(github.commits[0].board.length, 0);
  assert.equal(github.commits[0].writes.length, 0);
});

test("established without a source is rejected", () => {
  const node = map.find((n) => n.id === "printed-actuator-moves-figure-joint");
  const applied = applyWorker(node, {
    changedNode: true,
    status: "established",
    claim: "it moves a joint",
    boardLine: "[think-tank] no source",
  });
  assert.equal(applied.rejected, true);
  assert.equal(applied.node.status, "hypothesis");
  assert.equal(applied.boardLine, null);
});

test("dry run prints and does not call GitHub", async () => {
  const github = { commits: [], async commit(plan) { this.commits.push(plan); } };
  const plan = await runCycle({
    nodes: structuredClone(map),
    dryRun: true,
    github,
    activeTracks: ["printing-working-machines"],
    maxSearches: 4,
    pick: async () => ({ id: "mit-printed-linear-motor" }),
    work: async ({ maxSearches }) => ({
      changedNode: true,
      status: "established",
      title: "Fully 3D-Printed electric motor",
      url: "https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218",
      date: "2026-02-18",
      part: "fully 3D-printed electric linear motor",
      claim: "reconfirmed",
      sourceUrl: "https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218",
      boardLine: "[think-tank] motor reconfirmed",
      trackNote: `searches=${maxSearches}`,
    }),
  });
  assert.equal(plan.printed, true);
  assert.equal(plan.dryRun, true);
  assert.equal(github.commits.length, 0);
  assert.equal(plan.board.length, 1);
  assert.match(plan.log, /printing-working-machines/);
  assert.doesNotMatch(plan.log, /living-figures/);
});
