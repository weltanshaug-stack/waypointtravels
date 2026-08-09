import {
  runPreferenceAnalyzer,
  runPlanner,
  runReviser,
  runTripCritic,
} from "@/lib/waypoint/agents.server";
import type {
  AdaptationId,
  PreferenceBrief,
  TripCheck,
  TripInput,
  TripPlan,
} from "@/lib/waypoint/types";

/**
 * Orchestrator agent. Owns the multi-agent control flow and the revision loop:
 *
 *   input -> Preference Analyzer -> Planner -> Trip Critic
 *         -> Reviser (only when the critic reports a blocking failure)
 *         -> re-audit -> final guide
 */

export type OrchestratorResult = {
  brief: PreferenceBrief;
  plan: TripPlan;
  check: TripCheck;
  revised: boolean;
};

export async function orchestrateNewTrip(input: TripInput): Promise<OrchestratorResult> {
  const brief = await runPreferenceAnalyzer(input);
  const plan = await runPlanner({ input, brief });
  const check = await runTripCritic({ input, brief, plan });

  const blocking = check.checks.some((c) => c.status === "fail");
  if (!blocking) return { brief, plan, check, revised: false };

  const revisedPlan = await runReviser({ input, brief, plan, check });
  const recheck = await runTripCritic({ input, brief, plan: revisedPlan });
  return { brief, plan: revisedPlan, check: recheck, revised: true };
}

const DIRECTIVES: Record<AdaptationId, string> = {
  cheaper:
    "Reduce the total estimated cost by roughly 20-30% without losing the traveller's highest-weighted priorities. Swap paid attractions for high-quality lower-cost equivalents, cheaper meals of the same cuisine, and cheaper transport. Update the budget breakdown accordingly.",
  relaxing:
    "Make the trip noticeably more relaxing: fewer activities per day, later starts, longer meals, explicit rest periods, and shorter transfers.",
  adventure:
    "Add more active and adventurous experiences, while respecting every accessibility constraint the traveller stated. Never exceed their stated mobility limits.",
  food: "Shift the balance toward food experiences: local markets, neighbourhood restaurants, food-focused walks, and regional specialities that fit the stated dietary needs.",
  culture:
    "Shift the balance toward cultural and historical depth: museums, heritage sites, local arts and performances, with context in each description.",
  "less-walking":
    "Substantially reduce walking and standing time. Prefer seated experiences, shorter distances, more taxi/rideshare or transit door-to-door legs, and closer clustering.",
  family:
    "Make the trip more family-friendly: age-appropriate activities, shorter attention spans, meal timing, nap/rest windows, and stroller/accessibility practicality.",
  regenerate:
    "Produce a genuinely different itinerary for the same constraints: different neighbourhoods, activities and restaurants, same priorities and budget discipline.",
};

export async function orchestrateAdaptation(args: {
  input: TripInput;
  brief: PreferenceBrief;
  plan: TripPlan;
  adaptation: AdaptationId;
  customDirective?: string;
}): Promise<OrchestratorResult> {
  const directive = args.customDirective ?? DIRECTIVES[args.adaptation];
  const plan = await runPlanner({
    input: args.input,
    brief: args.brief,
    revisionDirective: directive,
    ...(args.adaptation === "regenerate" ? {} : { previousPlan: args.plan }),
  });
  const check = await runTripCritic({ input: args.input, brief: args.brief, plan });
  return { brief: args.brief, plan, check, revised: true };
}
