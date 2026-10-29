import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PAGE_TEMPLATES, downloadText, exportMarkdown, snippetAround } from "@/lib/mind";
import { useVoidStore } from "@/lib/void-store";
import { isModK } from "@/lib/utils";
import type { WorkspaceView } from "@/lib/void-types";

export function CommandPalette({
  open,
  onOpenChange,
  onGo,
  onDeepen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGo: (view: WorkspaceView, pageId?: string) => void;
  onDeepen: () => void;
}) {
  const pages = useVoidStore((s) => s.pages);
  const upsertPage = useVoidStore((s) => s.upsertPage);
  const capture = useVoidStore((s) => s.capture);
  const ensureToday = useVoidStore((s) => s.ensureToday);
  const ensureInbox = useVoidStore((s) => s.ensureInbox);
  const ensureWeek = useVoidStore((s) => s.ensureWeek);
  const canAddPage = useVoidStore((s) => s.canAddPage);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isModK(e)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (view: WorkspaceView, id?: string) => {
    onGo(view, id);
    onOpenChange(false);
  };

  const hits = useMemo(() => {
    const q = query.trim();
    if (!q) return pages.slice(0, 12).map((p) => ({ page: p, snippet: "" }));
    const lower = q.toLowerCase();
    return pages
      .map((p) => {
        const inTitle = p.title.toLowerCase().includes(lower);
        const snippet = snippetAround(p.body, q) ?? "";
        if (!inTitle && !snippet) return null;
        return { page: p, snippet: inTitle ? "" : snippet };
      })
      .filter((x): x is { page: (typeof pages)[number]; snippet: string } => Boolean(x))
      .slice(0, 16);
  }, [pages, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,36rem)] overflow-hidden p-0 pt-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Command</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, capture a thought, or go somewhere in the void.
        </DialogDescription>
        <Command
          className="bg-surface text-fg"
          filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Capture, search, or go…"
            className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-subtle"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-sm text-muted">Nothing matches.</Command.Empty>
            <Command.Group
              heading="Capture"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-subtle"
            >
              {query.trim() && (
                <Command.Item
                  value={`capture ${query}`}
                  onSelect={() => {
                    capture(query);
                    const inbox = ensureInbox();
                    go("inbox", inbox.id);
                  }}
                  className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
                >
                  Inbox: {query.trim()}
                </Command.Item>
              )}
              <Command.Item
                value="new page"
                onSelect={() => {
                  if (!canAddPage()) return;
                  const page = upsertPage({
                    title: query.trim() || "Untitled",
                    kind: "page",
                    body: "",
                  });
                  go("pages", page.id);
                }}
                className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
              >
                New page{query.trim() ? `: ${query.trim()}` : ""}
              </Command.Item>
            </Command.Group>
            <Command.Group
              heading="Seed"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-subtle"
            >
              {PAGE_TEMPLATES.map((t) => (
                <Command.Item
                  key={t.id}
                  value={`template ${t.label} ${t.hint}`}
                  onSelect={() => {
                    if (!canAddPage()) return;
                    const page = upsertPage({
                      title: query.trim() || t.label,
                      kind: "page",
                      body: t.body,
                    });
                    go("pages", page.id);
                  }}
                  className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
                >
                  {t.label}{" "}
                  <span className="text-xs text-subtle">{t.hint}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group
              heading="Go"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-subtle"
            >
              <Command.Item
                value="room"
                onSelect={() => go("room")}
                className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
              >
                Room
              </Command.Item>
              <Command.Item
                value="today daily"
                onSelect={() => {
                  const d = ensureToday();
                  go("today", d.id);
                }}
                className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
              >
                Today
              </Command.Item>
              <Command.Item
                value="inbox capture"
                onSelect={() => {
                  const box = ensureInbox();
                  go("inbox", box.id);
                }}
                className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
              >
                Inbox
              </Command.Item>
              <Command.Item
                value="this week weekly"
                onSelect={() => {
                  const w = ensureWeek();
                  go("pages", w.id);
                }}
                className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
              >
                This week
              </Command.Item>
              <Command.Item
                value="pages library"
                onSelect={() => go("pages")}
                className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
              >
                Pages
              </Command.Item>
              <Command.Item
                value="graph constellation"
                onSelect={() => go("graph")}
                className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
              >
                Graph
              </Command.Item>
              <Command.Item
                value="deepen the void"
                onSelect={() => {
                  onOpenChange(false);
                  onDeepen();
                }}
                className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
              >
                Ask the void to deepen
              </Command.Item>
              <Command.Item
                value="export markdown download"
                onSelect={() => {
                  downloadText("the-void.md", exportMarkdown(pages), "text/markdown");
                  onOpenChange(false);
                }}
                className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
              >
                Export the mind as markdown
              </Command.Item>
            </Command.Group>
            {hits.length > 0 && (
              <Command.Group
                heading="Pages"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-subtle"
              >
                {hits.map(({ page: p, snippet }) => (
                  <Command.Item
                    key={p.id}
                    value={`${p.title} ${p.body.slice(0, 240)} ${p.kind}`}
                    onSelect={() => go(p.kind === "daily" ? "today" : p.kind === "inbox" ? "inbox" : "pages", p.id)}
                    className="cursor-pointer rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-fg/8"
                  >
                    <span className="block">{p.title}</span>
                    {snippet ? <span className="mt-0.5 block text-xs text-subtle">{snippet}</span> : null}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
