/**
 * Shared WayPoint domain types. Client-safe: no server imports.
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
  budgetTotal: 2000,
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
};

export type TripCheck = {
  fitScore: number;
  summary: string;
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
  check: TripCheck;
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


export function formatMoney(amount: number, currency: string): string {
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
