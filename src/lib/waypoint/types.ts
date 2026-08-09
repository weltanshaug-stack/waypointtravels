/**
 * Shared Waypoint domain types. Client-safe: no server imports.
 */

export const TRAVEL_STYLES = [
  "Relaxing",
  "Adventure",
  "Food",
  "Culture",
  "History",
  "Nature",
  "Nightlife",
  "Shopping",
  "Beaches",
  "Photography",
  "Sports",
  "Family-friendly",
  "Romantic",
  "Educational",
] as const;

export const ACCESSIBILITY_NEEDS = [
  "Wheelchair accessibility",
  "Limited walking",
  "Mobility assistance",
  "Avoid stairs",
  "Hearing accessibility",
  "Visual accessibility",
  "Sensory considerations",
  "Dietary restrictions / allergies",
  "Medication storage / refrigeration",
] as const;

export const ACCOMMODATION_OPTIONS = [
  "Hotel",
  "Hostel",
  "Vacation rental",
  "Resort",
  "Flexible",
  "Accessible room required",
] as const;

export const TRANSPORT_OPTIONS = [
  "Public transportation",
  "Walking",
  "Rental car",
  "Taxi / rideshare",
  "Flexible",
] as const;

export const PACE_OPTIONS = ["Relaxed", "Balanced", "Packed"] as const;
export const BUDGET_CATEGORIES = ["Budget", "Moderate", "Comfortable", "Luxury"] as const;
export const BUDGET_FLEXIBILITY = ["Strict", "Somewhat flexible", "Very flexible"] as const;
export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "INR"] as const;

export type TripInput = {
  destination: string;
  destinationFlexible: boolean;
  preferredRegion: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  useDayCount: boolean;
  budgetTotal: number;
  currency: string;
  budgetFlexibility: string;
  budgetCategory: string;
  adults: number;
  children: number;
  childrenAges: string;
  travelStyles: string[];
  freeText: string;
  accessibilityNeeds: string[];
  accessibilityNotes: string;
  pace: string;
  accommodation: string[];
  transportation: string[];
};

export const emptyTripInput: TripInput = {
  destination: "",
  destinationFlexible: false,
  preferredRegion: "",
  startDate: "",
  endDate: "",
  daysCount: 5,
  useDayCount: false,
  // Left empty so the budget field shows its recommended-amount placeholder.
  budgetTotal: 0,
  currency: "USD",
  budgetFlexibility: "Somewhat flexible",
  budgetCategory: "Moderate",
  adults: 2,
  children: 0,
  childrenAges: "",
  travelStyles: [],
  freeText: "",
  accessibilityNeeds: [],
  accessibilityNotes: "",
  pace: "Balanced",
  accommodation: ["Hotel"],
  transportation: ["Public transportation", "Walking"],
};

export const demoTripInput: TripInput = {
  ...emptyTripInput,
  destination: "Tokyo, Japan",
  destinationFlexible: false,
  preferredRegion: "",
  useDayCount: true,
  daysCount: 6,
  budgetTotal: 2500,
  currency: "USD",
  budgetCategory: "Moderate",
  budgetFlexibility: "Somewhat flexible",
  adults: 2,
  children: 0,
  travelStyles: ["Food", "Culture", "Photography"],
  freeText:
    "We love local food and neighbourhood markets, want to avoid the most crowded tourist attractions, and prefer late starts.",
  accessibilityNeeds: ["Limited walking"],
  accessibilityNotes: "Comfortable with about 20 minutes of walking at a time, frequent sit-down breaks.",
  pace: "Balanced",
  accommodation: ["Hotel"],
  transportation: ["Public transportation", "Taxi / rideshare"],
};

/* ---------- Randomized demo trip ---------- */

const DEMO_DESTINATIONS = [
  { destination: "Lisbon, Portugal", currency: "EUR" },
  { destination: "Kyoto, Japan", currency: "JPY" },
  { destination: "Mexico City, Mexico", currency: "USD" },
  { destination: "Barcelona, Spain", currency: "EUR" },
  { destination: "Copenhagen, Denmark", currency: "EUR" },
  { destination: "Marrakech, Morocco", currency: "EUR" },
  { destination: "Vancouver, Canada", currency: "CAD" },
  { destination: "Edinburgh, Scotland", currency: "GBP" },
  { destination: "Cape Town, South Africa", currency: "USD" },
  { destination: "Sydney, Australia", currency: "AUD" },
  { destination: "Istanbul, Türkiye", currency: "EUR" },
  { destination: "Jaipur, India", currency: "INR" },
  { destination: "Seoul, South Korea", currency: "USD" },
  { destination: "Buenos Aires, Argentina", currency: "USD" },
  { destination: "Reykjavík, Iceland", currency: "EUR" },
  { destination: "Athens, Greece", currency: "EUR" },
] as const;

