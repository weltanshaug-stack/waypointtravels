import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Accessibility,
  Check,
  Clock,
  Coffee,
  Flame,
  Footprints,
  ImageIcon,
  Loader2,
  MapPin,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchActivityImages } from "@/lib/waypoint/trip.functions";
import {
  ADAPTATIONS,
  formatMoney,
  type ActivityLevel,
  type AdaptationId,
  type ItineraryItem,
  type TripResult,
} from "@/lib/waypoint/types";

const TIME_LABEL = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;

const LEVEL_STYLE: Record<ActivityLevel, { className: string; icon: typeof Coffee }> = {
  Relaxed: { className: "border-border bg-accent text-accent-foreground", icon: Coffee },
  Moderate: { className: "border-border bg-secondary text-foreground", icon: Footprints },
  Active: { className: "border-warn/50 bg-warn/15 text-warn-foreground", icon: Flame },
};

function imageKeyFor(item: ItineraryItem, destination: string): string {
  const q = (item.imageQuery ?? "").trim();
  return (q || `${item.title} ${destination}`).slice(0, 120);
}

const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10}h`;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{value}</dd>
    </div>
  );
}

export function TripGuide({
  result,
  onAdapt,
  onChangeDestination,
  adapting,
  headerActions,
  checking,
}: {
  result: TripResult;
  onAdapt?: (id: AdaptationId) => void;
  onChangeDestination?: () => void;
  adapting?: AdaptationId | null;
  headerActions?: React.ReactNode;
  /** True while the Trip Critic audit is still running in the background. */
  checking?: boolean;
}) {
  const { plan, check, input, brief } = result;
  const currency = plan.currency || input.currency;

  // Only surface accessibility content when the traveller actually asked for it.
  const showAccessibility =
    input.accessibilityNeeds.length > 0 || Boolean(input.accessibilityNotes?.trim());

  const imageQueries = useMemo(
    () =>
      Array.from(
        new Set(plan.days.flatMap((d) => d.items.map((i) => imageKeyFor(i, plan.destination)))),
      ).slice(0, 40),
    [plan],
  );
  const runFetchImages = useServerFn(fetchActivityImages);
  const { data: images } = useQuery({
    queryKey: ["activity-images", plan.destination, imageQueries],
    queryFn: () => runFetchImages({ data: { queries: imageQueries } }),
    staleTime: Infinity,
    retry: false,
    enabled: imageQueries.length > 0,
  });

  const budgetRows = [
    { label: "Stay", value: plan.budget.accommodation },
    { label: "Food", value: plan.budget.food },
    { label: "Transport", value: plan.budget.transportation },
    { label: "Activities", value: plan.budget.activities },
    { label: "Other", value: plan.budget.miscellaneous },
  ].filter((r) => r.value > 0);
  const maxRow = Math.max(1, ...budgetRows.map((r) => r.value));

  const dates =
    !input.useDayCount && input.startDate && input.endDate
      ? `${input.startDate} → ${input.endDate}`
      : `${plan.days.length} days · flexible`;

  const problems = check?.checks.filter((c) => c.status !== "pass") ?? [];

  return (
    <div className="space-y-8">
      {/* ---------- Header ---------- */}
      <section className="surface-card animate-rise overflow-hidden">
        <div className="grain-hero px-6 py-7 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-widest text-accent-foreground uppercase">
                Your itinerary
              </p>
              <h1 className="text-display mt-1 text-3xl font-semibold sm:text-4xl">
                {plan.destination}
              </h1>
              <p className="mt-1 text-muted-foreground">{plan.title}</p>
            </div>
            {headerActions}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Fact label="Dates" value={dates} />
            <Fact label="Days" value={`${plan.days.length}`} />
            <Fact
              label="Travellers"
              value={`${input.adults + input.children}`}
            />
            <Fact label="Est. total" value={formatMoney(plan.budget.total, currency)} />
          </dl>
        </div>
      </section>

      {/* ---------- Money + fit ---------- */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-display flex items-center gap-2 text-lg font-semibold">
              <Wallet className="h-4 w-4" aria-hidden="true" /> Budget
            </h2>
            <span className="text-sm text-muted-foreground">
              of {formatMoney(input.budgetTotal, input.currency)} planned
            </span>
          </div>
          <ul className="mt-4 space-y-2.5">
            {budgetRows.map((row) => (
              <li key={row.label}>
                <div className="flex items-center justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="font-medium">{formatMoney(row.value, currency)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent-foreground"
                    style={{ width: `${(row.value / maxRow) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
            Estimates for the whole group — check prices before booking.
          </p>
        </div>

        <div className="surface-card p-6">
          <h2 className="text-display text-lg font-semibold">Trip check</h2>
          {checking && !check && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Reviewing your plan for conflicts…
            </p>
          )}
          {check && (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-display text-4xl font-semibold">{check.fitScore}</span>
                <span className="text-sm text-muted-foreground">/ 100 fit</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{check.summary}</p>
              {problems.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 text-sm font-medium">
                  <Check className="h-4 w-4" aria-hidden="true" /> No conflicts found.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {problems.map((c) => (
                    <li key={c.name} className="flex items-start gap-2 text-sm">
                      <TriangleAlert
                        className="mt-0.5 h-4 w-4 shrink-0 text-warn-foreground"
                        aria-hidden="true"
                      />
                      <span>
                        <strong>{c.name}:</strong> {c.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      {/* ---------- Adapt ---------- */}
      {onAdapt && (
        <section className="surface-card p-6">
          <h2 className="text-display text-lg font-semibold">Change something</h2>
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
                Change destination
              </Button>
            )}
          </div>
        </section>
      )}

      {/* ---------- Day by day ---------- */}
      <section aria-labelledby="schedule-heading" className="space-y-10">
        <h2 id="schedule-heading" className="text-display text-2xl font-semibold">
          Day by day
        </h2>

        {plan.days.map((day) => {
          const level = LEVEL_STYLE[day.activityLevel ?? "Moderate"];
          const LevelIcon = level.icon;
          const dayTotal = day.estimatedDayCost || day.items.reduce((s, i) => s + i.estimatedCost, 0);
          const dayMinutes = day.items.reduce(
            (s, i) => s + i.durationMinutes + (i.travelTimeMinutes ?? 0),
            0,
          );

          return (
            <article key={day.day} className="scroll-mt-20">
              {/* Clear day divider */}
              <div className="flex items-end gap-4 border-b-2 border-foreground/80 pb-3">
                <span className="text-display text-5xl leading-none font-semibold sm:text-6xl">
                  {day.day}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    Day {day.day}
                    {day.date ? ` · ${day.date}` : ""}
                  </p>
                  <h3 className="text-display truncate text-xl font-semibold sm:text-2xl">
                    {day.theme}
                  </h3>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${level.className}`}
                >
                  <LevelIcon className="h-4 w-4" aria-hidden="true" />
                  {day.activityLevel ?? "Moderate"} day
                </span>
                <Badge variant="secondary" className="gap-1 text-sm">
                  <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatMoney(dayTotal, currency)}
                </Badge>
                <Badge variant="outline" className="gap-1 text-sm">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {hours(dayMinutes)}
                </Badge>
                <Badge variant="outline" className="text-sm">
                  {day.items.length} stop{day.items.length === 1 ? "" : "s"}
                </Badge>
              </div>

              <ol className="mt-5 space-y-4">
                {day.items.map((item, i) => {
                  const image = images?.[imageKeyFor(item, plan.destination)];
                  return (
                    <li key={i} className="surface-card overflow-hidden">
                      <div className="grid gap-0 sm:grid-cols-[180px_1fr]">
                        <div className="relative aspect-[16/9] w-full bg-secondary sm:aspect-auto sm:h-full">
                          {image ? (
                            <img
                              src={image}
                              alt={`${item.title}, ${plan.destination}`}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-full min-h-[120px] w-full items-center justify-center text-muted-foreground"
                              aria-hidden="true"
                            >
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 p-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase">
                              {TIME_LABEL[item.timeOfDay]}
                            </span>
                            <span className="text-sm font-medium">
                              {item.estimatedCost > 0
                                ? formatMoney(item.estimatedCost, currency)
                                : "Free"}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              · {hours(item.durationMinutes)}
                            </span>
                          </div>

                          <h4 className="mt-2 text-lg font-semibold">{item.title}</h4>
                          <p className="mt-1 text-[0.975rem] leading-relaxed text-foreground/90">
                            {item.description}
                          </p>

                          {item.transportNote && (
                            <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              {item.transportNote}
                              {item.travelTimeMinutes ? ` (~${item.travelTimeMinutes} min)` : ""}
                            </p>
                          )}

                          {item.whyItFits && (
                            <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                              <strong>Why you'll like it: </strong>
                              {item.whyItFits}
                            </p>
                          )}

                          {showAccessibility && item.accessibilityNote && (
                            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                              <Accessibility className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                              <span>{item.accessibilityNote} — confirm with the venue.</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {(day.notes || day.restPeriods) && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {[day.notes, day.restPeriods].filter(Boolean).join(" · ")}
                </p>
              )}
            </article>
          );
        })}
      </section>

      {/* ---------- Optional detail, collapsed by default ---------- */}
      <section className="space-y-3">
        {plan.highlights.length > 0 && (
          <details className="surface-card px-6 py-4">
            <summary className="cursor-pointer font-semibold">Why this trip was built this way</summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{plan.overview}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {plan.highlights.slice(0, 4).map((h) => (
                <li key={h.title}>
                  <strong>{h.title}</strong> — <span className="text-muted-foreground">{h.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {plan.practicalNotes.length > 0 && (
          <details className="surface-card px-6 py-4">
            <summary className="cursor-pointer font-semibold">Good to know</summary>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {plan.practicalNotes.slice(0, 8).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </details>
        )}

        {brief.priorities.length > 0 && (
          <details className="surface-card px-6 py-4">
            <summary className="cursor-pointer font-semibold">What we planned around</summary>
            <ul className="mt-3 flex flex-wrap gap-2">
              {brief.priorities.slice(0, 6).map((p) => (
                <li key={p.label}>
                  <Badge variant="secondary">{p.label}</Badge>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
