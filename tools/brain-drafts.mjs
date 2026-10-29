#!/usr/bin/env node
// brain-drafts — reads every frontier draft in a checkout of atomeam/a-to-mind.com and writes void-live-deploy/lib/brain-drafts.json: for each
// draft, the techniques it uses, the Verse Brain organ it became part of, or why it was left out. Owner, 2026-10-29: "build all the unique
// builds as a combination"; "dont fake it": a draft counts as part of the brain only through a technique the brain really runs.
// Usage: node tools/brain-drafts.mjs <path to an a-to-mind.com checkout> [--check]   (--check: fail if the committed file is stale)
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))), OUT = join(ROOT, 'void-live-deploy/lib/brain-drafts.json');
// technique -> [pattern, organ]. The organ is where the brain runs that technique. Order is priority: the first technique found in a
// draft's own name is its main idea, then the first found in its spec.
export const TECHNIQUES = [
  ['spiking synapses', /spiking|izhikevich|\bstdp\b|synap/, 'synapses'],
  ['lenia', /lenia/, 'creature'],
  ['hummed melody', /hum[ -]crystal|pitch[ -]detect|\byin\b|music[ -]box/, 'hearing'],
  ['self-mutating program', /self[ -]mutating|shader[ -]mind|genetic programming/, 'painter'],
  ['codec retina', /codec[ -]retina/, 'gardener'],
  ['l-system grammar', /l[ -]system (?:spatial|generative|expansion|grammar)|lindenmayer/, 'grower'], // "branches away from ... L-systems" in other specs is not the idea
  ['expression tree', /expression[ -]tree[ -](?:spatial|evo)|symbolic regression/, 'formula'], // F458's list of "recent clusters" names expression trees, not its idea
  ['lattice boltzmann', /lattice[ -]boltzmann|\blbm\b/, 'current'], // F308's wind tunnel is in LEFT, a physics toy for a different job
  ['granular contact genes', /discrete[ -]element|granular discrete|webgpu granular/, 'grains'], // F456; later drafts name its "granular broadcast" only as a cluster they branch away from
  ['reservoir', /reservoir|echo[ -]state|\besn\b/, 'predictor'],
  ['online k-means', /k-?means/, 'gestures'],
  ['compression oracle', /compression|\bncd\b|kolmogorov/, 'gestures'],
  ['hebbian learning', /hebbian/, 'memory'],
  ['hypervectors', /hypervector|hyperdimensional/, 'concepts'],
  ['character surprisal', /surprisal|ppm/, 'concepts'],
  ['concept graph', /concept[ -]graph|spatial graph|graph mind|co-?occurrence|message[ -]passing|spatial[ -]token|token[ -]swarm|embedding/, 'concepts'],
  ['speech words', /speech|spoken|voice/, 'concepts'],
  ['q-learning', /q-learning|tabular q|\bq-table/, 'will'],
  ['decision tree', /decision[ -]tree/, 'will'],
  ['policy', /\bpolicy\b|\brl\b|reinforcement|reward/, 'will'],
  ['kuramoto rhythm', /kuramoto|phase[ -]lock|phase oscillat|oscillator/, 'rhythm'],
  ['spectral and wave', /spectral|resonan|\bwave\b|interference|harmonic|sonif|acoustic|audio/, 'rhythm'],
  ['particle life', /particle[ -]life/, 'swarm'],
  ['physarum', /physarum|slime/, 'swarm'],
  ['softbody', /soft-?body|spring-?mass|mass-spring|cloth|membrane|\bchain\b|verlet|muscle/, 'membrane'],
  ['reaction-diffusion', /reaction[ -]diffusion|gray-?scott|\brd\b|autopoiesis|catalyst/, 'tissue'],
  ['neural cellular automata', /\bnca\b|cellular automat/, 'tissue'],
  ['lattice field', /lattice|density field|memory field|deposit|causal (?:energy|density|memory)/, 'tissue'],
  ['attention', /attention|transformer/, 'attention'],
  ['imagined futures', /imagin|rollout|what if/, 'imagination'],
  ['recurrent net', /\brnn\b|elman|recurrent/, 'predictor'],
  ['prediction residual', /residual|predict|forecast|\blms\b|online[ -]learning|intent/, 'predictor'],
  ['trajectory', /trajector|gesture|pointer[ -]history/, 'gestures'],
  ['memory', /memory|consolidat|palace|echo/, 'memory'],
  ['swarm and fluid', /swarm|boids|flock|particle|fluid|\bsph\b|forag|vector[ -]field|advection|vortex/, 'swarm'],
  ['genome arena', /genome|competition|competitive|arena|evolv|\bevo\b|genetic|population/, 'arena'],
  ['tiny mlp', /\bmlp\b|perceptron|neural kernel/, 'arena'],
  ['seal', /seal|indexeddb/, 'arena'],
  ['tilt', /orientation|tilt|devicemotion|accelerat/, 'senses'],
  ['webxr hand and gaze', /webxr|hand[ -]track|\bgaze\b|\bhand\b/, 'senses'],
  ['microphone', /microphone|\bmic\b|analysernode/, 'senses'],
  ['dom embodiment', /\bdom\b|\borbs?\b|\bcards?\b|portal|probe/, 'embodiment'],
  ['shared pages', /webrtc|shared/, 'bridge']
];
// whole drafts that are their own product or need a browser feature the brain does not use: what they are, and why left out
export const LEFT = {
  'panel-play': 'a comics maker, its own product (area rotation), not a part of a mind',
  'loop-grid': 'a music loop grid, its own product',
  'forge-duel': 'a card duel game, its own product',
  'scene-blocker': 'a film blocking tool, its own product',
  'spoken-sdf-program-synthesis': 'program synthesis of 3D shapes from speech, a 3D tool rather than a mind part',
  'lbm-wing-forge': 'a lattice-Boltzmann wind tunnel, a physics toy for a different job',
  'screen-grazing-lichen': 'needs the visitor to share their screen (getDisplayMedia)',
  'window-spanning-organism': 'needs several windows and a SharedWorker; the bridge shares one brain across pages instead',
  'taste-oracle': 'Gaussian-process preference duels; measured as a taste term in the arena on 20 seeds it gave no reliable gain (0.29 without, 0.25 to 0.33 with) and on its own benchmark it did no better than a hill climb',
  'local-ai-portal-lattice-mind': 'its spec is a placeholder and its page holds no working mind',
  'rd-attention-kernel': 'its spec is a placeholder (its idea is in the tissue and attention organs through other drafts)'
};

