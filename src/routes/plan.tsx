import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Bookmark, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/waypoint/SiteHeader";
import { TripForm } from "@/components/waypoint/TripForm";
import { AgentProgress } from "@/components/waypoint/AgentProgress";
import { TripGuide } from "@/components/waypoint/TripGuide";
import { useAuth } from "@/hooks/useAuth";
import { adaptTrip, checkTrip, planTrip, saveTrip } from "@/lib/waypoint/trip.functions";
import {
  demoTripInput,
  emptyTripInput,
  type AdaptationId,
  type TripInput,
  type TripResult,
} from "@/lib/waypoint/types";

const DRAFT_KEY = "waypoint:draft";
/** Accessibility needs are the only answers we remember between trips. */
const ACCESS_KEY = "waypoint:accessibility";
const RESULT_KEY = "waypoint:result";

export const Route = createFileRoute("/plan")({
  validateSearch: (search: Record<string, unknown>): { demo?: boolean } =>
    search["demo"] === true || search["demo"] === "true" ? { demo: true } : {},

  head: () => ({
    meta: [
      { title: "Plan your trip — Wandor" },
      {
        name: "description",
        content:
          "Tell Wandor your budget, dates, pace and accessibility needs and let the AI agents build your day-by-day travel guide.",
      },
      { property: "og:title", content: "Plan your trip — Wandor" },
      {
        property: "og:description",
        content: "A multi-step planner feeding an agentic AI travel planning workflow.",
      },
    ],
  }),
  component: PlanPage,
});

type Phase = "form" | "planning" | "result";

/** Style/preference answers are per-trip and never carried into a new trip. */
function withoutPreferences(base: TripInput): TripInput {
  return {
    ...base,
    travelStyles: [],
    freeText: "",
    pace: emptyTripInput.pace,
    budgetCategory: emptyTripInput.budgetCategory,
    budgetFlexibility: emptyTripInput.budgetFlexibility,
    accommodation: [...emptyTripInput.accommodation],
    transportation: [...emptyTripInput.transportation],
  };
}

function readSavedAccessibility(): Pick<TripInput, "accessibilityNeeds" | "accessibilityNotes"> | null {
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TripInput>;
    return {
      accessibilityNeeds: Array.isArray(parsed.accessibilityNeeds) ? parsed.accessibilityNeeds : [],
      accessibilityNotes: typeof parsed.accessibilityNotes === "string" ? parsed.accessibilityNotes : "",
    };
  } catch {
    return null;
  }
}

