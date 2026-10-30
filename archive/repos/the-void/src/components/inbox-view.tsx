import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WikiBody } from "@/components/wiki-body";
import { WikiEditor } from "@/components/wiki-editor";
import { extractTasks, toggleTaskLine } from "@/lib/wiki";
import { useVoidStore } from "@/lib/void-store";
import type { Page } from "@/lib/void-types";
import { cn } from "@/lib/utils";

export function InboxView({
  page,
  onOpen,
  onTag,
}: {
  page: Page;
  onOpen: (id: string) => void;
  onTag?: (tag: string) => void;
}) {
  const capture = useVoidStore((s) => s.capture);
  const updatePage = useVoidStore((s) => s.updatePage);
  const keepInboxLine = useVoidStore((s) => s.keepInboxLine);
  const canAddPage = useVoidStore((s) => s.canAddPage);
  const openOrCreateByTitle = useVoidStore((s) => s.openOrCreateByTitle);
  const [drop, setDrop] = useState("");
  const [raw, setRaw] = useState(false);
  const [toast, setToast] = useState<{ text: string; pageId?: string } | null>(null);

  const tasks = useMemo(() => extractTasks(page.body), [page.body]);
  const waiting = tasks.filter((t) => !t.done && t.text.trim());
  const cleared = tasks.filter((t) => t.done);

  const submitCapture = () => {
    const text = drop.trim();
    if (!text) return;
    capture(text);
    setDrop("");
    setToast({ text: "In the queue" });
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

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
        <label className="sr-only" htmlFor="inbox-capture">
          Capture
        </label>
        <Input
          id="inbox-capture"
          value={drop}
          onChange={(e) => setDrop(e.target.value)}
          placeholder="A thought, before it is a page — Enter"
          className="h-10 min-w-0 flex-1"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!drop.trim()}>
          Capture
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
              Queue {waiting.length ? `· ${waiting.length}` : ""}
            </p>
            <Button size="sm" variant={raw ? "quiet" : "ghost"} onClick={() => setRaw((v) => !v)}>
              {raw ? "Queue" : "Write"}
            </Button>
          </div>

          {raw ? (
            <div className="mt-4">
              <WikiEditor
                value={page.body}
                onChange={(body) => updatePage(page.id, { body })}
                placeholder="- [ ] a raw thought"
              />
            </div>
          ) : waiting.length === 0 ? (
            <p className="mt-8 font-display text-xl text-muted">
              Clear. Capture from here, from Today, or with search. Keep a line when it deserves a page.
            </p>
          ) : (
            <ul className="mt-5 space-y-2">
              {waiting.map((t) => (
                <li
                  key={t.index}
                  className="flex min-h-11 items-start gap-3 border-b border-border/70 py-3 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => updatePage(page.id, { body: toggleTaskLine(page.body, t.index) })}
                    className="mt-1 size-3.5 accent-[var(--color-accent)]"
                    aria-label={`Clear ${t.text}`}
                  />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <WikiBody text={t.text} onOpen={openTitle} onTag={onTag} className="space-y-0 text-sm" />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canAddPage()}
                    onClick={() => {
                      const kept = keepInboxLine(t.index);
                      if (kept) setToast({ text: `Kept as ${kept.title}`, pageId: kept.id });
                    }}
                  >
                    Keep
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {!raw && cleared.length > 0 && (
            <section className="mt-10">
              <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                Kept {cleared.length ? `· ${cleared.length}` : ""}
              </p>
              <ul className="mt-3 space-y-2">
                {cleared.map((t) => (
                  <li key={t.index} className="flex min-h-11 items-start gap-3 py-1.5">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => updatePage(page.id, { body: toggleTaskLine(page.body, t.index) })}
                      className="mt-1 size-3.5 accent-[var(--color-accent)]"
                      aria-label={`Restore ${t.text}`}
                    />
                    <div className={cn("min-w-0 flex-1 pt-0.5 text-sm", "text-muted")}>
                      <WikiBody text={t.text} onOpen={openTitle} onTag={onTag} className="space-y-0 text-sm" />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      </div>

      {toast && (
        <button
          type="button"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-surface px-4 py-2 text-sm text-fg shadow-[var(--shadow-border)]"
          onClick={() => {
            if (toast.pageId) onOpen(toast.pageId);
            setToast(null);
          }}
        >
          {toast.text}
          {toast.pageId ? " · Open" : ""}
        </button>
      )}
    </div>
  );
}
