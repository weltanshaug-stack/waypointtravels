import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Accessibility,
  Check,
  Clock,
  Coffee,
  Flame,
  Footprints,
  Loader2,
  Sparkles,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityImage } from "@/components/waypoint/ActivityImage";
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
const TIME_ORDER = { morning: 0, afternoon: 1, evening: 2 } as const;

const LEVEL_STYLE: Record<ActivityLevel, { className: string; icon: typeof Coffee }> = {
  Relaxed: { className: "border-border bg-accent text-accent-foreground", icon: Coffee },
  Moderate: { className: "border-border bg-secondary text-foreground", icon: Footprints },
  Active: { className: "border-warn/50 bg-warn/15 text-warn-foreground", icon: Flame },
};

function imageKeyFor(item: ItineraryItem, destination: string): string {
  const q = (item.imageQuery ?? "").trim() || item.title;
  const city = destination.split(",")[0]?.trim() ?? "";
  // Anchor the search to the city so lookups resolve to the right building.
  const withCity = city && !q.toLowerCase().includes(city.toLowerCase()) ? `${q} ${city}` : q;
  return withCity.slice(0, 120);
}


/**
 * Renders the agent's copy, turning **Place Name** into bold text so specific
 * venues stand out in descriptions.
 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
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
  const { plan, check, input } = result;
  const currency = plan.currency || input.currency;

  // Only surface accessibility content when the traveller actually asked for it.
  const showAccessibility =
    input.accessibilityNeeds.length > 0 || Boolean(input.accessibilityNotes?.trim());

  // Each stop gets its own uniquely-selected photo (no shared fallback image).
  const imageQueries = useMemo(
    () =>
      Array.from(
        new Set(plan.days.flatMap((d) => d.items.map((i) => imageKeyFor(i, plan.destination)))),
      ).slice(0, 45),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan],
  );
  // Fetched in small batches so one failed or rate-limited request only affects
  // a few cards instead of wiping out every image on the page.
  const chunks = useMemo(() => {
    const size = 6;
    const out: string[][] = [];
    for (let i = 0; i < imageQueries.length; i += size) out.push(imageQueries.slice(i, i + size));
    return out;
  }, [imageQueries]);

  const runFetchImages = useServerFn(fetchActivityImages);
  const results = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: ["activity-images", plan.destination, chunk],
      queryFn: () => runFetchImages({ data: { queries: chunk, destination: plan.destination } }),
      staleTime: Infinity,
      retry: 2,
      retryDelay: 1200,
    })),
  });

  const images = useMemo(() => {
    const merged: Record<string, string[]> = {};
    for (const r of results) if (r.data) Object.assign(merged, r.data);
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => (r.data ? "1" : "0")).join("")]);

  // A card is only "still resolving" while its own batch is in flight.
  const resolvedKeys = useMemo(() => new Set(Object.keys(images)), [images]);
  const settledKeys = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r, i) => {
      if (!r.isPending) for (const q of chunks[i] ?? []) set.add(q);
    });
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => (r.isPending ? "p" : "s")).join(""), chunks]);


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
  const pros = check?.pros?.length ? check.pros : [];
  // Fall back to the audit's own warnings when the model gave no explicit cons.
  const cons = check?.cons?.length
    ? check.cons
    : problems.slice(0, 2).map((p) => `${p.name}: ${p.detail}`);

  return (
    <div className="space-y-10">
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
            </div>
            {headerActions}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Fact label="Dates" value={dates} />
            <Fact label="Days" value={`${plan.days.length}`} />
            <Fact label="Travellers" value={`${input.adults + input.children}`} />
            <Fact label="Est. total" value={formatMoney(plan.budget.total, currency)} />
          </dl>
        </div>
      </section>

      {/* ---------- Day by day (first thing after the itinerary header) ---------- */}
      <section aria-labelledby="schedule-heading" className="space-y-12">
        <h2 id="schedule-heading" className="text-display text-2xl font-semibold">
          Day by day
        </h2>

        {plan.days.map((day) => {
          const level = LEVEL_STYLE[day.activityLevel ?? "Moderate"];
          const LevelIcon = level.icon;
          const dayTotal =
            day.estimatedDayCost || day.items.reduce((s, i) => s + i.estimatedCost, 0);
          const dayMinutes = day.items.reduce(
            (s, i) => s + i.durationMinutes + (i.travelTimeMinutes ?? 0),
            0,
          );
          const items = [...day.items].sort(
            (a, b) => TIME_ORDER[a.timeOfDay] - TIME_ORDER[b.timeOfDay],
          );

          return (
            <article key={day.day} className="scroll-mt-20">
              {/* Clear day divider */}
              <div className="flex items-end gap-4 border-b-2 border-primary/70 pb-3">
                <span className="text-display text-5xl leading-none font-semibold text-primary sm:text-6xl">
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
              </div>

              <ol className="mt-5 flex flex-col gap-6">
                {items.map((item, i) => {
                  const key = imageKeyFor(item, plan.destination);
                  return (
                    <li key={i} className="surface-card flex flex-col overflow-hidden">
                      <div className="relative h-64 w-full shrink-0 sm:h-80">
                        <ActivityImage
                          cacheKey={key}
                          candidates={images?.[key]}
                          alt={`${item.title}, ${plan.destination}`}
                          priority={day.day === 1 && i === 0}
                          className="h-full w-full"
                        />
                        <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold tracking-wide uppercase">
                          {TIME_LABEL[item.timeOfDay]}
                        </span>
                      </div>


                      <div className="min-w-0 flex-1 p-6">
                        <h4 className="text-display text-xl font-semibold sm:text-2xl">{item.title}</h4>
                        <p className="mt-2 text-[1.02rem] leading-relaxed text-foreground/85">

                          <RichText text={item.description} />
                        </p>
                        <p className="mt-3 flex items-center gap-2 text-sm font-medium">
                          <span>
                            {item.estimatedCost > 0
                              ? formatMoney(item.estimatedCost, currency)
                              : "Free"}
                          </span>
                          <span className="text-muted-foreground">
                            · {hours(item.durationMinutes)}
                          </span>
                        </p>

                        {showAccessibility && item.accessibilityNote && (
                          <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
                            <Accessibility className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="line-clamp-2">{item.accessibilityNote}</span>
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </section>

      {/* ---------- What changed (only on revised plans) ---------- */}
      {(plan.changeSummary?.length ?? 0) > 0 && (
        <section className="surface-card border-primary/30 bg-accent/40 p-6">
          <h2 className="text-display flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" /> What changed
          </h2>
          <ul className="mt-4 space-y-2.5">
            {plan.changeSummary!.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm sm:text-base">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>
                  <RichText text={c.change} />
                  {c.why && (
                    <span className="text-muted-foreground"> → {c.why}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Budget ---------- */}
      <section className="surface-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-display flex items-center gap-2 text-lg font-semibold">
            <Wallet className="h-4 w-4" aria-hidden="true" /> Budget
          </h2>
          <span className="text-sm text-muted-foreground">
            of {formatMoney(input.budgetTotal, input.currency)} planned
          </span>
        </div>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 sm:gap-x-8">
          {budgetRows.map((row) => (
            <li key={row.label}>
              <div className="flex items-center justify-between text-sm">
                <span>{row.label}</span>
                <span className="font-medium">{formatMoney(row.value, currency)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(row.value / maxRow) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Change something ---------- */}
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
                {adapting === a.id ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                    Revising…
                  </>
                ) : (
                  a.label
                )}
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

      {/* ---------- Trip check (very bottom) ---------- */}
      <section className="surface-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-display text-lg font-semibold">Trip check</h2>
          {check && (
            <span className="text-sm text-muted-foreground">
              <strong className="text-display text-xl font-semibold text-foreground">
                {check.fitScore}
              </strong>{" "}
              / 100 fit
            </span>
          )}
        </div>

        {checking && !check && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reviewing your plan…
          </p>
        )}

        {check && (
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold tracking-widest text-primary uppercase">
                What works
              </h3>
              <ul className="mt-2 space-y-2">
                {(pros.length ? pros : ["This plan matches the preferences you gave us."]).map(
                  (pro, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>
                        <RichText text={pro} />
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Worth knowing
              </h3>
              <ul className="mt-2 space-y-2">
                {(cons.length ? cons : ["No conflicts found in this plan."]).map((con, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <TriangleAlert
                      className="mt-0.5 h-4 w-4 shrink-0 text-warn-foreground"
                      aria-hidden="true"
                    />
                    <span>
                      <RichText text={con} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