function PlanPage() {
  const { demo } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [input, setInput] = useState<TripInput>(demo ? demoTripInput : emptyTripInput);
  const [phase, setPhase] = useState<Phase>("form");
  const [result, setResult] = useState<TripResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adapting, setAdapting] = useState<AdaptationId | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  const runPlan = useServerFn(planTrip);
  const runAdapt = useServerFn(adaptTrip);
  const runSave = useServerFn(saveTrip);
  const runCheck = useServerFn(checkTrip);

  // Restore any in-progress work (form data is never lost, guest results survive sign-in).
  useEffect(() => {
    try {
      const savedResult = sessionStorage.getItem(RESULT_KEY);
      if (savedResult) {
        const parsed = JSON.parse(savedResult) as TripResult;
        setResult(parsed);
        setInput(parsed.input);
        setPhase("result");
        return;
      }
      const draft = sessionStorage.getItem(DRAFT_KEY);
      const base = draft && !demo ? (JSON.parse(draft) as TripInput) : null;
      const access = readSavedAccessibility();
      if (base) setInput({ ...base, ...(access ?? {}) });
      else if (access && !demo) setInput((prev) => ({ ...prev, ...access }));
    } catch {
      /* ignore corrupt storage */
    }
  }, [demo]);

  const persistDraft = (next: TripInput) => {
    setInput(next);
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      // Only accessibility needs persist beyond this trip.
      localStorage.setItem(
        ACCESS_KEY,
        JSON.stringify({
          accessibilityNeeds: next.accessibilityNeeds,
          accessibilityNotes: next.accessibilityNotes,
        }),
      );
    } catch {
      /* ignore */
    }
  };

  const persistResult = (next: TripResult | null) => {
    setResult(next);
    try {
      if (next) sessionStorage.setItem(RESULT_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(RESULT_KEY);
    } catch {
      /* ignore */
    }
  };

  /** Runs the review pass after the guide is already on screen. */
  async function audit(base: TripResult) {
    setChecking(true);
    try {
      const check = await runCheck({
        data: { input: base.input, brief: base.brief, plan: base.plan },
      });
      persistResult({ ...base, check });
    } catch {
      /* the guide is still usable without the review */
    } finally {
      setChecking(false);
    }
  }

  async function generate() {
    setError(null);
    setPhase("planning");
    try {
      const next = await runPlan({ data: { input } });
      persistResult(next);
      setPhase("result");
      void audit(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The AI agents could not finish your plan.");
      setPhase("form");
    }
  }

  async function adapt(id: AdaptationId) {
    if (!result) return;
    setAdapting(id);
    setError(null);
    try {
      const next = await runAdapt({
        data: { input: result.input, brief: result.brief, plan: result.plan, adaptation: id },
      });
      persistResult(next);
      toast.success("Itinerary updated.");
      // Bring the traveller back to the top so they see the revised plan from day 1.
      window.scrollTo({ top: 0, behavior: "smooth" });
      void audit(next);
    } catch (e) {
      const message = e instanceof Error ? e.message : "The revision could not be completed.";
      setError(message);
      toast.error(message);
    } finally {
      setAdapting(null);
    }
  }

  async function save() {
    if (!result) return;
    if (!user) {
      toast.info("Create a free account to save this trip — your guide is kept while you sign up.");
      navigate({ to: "/auth" });
      return;
    }
    setSaving(true);
    try {
      const { id } = await runSave({ data: { result } });
      persistResult(null);
      toast.success("Trip saved to your dashboard.");
      navigate({ to: "/trips/$tripId", params: { tripId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this trip.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {error && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
            <p className="flex items-start gap-2 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              {error} Your answers are still here.
            </p>
            <Button size="sm" variant="outline" onClick={() => (result ? adapt("regenerate") : generate())}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        {phase === "form" && (
          <div className="mx-auto max-w-3xl">
            <header className="mb-7">
              <h1 className="text-display text-3xl font-semibold sm:text-4xl">Tell us what you need</h1>
              <p className="mt-2 text-muted-foreground">
                The agents use every answer as a planning constraint. Nothing is required except destination,
                dates and budget.
              </p>
            </header>
            <TripForm
              value={input}
              onChange={persistDraft}
              onSubmit={generate}
              onDemo={() => {
                persistDraft(demoTripInput);
                toast.success("Demo trip loaded — 6 days in Tokyo.");
              }}
            />
          </div>
        )}

        {phase === "planning" && <AgentProgress done={false} />}

        {phase === "result" && result && (
          <>
            {adapting && (
              <div className="mb-6">
                <AgentProgress done={false} label="Revising your itinerary" />
              </div>
            )}
            <TripGuide
              result={result}
              checking={checking}
              onAdapt={adapt}
              adapting={adapting}
              onChangeDestination={() => {
                setPhase("form");
                persistResult(null);
              }}
              headerActions={
                <div className="flex flex-wrap gap-2">
                  <Button onClick={save} disabled={saving}>
                    <Bookmark className="mr-1 h-4 w-4" />
                    {user ? (saving ? "Saving…" : "Save trip") : "Save — create account"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      persistResult(null);
                      // Fresh trip: keep accessibility needs, drop style/preferences.
                      persistDraft(
                        withoutPreferences({
                          ...emptyTripInput,
                          accessibilityNeeds: input.accessibilityNeeds,
                          accessibilityNotes: input.accessibilityNotes,
                        }),
                      );
                      setPhase("form");
                    }}
                  >
                    New trip
                  </Button>
                </div>
              }
            />
            {!user && (
              <div className="surface-card mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
                <div>
                  <h2 className="text-display text-lg font-semibold">Keep this guide</h2>
                  <p className="text-sm text-muted-foreground">
                    Create a free account to save this trip, revisit it later and build more.
                  </p>
                </div>
                <Button asChild>
                  <Link to="/auth">Create free account</Link>
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
