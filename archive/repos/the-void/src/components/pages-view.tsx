import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageEditor } from "@/components/page-editor";
import { allTags, downloadText, exportMarkdown, missingTargets, orphans, pagesWithTag } from "@/lib/mind";
import { useVoidStore } from "@/lib/void-store";
import { WANDER_PAGE_LIMIT } from "@/lib/void-types";
import { cn } from "@/lib/utils";

type Filter = "all" | "recents" | "pinned" | "tags" | "lost";

export function PagesView({
  selectedId,
  onSelect,
  tag,
  onTag,
}: {
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  tag?: string;
  onTag?: (tag: string) => void;
}) {
  const pages = useVoidStore((s) => s.pages);
  const recents = useVoidStore((s) => s.recents);
  const plan = useVoidStore((s) => s.plan);
  const upsertPage = useVoidStore((s) => s.upsertPage);
  const openOrCreateByTitle = useVoidStore((s) => s.openOrCreateByTitle);
  const canAddPage = useVoidStore((s) => s.canAddPage);
  const ensureToday = useVoidStore((s) => s.ensureToday);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(tag ? "tags" : "all");
  const [activeTag, setActiveTag] = useState(tag ?? "");

  useEffect(() => {
    if (tag) {
      setFilter("tags");
      setActiveTag(tag);
    }
  }, [tag]);

  const tags = useMemo(() => allTags(pages), [pages]);
  const lost = useMemo(() => orphans(pages), [pages]);
  const ghosts = useMemo(() => missingTargets(pages), [pages]);

  const filtered = useMemo(() => {
    let list = pages;
    if (filter === "recents") {
      const order = recents;
      list = order.map((id) => pages.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => p != null);
    } else if (filter === "pinned") {
      list = pages.filter((p) => p.pinned);
    } else if (filter === "tags") {
      list = activeTag ? pagesWithTag(pages, activeTag) : pages;
    } else if (filter === "lost") {
      list = lost;
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((p) => p.title.toLowerCase().includes(query) || p.body.toLowerCase().includes(query));
    }
    if (filter === "recents") return list;
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [pages, q, filter, activeTag, recents, lost]);

  const selected = pages.find((p) => p.id === selectedId);
  const durable = pages.filter((p) => p.kind === "page").length;

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "recents", label: "Recent" },
    { id: "pinned", label: "Pinned" },
    { id: "tags", label: "Tags" },
    { id: "lost", label: "Lost" },
  ];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside
        className={cn(
          "flex w-full flex-col border-r border-border bg-bg md:w-72 md:shrink-0",
          selectedId && "hidden md:flex",
        )}
      >
        <div className="flex items-center gap-2 px-3 py-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages"
            className="h-9"
          />
        </div>
        <div className="flex gap-2 px-3 pb-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={!canAddPage()}
            onClick={() => {
              const page = upsertPage({ title: "Untitled", kind: "page", body: "" });
              onSelect(page.id);
            }}
          >
            New page
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const d = ensureToday();
              onSelect(d.id);
            }}
          >
            Today
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 px-3 pb-3">
          {filters.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? "quiet" : "ghost"}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {filter === "tags" && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-3">
            {tags.length === 0 && <p className="text-xs text-subtle">Write #focus in a page.</p>}
            {tags.map((t) => (
              <button
                key={t.tag}
                type="button"
                onClick={() => {
                  setActiveTag(t.tag);
                  onTag?.(t.tag);
                }}
                className={cn(
                  "rounded-sm px-2 py-1 text-xs",
                  activeTag === t.tag ? "bg-fg/10 text-fg" : "text-muted hover:text-fg",
                )}
              >
                #{t.tag}{" "}
                <span className="text-subtle">{t.count}</span>
              </button>
            ))}
          </div>
        )}
        {plan === "wander" && (
          <p className="px-4 pb-2 text-[11px] text-subtle">
            {durable}/{WANDER_PAGE_LIMIT} pages
          </p>
        )}
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {filter === "lost" &&
            ghosts.map((title) => (
              <li key={`ghost-${title}`}>
                <button
                  type="button"
                  onClick={() => {
                    const page = openOrCreateByTitle(title);
                    onSelect(page.id);
                  }}
                  className="w-full rounded-md px-3 py-2.5 text-left text-muted hover:bg-fg/5 hover:text-fg"
                >
                  <span className="block truncate font-display text-base">{title}</span>
                  <span className="mt-0.5 block text-xs text-subtle">Linked, not written</span>
                </button>
              </li>
            ))}
          {filtered.length === 0 && (filter !== "lost" || ghosts.length === 0) && (
            <li className="px-2 py-8 text-sm text-muted">
              {filter === "lost"
                ? "No lost pages. Everything is linked, or nothing is written."
                : "No pages yet. Write one, or capture with ⌘K."}
            </li>
          )}
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className={cn(
                  "w-full rounded-md px-3 py-2.5 text-left transition-colors duration-150",
                  selected?.id === p.id ? "bg-fg/8 text-fg" : "text-muted hover:bg-fg/5 hover:text-fg",
                )}
              >
                <span className="block truncate font-display text-base">{p.title}</span>
                <span className="mt-0.5 block truncate text-xs text-subtle">
                  {p.kind === "daily"
                    ? "Today’s page"
                    : p.kind === "inbox"
                      ? "Inbox"
                      : p.kind === "weekly"
                        ? "This week"
                        : p.body.slice(0, 48) || "Empty"}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-3 py-3">
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start"
            disabled={pages.length === 0}
            onClick={() => downloadText("the-void.md", exportMarkdown(pages), "text/markdown")}
          >
            Export markdown
          </Button>
        </div>
      </aside>
      <div className={cn("min-h-0 flex-1 flex-col", selected ? "flex" : "hidden md:flex")}>
        {selected ? (
          <>
            <div className="border-b border-border px-3 py-2 md:hidden">
              <Button size="sm" variant="ghost" onClick={() => onSelect(undefined)}>
                All pages
              </Button>
            </div>
            <PageEditor
              page={selected}
              onOpen={onSelect}
              onDeleted={() => onSelect(filtered.find((p) => p.id !== selected.id)?.id)}
              onTag={(t) => {
                setFilter("tags");
                setActiveTag(t);
                onTag?.(t);
              }}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="font-display text-xl text-muted">A page is a thought that stays.</p>
          </div>
        )}
      </div>
    </div>
  );
}
