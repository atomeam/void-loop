import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { CheckItem, Vessel } from "@/lib/void-types";
import { cn } from "@/lib/utils";
import { useVoidStore } from "@/lib/void-store";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return (
    <div className="px-4 py-5 text-center">
      <p className="font-display text-3xl tabular-nums tracking-tight text-fg">{time}</p>
      <p className="mt-1 text-xs tracking-wide text-muted">{date}</p>
    </div>
  );
}

export function VesselCard({
  vessel,
  interactive,
  onBody,
  onHabit,
  onRemove,
  onOpenPage,
}: {
  vessel: Vessel;
  interactive: boolean;
  onBody?: (body: string) => void;
  onHabit?: (day: number) => void;
  onRemove?: () => void;
  onOpenPage?: (pageId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const pages = useVoidStore((s) => s.pages);
  const toggleCheck = useVoidStore((s) => s.toggleCheck);
  const addCheck = useVoidStore((s) => s.addCheck);
  const updateCheck = useVoidStore((s) => s.updateCheck);
  const page = vessel.pageId ? pages.find((p) => p.id === vessel.pageId) : undefined;

  return (
    <div
      className={cn(
        "relative group select-none",
        vessel.kind === "intention" || vessel.kind === "quote" ? "bg-transparent" : "bg-surface/80 backdrop-blur-[2px]",
        vessel.kind === "note" && "rounded-lg shadow-[var(--shadow-border)]",
        vessel.kind === "habit" && "rounded-xl shadow-[var(--shadow-border)]",
        vessel.kind === "clock" && "rounded-xl shadow-[var(--shadow-border)]",
        vessel.kind === "image" && "rounded-md",
        vessel.kind === "page" && "rounded-lg shadow-[var(--shadow-border)]",
        vessel.kind === "task" && "rounded-xl shadow-[var(--shadow-border)]",
      )}
    >
      {interactive && onRemove && (
        <button
          type="button"
          aria-label="Remove"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -right-2 -top-2 z-10 inline-flex size-7 items-center justify-center rounded-full bg-surface text-muted shadow-[var(--shadow-border)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-fg max-md:opacity-100 md:opacity-0"
        >
          <X className="size-3.5" />
        </button>
      )}

      {vessel.kind === "clock" && <LiveClock />}

      {vessel.kind === "image" && vessel.src && (
        <img
          src={vessel.src}
          alt={vessel.body || "Placed image"}
          className="block w-full rounded-md object-cover outline outline-1 -outline-offset-1 outline-fg/10"
          draggable={false}
        />
      )}

      {vessel.kind === "habit" && (
        <div className="px-4 py-3.5">
          {interactive ? (
            <input
              value={vessel.body}
              onChange={(e) => onBody?.(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
              placeholder="A thing you return to"
            />
          ) : (
            <p className="text-sm text-fg">{vessel.body || "Habit"}</p>
          )}
          <div className="mt-3 flex justify-between gap-1">
            {DAYS.map((d, i) => (
              <button
                key={`${d}-${i}`}
                type="button"
                disabled={!interactive}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onHabit?.(i)}
                className="flex flex-col items-center gap-1.5"
                aria-pressed={vessel.habit[i]}
                aria-label={`${d}`}
              >
                <span
                  className={cn(
                    "size-3.5 rounded-full shadow-[var(--shadow-border)] transition-colors duration-150",
                    vessel.habit[i] ? "bg-accent" : "bg-transparent",
                  )}
                />
                <span className="text-[10px] tracking-wider text-subtle">{d}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {vessel.kind === "page" && (
        <button
          type="button"
          className="w-full px-4 py-3.5 text-left"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => vessel.pageId && onOpenPage?.(vessel.pageId)}
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Page</p>
          <p className="mt-1 font-display text-lg leading-snug text-fg">{page?.title || vessel.body || "Untitled"}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted">
            {page?.body.replace(/^#+\s+/gm, "").slice(0, 90) || "Open to write"}
          </p>
        </button>
      )}

      {vessel.kind === "task" && (
        <div className="px-4 py-3.5" onPointerDown={(e) => e.stopPropagation()}>
          {interactive ? (
            <input
              value={vessel.body}
              onChange={(e) => onBody?.(e.target.value)}
              className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
              placeholder="This list"
            />
          ) : (
            <p className="text-sm text-fg">{vessel.body || "Tasks"}</p>
          )}
          <ul className="mt-2 space-y-1.5">
            {vessel.checks.map((c: CheckItem) => (
              <li key={c.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.done}
                  disabled={!interactive}
                  onChange={() => toggleCheck(vessel.id, c.id)}
                  className="size-3.5 accent-[var(--color-accent)]"
                />
                {interactive ? (
                  <input
                    value={c.text}
                    onChange={(e) => updateCheck(vessel.id, c.id, e.target.value)}
                    placeholder="A next action"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
                  />
                ) : (
                  <span className={cn("text-sm", c.done && "text-muted line-through")}>{c.text}</span>
                )}
              </li>
            ))}
          </ul>
          {interactive && (
            <button
              type="button"
              className="mt-2 text-xs text-muted hover:text-fg"
              onClick={() => addCheck(vessel.id)}
            >
              Add a line
            </button>
          )}
        </div>
      )}

      {(vessel.kind === "note" || vessel.kind === "intention" || vessel.kind === "quote") && (
        <div
          className={cn(
            "px-4 py-3",
            vessel.kind === "intention" && "px-1 py-1",
            vessel.kind === "quote" && "px-2 py-2",
          )}
        >
          {interactive && (editing || !vessel.body) ? (
            <textarea
              autoFocus={editing}
              value={vessel.body}
              onChange={(e) => onBody?.(e.target.value)}
              onBlur={() => setEditing(false)}
              onPointerDown={(e) => e.stopPropagation()}
              rows={vessel.kind === "intention" ? 2 : 4}
              placeholder={
                vessel.kind === "intention"
                  ? "One intention for this month"
                  : vessel.kind === "quote"
                    ? "A line worth keeping"
                    : "Write something. [[Link]] a page."
              }
              className={cn(
                "w-full resize-none bg-transparent outline-none placeholder:text-subtle",
                vessel.kind === "intention" && "font-display text-2xl leading-snug text-fg",
                vessel.kind === "quote" && "font-display text-lg italic leading-snug text-fg",
                vessel.kind === "note" && "min-h-20 text-sm leading-relaxed text-fg",
              )}
            />
          ) : (
            <p
              onDoubleClick={() => interactive && setEditing(true)}
              className={cn(
                "whitespace-pre-wrap",
                vessel.kind === "intention" && "font-display text-2xl leading-snug text-fg",
                vessel.kind === "quote" && "font-display text-lg italic leading-snug text-fg",
                vessel.kind === "note" && "min-h-12 text-sm leading-relaxed text-fg",
                !vessel.body && "text-subtle",
              )}
            >
              {vessel.body || (interactive ? "Double-click to write" : "")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
