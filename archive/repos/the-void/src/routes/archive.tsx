import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { atmosphereOf, useVoidStore } from "@/lib/void-store";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/archive")({ component: ArchivePage });

function ArchivePage() {
  const ready = useHydrated();
  const archives = useVoidStore((s) => s.archives);
  const restoreArchive = useVoidStore((s) => s.restoreArchive);
  const navigate = useNavigate();

  if (!ready) return <div className="min-h-dvh bg-bg" />;

  return (
    <main className="relative min-h-dvh bg-bg pb-24">
      <div className="relative h-28">
        <SiteNav />
      </div>
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">Archive</p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight">Sealed months.</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Each month is kept as it was when you sealed it. Opening one brings it back into the room and archives
          whatever is there now.
        </p>

        {archives.length === 0 ? (
          <div className="mt-16 max-w-md">
            <p className="font-display text-2xl">Nothing is sealed yet.</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Place a few things. When the month feels finished, seal it from the sandbox.
            </p>
            <Button asChild className="mt-8">
              <Link to="/void" search={{ view: "room" }}>Open the room</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2">
            {archives.map((month) => {
              const atmo = atmosphereOf(month.atmosphere);
              return (
                <li key={month.id + month.createdAt} className="overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
                  <div className="relative h-40 overflow-hidden">
                    <img src={atmo.src} alt="" className="size-full object-cover opacity-70" />
                    <div className="absolute inset-0 bg-bg/35" />
                    <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
                      {month.vessels
                        .filter((v) => v.body.trim())
                        .slice(0, 2)
                        .map((v) => (
                          <p key={v.id} className="truncate font-display text-sm text-fg">
                            {v.body}
                          </p>
                        ))}
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="font-display text-xl">{month.name}</p>
                      <p className="text-xs text-muted">
                        {atmo.label} · {month.vessels.length} placed
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        restoreArchive(month.id);
                        void navigate({ to: "/void", search: { view: "room" } });
                      }}
                    >
                      Open
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
