import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace";
import { useHydrated } from "@/hooks/use-hydrated";
import type { WorkspaceView } from "@/lib/void-types";

const VIEWS: WorkspaceView[] = ["room", "pages", "graph", "today", "inbox"];

export const Route = createFileRoute("/void")({
  validateSearch: (s: Record<string, unknown>): { view: WorkspaceView; id?: string; tag?: string } => {
    const view = VIEWS.includes(s.view as WorkspaceView) ? (s.view as WorkspaceView) : "today";
    const id = typeof s.id === "string" ? s.id : undefined;
    const tag = typeof s.tag === "string" ? s.tag : undefined;
    return {
      view,
      ...(id ? { id } : {}),
      ...(tag ? { tag } : {}),
    };
  },
  component: VoidPage,
});

function VoidPage() {
  const ready = useHydrated();
  const { view, id, tag } = Route.useSearch();

  if (!ready) {
    return <div className="min-h-dvh bg-bg" />;
  }

  return <Workspace view={view} pageId={id} tag={tag} />;
}