const DEMO_FREE_TEXT = [
  "We love quiet cafés, local markets and late starts.",
  "We want great food and a couple of standout viewpoints.",
  "We like learning about the place — museums and old neighbourhoods.",
  "We prefer avoiding crowds and long queues.",
  "We enjoy being outdoors, but nothing too strenuous.",
  "We're happy to splurge on one memorable meal.",
];

const pick = <T,>(list: readonly T[]): T =>
  list[Math.floor(Math.random() * list.length)] as T;

const pickSome = <T,>(list: readonly T[], count: number): T[] => {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return out;
};

/** A fresh 2-4 day trip in a random city with randomized preferences. */
export function randomDemoTripInput(): TripInput {
  const place = pick(DEMO_DESTINATIONS);
  const adults = pick([1, 2, 2, 3] as const);
  const children = adults > 1 ? pick([0, 0, 1, 2] as const) : 0;
  const needs = Math.random() < 0.4 ? pickSome(ACCESSIBILITY_NEEDS, 1) : [];

  const base: TripInput = {
    ...emptyTripInput,
    destination: place.destination,
    currency: place.currency,
    useDayCount: true,
    daysCount: pick([2, 3, 4] as const),
    adults,
    children,
    childrenAges: children > 0 ? Array.from({ length: children }, () => 5 + Math.floor(Math.random() * 10)).join(", ") : "",
    travelStyles: pickSome(TRAVEL_STYLES, 2 + Math.floor(Math.random() * 2)),
    freeText: pick(DEMO_FREE_TEXT),
    accessibilityNeeds: needs,
    accessibilityNotes: needs.length > 0 ? "Please keep this in mind when choosing venues." : "",
    pace: pick(PACE_OPTIONS),
    budgetCategory: pick(BUDGET_CATEGORIES),
    budgetFlexibility: pick(BUDGET_FLEXIBILITY),
    accommodation: pickSome(["Hotel", "Vacation rental", "Resort", "Flexible"] as const, 1),
    transportation: pickSome(TRANSPORT_OPTIONS, 2),
  };
  return { ...base, budgetTotal: recommendedBudget(base) };
}


/* ---------- Agent output shapes ---------- */

export type PreferenceBrief = {
  constraints: string[];
  priorities: { label: string; weight: number; note: string }[];
  budgetStrategy: string;
  accessibilityConstraints: string[];
  paceGuidance: string;
  risks: string[];
};

export type ItineraryItem = {
  timeOfDay: "morning" | "afternoon" | "evening";
  title: string;
  description: string;
  durationMinutes: number;
  estimatedCost: number;
  whyItFits: string;
  transportNote?: string;
  travelTimeMinutes?: number;
  accessibilityNote?: string;
  /** Short real-world search phrase used to illustrate the activity. */
  imageQuery?: string;
};

export const ACTIVITY_LEVELS = ["Relaxed", "Moderate", "Active"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export type ItineraryDay = {
  day: number;
  date?: string;
  theme: string;
  notes?: string;
  restPeriods?: string;
  estimatedDayCost: number;
  /** How physically demanding the day is. */
  activityLevel?: ActivityLevel;
  items: ItineraryItem[];
};


export type BudgetBreakdown = {
  accommodation: number;
  food: number;
  transportation: number;
  activities: number;
  miscellaneous: number;
  total: number;
  notes: string;
};

export type TripPlan = {
  title: string;
  destination: string;
  destinationRationale: string;
  overview: string;
  currency: string;
  budget: BudgetBreakdown;
  days: ItineraryDay[];
  highlights: { title: string; reason: string }[];
  practicalNotes: string[];
  /** Only set on revisions: short "Changed X to Y → why" bullets. */
  changeSummary?: string[];
};

export type TripCheck = {
  fitScore: number;
  summary: string;
  /** Short bullet strengths of the plan (always more pros than cons). */
  pros: string[];
  /** Short bullet trade-offs or watch-outs. */
  cons: string[];
  checks: {
    name: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }[];
  issues: { day?: number; issue: string; proposedFix: string }[];
};


export type TripResult = {
  input: TripInput;
  brief: PreferenceBrief;
  plan: TripPlan;
  /** null while the Trip Critic audit is still running. */
  check: TripCheck | null;
  generatedAt: string;
};

export const ADAPTATIONS = [
  { id: "cheaper", label: "Make it cheaper" },
  { id: "relaxing", label: "Make it more relaxing" },
  { id: "adventure", label: "Add more adventure" },
  { id: "food", label: "More food" },
  { id: "culture", label: "More culture" },
  { id: "less-walking", label: "Less walking" },
  { id: "family", label: "Make it family-friendly" },
  { id: "regenerate", label: "Regenerate" },
] as const;

export type AdaptationId = (typeof ADAPTATIONS)[number]["id"];

export const MAX_TRIP_DAYS = 21;

export function tripDayCount(input: TripInput): number {
  if (!input.useDayCount && input.startDate && input.endDate) {
    const start = new Date(input.startDate).getTime();
    const end = new Date(input.endDate).getTime();
    const diff = Math.round((end - start) / 86_400_000) + 1;
    if (Number.isFinite(diff) && diff > 0) return Math.min(diff, MAX_TRIP_DAYS);
  }
  return Math.max(1, Math.min(input.daysCount || 1, MAX_TRIP_DAYS));
}

function parseISODate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parts = value.split("-").map(Number);
  const [y, m, d] = [parts[0]!, parts[1]!, parts[2]!];
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/**
 * Validates the Dates step. Returns a human-readable error, or null when valid.
 */
export function validateTripDates(input: TripInput): string | null {
  if (input.useDayCount) {
    const n = Number(input.daysCount);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      return "Enter the number of days as a whole number of at least 1.";
    }
    if (n > MAX_TRIP_DAYS) return `We can plan up to ${MAX_TRIP_DAYS} days at a time.`;
    return null;
  }

  if (!input.startDate && !input.endDate) {
    return "Add a start and end date, or switch to planning by number of days.";
  }
  if (!input.startDate) return "Add a start date for your trip.";
  if (!input.endDate) return "Add an end date for your trip.";

  const start = parseISODate(input.startDate);
  const end = parseISODate(input.endDate);
  if (!start) return "That start date isn't a real date. Use the format YYYY-MM-DD.";
  if (!end) return "That end date isn't a real date. Use the format YYYY-MM-DD.";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start.getTime() < today.getTime()) return "Your start date is in the past — pick today or later.";
  if (start.getFullYear() > today.getFullYear() + 5) {
    return "That start date is too far ahead — pick a date within the next 5 years.";
  }
  if (end.getTime() < start.getTime()) {
    return "Your end date is before your start date. Swap them or pick a later end date.";
  }
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > MAX_TRIP_DAYS) {
    return `That's ${days} days. We can plan up to ${MAX_TRIP_DAYS} days at a time.`;
  }
  return null;
}


