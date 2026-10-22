import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { deepenVoid } from "@/lib/deepen";
import { allTags, openTasks } from "@/lib/mind";
import { useVoidStore } from "@/lib/void-store";
import type { DeepenResult } from "@/lib/void-types";

export function DeepenPanel({
  open,
  onOpenChange,
  onOpenPage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPage: (id: string) => void;
}) {
  const pages = useVoidStore((s) => s.pages);
  const current = useVoidStore((s) => s.current);
  const deepen = useVoidStore((s) => s.deepen);
  const recordDeepen = useVoidStore((s) => s.recordDeepen);
  const deepenAllowed = useVoidStore((s) => s.deepenAllowed);
  const upsertPage = useVoidStore((s) => s.upsertPage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const last = deepen.last;

  const run = async () => {
    if (!deepenAllowed() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deepenVoid({
        data: {
          month: current.name,
          pages: pages.map((p) => ({ title: p.title, body: p.body, kind: p.kind })),
          vessels: current.vessels.map((v) => ({ kind: v.kind, body: v.body })),
          openTasks: openTasks(pages).map((t) => `${t.text} (${t.title})`),
          tags: allTags(pages).map((t) => t.tag),
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const result: DeepenResult = {
        observation: res.observation,
        missing: res.missing,
        next: res.next,
        draftTitle: res.draftTitle,
        draftBody: res.draftBody,
        at: new Date().toISOString(),
      };
      recordDeepen(result);
    } catch {
      setError("The void did not answer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Deepen</SheetTitle>
        </SheetHeader>
        <p className="text-sm leading-relaxed text-muted">
          The room should be better than last time you opened it. Ask, and it will look at what is actually here.
        </p>
        <div className="mt-6 flex-1 space-y-5 overflow-y-auto">
          {last && (
            <div className="space-y-4 text-sm leading-relaxed">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Here</p>
                <p className="mt-1 text-fg">{last.observation}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Missing</p>
                <p className="mt-1 text-fg">{last.missing}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Next</p>
                <p className="mt-1 text-fg">{last.next}</p>
              </div>
              {last.draftTitle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const page = upsertPage({
                      title: last.draftTitle || "Consideration",
                      body: last.draftBody || "",
                      kind: "page",
                    });
                    onOpenPage(page.id);
                    onOpenChange(false);
                  }}
                >
                  Keep “{last.draftTitle}”
                </Button>
              )}
            </div>
          )}
          {error && <p className="text-sm text-muted">{error}</p>}
        </div>
        <Button className="mt-4" onClick={() => void run()} disabled={busy || !deepenAllowed()}>
          {busy ? "Listening…" : last ? "Deepen again" : "Look at this month"}
        </Button>
        {!deepenAllowed() && (
          <p className="mt-2 text-xs text-subtle">Enough for today. Return tomorrow.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
