import { format, getISOWeek, getISOWeekYear, setISOWeek, setISOWeekYear, startOfISOWeek } from "date-fns";
import type { Page } from "@/lib/void-types";
import { extractTags, extractTasks, extractWikiLinks, findPageByTitle, slugTitle } from "@/lib/wiki";

export type TemplateId = "person" | "project" | "idea" | "meeting" | "week";

export interface PageTemplate {
  id: TemplateId;
  label: string;
  hint: string;
  body: string;
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "person",
    label: "Person",
    hint: "Someone you keep returning to.",
    body: "Who they are to me.\n\nLast spoke:\n\nOpen:\n- [ ] \n\n#people\n",
  },
  {
    id: "project",
    label: "Project",
    hint: "Work that wants a next step.",
    body: "What this is for.\n\nWhy it matters:\n\nNext:\n- [ ] \n\n#project\n",
  },
  {
    id: "idea",
    label: "Idea",
    hint: "Unfinished on purpose.",
    body: "The thought, still wet.\n\nWhy it won't leave:\n\nNext:\n- [ ] \n\n#idea\n",
  },
  {
    id: "meeting",
    label: "Meeting",
    hint: "What was said, and what follows.",
    body: "With:\nWhen:\n\nWhat was said:\n\nNext:\n- [ ] \n\n#meeting\n",
  },
  {
    id: "week",
    label: "Week",
    hint: "What you kept. What you let go.",
    body: "Kept:\n\nLet go:\n\nNext week:\n- [ ] \n\n#week\n",
  },
];

export interface HarvestedTask {
  pageId: string;
  title: string;
  text: string;
  index: number;
  done: boolean;
}

export function weekId(date = new Date()) {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`;
}

export function weekLabel(id: string) {
  const m = id.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return id;
  try {
    let d = new Date(Number(m[1]), 0, 4);
    d = setISOWeekYear(d, Number(m[1]));
    d = setISOWeek(d, Number(m[2]));
    return `Week of ${format(startOfISOWeek(d), "MMMM d")}`;
  } catch {
    return id;
  }
}

export function openTasks(pages: Page[]): HarvestedTask[] {
  const out: HarvestedTask[] = [];
  for (const p of pages) {
    for (const t of extractTasks(p.body)) {
      if (t.done || !t.text.trim()) continue;
      out.push({ pageId: p.id, title: p.title, text: t.text, index: t.index, done: false });
    }
  }
  return out;
}

export function allTags(pages: Page[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of pages) {
    for (const tag of extractTags(`${p.title} ${p.body}`)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function pagesWithTag(pages: Page[], tag: string): Page[] {
  const key = tag.replace(/^#/, "").toLowerCase();
  return pages.filter((p) => extractTags(`${p.title} ${p.body}`).includes(key));
}

export function unlinkedMentions(pages: Page[], page: Page): Page[] {
  const title = slugTitle(page.title);
  if (title.length < 3) return [];
  const re = new RegExp(`\\b${escapeReg(title)}\\b`, "i");
  const linked = new Set(
    pages
      .filter((p) => extractWikiLinks(p.body).some((t) => t.toLowerCase() === title.toLowerCase()))
      .map((p) => p.id),
  );
  return pages.filter((p) => {
    if (p.id === page.id) return false;
    if (linked.has(p.id)) return false;
    return re.test(p.body);
  });
}

export function orphans(pages: Page[]): Page[] {
  const linked = new Set<string>();
  for (const p of pages) {
    for (const title of extractWikiLinks(p.body)) {
      const target = findPageByTitle(pages, title);
      if (target) {
        linked.add(p.id);
        linked.add(target.id);
      }
    }
  }
  return pages.filter((p) => p.kind === "page" && !linked.has(p.id) && !p.pinned);
}

export function missingTargets(pages: Page[]): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    for (const title of extractWikiLinks(p.body)) {
      const key = title.toLowerCase();
      if (key.length < 2) continue;
      if (seen.has(key)) continue;
      if (findPageByTitle(pages, title)) continue;
      seen.add(key);
      found.push(title.trim());
    }
  }
  return found;
}

export function missingEdges(pages: Page[]): { from: string; title: string }[] {
  const out: { from: string; title: string }[] = [];
  for (const p of pages) {
    for (const title of extractWikiLinks(p.body)) {
      const name = title.trim();
      if (name.length < 2) continue;
      if (findPageByTitle(pages, name)) continue;
      out.push({ from: p.id, title: name });
    }
  }
  return out;
}

export function outline(text: string): { level: number; text: string; index: number }[] {
  return text.split("\n").flatMap((line, index) => {
    const m = line.match(/^(#{1,3})\s+(.*)$/);
    if (!m) return [];
    return [{ level: m[1].length, text: m[2].trim(), index }];
  });
}

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function readingMinutes(text: string) {
  return Math.max(1, Math.round(wordCount(text) / 220));
}

export function snippetAround(text: string, query: string, radius = 72): string | null {
  const q = query.trim();
  if (!q) return null;
  const lower = text.toLowerCase();
  const at = lower.indexOf(q.toLowerCase());
  if (at < 0) return null;
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + q.length + radius);
  const slice = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

export function exportMarkdown(pages: Page[]) {
  const sorted = [...pages].sort((a, b) => a.title.localeCompare(b.title));
  const parts = sorted.map((p) => {
    const tags = extractTags(p.body);
    const head = [`# ${p.title}`];
    if (p.kind !== "page") head.push(`_${p.kind}_`);
    if (tags.length) head.push(tags.map((t) => `#${t}`).join(" "));
    return `${head.join("\n")}\n\n${p.body.trim() || ""}`.trim();
  });
  return `# The Void\n\n${parts.join("\n\n---\n\n")}\n`;
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
