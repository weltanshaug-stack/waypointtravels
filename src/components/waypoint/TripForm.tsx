import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCESSIBILITY_NEEDS,
  ACCOMMODATION_OPTIONS,
  BUDGET_CATEGORIES,
  BUDGET_FLEXIBILITY,
  CURRENCIES,
  MAX_TRIP_DAYS,
  PACE_OPTIONS,
  TRANSPORT_OPTIONS,
  TRAVEL_STYLES,
  type TripInput,
  recommendedBudget,
  tripDayCount,
  validateTripBudget,
  validateTripDates,
} from "@/lib/waypoint/types";


const STEPS = [
  "Destination",
  "Dates",
  "Budget",
  "Travellers",
  "Style",
  "Access & logistics",
] as const;

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Numeric input that keeps its own text state so the displayed value is never
 * a leading "0" the user has to delete — an empty field simply reads as 0.
 */
function NumberField({
  value,
  onChange,
  min,
  max,
  placeholder,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value ? String(value) : "");

  useEffect(() => {
    const parsed = text.trim() === "" ? 0 : Number(text);
    if (parsed !== value) setText(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder ?? "0"}
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
        setText(raw);
        onChange(raw === "" ? 0 : Number(raw));
      }}
      onBlur={() => {
        if (text === "") return;
        let n = Number(text);
        if (typeof min === "number" && n < min) n = min;
        if (typeof max === "number" && n > max) n = max;
        setText(String(n));
        onChange(n);
      }}
    />
  );
}


