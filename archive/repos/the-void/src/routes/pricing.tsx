import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@/lib/void-types";
import { useVoidStore } from "@/lib/void-store";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

function PricingPage() {
  const ready = useHydrated();
  const plan = useVoidStore((s) => s.plan);
  const setPlan = useVoidStore((s) => s.setPlan);
  const navigate = useNavigate();

  const choose = (id: PlanId) => {
    setPlan(id);
    void navigate({ to: "/void", search: { view: "today" } });
  };

  if (!ready) return <div className="min-h-dvh bg-bg" />;

  return (
    <main className="relative min-h-dvh bg-bg pb-24">
      <div className="relative h-28">
        <SiteNav />
      </div>
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">Keep</p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight">Pay for the archive, not the empty room.</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Wander is enough to find out if the room is yours. Keep is for people who return. This preview unlocks on
          this device — no card is charged.
        </p>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            const active = plan === id;
            return (
              <article
                key={id}
                className={cn(
                  "flex flex-col rounded-xl bg-surface p-6",
                  active ? "shadow-[0_0_0_1px_var(--color-accent)]" : "shadow-[var(--shadow-border)]",
                )}
              >
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-muted">{p.name}</p>
                  {active && <span className="text-[11px] uppercase tracking-[0.16em] text-subtle">Current</span>}
                </div>
                <p className="mt-3 font-display text-4xl tracking-tight">
                  {p.price === "0" ? "Free" : `$${p.price}`}
                  {p.price !== "0" && (
                    <span className="ml-1 text-base text-muted">/{p.cadence === "month" ? "mo" : "yr"}</span>
                  )}
                </p>
                <ul className="mt-6 flex-1 space-y-2 text-sm leading-relaxed text-muted">
                  {p.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
                <Button
                  className="mt-8"
                  variant={id === "keep" ? "default" : "outline"}
                  onClick={() => choose(id)}
                >
                  {active ? "Return to the room" : p.cta}
                </Button>
              </article>
            );
          })}
        </div>

        <p className="mt-16 max-w-xl text-sm leading-relaxed text-muted">
          Activation is whether you placed something. Retention is whether you came back next month. Missing a month is
          not failure — it is a sealed empty room, which is still a record.
        </p>
        <p className="mt-8">
          <Link to="/void" search={{ view: "today" }} className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
            Skip this. Stay in the sandbox.
          </Link>
        </p>
      </div>
    </main>
  );
}
