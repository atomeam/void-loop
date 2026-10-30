import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { ATMOSPHERES, PLANS, VESSEL_META } from "@/lib/void-types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="bg-bg text-fg">
      <section className="relative isolate min-h-dvh overflow-hidden">
        <img
          src="/atmospheres/still.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-bg/50" />
        <SiteNav />
        <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 pb-16 pt-24 text-center">
          <div className="stagger-in max-w-2xl">
            <p className="font-display text-5xl leading-none tracking-tight text-fg/90 md:text-6xl">空</p>
            <h1 className="mt-8 font-display text-4xl font-medium tracking-tight md:text-5xl">
              Your month starts empty.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted">
              Other tools arrive furnished. This one earns every page. Capture, link, and deepen until it is better
              than Notion, Obsidian, and the last time you opened it.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/enter">Enter the sandbox</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#how">How a month works</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-24 md:py-32">
        <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">What this is</p>
        <h2 className="mt-4 font-display text-3xl font-medium tracking-tight">A second brain that starts as nothing.</h2>
        <div className="mt-8 space-y-5 text-base leading-relaxed text-muted">
          <p>
            Notion and Obsidian assume you already know how you think. They hand you a warehouse. The Void hands you an
            empty room. You place a page. You link it with [[brackets]]. You capture a task into the inbox. Today
            harvests every open task across the mind. The graph appears only when thoughts actually touch.
          </p>
          <p>
            The room is this month — spatial, atmospheric, finite. Pages outlive the month. When you seal, the furniture
            is archived and the library stays. You cannot hoard a dashboard you never used.
          </p>
          <p>
            It wants to be better than last time. Ask it to deepen, and it will look at what is actually here — not a
            template, not a streak, not someone else’s system.
          </p>
        </div>
      </section>

      <section className="border-t border-border px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">Instead of a warehouse</p>
          <h2 className="mt-4 font-display text-3xl font-medium tracking-tight">
            Everything those apps do, without the furniture you never used.
          </h2>
          <ul className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                t: "Capture in one key",
                d: "Command palette. A thought lands in Inbox. Today gathers every open task from every page.",
              },
              {
                t: "Links that mean it",
                d: "Type [[ and the page is there. Hover to peek. Unlinked mentions surface. Lost pages wait to be tied.",
              },
              {
                t: "A graph, not a database",
                d: "No properties hell. Hubs sit toward the center. Names you linked but never wrote appear dashed, ready.",
              },
              {
                t: "Today is the home",
                d: "A daily page, the inbox, this week, and whatever is still open. Not a dashboard of widgets.",
              },
              {
                t: "Seeds, not templates",
                d: "Person, project, idea, meeting, week. One shape. You fill it. The void can deepen what is actually here.",
              },
              {
                t: "Yours to take",
                d: "Export the mind as markdown. Pages survive the seal. The room empties. You begin again, already better.",
              },
            ].map((s) => (
              <li key={s.t}>
                <h3 className="font-display text-2xl font-medium">{s.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how" className="border-t border-border px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">How a month works</p>
          <h2 className="mt-4 font-display text-3xl font-medium tracking-tight">Four movements. Then a better room.</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4 md:gap-8">
            {[
              {
                n: "01",
                t: "Enter",
                d: "The room is blank on purpose. Name the month. Choose the weather.",
              },
              {
                n: "02",
                t: "Write",
                d: "Pages, tasks, notes. Link with [[this]]. Capture from anywhere with the command bar.",
              },
              {
                n: "03",
                t: "Deepen",
                d: "Ask the void to look. It names what is missing and what to do next. Then you keep going.",
              },
              {
                n: "04",
                t: "Seal",
                d: "The room is archived. Pages remain. A new void opens, already smarter than the last.",
              },
            ].map((s) => (
              <li key={s.n}>
                <p className="font-mono text-xs tabular-nums text-subtle">{s.n}</p>
                <h3 className="mt-3 font-display text-2xl font-medium">{s.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">What you can place</p>
          <h2 className="mt-4 font-display text-3xl font-medium tracking-tight">In the room, and beyond it.</h2>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(VESSEL_META) as Array<keyof typeof VESSEL_META>).map((k) => (
              <li key={k} className="bg-bg px-5 py-6">
                <h3 className="font-display text-xl">{VESSEL_META[k].label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{VESSEL_META[k].hint}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">Atmospheres</p>
          <h2 className="mt-4 font-display text-3xl font-medium tracking-tight">The room has weather.</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ATMOSPHERES.map((a) => (
              <figure key={a.id} className="overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
                <img
                  src={a.src}
                  alt=""
                  className="aspect-16/10 w-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
                />
                <figcaption className="px-4 py-3">
                  <p className="font-display text-lg">{a.label}</p>
                  <p className="text-sm text-muted">{a.line}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">Keep</p>
          <h2 className="mt-4 font-display text-3xl font-medium tracking-tight">The room is free. The library is kept.</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((id) => {
              const p = PLANS[id];
              return (
                <article
                  key={id}
                  className="flex flex-col rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]"
                >
                  <p className="text-sm text-muted">{p.name}</p>
                  <p className="mt-3 font-display text-4xl tracking-tight">
                    {p.price === "0" ? "Free" : `$${p.price}`}
                    {p.price !== "0" && (
                      <span className="ml-1 text-base text-muted">/{p.cadence === "month" ? "mo" : "yr"}</span>
                    )}
                  </p>
                  <ul className="mt-6 flex-1 space-y-2 text-sm text-muted">
                    {p.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                  <Button asChild variant={id === "keep" ? "default" : "outline"} className="mt-8">
                    <Link to={id === "wander" ? "/enter" : "/pricing"}>{p.cta}</Link>
                  </Button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative isolate overflow-hidden border-t border-border px-6 py-32 text-center">
        <img src="/atmospheres/hollow.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-bg/60" />
        <div className="relative z-10">
          <p className="font-display text-4xl tracking-tight md:text-5xl">Better than last time. That is the whole product.</p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to="/enter">Begin this month</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="flex flex-col gap-3 border-t border-border px-6 py-8 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
        <p>空 · The Void</p>
        <p>A monthly room that outgrows every other one.</p>
      </footer>
    </main>
  );
}