function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-all ${
        active
          ? "border-primary bg-primary text-primary-foreground shadow-card"
          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {hint ? <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function TripForm({
  value,
  onChange,
  onSubmit,
  onDemo,
}: {
  value: TripInput;
  onChange: (next: TripInput) => void;
  onSubmit: () => void;
  onDemo: () => void;
}) {
  const [step, setStep] = useState(0);
  const [showDateError, setShowDateError] = useState(false);
  const [showBudgetError, setShowBudgetError] = useState(false);
  const set = <K extends keyof TripInput>(key: K, v: TripInput[K]) =>
    onChange({ ...value, [key]: v });
  const toggle = (key: "travelStyles" | "accessibilityNeeds" | "accommodation" | "transportation", item: string) => {
    const list = value[key];
    set(key, list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const dateError = validateTripDates(value);
  const budgetError = validateTripBudget(value);

  const canAdvance = () => {
    if (step === 0) return value.destinationFlexible ? true : value.destination.trim().length > 1;
    if (step === 2) return value.budgetTotal > 0;
    return true;
  };

  const blockedByDates = () => {
    if (!dateError) return false;
    setShowDateError(true);
    setStep(1);
    toast.error("Check your travel dates", { description: dateError });
    return true;
  };

  const blockedByBudget = () => {
    if (!budgetError) return false;
    setShowBudgetError(true);
    setStep(2);
    toast.error("Check your budget", { description: budgetError });
    return true;
  };

  const handleContinue = () => {
    if (step === 1 && blockedByDates()) return;
    if (step === 2 && blockedByBudget()) return;
    setShowDateError(false);
    setShowBudgetError(false);
    setStep((s) => s + 1);
  };

  const handleSubmit = () => {
    if (blockedByDates()) return;
    if (blockedByBudget()) return;
    onSubmit();
  };

  const last = step === STEPS.length - 1;


  return (
    <div className="surface-card animate-rise overflow-hidden">
      <div className="border-b border-border bg-secondary/40 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="text-display mt-1 text-2xl font-semibold">{STEPS[step]}</h2>
          </div>
          <Button variant="outline" size="sm" onClick={onDemo} type="button">
            Try demo trip
          </Button>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} className="mt-4 h-1.5" />
      </div>

      <div className="space-y-8 px-6 py-7">
        {step === 0 && (
          <>
            <Section title="Where do you want to go?" hint="A city, a country, or leave it to the agents.">
              <Input
                placeholder="e.g. Lisbon, Portugal"
                value={value.destination}
                disabled={value.destinationFlexible}
                onChange={(e) => set("destination", e.target.value)}
              />
              <label className="flex items-center gap-2 pt-1 text-sm">
                <Checkbox
                  checked={value.destinationFlexible}
                  onCheckedChange={(c) => set("destinationFlexible", c === true)}
                />
                I'm flexible — pick a destination for me
              </label>
            </Section>
            {value.destinationFlexible && (
              <Section title="Which part of the world?" hint="Region, country or continent.">
                <Input
                  placeholder="e.g. Southern Europe, Southeast Asia, US West Coast"
                  value={value.preferredRegion}
                  onChange={(e) => set("preferredRegion", e.target.value)}
                />
              </Section>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <Section title="When are you travelling?">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    min={todayISO()}
                    value={value.startDate}
                    disabled={value.useDayCount}
                    aria-invalid={showDateError && !!dateError}
                    onChange={(e) => {
                      setShowDateError(false);
                      set("startDate", e.target.value);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    min={value.startDate || todayISO()}
                    value={value.endDate}
                    disabled={value.useDayCount}
                    aria-invalid={showDateError && !!dateError}
                    onChange={(e) => {
                      setShowDateError(false);
                      set("endDate", e.target.value);
                    }}
                  />
                </div>
              </div>
              {showDateError && dateError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>{dateError}</span>
                </div>
              )}
              <label className="flex items-center gap-2 pt-1 text-sm">
                <Checkbox
                  checked={value.useDayCount}
                  onCheckedChange={(c) => {
                    setShowDateError(false);
                    set("useDayCount", c === true);
                  }}
                />
                I don't have dates yet — plan by number of days
              </label>
              {value.useDayCount && (
                <div className="max-w-[180px] space-y-1.5 pt-2">
                  <Label>Number of days</Label>
                  <NumberField
                    min={1}
                    max={MAX_TRIP_DAYS}
                    placeholder="5"
                    value={value.daysCount}
                    onChange={(n) => {
                      setShowDateError(false);
                      set("daysCount", n);
                    }}
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Planning for <strong>{tripDayCount(value)}</strong> days (up to {MAX_TRIP_DAYS}).
              </p>
            </Section>
          </>
        )}


        {step === 2 && (
          <>
            <Section title="Total budget" hint="Everything for the whole group, excluding flights unless you say otherwise.">
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <NumberField
                  min={0}
                  max={1_000_000}
                  placeholder={`${recommendedBudget(value).toLocaleString("en-US")} (recommended for this trip)`}
                  value={value.budgetTotal}
                  onChange={(n) => {
                    setShowBudgetError(false);
                    set("budgetTotal", n);
                  }}
                />


                <Select value={value.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showBudgetError && budgetError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>{budgetError}</span>
                </div>
              )}
            </Section>
            <Section title="Budget flexibility">
              <div className="flex flex-wrap gap-2">
                {BUDGET_FLEXIBILITY.map((b) => (
                  <Pill key={b} active={value.budgetFlexibility === b} onClick={() => set("budgetFlexibility", b)}>
                    {b}
                  </Pill>
                ))}
              </div>
            </Section>
            <Section title="Budget category">
              <div className="flex flex-wrap gap-2">
                {BUDGET_CATEGORIES.map((b) => (
                  <Pill key={b} active={value.budgetCategory === b} onClick={() => set("budgetCategory", b)}>
                    {b}
                  </Pill>
                ))}
              </div>
            </Section>
          </>
        )}

        {step === 3 && (
          <>
            <Section title="Who's going?">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Adults</Label>
                  <NumberField
                    min={1}
                    max={20}
                    placeholder="2"
                    value={value.adults}
                    onChange={(n) => set("adults", n)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Children</Label>
                  <NumberField
                    min={0}
                    max={20}
                    placeholder="0"
                    value={value.children}
                    onChange={(n) => set("children", n)}
                  />
                </div>

              </div>
              {value.children > 0 && (
                <div className="space-y-1.5 pt-2">
                  <Label>Ages of children (optional)</Label>
                  <Input
                    placeholder="e.g. 4 and 9"
                    value={value.childrenAges}
                    onChange={(e) => set("childrenAges", e.target.value)}
                  />
                </div>
              )}
            </Section>
          </>
        )}

        {step === 4 && (
          <>
            <Section title="Travel style" hint="Pick everything that sounds like your trip.">
              <div className="flex flex-wrap gap-2">
                {TRAVEL_STYLES.map((s) => (
                  <Pill key={s} active={value.travelStyles.includes(s)} onClick={() => toggle("travelStyles", s)}>
                    {s}
                  </Pill>
                ))}
              </div>
            </Section>
            <Section title="Anything else we should know?" hint="Written in your own words — the agents treat this as a hard signal.">
              <Textarea
                rows={5}
                placeholder={[
                  "I love quiet places away from the crowds…",
                  "I want to try as much local pasta as possible…",
                  "I'd rather wake up late and take slow mornings…",
                  "I want a mix of museums and time outdoors…",
                ].join("\n")}
                value={value.freeText}
                onChange={(e) => set("freeText", e.target.value)}
              />
            </Section>
            <Section title="Pace">
              <div className="flex flex-wrap gap-2">
                {PACE_OPTIONS.map((p) => (
                  <Pill key={p} active={value.pace === p} onClick={() => set("pace", p)}>
                    {p}
                  </Pill>
                ))}
              </div>
            </Section>
          </>
        )}

        {step === 5 && (
          <>
            <Section
              title="Accessibility & health-related travel needs"
              hint="Optional, and skippable. These are used only as logistical planning constraints — never as medical advice, and we make no assumptions beyond what you select."
            >
              <div className="flex flex-wrap gap-2">
                {ACCESSIBILITY_NEEDS.map((a) => (
                  <Pill
                    key={a}
                    active={value.accessibilityNeeds.includes(a)}
                    onClick={() => toggle("accessibilityNeeds", a)}
                  >
                    {a}
                  </Pill>
                ))}
              </div>
              <Textarea
                rows={3}
                className="mt-3"
                placeholder="Other accessibility needs, or detail on the above (optional)"
                value={value.accessibilityNotes}
                onChange={(e) => set("accessibilityNotes", e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary">Optional</Badge>
                <span className="text-xs text-muted-foreground">
                  Accessibility details in your guide are reported/estimated — always confirm with the venue.
                </span>
              </div>
            </Section>
            <Section title="Accommodation">
              <div className="flex flex-wrap gap-2">
                {ACCOMMODATION_OPTIONS.map((a) => (
                  <Pill key={a} active={value.accommodation.includes(a)} onClick={() => toggle("accommodation", a)}>
                    {a}
                  </Pill>
                ))}
              </div>
            </Section>
            <Section title="Transportation">
              <div className="flex flex-wrap gap-2">
                {TRANSPORT_OPTIONS.map((t) => (
                  <Pill key={t} active={value.transportation.includes(t)} onClick={() => toggle("transportation", t)}>
                    {t}
                  </Pill>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/30 px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Back
        </Button>
        {last ? (
          <Button type="button" size="lg" onClick={handleSubmit}>
            Build my trip
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={handleContinue} disabled={!canAdvance()}>
            Continue
          </Button>
        )}

      </div>
    </div>
  );
}
