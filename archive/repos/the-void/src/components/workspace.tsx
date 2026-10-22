import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { DeepenPanel } from "@/components/deepen-panel";
import { GraphView } from "@/components/graph-view";
import { InboxView } from "@/components/inbox-view";
import { PagesView } from "@/components/pages-view";
import { SiteNav } from "@/components/site-nav";
import { TodayView } from "@/components/today-view";
import { VoidStage } from "@/components/void-canvas";
import { Button } from "@/components/ui/button";
import { useVoidStore } from "@/lib/void-store";
import type { WorkspaceView } from "@/lib/void-types";
import { cn } from "@/lib/utils";

const VIEWS: { id: WorkspaceView; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "pages", label: "Pages" },
  { id: "graph", label: "Graph" },
  { id: "inbox", label: "Inbox" },
  { id: "room", label: "Room" },
];

export function Workspace({
  view,
  pageId,
  tag,
}: {
  view: WorkspaceView;
  pageId?: string;
  tag?: string;
}) {
  const navigate = useNavigate();
  const entered = useVoidStore((s) => s.entered);
  const pages = useVoidStore((s) => s.pages);
  const ensureToday = useVoidStore((s) => s.ensureToday);
  const ensureInbox = useVoidStore((s) => s.ensureInbox);
  const upsertPage = useVoidStore((s) => s.upsertPage);
  const canAddPage = useVoidStore((s) => s.canAddPage);
  const [palette, setPalette] = useState(false);
  const [deepen, setDeepen] = useState(false);

  const go = (next: WorkspaceView, id?: string, nextTag?: string) => {
    const search: { view: WorkspaceView; id?: string; tag?: string } = { view: next };
    if (id) search.id = id;
    if (nextTag) search.tag = nextTag;
    void navigate({ to: "/void", search });
  };

  useEffect(() => {
    if (view !== "today") return;
    const d = ensureToday();
    const current = pages.find((p) => p.id === pageId);
    if (!pageId || current?.kind !== "daily") go("today", d.id);
  }, [view, pageId]);

  useEffect(() => {
    if (view !== "inbox") return;
    const box = ensureInbox();
    const current = pages.find((p) => p.id === pageId);
    if (!pageId || current?.kind !== "inbox") go("inbox", box.id);
  }, [view, pageId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n" && !e.shiftKey) {
        e.preventDefault();
        if (!canAddPage()) return;
        const page = upsertPage({ title: "Untitled", kind: "page", body: "" });
        go("pages", page.id);
        return;
      }
      if (!typing && e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const d = ensureToday();
        go("today", d.id);
      }
      if (!typing && e.key.toLowerCase() === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const box = ensureInbox();
        go("inbox", box.id);
      }
      if (!typing && e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (view === "inbox") {
          document.getElementById("inbox-capture")?.focus();
          return;
        }
        const d = ensureToday();
        go("today", d.id);
        window.setTimeout(() => document.getElementById("today-capture")?.focus(), 40);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canAddPage, upsertPage, ensureToday, ensureInbox, view]);

  const daily =
    pages.find((p) => p.id === pageId && p.kind === "daily") ?? pages.find((p) => p.kind === "daily");
  const inbox = pages.find((p) => p.kind === "inbox");

  const tabs = (
    <div className="flex items-center gap-0.5 rounded-lg bg-surface/85 p-1 shadow-[var(--shadow-border)] backdrop-blur-sm">
      {VIEWS.map((v) => (
        <Button
          key={v.id}
          size="sm"
          variant={view === v.id ? "quiet" : "ghost"}
          onClick={() =>
            go(
              v.id,
              v.id === "today" ? daily?.id : v.id === "inbox" ? inbox?.id : v.id === "pages" ? pageId : undefined,
            )
          }
        >
          {v.label}
        </Button>
      ))}
    </div>
  );

  const actions = (
    <div className="flex items-center gap-1">
      <Button size="icon-sm" variant="ghost" className="sm:hidden" aria-label="Search" onClick={() => setPalette(true)}>
        <Search />
      </Button>
      <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => setPalette(true)}>
        Search
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDeepen(true)}>
        Deepen
      </Button>
      {!entered && (
        <Button asChild size="sm" variant="outline">
          <Link to="/enter">Make it yours</Link>
        </Button>
      )}
    </div>
  );

  const openFromMind = (id: string) => {
    const p = pages.find((x) => x.id === id);
    go(p?.kind === "daily" ? "today" : p?.kind === "inbox" ? "inbox" : "pages", id);
  };

  return (
    <div className={cn("flex bg-bg", view === "room" ? "relative min-h-dvh" : "h-dvh flex-col overflow-hidden")}>
      <SiteNav solid={view !== "room"} action={actions} />

      {view === "room" ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-[3.4rem] z-30 flex justify-center md:top-16">
            <div className="pointer-events-auto">{tabs}</div>
          </div>
          <VoidStage showChrome onOpenPage={(id) => go("pages", id)} />
        </>
      ) : (
        <>
          <div className="flex justify-center border-b border-border py-2">{tabs}</div>
          {view === "pages" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <PagesView
                selectedId={pageId}
                onSelect={(id) => {
                  const p = pages.find((x) => x.id === id);
                  go(p?.kind === "daily" ? "today" : p?.kind === "inbox" ? "inbox" : "pages", id, tag);
                }}
                tag={tag}
                onTag={(t) => go("pages", pageId, t)}
              />
            </div>
          )}
          {view === "graph" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <GraphView onOpen={openFromMind} />
            </div>
          )}
          {view === "today" && (
            <div className="flex min-h-0 flex-1 flex-col">
              {daily ? (
                <TodayView page={daily} onOpen={openFromMind} onTag={(t) => go("pages", undefined, t)} />
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-muted">Opening today…</p>
                </div>
              )}
            </div>
          )}
          {view === "inbox" && (
            <div className="flex min-h-0 flex-1 flex-col">
              {inbox ? (
                <InboxView page={inbox} onOpen={openFromMind} onTag={(t) => go("pages", undefined, t)} />
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-muted">Opening inbox…</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <CommandPalette open={palette} onOpenChange={setPalette} onGo={go} onDeepen={() => setDeepen(true)} />
      <DeepenPanel open={deepen} onOpenChange={setDeepen} onOpenPage={(id) => go("pages", id)} />
    </div>
  );
}
