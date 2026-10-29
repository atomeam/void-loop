import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Maximize2, Minimize2, Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WikiBody } from "@/components/wiki-body";
import { WikiEditor } from "@/components/wiki-editor";
import { PAGE_TEMPLATES, outline, readingMinutes, unlinkedMentions, wordCount } from "@/lib/mind";
import { useVoidStore } from "@/lib/void-store";
import { backlinksTo, extractTags, toggleTaskLine } from "@/lib/wiki";
import type { Page } from "@/lib/void-types";
import { cn } from "@/lib/utils";

export function PageEditor({
  page,
  onOpen,
  onDeleted,
  onTag,
  compact,
}: {
  page: Page;
  onOpen: (id: string) => void;
  onDeleted?: () => void;
  onTag?: (tag: string) => void;
  compact?: boolean;
}) {
  const pages = useVoidStore((s) => s.pages);
  const updatePage = useVoidStore((s) => s.updatePage);
  const removePage = useVoidStore((s) => s.removePage);
  const placePageInRoom = useVoidStore((s) => s.placePageInRoom);
  const openOrCreateByTitle = useVoidStore((s) => s.openOrCreateByTitle);
  const applyTemplate = useVoidStore((s) => s.applyTemplate);
  const restoreSnapshot = useVoidStore((s) => s.restoreSnapshot);
  const touchPage = useVoidStore((s) => s.touchPage);
  const [mode, setMode] = useState<"write" | "read">(page.body ? "read" : "write");
  const [focus, setFocus] = useState(false);
  const [aliasDraft, setAliasDraft] = useState((page.aliases ?? []).join(", "));

  useEffect(() => {
    touchPage(page.id);
  }, [page.id, touchPage]);

  useEffect(() => {
    setAliasDraft((page.aliases ?? []).join(", "));
  }, [page.id, page.aliases]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        setMode((m) => (m === "write" ? "read" : "write"));
      }
      if (e.key === "Escape" && focus) setFocus(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  const backs = useMemo(() => backlinksTo(pages, page), [pages, page]);
  const mentions = useMemo(() => unlinkedMentions(pages, page), [pages, page]);
  const heads = useMemo(() => outline(page.body), [page.body]);
  const tags = useMemo(() => extractTags(page.body), [page.body]);
  const words = wordCount(page.body);
  const minutes = readingMinutes(page.body);

  const openTitle = (title: string) => {
    const next = openOrCreateByTitle(title);
    onOpen(next.id);
  };

  const shell = (
    <article className={cn("flex h-full min-h-0 flex-col", focus && "fixed inset-0 z-40 bg-bg")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 md:px-6">
        <Input
          value={page.title}
          onChange={(e) => updatePage(page.id, { title: e.target.value })}
          className="h-10 min-w-0 flex-1 border-0 bg-transparent px-0 font-display text-xl shadow-none focus-visible:ring-0"
        />
        {!compact && (
          <>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={page.pinned ? "Unpin" : "Pin"}
              onClick={() => updatePage(page.id, { pinned: !page.pinned })}
            >
              {page.pinned ? <Pin className="size-4" /> : <PinOff className="size-4" />}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={focus ? "Exit focus" : "Focus"}
              onClick={() => setFocus((v) => !v)}
            >
              {focus ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
          </>
        )}
        <Button type="button" size="sm" variant={mode === "write" ? "quiet" : "ghost"} onClick={() => setMode("write")}>
          Write
        </Button>
        <Button type="button" size="sm" variant={mode === "read" ? "quiet" : "ghost"} onClick={() => setMode("read")}>
          Read
        </Button>
        {!compact && (
          <Button type="button" size="sm" variant="outline" onClick={() => placePageInRoom(page.id)}>
            Place in room
          </Button>
        )}
        {page.kind === "page" && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Delete page"
            onClick={() => {
              removePage(page.id);
              onDeleted?.();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn("px-4 py-5 md:px-6", !focus && !compact && "lg:flex lg:gap-10")}>
          <div className="min-w-0 flex-1">
            {mode === "write" ? (
              <WikiEditor
                value={page.body}
                onChange={(body) => updatePage(page.id, { body })}
                placeholder="Write. Type [[ to link. Type / for a heading, a task, or a template."
                className={compact ? "min-h-[28vh]" : undefined}
              />
            ) : (
              <WikiBody
                text={page.body}
                onOpen={openTitle}
                onToggle={(line) => updatePage(page.id, { body: toggleTaskLine(page.body, line) })}
                onTag={onTag}
                className="max-w-2xl"
              />
            )}
            <p className="mt-6 text-xs text-subtle">
              {words} words · {minutes} min · {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
              <span className="ml-2">⌘↩ {mode === "write" ? "read" : "write"}</span>
            </p>
          </div>
          {!focus && !compact && (
            <aside className="mt-10 w-full shrink-0 space-y-8 lg:mt-0 lg:w-56">
              {tags.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Tags</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <li key={t}>
                        <button type="button" className="text-sm text-muted hover:text-fg" onClick={() => onTag?.(t)}>
                          #{t}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {heads.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Outline</p>
                  <ul className="mt-3 space-y-1">
                    {heads.map((h) => (
                      <li key={`${h.index}-${h.text}`} className={h.level > 1 ? "pl-3" : ""}>
                        <span className="text-sm text-muted">{h.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {backs.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Linked from</p>
                  <ul className="mt-3 space-y-1">
                    {backs.map((b) => (
                      <li key={b.id}>
                        <button type="button" className="text-sm text-muted hover:text-fg" onClick={() => onOpen(b.id)}>
                          {b.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {mentions.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Also mentioned</p>
                  <ul className="mt-3 space-y-1">
                    {mentions.map((b) => (
                      <li key={b.id}>
                        <button type="button" className="text-sm text-muted hover:text-fg" onClick={() => onOpen(b.id)}>
                          {b.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {page.kind === "page" && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Seed</p>
                  <ul className="mt-3 space-y-1">
                    {PAGE_TEMPLATES.filter((t) => t.id !== "week").map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          className="text-sm text-muted hover:text-fg"
                          onClick={() => applyTemplate(page.id, t.id)}
                        >
                          {t.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Also known as</p>
                <Input
                  value={aliasDraft}
                  onChange={(e) => setAliasDraft(e.target.value)}
                  onBlur={() =>
                    updatePage(page.id, {
                      aliases: aliasDraft
                        .split(",")
                        .map((a) => a.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="other names"
                  className="mt-2 h-9"
                />
              </div>
              {(page.snapshots ?? []).length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Earlier</p>
                  <ul className="mt-3 space-y-1">
                    {(page.snapshots ?? []).map((s) => (
                      <li key={s.at}>
                        <button
                          type="button"
                          className="text-sm text-muted hover:text-fg"
                          onClick={() => restoreSnapshot(page.id, s.at)}
                        >
                          {formatDistanceToNow(new Date(s.at), { addSuffix: true })}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </article>
  );

  return shell;
}
