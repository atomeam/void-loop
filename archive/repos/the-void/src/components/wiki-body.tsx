import { useState, type ReactNode } from "react";
import { findPageByTitle } from "@/lib/wiki";
import { useVoidStore } from "@/lib/void-store";
import { cn } from "@/lib/utils";

type Hover = { title: string; x: number; y: number };

function renderInline(
  text: string,
  onOpen?: (title: string) => void,
  onTag?: (tag: string) => void,
  onHover?: (next: Hover | null) => void,
): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\[\[([^\]\n]+)\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|(^|\s)(#[A-Za-z][\w-]*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) {
      const raw = m[1];
      const [titlePart, aliasPart] = raw.split("|");
      const title = (titlePart ?? raw).replace(/#.*$/, "").trim();
      const label = (aliasPart ?? title).trim();
      parts.push(
        <button
          key={`l-${i++}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.(title);
          }}
          onMouseEnter={(e) => onHover?.({ title, x: e.clientX, y: e.clientY })}
          onMouseLeave={() => onHover?.(null)}
          className="text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
        >
          {label}
        </button>,
      );
    } else if (m[2]) {
      parts.push(
        <strong key={`b-${i++}`} className="font-medium">
          {m[2]}
        </strong>,
      );
    } else if (m[3]) {
      parts.push(
        <em key={`i-${i++}`} className="italic">
          {m[3]}
        </em>,
      );
    } else if (m[4]) {
      parts.push(
        <code key={`c-${i++}`} className="rounded-xs bg-fg/8 px-1 font-mono text-[0.85em]">
          {m[4]}
        </code>,
      );
    } else if (m[6]) {
      const tag = m[6].slice(1);
      parts.push(m[5]);
      parts.push(
        <button
          key={`t-${i++}`}
          type="button"
          className="text-muted hover:text-fg"
          onClick={(e) => {
            e.stopPropagation();
            onTag?.(tag);
          }}
        >
          {m[6]}
        </button>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function WikiBody({
  text,
  onOpen,
  onToggle,
  onTag,
  className,
  depth = 0,
}: {
  text: string;
  onOpen?: (title: string) => void;
  onToggle?: (line: number) => void;
  onTag?: (tag: string) => void;
  className?: string;
  depth?: number;
}) {
  const pages = useVoidStore((s) => s.pages);
  const [hover, setHover] = useState<Hover | null>(null);
  const preview = hover ? findPageByTitle(pages, hover.title) : undefined;

  if (!text.trim()) {
    return <p className={cn("text-sm text-subtle", className)}>Empty.</p>;
  }

  const lines = text.split("\n");
  const left = hover ? Math.min(hover.x + 16, typeof window === "undefined" ? hover.x : window.innerWidth - 280) : 0;
  const top = hover ? Math.min(hover.y + 16, typeof window === "undefined" ? hover.y : window.innerHeight - 160) : 0;

  return (
    <div className={cn("relative space-y-2 text-sm leading-relaxed text-fg", className)}>
      {lines.map((line, index) => {
        const embed = line.match(/^!\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]\s*$/);
        if (embed) {
          const title = embed[1].trim();
          const page = findPageByTitle(pages, title);
          if (depth > 0 || !page) {
            return (
              <p key={index}>
                {renderInline(`[[${title}]]`, onOpen, onTag, setHover)}
                {!page && <span className="ml-2 text-xs text-subtle">not written yet</span>}
              </p>
            );
          }
          return (
            <div key={index} className="rounded-md bg-surface/80 px-4 py-3 shadow-[var(--shadow-border)]">
              <button
                type="button"
                className="font-display text-base text-fg hover:underline"
                onClick={() => onOpen?.(title)}
              >
                {page.title}
              </button>
              <div className="mt-2">
                <WikiBody text={page.body} onOpen={onOpen} onTag={onTag} depth={depth + 1} />
              </div>
            </div>
          );
        }
        const heading = line.match(/^(#{1,3})\s+(.*)$/);
        if (heading) {
          const size = heading[1].length === 1 ? "text-xl" : heading[1].length === 2 ? "text-lg" : "text-base";
          return (
            <h3 key={index} className={cn("font-display font-medium tracking-tight", size)}>
              {renderInline(heading[2], onOpen, onTag, setHover)}
            </h3>
          );
        }
        const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
        if (task) {
          const done = task[1] !== " ";
          return (
            <label key={index} className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={done}
                onChange={() => onToggle?.(index)}
                className="mt-1 size-3.5 accent-[var(--color-accent)]"
              />
              <span className={done ? "text-muted line-through" : ""}>
                {renderInline(task[2], onOpen, onTag, setHover)}
              </span>
            </label>
          );
        }
        const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
        if (numbered) {
          return (
            <p key={index} className="pl-3">
              <span className="mr-2 text-subtle">{line.trim().match(/^\d+/)?.[0]}.</span>
              {renderInline(numbered[1], onOpen, onTag, setHover)}
            </p>
          );
        }
        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        if (bullet) {
          return (
            <p key={index} className="pl-3">
              <span className="mr-2 text-subtle">·</span>
              {renderInline(bullet[1], onOpen, onTag, setHover)}
            </p>
          );
        }
        const quote = line.match(/^>\s?(.*)$/);
        if (quote) {
          return (
            <blockquote key={index} className="border-l border-border-strong pl-4 text-muted">
              {renderInline(quote[1], onOpen, onTag, setHover)}
            </blockquote>
          );
        }
        if (/^---+$/.test(line.trim())) {
          return <hr key={index} className="border-border" />;
        }
        if (!line.trim()) return <div key={index} className="h-2" />;
        return <p key={index}>{renderInline(line, onOpen, onTag, setHover)}</p>;
      })}
      {hover && depth === 0 && (
        <aside
          className="pointer-events-none fixed z-50 hidden w-64 rounded-md bg-surface p-3 shadow-[var(--shadow-border)] md:block"
          style={{ left, top }}
        >
          <p className="font-display text-sm text-fg">{preview?.title ?? hover.title}</p>
          <p className="mt-1 line-clamp-5 text-xs leading-relaxed text-muted">
            {preview
              ? preview.body.replace(/\s+/g, " ").trim() || "Empty."
              : "Linked, not written. Click to keep it."}
          </p>
        </aside>
      )}
    </div>
  );
}
