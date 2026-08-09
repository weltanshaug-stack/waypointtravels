import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

const STAGES = [
  { title: "Understand", detail: "Analyzing your preferences...", agent: "Preference Analyzer" },
  { title: "Plan", detail: "Building destinations and activities around your constraints...", agent: "Destination & Activity Planner" },
  { title: "Optimize", detail: "Balancing budget, travel time, accessibility, and interests...", agent: "Budget · Accessibility · Schedule agents" },
  { title: "Check", detail: "Checking your itinerary for conflicts and unrealistic scheduling...", agent: "Trip Critic" },
  { title: "Finalize", detail: "Creating your personalized travel guide...", agent: "Final Itinerary Generator" },
];

/**
 * Agent progress theatre. Advances through the orchestrator's stages while the
 * server-side agent chain runs, and completes once the result lands.
 */
export function AgentProgress({ done, label }: { done: boolean; label?: string }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (done) {
      setStage(STAGES.length);
      return;
    }
    const timer = setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, 7000);
    return () => clearInterval(timer);
  }, [done]);

  return (
    <div className="surface-card animate-rise mx-auto max-w-2xl overflow-hidden">
      <div className="border-b border-border bg-secondary/40 px-6 py-5">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">AI travel agents at work</p>
        <h2 className="text-display mt-1 text-2xl font-semibold">
          {label ?? "Designing your trip"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The orchestrator is coordinating seven specialist agents. This usually takes under a minute.
        </p>
      </div>
      <ol className="divide-y divide-border">
        {STAGES.map((s, i) => {
          const state = i < stage ? "done" : i === stage ? "active" : "idle";
          return (
            <li
              key={s.title}
              className={`flex items-start gap-4 px-6 py-4 transition-colors ${
                state === "active" ? "bg-accent/40" : ""
              }`}
            >
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                  state === "done"
                    ? "border-primary bg-primary text-primary-foreground"
                    : state === "active"
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                }`}
              >
                {state === "done" ? (
                  <Check className="h-4 w-4" />
                ) : state === "active" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-xs">{i + 1}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className={`font-semibold ${state === "idle" ? "text-muted-foreground" : ""}`}>
                  Step {i + 1} — {s.title}
                </p>
                <p className="text-sm text-muted-foreground">{s.detail}</p>
                <p className="mt-1 text-xs tracking-wide text-primary/80 uppercase">{s.agent}</p>
                {state === "active" && <div className="skeleton-shimmer mt-3 h-1.5 w-full rounded-full" />}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
