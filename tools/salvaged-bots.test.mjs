// The salvaged bots (void-live-deploy/bots/salvaged.js): each passes its probe and a second real case, and its lineage is a real piece.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SALVAGED } from '../void-live-deploy/bots/salvaged.js';
import { BOT, probe } from '../void-live-deploy/bots/kit.js';
const bot = (id) => SALVAGED.find((b) => b.id === id);
const lineage = (b) => b.from.every((f) => existsSync(new URL('../' + f, import.meta.url)));
// cases
test("cra-clock", () => {
  const b = bot("cra-clock"); assert.ok(b && BOT("cra-clock"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("SI 2026-01-01T00:00:00Z"), "early warning 2026-01-02 00:00 UTC · notification 2026-01-04 00:00 UTC · final report 2026-02-03 00:00 UTC (1 month after the notification)");
  assert.ok(lineage(b), 'lineage is real');
});
test("change-curator", () => {
  const b = bot("change-curator"); assert.ok(b && BOT("change-curator"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("{\"citations\":[\"#1\"],\"rollback\":[\"revert\"],\"metric\":\"ctr\",\"risk\":\"low\",\"idempotent\":true}"), "approved");
  assert.ok(lineage(b), 'lineage is real');
});
test("retry-backoff", () => {
  const b = bot("retry-backoff"); assert.ok(b && BOT("retry-backoff"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("attempt 9, 200s in"), "stop: 3 minutes used, report it down");
  assert.ok(lineage(b), 'lineage is real');
});
test("wiki-links", () => {
  const b = bot("wiki-links"); assert.ok(b && BOT("wiki-links"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("plain note"), "links: none · tags: none");
  assert.ok(lineage(b), 'lineage is real');
});
test("header-grader", () => {
  const b = bot("header-grader"); assert.ok(b && BOT("header-grader"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("content-security-policy: a\nstrict-transport-security: b\nx-content-type-options: c\nreferrer-policy: d\npermissions-policy: e\ncross-origin-opener-policy: f"), "6/6 · all present");
  assert.ok(lineage(b), 'lineage is real');
});
test("atari-playfield", () => {
  const b = bot("atari-playfield"); assert.ok(b && BOT("atari-playfield"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("00 00 00"), "····················");
  assert.ok(lineage(b), 'lineage is real');
});
test("secret-sniffer", () => {
  const b = bot("secret-sniffer"); assert.ok(b && BOT("secret-sniffer"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("hello world"), "no secrets spotted");
  assert.ok(lineage(b), 'lineage is real');
});
test("journal-day", () => {
  const b = bot("journal-day"); assert.ok(b && BOT("journal-day"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("2024-02-29"), "2024-02-29 · Thursday, February 29");
  assert.ok(lineage(b), 'lineage is real');
});
test("free-api-finder", () => {
  const b = bot("free-api-finder"); assert.ok(b && BOT("free-api-finder"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("pokemon"), "PokeAPI, pokeapi.co");
  assert.ok(lineage(b), 'lineage is real');
});
test("proposal-checker", () => {
  const b = bot("proposal-checker"); assert.ok(b && BOT("proposal-checker"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("{\"title\":\"t\",\"citations\":[\"a\"],\"rollback\":[\"r\"],\"metric\":\"m\",\"risk\":\"low\"}"), "complete, ready for the change-curator");
  assert.ok(lineage(b), 'lineage is real');
});
test("note-search", () => {
  const b = bot("note-search"); assert.ok(b && BOT("note-search"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("crater | The base was quiet."), "not in this note: crater");
  assert.ok(lineage(b), 'lineage is real');
});
test("intent-router", () => {
  const b = bot("intent-router"); assert.ok(b && BOT("intent-router"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("clock AEV now"), "clock: opens a reporting clock");
  assert.ok(lineage(b), 'lineage is real');
});
test("pwa-manifest-check", () => {
  const b = bot("pwa-manifest-check"); assert.ok(b && BOT("pwa-manifest-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("{\"short_name\":\"A2M\",\"start_url\":\"./\",\"display\":\"standalone\",\"icons\":[{\"src\":\"i.svg\",\"sizes\":\"any\",\"type\":\"image/svg+xml\"}]}"), "installable · A2M opens ./ as standalone");
  assert.ok(lineage(b), 'lineage is real');
});
test("ollama-call", () => {
  const b = bot("ollama-call"); assert.ok(b && BOT("ollama-call"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("no model here"), "send model: question, like llama3.2: hello");
  assert.ok(lineage(b), 'lineage is real');
});
test("security-txt-check", () => {
  const b = bot("security-txt-check"); assert.ok(b && BOT("security-txt-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  const now = Date.parse('2026-11-04T00:00:00Z');
  assert.equal(b.run("Contact: mailto:security@example.com\nContact: https://example.com/report\nExpires: 2027-06-01T00:00:00Z", now), "passes RFC 9116 · 2 contacts, expires 2027-06-01");
  assert.equal(b.run("# only a comment\nExpires: 2029-01-01T00:00:00Z", now), "fails RFC 9116 · no Contact · Expires is more than a year out");
  assert.ok(lineage(b), 'lineage is real');
});
test("agent-transition", () => {
  const b = bot("agent-transition"); assert.ok(b && BOT("agent-transition"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("running -> waiting"), "allowed: running -> waiting");
  assert.ok(lineage(b), 'lineage is real');
});
test("deploy-command", () => {
  const b = bot("deploy-command"); assert.ok(b && BOT("deploy-command"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("netlify my-site public"), "npx netlify-cli deploy --prod --dir public --site my-site --auth \"$NETLIFY_AUTH_TOKEN\"");
  assert.ok(lineage(b), 'lineage is real');
});
test("facet-check", () => {
  const b = bot("facet-check"); assert.ok(b && BOT("facet-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("risk=read-only"), "facet#focus=none facet#output=none facet#risk=read-only");
  assert.ok(lineage(b), 'lineage is real');
});
test("contact-check", () => {
  const b = bot("contact-check"); assert.ok(b && BOT("contact-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("noreply@example.com"), "not a channel: noreply@example.com says nobody reads it");
  assert.ok(lineage(b), 'lineage is real');
});
test("permissions-policy-check", () => {
  const b = bot("permissions-policy-check"); assert.ok(b && BOT("permissions-policy-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), fullscreen=(self), autoplay=(), clipboard-read=(), bluetooth=()"), "10 set · allowed: fullscreen=(self)");
  assert.ok(lineage(b), 'lineage is real');
});
test("og-card-check", () => {
  const b = bot("og-card-check"); assert.ok(b && BOT("og-card-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("<h1>Verse</h1>"), "no Open Graph tags · omit them until a human seals a catalog");
  assert.equal(b.run('<h1>Verse</h1>\n<meta property="og:title" content="Verse">\n<meta property="og:url" content="https://a-to-mind.com/bots/">\n<meta property="og:image" content="https://a-to-mind.com/og.png">'), "passes · title matches the h1 and the image is first-party");
  assert.ok(lineage(b), 'lineage is real');
});
test("referrer-policy-check", () => {
  const b = bot("referrer-policy-check"); assert.ok(b && BOT("referrer-policy-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run(""), "unpublished · absent until a human seals one token");
  assert.equal(b.run("no-referrer"), "candidate · no-referrer");
  assert.equal(b.run("unsafe-url"), "fails · unsafe-url is denied");
  assert.ok(lineage(b), 'lineage is real');
});
test("hsts-check", () => {
  const b = bot("hsts-check"); assert.ok(b && BOT("hsts-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("max-age=300"), "candidate · max-age=300");
  assert.equal(b.run(""), "unpublished · a 404 must not send this header");
  assert.ok(lineage(b), 'lineage is real');
});
test("isolation-check", () => {
  const b = bot("isolation-check"); assert.ok(b && BOT("isolation-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run(""), "unpublished · COOP, COEP and CORP stay absent until a seal");
  assert.match(b.run("Cross-Origin-Resource-Policy: same-origin"), /CORP same-origin is denied/);
  assert.ok(lineage(b), 'lineage is real');
});
test("sri-check", () => {
  const b = bot("sri-check"); assert.ok(b && BOT("sri-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run('<script src="/vendor/app.js" integrity="sha384-abcdefghijklmnopqrstuvwx"></script>'), "first-party · sha384");
  assert.match(b.run('<script src="/vendor/app.js" integrity="sha256-abcdefghijklmnopqrstuvwx"></script>'), /sha384 or sha512/);
  assert.ok(lineage(b), 'lineage is real');
});
test("api-catalog-check", () => {
  const b = bot("api-catalog-check"); assert.ok(b && BOT("api-catalog-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("404"), "unpublished · no /.well-known/api-catalog until a human seals the linkset");
  assert.equal(b.run('{"linkset":[]}'), "empty linkset · a candidate only, not a published catalog");
  assert.ok(lineage(b), 'lineage is real');
});
test("jsdelivr-url", async () => {
  const b = bot("jsdelivr-url"); assert.ok(b && BOT("jsdelivr-url"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("@scope/pkg 2.0.1"), "https://cdn.jsdelivr.net/npm/@scope/pkg@2.0.1");
  assert.equal(b.run("left-pad latest"), "send a package and a version, like left-pad 1.3.0");
  assert.equal(b.credit.license, "MIT");
  assert.ok(lineage(b), 'lineage is real');
  const r = await fetch(b.run("left-pad 1.3.0"), { method: "HEAD", signal: AbortSignal.timeout(20000) });
  assert.equal(r.status, 200, "the pinned jsDelivr URL answers");
});
test("permalink-check", () => {
  const b = bot("permalink-check"); assert.ok(b && BOT("permalink-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run(""), "unpublished · no heading ids until a human seals a catalog");
  assert.match(b.run("<h2 id=\"capital-cities\">Capital cities</h2>"), /slugified from the heading/);
  assert.match(b.run('<h2 id="capitals"><a href="#capitals">Capital cities</a></h2>'), /inside the heading/);
  assert.ok(lineage(b), 'lineage is real');
});
test("status-seal-check", () => {
  const b = bot("status-seal-check"); assert.ok(b && BOT("status-seal-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run(""), "unpublished · no status page until a human seals a snapshot");
  assert.match(b.run("All Systems Operational"), /not All Systems Operational/);
  assert.match(b.run("stage: operational · 99.98%"), /no invented uptime/);
  assert.ok(lineage(b), 'lineage is real');
});
test("subprocessors-check", () => {
  const b = bot("subprocessors-check"); assert.ok(b && BOT("subprocessors-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run(""), "unpublished · no /subprocessors until a human seals a catalog");
  assert.match(b.run("Cloudflare, Inc. | serves the site · SOC 2"), /no certification badge/);
  assert.ok(lineage(b), 'lineage is real');
});
test("weak-signal-check", () => {
  const b = bot("weak-signal-check"); assert.ok(b && BOT("weak-signal-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("a faint note | the feed changed |"), "unattested · watched needs a disconfirm path, and nothing is sent");
  assert.match(b.run("a clue | early warning of a storm | look again"), /no early-warning badge/);
  assert.ok(lineage(b), 'lineage is real');
});
test("simple-icon-url", async () => {
  const b = bot("simple-icon-url"); assert.ok(b && BOT("simple-icon-url"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("GitHub 16.36.0"), "send a slug and a version, like github 16.36.0");
  assert.equal(b.credit.license, "CC0-1.0");
  assert.ok(lineage(b), 'lineage is real');
  const r = await fetch(b.run("github 16.36.0"), { method: "HEAD", signal: AbortSignal.timeout(20000) });
  assert.equal(r.status, 200, "the pinned simple-icons URL answers");
});
test("tabler-icon-url", async () => {
  const b = bot("tabler-icon-url"); assert.ok(b && BOT("tabler-icon-url"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("home 3.50.0"), "send a style, a slug and a version, like outline home 3.50.0");
  assert.equal(b.credit.license, "MIT");
  assert.ok(lineage(b), 'lineage is real');
  const r = await fetch(b.run("outline home 3.50.0"), { method: "HEAD", signal: AbortSignal.timeout(20000) });
  assert.equal(r.status, 200, "the pinned Tabler icon URL answers");
});