/** Rough floor for a realistic trip, per traveller per day, in the chosen currency. */
const MIN_PER_PERSON_PER_DAY: Record<string, number> = {
  USD: 60,
  EUR: 55,
  GBP: 50,
  CAD: 80,
  AUD: 90,
  JPY: 9000,
  INR: 3000,
};

/** Multiplier on the daily floor for each budget category. */
const CATEGORY_MULTIPLIER: Record<string, number> = {
  Budget: 1.6,
  Moderate: 2.6,
  Comfortable: 4,
  Luxury: 7,
};

/**
 * A realistic suggested total for this trip, used as the budget placeholder.
 */
export function recommendedBudget(input: TripInput): number {
  const travellers = Math.max(1, (input.adults || 0) + (input.children || 0));
  const days = tripDayCount(input);
  const floor = MIN_PER_PERSON_PER_DAY[input.currency] ?? 60;
  const multiplier = CATEGORY_MULTIPLIER[input.budgetCategory] ?? 2.6;
  const raw = floor * multiplier * travellers * days;
  const step = raw > 100_000 ? 10_000 : raw > 10_000 ? 500 : 50;
  return Math.max(step, Math.round(raw / step) * step);
}


/**
 * Rejects budgets that could not cover the trip (e.g. $50 for 7 days).
 * Returns a human-readable error, or null when the budget is plausible.
 */
export function validateTripBudget(input: TripInput): string | null {
  const amount = Number(input.budgetTotal);
  if (!Number.isFinite(amount) || amount <= 0) return "Enter your total budget for the trip.";

  const travellers = Math.max(1, (input.adults || 0) + (input.children || 0));
  const days = tripDayCount(input);
  const floor = MIN_PER_PERSON_PER_DAY[input.currency] ?? 60;
  const minimum = Math.round(floor * travellers * days);

  if (amount < minimum) {
    return `${formatMoney(amount, input.currency)} isn't enough for ${travellers} traveller${
      travellers > 1 ? "s" : ""
    } over ${days} day${days > 1 ? "s" : ""}. Plan on at least ${formatMoney(
      minimum,
      input.currency,
    )} so we can build a realistic trip.`;
  }
  if (amount > 5_000_000) return "That budget is unrealistically high — enter a real total.";
  return null;
}

/** Approximate value of 1 unit of the currency in USD. */
const USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.66,
  JPY: 0.0067,
  INR: 0.012,
};

/** Plain formatted amount in its own currency, no conversion. */
export function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(amount || 0));
  } catch {
    return `${Math.round(amount || 0)} ${currency}`;
  }
}

/**
 * Money for display. Non-USD currencies always show the approximate US dollar
 * equivalent in parentheses, e.g. "€1,200 (≈$1,296)".
 */
export function formatMoney(amount: number, currency: string): string {
  const base = formatAmount(amount, currency);
  const rate = USD_PER_UNIT[currency];
  if (!currency || currency === "USD" || !rate) return base;
  const usd = Math.round((amount || 0) * rate);
  return `${base} (≈${formatAmount(usd, "USD")})`;
}
