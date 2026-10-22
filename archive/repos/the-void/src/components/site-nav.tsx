import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("inline-flex items-baseline gap-2.5 text-fg no-underline", className)}>
      <span className="font-display text-lg leading-none tracking-tight">空</span>
      <span className="text-[11px] uppercase tracking-[0.22em] text-muted">The Void</span>
    </Link>
  );
}

export function SiteNav({
  ghost,
  solid,
  action,
}: {
  ghost?: boolean;
  solid?: boolean;
  action?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "pointer-events-none inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 md:px-8",
        solid ? "relative border-b border-border bg-bg" : "absolute",
        ghost && "text-fg",
      )}
    >
      <div className="pointer-events-auto">
        <Mark />
      </div>
      <nav className="pointer-events-auto flex items-center gap-1 text-sm text-muted">
        <Link
          to="/void"
          search={{ view: "today" }}
          activeOptions={{ includeSearch: true }}
          className="rounded-sm px-3 py-2 transition-colors duration-150 hover:text-fg"
          activeProps={{ className: "text-fg" }}
        >
          Today
        </Link>
        <Link
          to="/void"
          search={{ view: "inbox" }}
          activeOptions={{ includeSearch: true }}
          className="rounded-sm px-3 py-2 transition-colors duration-150 hover:text-fg"
          activeProps={{ className: "text-fg" }}
        >
          Inbox
        </Link>
        <Link
          to="/void"
          search={{ view: "room" }}
          activeOptions={{ includeSearch: true }}
          className="hidden rounded-sm px-3 py-2 transition-colors duration-150 hover:text-fg sm:inline"
          activeProps={{ className: "text-fg" }}
        >
          Room
        </Link>
        <Link
          to="/archive"
          className="hidden rounded-sm px-3 py-2 transition-colors duration-150 hover:text-fg sm:inline"
          activeProps={{ className: "text-fg" }}
        >
          Archive
        </Link>
        <Link
          to="/pricing"
          className="rounded-sm px-3 py-2 transition-colors duration-150 hover:text-fg"
          activeProps={{ className: "text-fg" }}
        >
          Keep
        </Link>
        {action}
      </nav>
    </header>
  );
}
