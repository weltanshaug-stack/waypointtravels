import { runAgentStep } from "@/lib/ai-gateway.server";
import type {
  ActivityLevel,
  PreferenceBrief,
  TripCheck,
  TripInput,
  TripPlan,
} from "@/lib/waypoint/types";

import { tripDayCount } from "@/lib/waypoint/types";

/**
 * Waypoint agent layer. Each agent is a separate logical module with its own
 * system prompt and contract. The orchestrator composes them:
 *
 *   Preference Analyzer -> Planner (destination/activity + budget +
 *   accessibility + schedule optimizer directives) -> Trip Critic -> Reviser
 *
 * They currently share one underlying LLM but stay independently callable so
 * specialised models can be swapped in per agent later.
 */

const SAFETY_RULES = `
NON-NEGOTIABLE SAFETY & ACCURACY RULES
- You have NO live travel data. Every price, duration, opening hour, transport
  time and accessibility detail you output is an ESTIMATE based on general
  knowledge. Never phrase them as confirmed or verified.
- Never guarantee accessibility. Use wording like "reported/estimated
  accessibility — confirm directly with the venue".
- Never give medical advice. Treat health/accessibility inputs purely as
  logistical planning constraints.
- Never assume the nature or severity of a person's disability beyond what the
  traveller stated.
- Do not invent bookings, availability, or real-time schedules.
- Respond with valid JSON only. No markdown, no commentary.
`;

function travellerSummary(input: TripInput): string {
  const days = tripDayCount(input);
  const dates =
    !input.useDayCount && input.startDate && input.endDate
      ? `${input.startDate} to ${input.endDate} (${days} days)`
      : `${days} days, dates flexible`;
  return `
DESTINATION: ${input.destinationFlexible ? `Flexible — traveller prefers region: ${input.preferredRegion || "anywhere"}` : input.destination}
DATES: ${dates}
BUDGET: ${input.budgetTotal} ${input.currency} total, category ${input.budgetCategory}, flexibility ${input.budgetFlexibility}
TRAVELLERS: ${input.adults} adults, ${input.children} children${input.childrenAges ? ` (ages: ${input.childrenAges})` : ""}
TRAVEL STYLES: ${input.travelStyles.length ? input.travelStyles.join(", ") : "not specified"}
PACE: ${input.pace}
ACCOMMODATION: ${input.accommodation.join(", ") || "flexible"}
TRANSPORTATION: ${input.transportation.join(", ") || "flexible"}
FREE-TEXT PREFERENCES: ${input.freeText || "none provided"}
ACCESSIBILITY / HEALTH-RELATED TRAVEL NEEDS: ${input.accessibilityNeeds.length ? input.accessibilityNeeds.join(", ") : "none selected"}
ACCESSIBILITY NOTES: ${input.accessibilityNotes || "none provided"}
`.trim();
}

/* ---------------- 1. Preference Analyzer Agent ---------------- */

export async function runPreferenceAnalyzer(input: TripInput): Promise<PreferenceBrief> {
  const system = `You are the Preference Analyzer agent inside Waypoint, an agentic travel planning system.
Your only job is to convert raw traveller input into an explicit, machine-usable constraint brief for downstream planning agents.
Extract hard constraints, infer implicit priorities, weight them, and flag planning risks.
${SAFETY_RULES}
Return JSON exactly shaped as:
{"constraints":[string],"priorities":[{"label":string,"weight":number,"note":string}],"budgetStrategy":string,"accessibilityConstraints":[string],"paceGuidance":string,"risks":[string]}
weight is 0-1. Include 4-7 priorities. Constraints must be concrete and testable.`;

  const prompt = `Traveller input:\n${travellerSummary(input)}\n\nProduce the constraint brief.`;
  const brief = await runAgentStep<PreferenceBrief>({
    system,
    prompt,
    label: "preference analyzer",
  });
  return {
    constraints: brief.constraints ?? [],
    priorities: (brief.priorities ?? []).slice(0, 8),
    budgetStrategy: brief.budgetStrategy ?? "",
    accessibilityConstraints: brief.accessibilityConstraints ?? [],
    paceGuidance: brief.paceGuidance ?? "",
    risks: brief.risks ?? [],
  };
}

/* -------- 2-6. Planner + Budget + Accessibility + Schedule Optimizer -------- */

