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
