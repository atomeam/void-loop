import type { Page } from "@/lib/void-types";

export function dayId(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dayLabel(id: string) {
  const [y, m, d] = id.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function extractWikiLinks(text: string): string[] {
  const found: string[] = [];
  const re = /!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const title = m[1].trim();
    if (title) found.push(title);
  }
  return [...new Set(found)];
}

export function extractTags(text: string): string[] {
  const found: string[] = [];
  const re = /(^|\s)#([A-Za-z][\w-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) found.push(m[2].toLowerCase());
  return [...new Set(found)];
}

export function extractTasks(text: string): { done: boolean; text: string; index: number }[] {
  return text.split("\n").flatMap((line, index) => {
    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (!m) return [];
    return [{ done: m[1] !== " ", text: m[2], index }];
  });
}

export function toggleTaskLine(text: string, index: number): string {
  const lines = text.split("\n");
  const line = lines[index];
  if (!line) return text;
  if (line.includes("- [ ]")) lines[index] = line.replace("- [ ]", "- [x]");
  else if (line.includes("- [x]") || line.includes("- [X]")) lines[index] = line.replace(/- \[[xX]\]/, "- [ ]");
  return lines.join("\n");
}

export function slugTitle(title: string) {
  return title.trim().replace(/\s+/g, " ");
}

export function findPageByTitle(pages: Page[], title: string): Page | undefined {
  const key = slugTitle(title).toLowerCase();
  return pages.find((p) => {
    if (p.title.trim().toLowerCase() === key) return true;
    return (p.aliases ?? []).some((a) => a.trim().toLowerCase() === key);
  });
}

export function backlinksTo(pages: Page[], page: Page): Page[] {
  const titles = new Set(
    [page.title, ...(page.aliases ?? [])].map((t) => slugTitle(t).toLowerCase()).filter(Boolean),
  );
  return pages.filter((p) => {
    if (p.id === page.id) return false;
    return extractWikiLinks(p.body).some((t) => titles.has(t.toLowerCase()));
  });
}

export function allLinks(pages: Page[]): { from: string; to: string; title: string }[] {
  const edges: { from: string; to: string; title: string }[] = [];
  for (const p of pages) {
    for (const title of extractWikiLinks(p.body)) {
      const target = findPageByTitle(pages, title);
      if (target && target.id !== p.id) edges.push({ from: p.id, to: target.id, title });
    }
  }
  return edges;
}

export function linkDegrees(pages: Page[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const e of allLinks(pages)) {
    deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
    deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  }
  return deg;
}