const PLAN_SHAPE = `{"title":string,"destination":string,"destinationRationale":string,"overview":string,"currency":string,
"budget":{"accommodation":number,"food":number,"transportation":number,"activities":number,"miscellaneous":number,"total":number,"notes":string},
"days":[{"day":number,"date":string,"theme":string,"notes":string,"restPeriods":string,"estimatedDayCost":number,"activityLevel":"Relaxed"|"Moderate"|"Active",
"items":[{"timeOfDay":"morning"|"afternoon"|"evening","title":string,"description":string,"durationMinutes":number,"estimatedCost":number,"whyItFits":string,"transportNote":string,"travelTimeMinutes":number,"accessibilityNote":string,"imageQuery":string}]}],
"highlights":[{"title":string,"reason":string}],"practicalNotes":[string]}`;


const PLANNER_SYSTEM = `You are the Planner Orchestration agent inside Waypoint. You combine four specialist passes before emitting output:
1. DESTINATION/ACTIVITY PLANNER — generate candidate destinations/activities, then rank them against the traveller's weighted priorities. Drop generic tourist-trap picks when the traveller dislikes crowds.
2. BUDGET AGENT — sanity-check the total budget first: if it is clearly too low for the destination, group size and trip length, plan the most realistic affordable version, keep every cost honest (never fake low prices) and state the shortfall plainly in budget.notes. Then allocate the total budget across accommodation, food, transportation, activities and miscellaneous. Per-item costs must be per-group (all travellers) and the sum of day costs plus accommodation must stay within the stated total budget. Respect budget flexibility.
3. ACCESSIBILITY AGENT — apply every accessibility constraint as a hard logistical filter (walking distance, stairs, seating, sensory load, dietary needs, medication storage). Add an accessibilityNote to any item where it is relevant, always phrased as reported/estimated.
4. SCHEDULE OPTIMIZER — respect pace: Relaxed = max 2 activities/day, Balanced = 2-3, Packed = 3-4. Cluster geographically to minimise travel. Give realistic travelTimeMinutes between consecutive activities. Include arrival/departure realities on the first and last day, and explicit rest periods.

Within each day, list items in chronological order: all morning items first, then afternoon, then evening.
Write each item description as one short, warm, appealing sentence (max 18 words) — no filler, no repeated context.
NAME REAL PLACES. Every stop must name a specific, real, well-known venue: an actual restaurant, museum, park, market, viewpoint or hotel. Never write vague stops like "check into a hotel", "have dinner", "explore the area" or "free time".
ACCOMMODATION: instead of a generic hotel stop, name ONE specific real hotel (or a real, recognisable hotel in the right neighbourhood) that sits close to the other places on the itinerary, and say in the description why the location works (e.g. walking distance to the stops on days 2-3).
BOLDING: in every description, wrap each specific proper place name in double asterisks, e.g. "Dinner at **Trattoria Sostanza**, five minutes from **Piazza del Duomo**." Bold only real named places, never generic words.
Every item needs a specific whyItFits sentence that references the traveller's own stated preferences.
Every item MUST have a non-empty imageQuery built as [exact activity or attraction] + [specific location] + [city], 3-6 words, so a photo search returns a picture of what the traveller is actually doing or seeing — e.g. "Senso-ji Temple Tokyo", "Arashiyama bamboo forest Kyoto", "hot air balloon Cappadocia", "Seine river cruise Paris". Never a bare city name, never a map, logo, flag, crest, diagram or vague phrase like "local food" or "Paris travel". For meals, name the restaurant plus city; for hotels, the hotel name plus city; for transfers, the actual station or street plus city.
Every day needs estimatedDayCost (sum of that day's item costs plus that day's share of food/local transport) and activityLevel: "Relaxed" (mostly sitting, little walking), "Moderate" (normal sightseeing) or "Active" (long walking, hiking or physically demanding). Match activityLevel to the traveller's pace and accessibility constraints, and alternate Active days with Relaxed ones.

${SAFETY_RULES}
Return JSON exactly shaped as:
${PLAN_SHAPE}`;

