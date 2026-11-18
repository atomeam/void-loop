// Versus floor-page families: one public page per job. Member paths redirect to `page`.
// Future floors join the family page (tools/tower-self.mjs, tools/tool-site-pages.mjs). Pure.
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
  { id: "photos", page: "/photos/", members: [
    { path: "/photos/", to: "/photos/" },
    { path: "/photos/tinypng/", to: "/photos/?tab=out" },
    { path: "/photos/squoosh/", to: "/photos/?tab=out" },
    { path: "/photos/iloveimg/", to: "/photos/?tab=out" },
    { path: "/photos/photopea/", to: "/photos/?tab=draw" },
    { path: "/photos/exif/", to: "/photos/?tab=info" },
    { path: "/photos/exifeditor/", to: "/photos/?tab=info" },
    { path: "/resize-image/", to: "/photos/?tab=crop" }
  ] },
  { id: "jobs", page: "/jobs/", members: [
    { path: "/jobs/", to: "/jobs/" },
    { path: "/jobs/regions/", to: "/jobs/?panel=regions" },
    { path: "/jobs/alerts/", to: "/jobs/?panel=alerts" },
    { path: "/jobs/europe/", to: "/jobs/?panel=regions&region=europe" },
    { path: "/jobs/salary/", to: "/jobs/?panel=search&salary=1" },
    { path: "/jobs/categories/", to: "/jobs/?panel=categories" },
    { path: "/jobs/tags/", to: "/jobs/?panel=tags" },
    { path: "/jobs/companies/", to: "/jobs/?panel=companies" }
  ] },
  { id: "flights", page: "/flights/", members: [
    { path: "/flights/", to: "/flights/" },
    { path: "/flights/trip/", to: "/flights/?mode=trip" },
    { path: "/flights/airports/", to: "/flights/?mode=airports" },
    { path: "/flights/time/", to: "/flights/?mode=time" },
    { path: "/flights/distance/", to: "/flights/?mode=facts" },
    { path: "/flights/map/", to: "/flights/?mode=route" },
    { path: "/flights/co2/", to: "/flights/?mode=co2" },
    { path: "/flights/routes/", to: "/flights/?mode=routes" }
  ] },
  { id: "color", page: "/color/", members: [
    { path: "/color/", to: "/color/" },
    { path: "/color/colour-management/", to: "/color/" },
    { path: "/color/colour-picker-tool/", to: "/color/" },
    { path: "/color/gradient/", to: "/color/?mode=gradient" }
  ] },
  { id: "convert", page: "/convert/", members: [
    { path: "/convert/", to: "/convert/" },
    { path: "/convert/unit-converter/", to: "/convert/" },
    { path: "/convert/unit-converter-2/", to: "/convert/" }
  ] },
  { id: "kanban", page: "/kanban/", members: [
    { path: "/kanban/", to: "/kanban/" },
    { path: "/kanban/simple/", to: "/kanban/" },
    { path: "/kanban/quick/", to: "/kanban/" },
    { path: "/kanban/teams/", to: "/kanban/" },
    { path: "/kanban/flow/", to: "/kanban/" }
  ] },
  { id: "news", page: "/news/", members: [
    { path: "/news/", to: "/news/" },
    { path: "/news/global-headlines/", to: "/news/?sec=world" }
  ] },
  { id: "emoji-combos", page: "/emoji-combos/", members: [
    { path: "/emoji-combos/", to: "/emoji-combos/" },
    { path: "/emoji-combos/emoji-dictionary/", to: "/emoji-combos/" }
  ] },
  { id: "password", page: "/password/", members: [
    { path: "/password/", to: "/password/" },
    { path: "/password/strength/", to: "/password/?mode=strength" }
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
    { path: "/markets/screener/", to: "/markets/?mode=screener" },
    { path: "/markets/currency-converter/", to: "/markets/?mode=currency" }
  ] },
  { id: "scores", page: "/scores/", members: [
    { path: "/scores/", to: "/scores/" },
    { path: "/scores/sports/", to: "/scores/?mode=sports" }
  ] },
  { id: "base64", page: "/base64/", members: [
    { path: "/base64/", to: "/base64/" },
    { path: "/base64/bases/", to: "/base64/?mode=bases" }
  ] },
  { id: "calculator", page: "/calculator/", members: [
    { path: "/calculator/", to: "/calculator/" },
    { path: "/calculators/", to: "/calculator/?mode=formulas" }
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
  "/color/": { "gradient": "/color/modes/gradient.html" },
  "/password/": { "strength": "/password/modes/strength.html" },
  "/random/": { "coin": "/random/modes/coin.html", "wheel": "/random/modes/wheel.html", "people": "/random/modes/people.html" },
  "/markets/": { "caps": "/markets/modes/caps.html", "screener": "/markets/modes/screener.html", "currency": "/markets/modes/currency.html" },
  "/scores/": { "sports": "/scores/modes/sports.html" },
  "/base64/": { "bases": "/base64/modes/bases.html" },
  "/calculator/": { "formulas": "/calculator/modes/formulas.html" },
});
