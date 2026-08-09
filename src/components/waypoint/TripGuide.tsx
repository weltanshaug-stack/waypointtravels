import {
  AlertTriangle,
  Bus,
  Check,
  Clock,
  Info,
  Sparkles,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ADAPTATIONS, formatMoney, type AdaptationId, type TripResult } from "@/lib/waypoint/types";

const TIME_LABEL = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;

function EstimateNote({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Info className="h-3 w-3" />
      {children ?? "Estimated — verify before booking."}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const tone = score >= 85 ? "text-primary" : score >= 70 ? "text-warn" : "text-destructive";
  return (
    <div className="flex items-baseline gap-1">
      <span className={`text-display text-4xl font-semibold ${tone}`}>{score}</span>
      <span className="text-sm text-muted-foreground">/100</span>
    </div>
  );
}

export function TripGuide({
  result,
  onAdapt,
  onChangeDestination,
  adapting,
  headerActions,
}: {
  result: TripResult;
  onAdapt?: (id: AdaptationId) => void;
  onChangeDestination?: () => void;
  adapting?: AdaptationId | null;
  headerActions?: React.ReactNode;
}) {
  const { plan, check, input, brief } = result;
  const currency = plan.currency || input.currency;
  const budgetRows = [
    { label: "Accommodation", value: plan.budget.accommodation },
    { label: "Food", value: plan.budget.food },
    { label: "Transportation", value: plan.budget.transportation },
    { label: "Activities", value: plan.budget.activities },
    { label: "Miscellaneous", value: plan.budget.miscellaneous },
  ];
  const maxRow = Math.max(1, ...budgetRows.map((r) => r.value));
  const dates =
    !input.useDayCount && input.startDate && input.endDate
      ? `${input.startDate} → ${input.endDate}`
      : `${plan.days.length} days · dates flexible`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="surface-card animate-rise grain-hero overflow-hidden">
        <div className="px-6 py-7 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Badge className="mb-3 gap-1">
                <Sparkles className="h-3 w-3" /> AI-generated guide
              </Badge>
              <h1 className="text-display text-3xl font-semibold sm:text-4xl">{plan.destination}</h1>
              <p className="mt-1 text-muted-foreground">{plan.title}</p>
            </div>
            {headerActions}
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-4">
            {[
              { k: "Dates", v: dates },
              { k: "Days", v: `${plan.days.length}` },
              {
                k: "Travellers",
                v: `${input.adults} adult${input.adults === 1 ? "" : "s"}${input.children ? `, ${input.children} child${input.children === 1 ? "" : "ren"}` : ""}`,
              },
              { k: "Estimated total", v: formatMoney(plan.budget.total, currency) },
            ].map((row) => (
              <div key={row.k} className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
                <dt className="text-xs tracking-widest text-muted-foreground uppercase">{row.k}</dt>
                <dd className="mt-1 font-semibold">{row.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Overview + why */}
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="surface-card p-6">
          <h2 className="text-display text-xl font-semibold">Trip overview</h2>
          <p className="mt-3 leading-relaxed text-foreground/90">{plan.overview}</p>
          {plan.destinationRationale && (
            <p className="mt-3 rounded-xl bg-accent/50 p-4 text-sm leading-relaxed">
              <strong>Why here: </strong>
              {plan.destinationRationale}
            </p>
          )}
          {plan.highlights.length > 0 && (
            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                Why this was chosen
              </h3>
              {plan.highlights.map((h) => (
                <div key={h.title} className="rounded-xl border border-border bg-secondary/40 p-3">
                  <p className="font-medium">{h.title}</p>
                  <p className="text-sm text-muted-foreground">{h.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Budget */}
        <div className="surface-card p-6">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="text-display text-xl font-semibold">Budget breakdown</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            All figures are AI estimates for the whole group — verify before booking.
          </p>
          <div className="mt-5 space-y-3">
            {budgetRows.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="font-medium">{formatMoney(row.value, currency)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(row.value / maxRow) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="font-semibold">Estimated total</span>
            <span className="text-display text-xl font-semibold">
              {formatMoney(plan.budget.total, currency)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Your stated budget: {formatMoney(input.budgetTotal, input.currency)} ({input.budgetCategory})
          </p>
          {plan.budget.notes && <p className="mt-3 text-sm text-muted-foreground">{plan.budget.notes}</p>}
        </div>
      </section>

      {/* Trip check */}
      <section className="surface-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-display text-xl font-semibold">AI Trip Check</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{check.summary}</p>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-widest text-muted-foreground uppercase">Trip fit</p>
            <ScoreRing score={check.fitScore} />
          </div>
        </div>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {check.checks.map((c) => (
            <li key={c.name} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  c.status === "pass"
                    ? "bg-primary text-primary-foreground"
                    : c.status === "warn"
                      ? "bg-warn text-warn-foreground"
                      : "bg-destructive text-destructive-foreground"
                }`}
              >
                {c.status === "pass" ? <Check className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
              </span>
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        {check.issues.length > 0 && (
          <div className="mt-5 space-y-2">
            <h3 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
              Proposed corrections
            </h3>
            {check.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-warn/50 bg-warn/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-foreground" />
                <p className="text-sm">
                  {issue.day ? <strong>Day {issue.day}: </strong> : null}
                  {issue.issue} <span className="text-muted-foreground">→ {issue.proposedFix}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Adaptation */}
      {onAdapt && (
        <section className="surface-card p-6">
          <h2 className="text-display text-xl font-semibold">Adapt this trip</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The agents revise the existing itinerary instead of starting over — your priorities stay intact.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ADAPTATIONS.map((a) => (
              <Button
                key={a.id}
                variant={a.id === "regenerate" ? "secondary" : "outline"}
                size="sm"
                disabled={!!adapting}
                onClick={() => onAdapt(a.id)}
              >
                {adapting === a.id ? "Revising…" : a.label}
              </Button>
            ))}
            {onChangeDestination && (
              <Button variant="ghost" size="sm" disabled={!!adapting} onClick={onChangeDestination}>
                Change my destination
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Itinerary */}
      <section className="space-y-5">
        <h2 className="text-display text-2xl font-semibold">Itinerary</h2>
        {plan.days.map((day) => (
          <article key={day.day} className="surface-card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-6 py-4">
              <div>
                <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                  Day {day.day}
                  {day.date ? ` · ${day.date}` : ""}
                </p>
                <h3 className="text-display mt-0.5 text-xl font-semibold">{day.theme}</h3>
              </div>
              <Badge variant="secondary">Est. {formatMoney(day.estimatedDayCost, currency)}</Badge>
            </header>
            <div className="divide-y divide-border">
              {day.items.map((item, i) => (
                <div key={i} className="grid gap-3 px-6 py-5 sm:grid-cols-[110px_1fr]">
                  <p className="text-sm font-semibold tracking-wide text-primary uppercase">
                    {TIME_LABEL[item.timeOfDay]}
                  </p>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="font-semibold">{item.title}</h4>
                      <span className="text-sm text-muted-foreground">
                        Est. {formatMoney(item.estimatedCost, currency)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-foreground/90">{item.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> ~{Math.round(item.durationMinutes / 60 * 10) / 10}h
                      </span>
                      {item.transportNote ? (
                        <span className="inline-flex items-center gap-1">
                          <Bus className="h-3 w-3" /> {item.transportNote}
                          {item.travelTimeMinutes ? ` (~${item.travelTimeMinutes} min)` : ""}
                        </span>
                      ) : null}
                      <EstimateNote />
                    </div>
                    {item.whyItFits && (
                      <p className="mt-3 rounded-lg bg-accent/50 px-3 py-2 text-sm">
                        <strong>Why this fits you: </strong>
                        {item.whyItFits}
                      </p>
                    )}
                    {item.accessibilityNote && (
                      <p className="mt-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
                        <strong>Accessibility: </strong>
                        {item.accessibilityNote} — reported/estimated, confirm directly with the venue.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {(day.notes || day.restPeriods) && (
              <footer className="border-t border-border bg-secondary/30 px-6 py-3 text-sm text-muted-foreground">
                {[day.notes, day.restPeriods].filter(Boolean).join(" • ")}
              </footer>
            )}
          </article>
        ))}
      </section>

      {/* Reasoning + notes */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-6">
          <h2 className="text-display text-xl font-semibold">What the agents understood</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {brief.priorities.map((p) => (
              <li key={p.label} className="flex items-start justify-between gap-3">
                <span>
                  <strong>{p.label}</strong>
                  <span className="text-muted-foreground"> — {p.note}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">{Math.round(p.weight * 100)}%</span>
              </li>
            ))}
          </ul>
          {brief.constraints.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              <strong className="text-foreground">Constraints applied: </strong>
              {brief.constraints.join(" · ")}
            </p>
          )}
        </div>
        <div className="surface-card p-6">
          <h2 className="text-display text-xl font-semibold">Before you book</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-foreground/90">
            {plan.practicalNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            No live travel APIs are connected in this build. Prices, durations, opening hours, transport times
            and accessibility details are <strong>AI estimates</strong> — verify before booking. Accessibility
            information is reported/estimated only; confirm directly with each venue. Nothing here is medical
            advice.
          </p>
        </div>
      </section>
    </div>
  );
}