export async function runPlanner(args: {
  input: TripInput;
  brief: PreferenceBrief;
  revisionDirective?: string;
  previousPlan?: TripPlan;
}): Promise<TripPlan> {
  const { input, brief, revisionDirective, previousPlan } = args;
  const days = tripDayCount(input);

  const prompt = [
    `Traveller input:\n${travellerSummary(input)}`,
    `Constraint brief from the Preference Analyzer:\n${JSON.stringify(brief)}`,
    `Build exactly ${days} day objects, numbered 1..${days}.`,
    input.destinationFlexible
      ? `The traveller is flexible on destination. Choose ONE concrete destination inside their preferred area (${input.preferredRegion || "anywhere"}) and justify it in destinationRationale.`
      : `Stated destination: "${input.destination}". If that is a broad region, country or continent (e.g. "Europe", "Asia", "Italy") rather than a single city, CHOOSE ONE specific city or town inside it that best fits this traveller's budget, pace, styles and accessibility needs — pick somewhere you can plan confidently — set destination to that city (with country) and justify the choice in destinationRationale. If it is already a specific place, keep it and use destinationRationale to explain how the plan is shaped around this traveller.`,
    previousPlan
      ? `You are REVISING an existing plan. Preserve everything that already matched the traveller's priorities and change only what the directive requires.\nExisting plan:\n${JSON.stringify(previousPlan)}`
      : "",
    revisionDirective ? `REVISION DIRECTIVE: ${revisionDirective}` : "",
    `Currency for all amounts: ${input.currency}.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const plan = await runAgentStep<TripPlan>({
    system: PLANNER_SYSTEM,
    prompt,
    label: "itinerary planner",
  });
  return normalisePlan(plan, input);
}

/* ------- Fast path: brief + plan in a single gateway round-trip ------- */

const BRIEF_SHAPE = `{"constraints":[string],"priorities":[{"label":string,"weight":number,"note":string}],"budgetStrategy":string,"accessibilityConstraints":[string],"paceGuidance":string,"risks":[string]}`;

/**
 * Combines the Preference Analyzer and Planner passes into one call. The model
 * still reasons in stages (it emits the constraint brief first, then plans
 * against it), but the traveller waits for one round-trip instead of two.
 */
export async function runBriefAndPlan(input: TripInput): Promise<{
  brief: PreferenceBrief;
  plan: TripPlan;
}> {
  const days = tripDayCount(input);
  const system = `${PLANNER_SYSTEM}

Before planning you also act as the PREFERENCE ANALYZER: convert the raw traveller input into an explicit constraint brief (4-6 weighted priorities, testable constraints, budget strategy, accessibility constraints, pace guidance, risks), then plan against that brief.
Output BOTH results in a single JSON object shaped exactly as:
{"brief":${BRIEF_SHAPE},"plan":${PLAN_SHAPE}}
Keep every description to ONE short sentence (max 18 words) and whyItFits to one short clause. Keep notes and highlights to at most one entry each. Be concise: no filler prose.`;

  const prompt = [
    `Traveller input:\n${travellerSummary(input)}`,
    `Build exactly ${days} day objects, numbered 1..${days}.`,
    input.destinationFlexible
      ? `The traveller is flexible on destination. Choose ONE concrete destination inside their preferred area (${input.preferredRegion || "anywhere"}) and justify it in destinationRationale.`
      : `Stated destination: "${input.destination}". If that is a broad region, country or continent (e.g. "Europe", "Asia", "Italy") rather than a single city, CHOOSE ONE specific city or town inside it that best fits this traveller's budget, pace, styles and accessibility needs — pick somewhere you can plan confidently — set destination to that city (with country) and justify the choice in destinationRationale. If it is already a specific place, keep it and use destinationRationale to explain how the plan is shaped around this traveller.`,
    `Currency for all amounts: ${input.currency}.`,
  ].join("\n\n");

  const raw = await runAgentStep<{ brief?: PreferenceBrief; plan?: TripPlan }>({
    system,
    prompt,
    label: "itinerary planner",
  });

  const brief = raw.brief ?? ({} as PreferenceBrief);
  return {
    brief: {
      constraints: brief.constraints ?? [],
      priorities: (brief.priorities ?? []).slice(0, 8),
      budgetStrategy: brief.budgetStrategy ?? "",
      accessibilityConstraints: brief.accessibilityConstraints ?? [],
      paceGuidance: brief.paceGuidance ?? "",
      risks: brief.risks ?? [],
    },
    plan: normalisePlan(raw.plan ?? ({} as TripPlan), input),
  };
}

/* ---------------- 7. Trip Critic Agent ---------------- */

export async function runTripCritic(args: {
  input: TripInput;
  brief: PreferenceBrief;
  plan: TripPlan;
}): Promise<TripCheck> {
  const system = `You are the Trip Critic agent inside Waypoint. You audit a draft itinerary against the traveller's constraints and score its fit.
Audit exactly these seven checks, in this order, using these names:
"Budget consistency", "Time feasibility", "Travel distance", "Accessibility compatibility", "Pace", "Preference matching", "Scheduling conflicts".
status is "pass", "warn" or "fail". Be genuinely critical: flag impossible travel times, over-packed days, budget overruns, and accessibility mismatches.
For every warn/fail, add an issue entry with a concrete proposedFix (name the day).
fitScore is 0-100 and must reflect the checks (any fail keeps it below 75).
${SAFETY_RULES}
Also produce traveller-facing bullets: "pros" (3-5 short bullets, max 14 words each, on what this plan gets right for them) and "cons" (1-2 short bullets on real trade-offs or watch-outs). There must always be strictly more pros than cons.
Return JSON exactly shaped as:
{"fitScore":number,"summary":string,"pros":[string],"cons":[string],"checks":[{"name":string,"status":"pass"|"warn"|"fail","detail":string}],"issues":[{"day":number,"issue":string,"proposedFix":string}]}
summary is 1 plain sentence the traveller can read.`;

  const prompt = `Traveller input:\n${travellerSummary(args.input)}\n\nConstraint brief:\n${JSON.stringify(args.brief)}\n\nDraft itinerary:\n${JSON.stringify(args.plan)}\n\nAudit it.`;

  const check = await runAgentStep<TripCheck>({ system, prompt, label: "trip critic" });
  return {
    fitScore: Math.max(0, Math.min(100, Math.round(Number(check.fitScore) || 0))),
    summary: check.summary ?? "",
    pros: (check.pros ?? []).filter(Boolean).slice(0, 5),
    cons: (check.cons ?? []).filter(Boolean).slice(0, 2),
    checks: (check.checks ?? []).map((c) => ({
      name: c.name,
      status: c.status === "fail" || c.status === "warn" ? c.status : "pass",
      detail: c.detail ?? "",
    })),
    issues: (check.issues ?? []).filter((i) => i && i.issue),
  };
}

