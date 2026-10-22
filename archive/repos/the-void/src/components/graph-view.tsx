import { useMemo, useState } from "react";
import { allLinks, linkDegrees } from "@/lib/wiki";
import { missingEdges, missingTargets } from "@/lib/mind";
import { useVoidStore } from "@/lib/void-store";
import { Button } from "@/components/ui/button";
import { clamp } from "@/lib/utils";

export function GraphView({ onOpen }: { onOpen: (id: string) => void }) {
  const pages = useVoidStore((s) => s.pages);
  const openOrCreateByTitle = useVoidStore((s) => s.openOrCreateByTitle);
  const [seed, setSeed] = useState(0);
  const edges = useMemo(() => allLinks(pages), [pages]);
  const degrees = useMemo(() => linkDegrees(pages), [pages]);
  const missing = useMemo(() => missingTargets(pages), [pages]);
  const ghostsFrom = useMemo(() => missingEdges(pages), [pages]);
  const maxDeg = Math.max(1, ...[...degrees.values()]);

  const nodes = useMemo(() => {
    const n = pages.length;
    if (n === 0) return [];
    if (n === 1) return pages.map((p) => ({ ...p, x: 50, y: 44, r: 2.4, ghost: false }));
    const laid = pages.map((p, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2 + seed * 0.4;
      const d = degrees.get(p.id) ?? 0;
      const radius = d === 0 ? 34 : 16 + 16 * (1 - d / maxDeg);
      return {
        ...p,
        x: 50 + radius * Math.cos(a),
        y: 48 + radius * Math.sin(a),
        r: p.pinned ? 2.4 : 1.5 + (d / maxDeg) * 1.4,
        ghost: false,
      };
    });
    const byId = new Map(laid.map((node) => [node.id, node]));
    for (let k = 0; k < 40; k++) {
      for (let i = 0; i < laid.length; i++) {
        for (let j = i + 1; j < laid.length; j++) {
          const a = laid[i];
          const b = laid[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          const d2 = dx * dx + dy * dy || 0.05;
          const f = 14 / d2;
          dx *= f;
          dy *= f;
          a.x += dx;
          a.y += dy;
          b.x -= dx;
          b.y -= dy;
        }
      }
      for (const e of edges) {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) continue;
        const dx = (b.x - a.x) * 0.04;
        const dy = (b.y - a.y) * 0.04;
        a.x += dx;
        a.y += dy;
        b.x -= dx;
        b.y -= dy;
      }
      for (const node of laid) {
        const hub = (degrees.get(node.id) ?? 0) / maxDeg;
        node.x += (50 - node.x) * (0.03 + hub * 0.06);
        node.y += (48 - node.y) * (0.03 + hub * 0.06);
        node.x = clamp(node.x, 10, 90);
        node.y = clamp(node.y, 12, 86);
      }
    }
    return laid;
  }, [pages, degrees, maxDeg, edges, seed]);

  const ghosts = useMemo(() => {
    if (missing.length === 0) return [];
    return missing
      .filter((title) => title.trim().length >= 2)
      .map((title, i) => {
        const a = (i / Math.max(missing.length, 1)) * Math.PI * 2 + Math.PI / 6 + seed * 0.2;
        return {
          id: `ghost-${title}`,
          title,
          x: 50 + 42 * Math.cos(a),
          y: 48 + 42 * Math.sin(a),
          r: 1.3,
          ghost: true,
        };
      });
  }, [missing, seed]);

  const pos = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const ghostPos = useMemo(() => new Map(ghosts.map((n) => [n.title.toLowerCase(), n])), [ghosts]);

  if (pages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="max-w-sm text-center font-display text-xl text-muted">
          Write a page, then link it with [[brackets]]. The constellation appears when thoughts touch.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div className="absolute right-4 top-3 z-10">
        <Button size="sm" variant="ghost" onClick={() => setSeed((s) => s + 1)}>
          Reset
        </Button>
      </div>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" role="img" aria-label="Page graph">
        {edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={`${e.from}-${e.to}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              className="text-fg/20"
              strokeWidth="0.25"
            />
          );
        })}
        {ghostsFrom.map((e, i) => {
          const a = pos.get(e.from);
          const b = ghostPos.get(e.title.toLowerCase());
          if (!a || !b) return null;
          return (
            <line
              key={`g-${e.from}-${e.title}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              className="text-fg/15"
              strokeWidth="0.22"
              strokeDasharray="0.8 0.7"
            />
          );
        })}
        {nodes.map((n) => (
          <g key={n.id} className="cursor-pointer" onClick={() => onOpen(n.id)}>
            <circle cx={n.x} cy={n.y} r={4.6} fill="transparent" />
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              className={(degrees.get(n.id) ?? 0) === 0 ? "fill-fg/35" : "fill-accent"}
            />
            <text
              x={n.x}
              y={n.y + 5.2}
              textAnchor="middle"
              className="fill-fg"
              fontSize="3.2"
              fontFamily="Newsreader, serif"
            >
              {n.title.slice(0, 22)}
            </text>
          </g>
        ))}
        {ghosts.map((n) => (
          <g
            key={n.id}
            className="cursor-pointer"
            onClick={() => {
              const page = openOrCreateByTitle(n.title);
              onOpen(page.id);
            }}
          >
            <circle cx={n.x} cy={n.y} r={4.6} fill="transparent" />
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="none"
              stroke="currentColor"
              className="text-fg/40"
              strokeWidth="0.3"
              strokeDasharray="0.7 0.7"
            />
            <text
              x={n.x}
              y={n.y + 4.6}
              textAnchor="middle"
              className="fill-muted"
              fontSize="2.8"
              fontFamily="Newsreader, serif"
            >
              {n.title.slice(0, 18)}
            </text>
          </g>
        ))}
      </svg>
      {edges.length === 0 && missing.length === 0 && (
        <p className="pointer-events-none absolute bottom-8 left-0 right-0 text-center text-sm text-muted">
          No links yet. In a page, write [[Another page]].
        </p>
      )}
      {missing.length > 0 && (
        <p className="pointer-events-none absolute bottom-8 left-0 right-0 text-center text-sm text-muted">
          Dashed names are linked but not written. Click to keep them.
        </p>
      )}
    </div>
  );
}
