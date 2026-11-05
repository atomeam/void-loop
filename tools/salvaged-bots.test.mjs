// The salvaged bots (void-live-deploy/bots/salvaged.js): each passes its probe and a second real case, and its lineage is a real piece.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
test("void-look", () => {
  const b = bot("void-look"); assert.ok(b && BOT("void-look"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("scale 1.3: bigger text"), "bg #050505 · glow #0b0b10 · stars off · scale 1.4");
  assert.equal(b.run("paint it red"), 'not a void look: try "my void deep blue", "add stars" or "bigger text"');
  assert.ok(lineage(b), 'lineage is real');
});
test("provider-status", () => {
  const b = bot("provider-status"); assert.ok(b && BOT("provider-status"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("available-local"), "local-ready");
  assert.match(b.run("online"), /unknown status/);
  assert.ok(lineage(b), 'lineage is real');
});
test("atom-feed-check", () => {
  const b = bot("atom-feed-check"); assert.ok(b && BOT("atom-feed-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run(""), "unpublished · no /feed.atom until a human seals at least one attested entry");
  assert.match(b.run('<rss><channel></channel></rss>'), /RSS and JSON Feed stay 404/);
  assert.ok(lineage(b), 'lineage is real');
});
test("gpc-check", () => {
  const b = bot("gpc-check"); assert.ok(b && BOT("gpc-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("404"), "unpublished · a missing support resource means support is unknown");
  assert.match(b.run('{"gpc": false}'), /gpc false is a claim/);
  assert.ok(lineage(b), 'lineage is real');
});
test("tdm-check", () => {
  const b = bot("tdm-check"); assert.ok(b && BOT("tdm-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.match(b.run('{"tdm-reservation": 0}'), /tdm-reservation 0 is denied/);
  assert.match(b.run('Content-Signal: ai-train=no'), /different names/);
  assert.ok(lineage(b), 'lineage is real');
});
test("redirect-check", () => {
  const b = bot("redirect-check"); assert.ok(b && BOT("redirect-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run(""), "unpublished · no redirects until a human seals emit");
  assert.match(b.run("/blog/* https://a-to-mind.com/blog/:splat 301"), /splat and placeholder are denied/);
  assert.match(b.run("/retired https://a-to-mind.com/ 301"), /not folded onto/);
  assert.ok(lineage(b), 'lineage is real');
});
test("humans-check", () => {
  const b = bot("humans-check"); assert.ok(b && BOT("humans-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run(""), "unpublished · no /humans.txt until a human seals named people who actually exist");
  assert.match(b.run("Chef: A-to-Mind Bot"), /invented names are denied/);
  assert.ok(lineage(b), 'lineage is real');
});
test("gap-check", () => {
  const b = bot("gap-check"); assert.ok(b && BOT("gap-check"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.match(b.run("open | marked | retraction | 0.5"), /both lanes must be marked/);
  const line = b.run("marked | marked | no-shared-artifact | 0.25 | please handoff this").split(" · ")[1];
  assert.equal(createHash("sha256").update(line).digest("hex"), "a1e257ea964aef2a968eb49f7196c2d57f257987c2da0981364a5ff9c4fe770a");
  assert.ok(!line.includes("please handoff"), "the handoff sentence is not in the line");
  assert.ok(lineage(b), 'lineage is real');
});
test("english-words-url", async () => {
  const b = bot("english-words-url"); assert.ok(b && BOT("english-words-url"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.equal(b.run("words"), "https://cdn.jsdelivr.net/gh/dwyl/english-words@20f5cc9b3f0ccc8ce45d814c532b7c2031bba31c/words.txt");
  assert.match(b.run("../words"), /send alpha or words/);
  assert.equal(b.credit.license, "Unlicense");
  assert.ok(lineage(b), 'lineage is real');
  const r = await fetch(b.run("alpha"), { method: "HEAD", signal: AbortSignal.timeout(20000) });
  assert.equal(r.status, 200, "the pinned word-list URL answers");
});
test("countries-url", async () => {
  const b = bot("countries-url"); assert.ok(b && BOT("countries-url"), 'in the kit');
  assert.ok(probe(b).ok, probe(b).out);
  assert.match(b.run("master"), /pinned release 4\.1\.1/);
  assert.equal(b.credit.license, "ODbL-1.0");
  assert.ok(lineage(b), 'lineage is real');
  const r = await fetch(b.run("v4.1.1"), { method: "HEAD", signal: AbortSignal.timeout(20000) });
  assert.equal(r.status, 200, "the pinned countries URL answers");
});