/* ---------------- 8. Reviser (Final Itinerary Generator) ---------------- */

export async function runReviser(args: {
  input: TripInput;
  brief: PreferenceBrief;
  plan: TripPlan;
  check: TripCheck;
}): Promise<TripPlan> {
  const directive = `The Trip Critic found the following blocking problems. Fix each one while preserving the traveller's top priorities:\n${args.check.issues
    .map((i) => `- Day ${i.day ?? "?"}: ${i.issue} -> ${i.proposedFix}`)
    .join("\n")}`;
  return runPlanner({
    input: args.input,
    brief: args.brief,
    previousPlan: args.plan,
    revisionDirective: directive,
  });
}

/* ---------------- Normalisation ---------------- */

const ORDER = { morning: 0, afternoon: 1, evening: 2 } as const;

export function normalisePlan(plan: TripPlan, input: TripInput): TripPlan {
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };
  const days = (plan.days ?? []).map((day, index) => {
    const items = (day.items ?? [])
      .map((item) => ({
        timeOfDay:
          item.timeOfDay === "afternoon" || item.timeOfDay === "evening"
            ? item.timeOfDay
            : ("morning" as const),
        title: item.title ?? "Activity",
        description: item.description ?? "",
        durationMinutes: num(item.durationMinutes),
        estimatedCost: num(item.estimatedCost),
        whyItFits: item.whyItFits ?? "",
        transportNote: item.transportNote ?? "",
        travelTimeMinutes: num(item.travelTimeMinutes),
        accessibilityNote: item.accessibilityNote ?? "",
        imageQuery: (item.imageQuery ?? "").trim(),
      }))
      .sort((a, b) => ORDER[a.timeOfDay] - ORDER[b.timeOfDay]);

    const itemsCost = items.reduce((sum, i) => sum + i.estimatedCost, 0);
    const activeMinutes = items.reduce((sum, i) => sum + i.durationMinutes, 0);
    const level: ActivityLevel =
      day.activityLevel === "Relaxed" || day.activityLevel === "Active" || day.activityLevel === "Moderate"
        ? day.activityLevel
        : items.length >= 4 || activeMinutes > 420
          ? "Active"
          : items.length <= 2 && activeMinutes <= 240
            ? "Relaxed"
            : "Moderate";

    return {
      day: Number(day.day) || index + 1,
      date: day.date ?? "",
      theme: day.theme ?? `Day ${index + 1}`,
      notes: day.notes ?? "",
      restPeriods: day.restPeriods ?? "",
      estimatedDayCost: num(day.estimatedDayCost) || itemsCost,
      activityLevel: level,
      items,
    };
  });


  const budget = plan.budget ?? ({} as TripPlan["budget"]);
  const parts = {
    accommodation: num(budget.accommodation),
    food: num(budget.food),
    transportation: num(budget.transportation),
    activities: num(budget.activities),
    miscellaneous: num(budget.miscellaneous),
  };
  const sum = Object.values(parts).reduce((a, b) => a + b, 0);

  return {
    title: plan.title ?? `Trip to ${plan.destination ?? input.destination}`,
    destination: plan.destination || input.destination || input.preferredRegion || "Flexible",
    destinationRationale: plan.destinationRationale ?? "",
    overview: plan.overview ?? "",
    currency: plan.currency || input.currency,
    budget: { ...parts, total: num(budget.total) || sum, notes: budget.notes ?? "" },
    days,
    highlights: (plan.highlights ?? []).filter((h) => h && h.title),
    practicalNotes: (plan.practicalNotes ?? []).filter(Boolean),
  };
}
