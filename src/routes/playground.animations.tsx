import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, ChevronRight, RotateCw, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/playground/animations")({
  head: () => ({
    meta: [
      { title: "Animations Playground — RefNotes" },
      { name: "description", content: "Live demos of tw-animate-css utilities." },
    ],
  }),
  component: AnimationsPlayground,
});

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint && <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{hint}</p>}
      </header>
      <div className="rounded-2xl border border-border bg-card p-4">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="block truncate font-mono text-[10px] text-muted-foreground">{children}</code>
  );
}

function ReplayCard({ label, classes }: { label: string; classes: string }) {
  const [k, setK] = useState(0);
  return (
    <div className="space-y-2">
      <div className="grid h-20 place-items-center overflow-hidden rounded-lg bg-surface-sunken">
        <div key={k} className={`grid h-12 w-12 place-items-center rounded-md bg-primary text-primary-foreground ${classes}`}>
          <span className="text-xs font-semibold">{label}</span>
        </div>
      </div>
      <Code>{classes}</Code>
      <button
        onClick={() => setK((n) => n + 1)}
        className="flex w-full items-center justify-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs hover:bg-accent"
      >
        <RotateCw size={12} /> Replay
      </button>
    </div>
  );
}

function AnimationsPlayground() {
  // Wizard preview state
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const goNext = () => { setDir("fwd"); setStep((s) => Math.min(2, s + 1)); };
  const goBack = () => { setDir("back"); setStep((s) => Math.max(0, s - 1)); };
  const wizardEnter = dir === "fwd" ? "slide-in-from-right-8" : "slide-in-from-left-8";

  return (
    <div className="space-y-6 px-4 py-6">
      <div className="space-y-1">
        <Link to="/" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold">Animations Playground</h1>
        <p className="text-sm text-muted-foreground">
          Live demos of <span className="font-mono">tw-animate-css</span> utilities — already available in your project.
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          Tip: respects <span className="underline">prefers-reduced-motion</span> at OS level for built-in loops.
        </p>
      </div>

      {/* 1. Entrance */}
      <Section title="1. Entrance animations" hint="animate-in + variants">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ReplayCard label="Fade" classes="animate-in fade-in duration-500" />
          <ReplayCard label="Up" classes="animate-in slide-in-from-bottom-4 duration-300" />
          <ReplayCard label="Zoom" classes="animate-in zoom-in-95 duration-200" />
          <ReplayCard label="Combo" classes="animate-in fade-in slide-in-from-right-8 duration-500" />
          <ReplayCard label="Spin" classes="animate-in spin-in-90 duration-500" />
          <ReplayCard label="Slow" classes="animate-in fade-in zoom-in-50 duration-1000 ease-out" />
        </div>
      </Section>

      {/* 2. Direction */}
      <Section title="2. Direction & distance" hint="slide-in-from-{dir}-{n}">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReplayCard label="↓2" classes="animate-in slide-in-from-top-2 duration-400" />
          <ReplayCard label="↑8" classes="animate-in slide-in-from-bottom-8 duration-400" />
          <ReplayCard label="→16" classes="animate-in slide-in-from-left-16 duration-500" />
          <ReplayCard label="←16" classes="animate-in slide-in-from-right-16 duration-500" />
        </div>
      </Section>

      {/* 3. Always-on loops */}
      <Section title="3. Always-on loops" hint="animate-{pulse,bounce,ping,spin}">
        <div className="grid grid-cols-4 gap-3">
          <div className="grid h-20 place-items-center rounded-lg bg-surface-sunken">
            <div className="h-10 w-10 animate-pulse rounded-md bg-primary" />
          </div>
          <div className="grid h-20 place-items-center rounded-lg bg-surface-sunken">
            <div className="h-10 w-10 animate-bounce rounded-md bg-primary" />
          </div>
          <div className="grid h-20 place-items-center rounded-lg bg-surface-sunken">
            <span className="relative flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-primary" />
            </span>
          </div>
          <div className="grid h-20 place-items-center rounded-lg bg-surface-sunken">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3">
          <Code>animate-pulse</Code>
          <Code>animate-bounce</Code>
          <Code>animate-ping</Code>
          <Code>animate-spin</Code>
        </div>
      </Section>

      {/* 4. Timing */}
      <Section title="4. Timing & easing" hint="duration-* + ease-*">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReplayCard label="150" classes="animate-in fade-in duration-150 ease-linear" />
          <ReplayCard label="300" classes="animate-in fade-in duration-300 ease-in" />
          <ReplayCard label="700" classes="animate-in fade-in duration-700 ease-out" />
          <ReplayCard label="1000" classes="animate-in fade-in duration-1000 ease-in-out" />
        </div>
      </Section>

      {/* 5. Hover / tap */}
      <Section title="5. Hover & tap micro-interactions" hint="hover:scale-* / active:scale-* / group-hover">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-transform duration-200 hover:scale-105 active:scale-95">
            Scale on hover/tap
          </button>
          <button className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <span>Group hover</span>
            <ChevronRight className="transition-transform group-hover:translate-x-1" size={16} />
          </button>
          <button className="rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent">
            Hover bg
          </button>
        </div>
      </Section>

      {/* 6. Wizard preview */}
      <Section title="6. Wizard step transitions" hint="slide-in-from-{left|right}-8 duration-300">
        <div className="overflow-hidden rounded-lg bg-surface-sunken">
          <div key={step} className={`p-6 animate-in ${wizardEnter} duration-300 ease-out`}>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Step {step + 1} of 3</p>
            <p className="mt-2 text-base font-medium">
              {["Game date & time", "Where was the game played?", "Who was the home team?"][step]}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={step === 0}
            className="flex items-center gap-1 rounded-md border border-border bg-muted px-3 py-1.5 text-xs disabled:opacity-40"
          >
            <ArrowLeft size={12} /> Back
          </button>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i === step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <button
            onClick={goNext}
            disabled={step === 2}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
          >
            Next <ArrowRight size={12} />
          </button>
        </div>
      </Section>

      {/* 7. Skeleton */}
      <Section title="7. Skeleton loader" hint="animate-pulse">
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken p-3">
              <div className="h-10 w-10 animate-pulse rounded-md bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-2 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* 8. Notification ping */}
      <Section title="8. Mentor notification ping" hint="animate-ping ring behind icon">
        <div className="flex items-center gap-4">
          <button className="relative grid h-12 w-12 place-items-center rounded-full border border-border bg-card">
            <Bell size={18} />
            <span className="absolute right-1 top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
            </span>
          </button>
          <p className="text-sm text-muted-foreground">New mentor reply available.</p>
        </div>
      </Section>

      <div className="pt-4 text-center">
        <Link to="/" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
