import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { VoidField } from "@/components/void-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ATMOSPHERES, type AtmosphereId } from "@/lib/void-types";
import { atmosphereOf, useVoidStore } from "@/lib/void-store";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/enter")({ component: EnterPage });

function EnterPage() {
  const ready = useHydrated();
  const navigate = useNavigate();
  const current = useVoidStore((s) => s.current);
  const setName = useVoidStore((s) => s.setName);
  const setAtmosphere = useVoidStore((s) => s.setAtmosphere);
  const addVessel = useVoidStore((s) => s.addVessel);
  const setEntered = useVoidStore((s) => s.setEntered);

  const [step, setStep] = useState(0);
  const [name, setLocalName] = useState(current.name);
  const [atmo, setAtmo] = useState<AtmosphereId>(current.atmosphere);
  const [intention, setIntention] = useState("");

  const visual = atmosphereOf(atmo);

  const finish = () => {
    setName(name.trim() || current.name);
    setAtmosphere(atmo);
    if (intention.trim()) {
      addVessel("intention", 18, 38, { body: intention.trim() });
    }
    setEntered();
    void navigate({ to: "/void", search: { view: "today" } });
  };

  if (!ready) return <div className="min-h-dvh bg-bg" />;

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-bg">
      <img src={visual.src} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-bg/60" />
      <VoidField atmosphere={atmo} density={0.4} className="absolute inset-0 size-full" />
      <SiteNav />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-28">
        <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">Step {step + 1} of 3</p>

        {step === 0 && (
          <div className="stagger-in mt-6">
            <h1 className="font-display text-4xl font-medium tracking-tight">Name this month.</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              The calendar name is fine. A private name is better.
            </p>
            <div className="mt-8 space-y-2">
              <Label htmlFor="month-name">Month</Label>
              <Input
                id="month-name"
                value={name}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder={current.name}
              />
            </div>
            <div className="mt-8 flex justify-end">
              <Button
                onClick={() => {
                  setName(name.trim() || current.name);
                  setStep(1);
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="stagger-in mt-6">
            <h1 className="font-display text-4xl font-medium tracking-tight">Choose the weather.</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">Six atmospheres. You can change this later.</p>
            <div className="mt-8 grid grid-cols-2 gap-2">
              {ATMOSPHERES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAtmo(a.id);
                    setAtmosphere(a.id);
                  }}
                  className={cn(
                    "overflow-hidden rounded-lg text-left shadow-[var(--shadow-border)] transition-opacity duration-150",
                    atmo === a.id ? "opacity-100" : "opacity-60 hover:opacity-90",
                  )}
                >
                  <img src={a.src} alt="" className="aspect-16/10 w-full object-cover" />
                  <span className="block bg-surface px-3 py-2">
                    <span className="block text-sm text-fg">{a.label}</span>
                    <span className="block text-xs text-muted">{a.line}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button onClick={() => setStep(2)}>Continue</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stagger-in mt-6">
            <h1 className="font-display text-4xl font-medium tracking-tight">One intention.</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Optional. If you write it, it will be waiting in the room.
            </p>
            <div className="mt-8 space-y-2">
              <Label htmlFor="intention">Intention</Label>
              <Textarea
                id="intention"
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="Sit before the phone. Finish the letter. Walk after dark."
                rows={4}
              />
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={finish}>Open the void</Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
