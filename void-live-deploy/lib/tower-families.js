// Versus floor-page families: one public page per job. Member paths redirect to `page`.
// Future floors join the family page (tools/tower-self.mjs, tools/tool-site-pages.mjs). Pure.
// This commit starts the registry with families already combined on main; later PRs add the rest.
export const FAMILIES = Object.freeze([
  { id: "pdf", page: "/pdf/", members: [
    { path: "/pdf/", to: "/pdf/" },
    { path: "/pdf/merge/", to: "/pdf/?tool=merge" },
    { path: "/pdf/organize/", to: "/pdf/?tool=pages" },
    { path: "/pdf/toolbox/", to: "/pdf/" },
    { path: "/pdf/editor/", to: "/pdf/?tool=pages" },
    { path: "/pdf/suite/", to: "/pdf/" },
    { path: "/pdf/studio/", to: "/pdf/?tool=compress" }
  ] },
  { id: "kanban", page: "/kanban/", members: [
    { path: "/kanban/", to: "/kanban/" },
    { path: "/kanban/simple/", to: "/kanban/" },
    { path: "/kanban/quick/", to: "/kanban/" },
    { path: "/kanban/teams/", to: "/kanban/" },
    { path: "/kanban/flow/", to: "/kanban/" }
  ] },
  { id: "password", page: "/password/", members: [
    { path: "/password/", to: "/password/" },
    { path: "/password/strength/", to: "/password/?mode=strength" }
  ] },
  { id: "base64", page: "/base64/", members: [
    { path: "/base64/", to: "/base64/" },
    { path: "/base64/bases/", to: "/base64/?mode=bases" }
  ] },
  { id: "scores", page: "/scores/", members: [
    { path: "/scores/", to: "/scores/" },
    { path: "/scores/sports/", to: "/scores/?mode=sports" }
  ] },
  { id: "calculator", page: "/calculator/", members: [
    { path: "/calculator/", to: "/calculator/" },
    { path: "/calculators/", to: "/calculator/?mode=formulas" }
  ] },
  { id: "random", page: "/random/", members: [
    { path: "/random/", to: "/random/" },
    { path: "/random/coin/", to: "/random/?mode=coin" },
    { path: "/random/wheel/", to: "/random/?mode=wheel" },
    { path: "/random/people/", to: "/random/?mode=people" }
  ] },
  { id: "markets", page: "/markets/", members: [
    { path: "/markets/", to: "/markets/" },
    { path: "/markets/caps/", to: "/markets/?mode=caps" },
    { path: "/markets/screener/", to: "/markets/?mode=screener" }
  ] },
]);

const byPath = new Map();
for (const f of FAMILIES) {
  for (const m of f.members) {
    const clean = String(m.path || "").replace(/[?#].*$/, "");
    if (clean) byPath.set(clean, f);
    const noSlash = clean.endsWith("/") && clean.length > 1 ? clean.slice(0, -1) : "";
    if (noSlash) byPath.set(noSlash, f);
  }
}

/** family record for a Verse path, or null. Pure. */
export function familyOf(path) {
  const clean = String(path || "").replace(/[?#].*$/, "");
  return byPath.get(clean) || byPath.get(clean.endsWith("/") ? clean.slice(0, -1) : clean + "/") || null;
}

/** the combined page (path + query) a member should open, or the path unchanged. Pure. */
export function familyPageOf(path) {
  const raw = String(path || "");
  const clean = raw.replace(/[?#].*$/, "");
  const f = familyOf(clean);
  if (!f) return raw;
  const m = f.members.find((x) => x.path.replace(/[?#].*$/, "").replace(/\/$/, "") === clean.replace(/\/$/, ""));
  return (m && m.to) || f.page;
}

/** true when two floor paths are different public pages of the same family. Pure. */
export function sameFamilyTwoPages(a, b) {
  const fa = familyOf(a), fb = familyOf(b);
  if (!fa || !fb || fa.id !== fb.id) return false;
  const pa = String(familyPageOf(a)).replace(/[?#].*$/, "").replace(/\/$/, "") || "/";
  const pb = String(familyPageOf(b)).replace(/[?#].*$/, "").replace(/\/$/, "") || "/";
  return pa === pb;
}

export const FAMILY_MODE_SRC = Object.freeze({
  "/password/": { "strength": "/password/modes/strength.html" },
  "/base64/": { "bases": "/base64/modes/bases.html" },
  "/scores/": { "sports": "/scores/modes/sports.html" },
  "/calculator/": { "formulas": "/calculator/modes/formulas.html" },
  "/random/": { "coin": "/random/modes/coin.html", "wheel": "/random/modes/wheel.html", "people": "/random/modes/people.html" },
  "/markets/": { "caps": "/markets/modes/caps.html", "screener": "/markets/modes/screener.html" },
});
