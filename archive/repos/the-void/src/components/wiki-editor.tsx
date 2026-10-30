import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { PAGE_TEMPLATES } from "@/lib/mind";
import { useVoidStore } from "@/lib/void-store";
import { cn } from "@/lib/utils";

type Hint =
  | { kind: "link"; query: string; from: number; to: number }
  | { kind: "slash"; query: string; from: number; to: number };

const SLASH = [
  { id: "task", label: "Task", insert: "- [ ] " },
  { id: "heading", label: "Heading", insert: "## " },
  { id: "quote", label: "Quote", insert: "> " },
  { id: "rule", label: "Line", insert: "---\n" },
  { id: "embed", label: "Embed a page", insert: "![[" },
  ...PAGE_TEMPLATES.map((t) => ({ id: t.id, label: t.label, insert: t.body })),
];

function inspect(value: string, caret: number): Hint | null {
  const before = value.slice(0, caret);
  const link = before.match(/\[\[([^\]\n]*)$/);
  if (link && link.index !== undefined) {
    return { kind: "link", query: link[1], from: link.index, to: caret };
  }
  const lineStart = before.lastIndexOf("\n") + 1;
  const line = before.slice(lineStart);
  const slash = line.match(/^\/([a-z]*)$/i);
  if (slash) {
    return { kind: "slash", query: slash[1], from: lineStart, to: caret };
  }
  return null;
}

export function WikiEditor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const pages = useVoidStore((s) => s.pages);
  const recents = useVoidStore((s) => s.recents);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [active, setActive] = useState(0);

  const linkItems = useMemo(() => {
    if (!hint || hint.kind !== "link") return [];
    const q = hint.query.trim().toLowerCase();
    const recent = recents
      .map((id) => pages.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p != null);
    const rest = pages.filter((p) => !recent.some((r) => r.id === p.id));
    const pool = [...recent, ...rest];
    const matched = q ? pool.filter((p) => p.title.toLowerCase().includes(q)) : pool;
    const create =
      q && !pages.some((p) => p.title.toLowerCase() === q)
        ? [{ id: "__new", title: hint.query.trim() || q, kind: "new" as const }]
        : [];
    return [...create, ...matched.map((p) => ({ id: p.id, title: p.title, kind: p.kind }))].slice(0, 8);
  }, [hint, pages, recents]);

  const slashItems = useMemo(() => {
    if (!hint || hint.kind !== "slash") return [];
    const q = hint.query.toLowerCase();
    return SLASH.filter((s) => s.label.toLowerCase().includes(q) || s.id.startsWith(q)).slice(0, 8);
  }, [hint]);

  const items = hint?.kind === "link" ? linkItems : slashItems;
  const open = Boolean(hint && items.length > 0);

  const apply = (index: number) => {
    const el = ref.current;
    if (!hint || !el) return;
    let insert = "";
    let cursor = 0;
    if (hint.kind === "link") {
      const item = linkItems[index];
      if (!item) return;
      insert = `[[${item.title}]]`;
      cursor = hint.from + insert.length;
    } else {
      const item = slashItems[index];
      if (!item) return;
      insert = item.insert;
      cursor = hint.from + insert.length;
    }
    const next = `${value.slice(0, hint.from)}${insert}${value.slice(hint.to)}`;
    onChange(next);
    setHint(null);
    setActive(0);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const n = items.length;
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n));
      return;
    }
    if (open && (e.key === "Enter" || e.key === "Tab") && !e.shiftKey) {
      e.preventDefault();
      apply(active);
      return;
    }
    if (open && e.key === "Escape") {
      e.preventDefault();
      setHint(null);
      return;
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          const nextHint = inspect(next, e.target.selectionStart ?? next.length);
          setHint(nextHint);
          setActive(0);
        }}
        onKeyUp={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            const el = e.currentTarget;
            setHint(inspect(el.value, el.selectionStart ?? 0));
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          window.setTimeout(() => setHint(null), 160);
        }}
        placeholder={placeholder}
        className={cn("min-h-[50vh] bg-transparent px-0 py-0 font-sans text-base leading-relaxed shadow-none focus-visible:ring-0", className)}
      />
      {open && hint?.kind === "link" && (
        <ul
          role="listbox"
          className="absolute bottom-2 left-0 z-20 w-full max-w-md overflow-hidden rounded-md bg-surface shadow-[var(--shadow-border)]"
        >
          {linkItems.map((item, i) => (
            <li key={`${item.id}-${item.title}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={cn(
                  "flex w-full items-baseline justify-between px-3 py-2 text-left text-sm",
                  i === active ? "bg-fg/8 text-fg" : "text-muted",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  apply(i);
                }}
              >
                <span>{item.kind === "new" ? `Create “${item.title}”` : item.title}</span>
                <span className="text-[11px] uppercase tracking-[0.14em] text-subtle">
                  {item.kind === "new" ? "new" : item.kind}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && hint?.kind === "slash" && (
        <ul
          role="listbox"
          className="absolute bottom-2 left-0 z-20 w-full max-w-md overflow-hidden rounded-md bg-surface shadow-[var(--shadow-border)]"
        >
          {slashItems.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={cn(
                  "flex w-full items-center px-3 py-2 text-left text-sm",
                  i === active ? "bg-fg/8 text-fg" : "text-muted",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  apply(i);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
