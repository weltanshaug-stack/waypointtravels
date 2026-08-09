import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchImagesForQueries } from "@/lib/waypoint/images.server";
import {
  orchestrateAdaptation,
  orchestrateCheck,
  orchestrateNewTrip,
} from "@/lib/waypoint/orchestrator.server";
import {
  deleteTripForUser,
  getTripForUser,
  listTripsForUser,
  saveTripForUser,
} from "@/lib/waypoint/trips.server";
import type {
  AdaptationId,
  PreferenceBrief,
  TripInput,
  TripPlan,
  TripResult,
} from "@/lib/waypoint/types";

export const fetchActivityImages = createServerFn({ method: "POST" })
  .inputValidator((data: { queries: string[] }) => ({
    queries: Array.isArray(data?.queries) ? data.queries.slice(0, 45) : [],
  }))
  .handler(async ({ data }): Promise<Record<string, string>> =>
    fetchImagesForQueries(data.queries),
  );


/**
 * Thin RPC surface. All logic lives in the imported agent/orchestrator modules.
 * Planning is available to guests; persistence requires an authenticated user.
 */

export const planTrip = createServerFn({ method: "POST" })
  .inputValidator((data: { input: TripInput }) => data)
  .handler(async ({ data }): Promise<TripResult> => {
    const { brief, plan, check } = await orchestrateNewTrip(data.input);
    return { input: data.input, brief, plan, check, generatedAt: new Date().toISOString() };
  });

export const checkTrip = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { input: TripInput; brief: PreferenceBrief; plan: TripPlan }) => data,
  )
  .handler(async ({ data }) => orchestrateCheck(data));

export const adaptTrip = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      input: TripInput;
      brief: PreferenceBrief;
      plan: TripPlan;
      adaptation: AdaptationId;
    }) => data,
  )
  .handler(async ({ data }): Promise<TripResult> => {
    const { brief, plan, check } = await orchestrateAdaptation(data);
    return {
      input: data.input,
      brief,
      plan,
      check,
      generatedAt: new Date().toISOString(),
      revised: true,
    };
  });


export const saveTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { result: TripResult }) => data)
  .handler(async ({ data, context }) =>
    saveTripForUser(context.supabase, context.userId, data.result),
  );

export const listTrips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listTripsForUser(context.supabase, context.userId));

export const getTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) =>
    getTripForUser(context.supabase, context.userId, data.id),
  );

export const deleteTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) =>
    deleteTripForUser(context.supabase, context.userId, data.id),
  );
