import { useCallback, useRef, useState, type PointerEvent } from "react";
import { ImagePlus, Quote, Target, Timer, Type, CheckSquare, CloudFog, FileText, ListTodo } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { VoidField } from "@/components/void-field";
import { VesselCard } from "@/components/vessel-card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { atmosphereOf, useVoidStore } from "@/lib/void-store";
import { ATMOSPHERES, VESSEL_META, WANDER_VESSEL_LIMIT, type VesselKind } from "@/lib/void-types";
import { clamp, cn } from "@/lib/utils";
import { readImageFile } from "@/lib/read-image";

const KINDS: { kind: VesselKind; icon: typeof Type }[] = [
  { kind: "note", icon: Type },
  { kind: "page", icon: FileText },
  { kind: "task", icon: ListTodo },
  { kind: "intention", icon: Target },
  { kind: "habit", icon: CheckSquare },
  { kind: "quote", icon: Quote },
  { kind: "image", icon: ImagePlus },
  { kind: "clock", icon: Timer },
];

export function VoidStage({
  readOnly,
  showChrome,
  onOpenPage,
}: {
  readOnly?: boolean;
  showChrome?: boolean;
  onOpenPage?: (pageId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [pendingKind, setPendingKind] = useState<VesselKind | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [sealOpen, setSealOpen] = useState(false);
  const [hint, setHint] = useState(true);

  const current = useVoidStore((s) => s.current);
  const plan = useVoidStore((s) => s.plan);
  const addVessel = useVoidStore((s) => s.addVessel);
  const updateVessel = useVoidStore((s) => s.updateVessel);
  const moveVessel = useVoidStore((s) => s.moveVessel);
  const removeVessel = useVoidStore((s) => s.removeVessel);
  const bringFront = useVoidStore((s) => s.bringFront);
  const toggleHabit = useVoidStore((s) => s.toggleHabit);
  const setAtmosphere = useVoidStore((s) => s.setAtmosphere);
  const setDensity = useVoidStore((s) => s.setDensity);
  const canAdd = useVoidStore((s) => s.canAdd);
  const sealMonth = useVoidStore((s) => s.sealMonth);
  const openFresh = useVoidStore((s) => s.openFresh);

  const atmo = atmosphereOf(current.atmosphere);
  const interactive = !readOnly && !current.sealedAt;

  const place = useCallback(
    async (kind: VesselKind, clientX: number, clientY: number, src?: string) => {
      const el = stageRef.current;
      if (!el) return;
      if (!canAdd()) {
        setLimitOpen(true);
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = clamp(((clientX - rect.left) / rect.width) * 100, 6, 88);
      const y = clamp(((clientY - rect.top) / rect.height) * 100, 10, 82);
      addVessel(kind, x, y, src ? { src } : undefined);
      setHint(false);
    },
    [addVessel, canAdd],
  );

  const onStagePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.stage) return;
    if (pendingKind === "image") {
      fileRef.current?.click();
      setPendingKind(null);
      return;
    }
    const kind = pendingKind ?? "note";
    void place(kind, e.clientX, e.clientY);
    setPendingKind(null);
  };

  const onVesselPointerDown = (e: PointerEvent, id: string) => {
    if (!interactive) return;
    if ((e.target as HTMLElement).closest("textarea, input, button, img")) return;
    const vessel = current.vessels.find((v) => v.id === id);
    const el = stageRef.current;
    if (!vessel || !el) return;
    bringFront(id);
    const rect = el.getBoundingClientRect();
    drag.current = {
      id,
      dx: ((e.clientX - rect.left) / rect.width) * 100 - vessel.x,
      dy: ((e.clientY - rect.top) / rect.height) * 100 - vessel.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onVesselPointerMove = (e: PointerEvent) => {
    if (!drag.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100 - drag.current.dx, 0, 92);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100 - drag.current.dy, 0, 90);
    moveVessel(drag.current.id, x, y);
  };

  const onFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const src = await readImageFile(file);
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      await place("image", rect.left + rect.width * 0.5, rect.top + rect.height * 0.42, src);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative isolate min-h-dvh w-full overflow-hidden bg-bg">
      <img
        src={atmo.src}
        alt=""
        className="absolute inset-0 size-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-bg/55" />
      <VoidField
        atmosphere={current.atmosphere}
        density={current.density}
        className="absolute inset-0 size-full"
      />

      <div
        ref={stageRef}
        data-stage="1"
        onPointerDown={onStagePointerDown}
        onDragOver={(e) => {
          if (interactive) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (interactive) void onFile(e.dataTransfer.files);
        }}
        className={cn("absolute inset-0", pendingKind && interactive && "cursor-crosshair")}
      >
        {current.vessels.map((v) => (
          <div
            key={v.id}
            style={{
              left: `${v.x}%`,
              top: `${v.y}%`,
              width: v.w,
              zIndex: v.z,
            }}
            className="absolute touch-none"
            onPointerDown={(e) => onVesselPointerDown(e, v.id)}
            onPointerMove={onVesselPointerMove}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            <VesselCard
              vessel={v}
              interactive={interactive}
              onBody={(body) => updateVessel(v.id, { body })}
              onHabit={(day) => toggleHabit(v.id, day)}
              onRemove={interactive ? () => removeVessel(v.id) : undefined}
              onOpenPage={onOpenPage}
            />
          </div>
        ))}

        {interactive && current.vessels.length === 0 && hint && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
            <p className="max-w-sm text-center font-display text-xl text-fg/80 md:text-2xl">
              The room is empty. Place a page, a task, a note. Or press ⌘K.
            </p>
          </div>
        )}
      </div>

      {showChrome && (
        <>
          <div className="pointer-events-none absolute left-5 top-16 z-20 md:left-8 md:top-[4.5rem]">
            <p className="pointer-events-auto font-display text-lg text-fg/90">{current.name}</p>
            <p className="pointer-events-auto text-xs tracking-wide text-muted">
              {atmo.label}
              {plan === "wander" ? ` · ${current.vessels.length}/${WANDER_VESSEL_LIMIT}` : ` · ${current.vessels.length}`}
            </p>
          </div>

          {interactive && (
            <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-surface/90 p-1.5 shadow-[var(--shadow-border)] backdrop-blur-sm">
                {KINDS.map(({ kind, icon: Icon }) => (
                  <Button
                    key={kind}
                    type="button"
                    variant={pendingKind === kind ? "default" : "ghost"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      if (kind === "image") {
                        fileRef.current?.click();
                        return;
                      }
                      setPendingKind((k) => (k === kind ? null : kind));
                    }}
                  >
                    <Icon />
                    <span className="hidden sm:inline">{VESSEL_META[kind].label}</span>
                  </Button>
                ))}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Atmosphere" className="shrink-0 md:hidden">
                      <CloudFog className="size-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom">
                    <SheetHeader>
                      <SheetTitle>Atmosphere</SheetTitle>
                    </SheetHeader>
                    <AtmospherePicker value={current.atmosphere} onChange={setAtmosphere} density={current.density} onDensity={setDensity} />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          )}

          <aside className="pointer-events-none absolute right-5 top-16 z-20 hidden w-56 md:block md:right-8 md:top-[4.5rem]">
            <div className="pointer-events-auto rounded-xl bg-surface/80 p-4 shadow-[var(--shadow-border)] backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Atmosphere</p>
              <AtmospherePicker value={current.atmosphere} onChange={setAtmosphere} density={current.density} onDensity={setDensity} compact />
              {interactive && (
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={current.vessels.length === 0}
                    onClick={() => setSealOpen(true)}
                  >
                    Seal this month
                  </Button>
                  <Button variant="ghost" size="sm" onClick={openFresh}>
                    Open a new void
                  </Button>
                </div>
              )}
            </div>
          </aside>

          <div className="absolute bottom-20 right-4 z-20 md:hidden">
            {interactive && current.vessels.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setSealOpen(true)}>
                Seal
              </Button>
            )}
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files);
          e.target.value = "";
        }}
      />

      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wander holds eight.</DialogTitle>
            <DialogDescription>
              The free room is small on purpose. Keep unlocks unlimited vessels, pages, and every sealed month.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setLimitOpen(false)}>
              Stay
            </Button>
            <Button asChild>
              <Link to="/pricing">See Keep</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sealOpen} onOpenChange={setSealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seal this month?</DialogTitle>
            <DialogDescription>
              The room is archived as it stands. Pages stay. A new void opens.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSealOpen(false)}>
              Not yet
            </Button>
            <Button
              onClick={() => {
                sealMonth();
                setSealOpen(false);
              }}
            >
              Seal it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AtmospherePicker({
  value,
  onChange,
  density,
  onDensity,
  compact,
}: {
  value: (typeof ATMOSPHERES)[number]["id"];
  onChange: (id: (typeof ATMOSPHERES)[number]["id"]) => void;
  density: number;
  onDensity: (n: number) => void;
  compact?: boolean;
}) {
  return (
    <div className="mt-3 space-y-3">
      <div className={cn("grid gap-1.5", compact ? "grid-cols-2" : "grid-cols-3")}>
        {ATMOSPHERES.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            className={cn(
              "rounded-md px-2 py-2 text-left text-xs transition-colors duration-150",
              value === a.id ? "bg-fg text-bg" : "bg-fg/6 text-muted hover:text-fg",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-subtle">Density</p>
        <Slider
          min={0.15}
          max={1}
          step={0.05}
          value={[density]}
          onValueChange={(v) => onDensity(v[0] ?? density)}
        />
      </div>
    </div>
  );
}
