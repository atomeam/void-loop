import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageEditor } from "@/components/page-editor";
import { WikiBody } from "@/components/wiki-body";
import { openTasks, weekLabel, weekId } from "@/lib/mind";
import { extractTasks, toggleTaskLine } from "@/lib/wiki";
import { useVoidStore } from "@/lib/void-store";
import type { Page } from "@/lib/void-types";
import { cn } from "@/lib/utils";

export function TodayView({
  page,
  onOpen,
  onTag,
}: {
  page: Page;
  onOpen: (id: string) => void;
  onTag?: (tag: string) => void;
}) {
  const pages = useVoidStore((s) => s.pages);
  const recents = useVoidStore((s) => s.recents);
  const capture = useVoidStore((s) => s.capture);
  const updatePage = useVoidStore((s) => s.updatePage);
  const ensureInbox = useVoidStore((s) => s.ensureInbox);
  const ensureWeek = useVoidStore((s) => s.ensureWeek);
  const openOrCreateByTitle = useVoidStore((s) => s.openOrCreateByTitle);
  const current = useVoidStore((s) => s.current);
  const sealMonth = useVoidStore((s) => s.sealMonth);
  const [drop, setDrop] = useState("");
  const [toast, setToast] = useState<{ text: string; toInbox?: boolean } | null>(null);
  const [sealOpen, setSealOpen] = useState(false);

  const tasks = useMemo(() => openTasks(pages), [pages]);
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; pageId: string; items: typeof tasks }>();
    for (const t of tasks) {
      const g = map.get(t.pageId) ?? { title: t.title, pageId: t.pageId, items: [] };
      g.items.push(t);
      map.set(t.pageId, g);
    }
    return [...map.values()];
  }, [tasks]);
  const inbox = pages.find((p) => p.kind === "inbox");
  const inboxOpen = inbox ? extractTasks(inbox.body).filter((t) => !t.done && t.text.trim()).length : 0;
  const week = pages.find((p) => p.kind === "weekly" && p.week === weekId());
  const recentPages = recents
    .map((id) => pages.find((p) => p.id === id))
    .filter((p): p is Page => p != null && p.id !== page.id)
    .slice(0, 6);

  const submitCapture = () => {
    const text = drop.trim();
    if (!text) return;
    capture(text);
    setDrop("");
    setToast({ text: "In harvest and Inbox", toInbox: true });
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "c" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      document.getElementById("today-capture")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openTitle = (title: string) => {
    const next = openOrCreateByTitle(title);
    onOpen(next.id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form
        className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center md:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          submitCapture();
        }}
      >
        <label className="sr-only" htmlFor="today-capture">
          Capture
        </label>
        <Input
          id="today-capture"
          value={drop}
          onChange={(e) => setDrop(e.target.value)}
          placeholder="Capture a thought — press Enter"
          className="h-10 min-w-0 flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={current.vessels.length === 0 || Boolean(current.sealedAt)}
          onClick={() => setSealOpen(true)}
        >
          Seal this month
        </Button>
      </form>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 overflow-hidden">
          <PageEditor page={page} onOpen={onOpen} onTag={onTag} compact />
        </div>
        <aside className="flex max-h-[46vh] flex-col overflow-y-auto border-t border-border lg:max-h-none lg:w-80 lg:shrink-0 lg:border-l lg:border-t-0">
          <section className="px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
              Harvest {tasks.length ? `· ${tasks.length}` : ""}
            </p>
            {tasks.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nothing waiting. Write a `- [ ]` on any page.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {groups.map((g) => (
                  <li key={g.pageId}>
                    <button
                      type="button"
                      className="text-[11px] uppercase tracking-[0.14em] text-subtle hover:text-fg"
                      onClick={() => onOpen(g.pageId)}
                    >
                      {g.title}
                    </button>
                    <ul className="mt-1.5 space-y-1.5">
                      {g.items.map((t) => (
                        <li key={`${t.pageId}-${t.index}`} className="flex min-h-11 items-start gap-2">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => {
                              const src = pages.find((p) => p.id === t.pageId);
                              if (!src) return;
                              updatePage(src.id, { body: toggleTaskLine(src.body, t.index) });
                            }}
                            className="mt-1 size-3.5 accent-[var(--color-accent)]"
                            aria-label={`Finish ${t.text}`}
                          />
                          <div className="min-w-0 pt-0.5">
                            <WikiBody text={t.text} onOpen={openTitle} onTag={onTag} className="space-y-0 text-sm" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-t border-border px-4 py-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Inbox</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const box = ensureInbox();
                  onOpen(box.id);
                }}
              >
                {inboxOpen ? `${inboxOpen} waiting` : "Open"}
              </Button>
            </div>
            <p className={cn("mt-1 text-sm", inboxOpen ? "text-muted" : "text-subtle")}>
              {inboxOpen ? "Empty it when the day is quiet." : "Clear."}
            </p>
          </section>

          <section className="border-t border-border px-4 py-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">This week</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const w = ensureWeek();
                  onOpen(w.id);
                }}
              >
                {week ? "Open" : "Begin"}
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted">{weekLabel(weekId())}</p>
          </section>

          {recentPages.length > 0 && (
            <section className="border-t border-border px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Recently touched</p>
              <ul className="mt-3 space-y-1">
                {recentPages.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="min-h-11 w-full truncate text-left text-sm text-muted hover:text-fg"
                      onClick={() => onOpen(p.id)}
                    >
                      {p.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {toast && (
        <button
          type="button"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-surface px-4 py-2 text-sm text-fg shadow-[var(--shadow-border)]"
          onClick={() => {
            if (toast.toInbox) {
              const box = ensureInbox();
              onOpen(box.id);
            }
            setToast(null);
          }}
        >
          {toast.text}
          {toast.toInbox ? " · Open" : ""}
        </button>
      )}

      <Dialog open={sealOpen} onOpenChange={setSealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seal this month?</DialogTitle>
            <DialogDescription>
              Pages survive. The room empties. You begin again, already better.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSealOpen(false)}>
              Stay
            </Button>
            <Button
              onClick={() => {
                sealMonth();
                setSealOpen(false);
                setToast({ text: "The room is sealed. Pages remain." });
              }}
            >
              Seal it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