function slugOf(folder) { return folder.replace(/^F-?0*\d+-/, ''); }
function textOf(dir) {
  const spec = join(dir, 'SPEC.md'); if (existsSync(spec)) return { from: 'spec', text: readFileSync(spec, 'utf8') };
  const page = join(dir, 'index.html'); if (existsSync(page)) { const h = readFileSync(page, 'utf8'); const t = (h.match(/<title>([^<]*)<\/title>/i) || [])[1] || ''; const c = (h.match(/<!--([\s\S]{0,1500}?)-->/) || [])[1] || ''; return { from: 'page', text: t + '\n' + c }; }
  return { from: 'name', text: '' };
}
export function classify(folder, text) {
  const slug = slugOf(folder), name = slug.replace(/-/g, ' '), body = String(text).toLowerCase().replace(/\[[^\]]*\]\([^)]*\)/g, ' ');
  const inName = TECHNIQUES.filter(([, re]) => re.test(name)).map(([t]) => t), inBody = TECHNIQUES.filter(([, re]) => re.test(body)).map(([t]) => t);
  const techniques = [...new Set([...inName, ...inBody])].filter((t) => !['seal', 'dom embodiment', 'tilt'].includes(t) || inName.includes(t));
  const n = +(folder.match(/^F-?0*(\d+)/) || [])[1];
  if (LEFT[slug]) return { folder, number: n, techniques, organ: null, left: LEFT[slug] };
  const main = inName.find((t) => !['seal', 'dom embodiment', 'shared pages'].includes(t)) || inBody.find((t) => !['seal', 'dom embodiment', 'shared pages'].includes(t));
  if (!main) return { folder, number: n, techniques, organ: null, left: 'no technique the brain could run was found in its name, spec or page' };
  return { folder, number: n, techniques, organ: TECHNIQUES.find(([t]) => t === main)[2], main };
}

export function build(repo) {
  const dirs = readdirSync(join(repo, 'drafts')).filter((f) => /^F-?\d/.test(f)).sort((a, b) => +(a.match(/\d+/)[0]) - +(b.match(/\d+/)[0]) || a.localeCompare(b));
  const out = dirs.map((f) => { const t = textOf(join(repo, 'drafts', f)); return classify(f, t.text); });
  const used = out.filter((d) => d.organ), sig = new Set(used.map((d) => d.techniques.filter((t) => !['seal', 'dom embodiment', 'tilt', 'shared pages'].includes(t)).sort().join('+')));
  const tech = new Set(used.flatMap((d) => d.techniques));
  const byOrgan = {}; for (const d of used) (byOrgan[d.organ] = byOrgan[d.organ] || []).push(d.folder);
  return { note: 'Every frontier draft in atomeam/a-to-mind.com drafts/ and the Verse Brain organ it became part of (lib/brain-organs.js), or why it was left out. Written by tools/brain-drafts.mjs from the drafts\' specs (or their page and name when a draft has no spec). Numbers are the ones in drafts/NUMBERS.md (2026-10-29).',
    total: out.length, inBrain: used.length, left: out.length - used.length, techniques: tech.size, combinations: sig.size, byOrgan: Object.fromEntries(Object.entries(byOrgan).map(([k, v]) => [k, v.length])), drafts: out };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const repo = process.argv[2]; if (!repo) { console.error('usage: node tools/brain-drafts.mjs <a-to-mind.com checkout> [--check]'); process.exit(2); }
  const data = build(repo), text = JSON.stringify(data) + '\n';
  if (process.argv.includes('--check')) { const old = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''; if (old !== text) { console.error('brain-drafts.json is stale: run node tools/brain-drafts.mjs ' + repo); process.exit(1); } console.log('brain-drafts ok'); }
  else { writeFileSync(OUT, text); console.log(`${data.total} drafts: ${data.inBrain} in the brain, ${data.left} left out; ${data.techniques} techniques in ${data.combinations} combinations`, data.byOrgan); }
}
