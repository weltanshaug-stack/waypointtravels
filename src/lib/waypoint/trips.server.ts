import type { SupabaseClient } from "@supabase/supabase-js";
import type { TripInput, TripResult } from "@/lib/waypoint/types";
import { tripDayCount } from "@/lib/waypoint/types";

type Db = SupabaseClient<any, any, any>;

export type SavedTripSummary = {
  id: string;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  days_count: number;
  travelers_adults: number;
  travelers_children: number;
  budget_total: number | null;
  currency: string;
  fit_score: number | null;
  created_at: string;
};

export async function saveTripForUser(
  supabase: Db,
  userId: string,
  result: TripResult,
): Promise<{ id: string }> {
  const { input, plan, check, brief } = result;
  const days = tripDayCount(input);

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      user_id: userId,
      title: plan.title || `Trip to ${plan.destination}`,
      destination: plan.destination,
      start_date: !input.useDayCount && input.startDate ? input.startDate : null,
      end_date: !input.useDayCount && input.endDate ? input.endDate : null,
      days_count: days,
      travelers_adults: input.adults,
      travelers_children: input.children,
      budget_total: input.budgetTotal,
      currency: input.currency,
      budget_category: input.budgetCategory,
      overview: plan.overview,
      budget_breakdown: plan.budget,
      trip_check: check,
      fit_score: check?.fitScore ?? null,
      agent_reasoning: brief,
      guide: result,
    })
    .select("id")
    .single();

  if (error || !trip) throw new Error(error?.message ?? "Could not save this trip.");
  const tripId = trip.id as string;

  const { error: prefError } = await supabase.from("trip_preferences").insert({
    trip_id: tripId,
    user_id: userId,
    destination_flexible: input.destinationFlexible,
    preferred_region: input.preferredRegion || null,
    budget_flexibility: input.budgetFlexibility,
    children_ages: input.childrenAges || null,
    travel_styles: input.travelStyles,
    pace: input.pace,
    accommodation: input.accommodation,
    transportation: input.transportation,
    accessibility_needs: input.accessibilityNeeds,
    accessibility_notes: input.accessibilityNotes || null,
    free_text: input.freeText || null,
  });
  if (prefError) throw new Error(prefError.message);

  for (const day of plan.days) {
    const { data: dayRow, error: dayError } = await supabase
      .from("itinerary_days")
      .insert({
        trip_id: tripId,
        user_id: userId,
        day_number: day.day,
        date: day.date || null,
        theme: day.theme,
        notes: [day.notes, day.restPeriods].filter(Boolean).join(" • ") || null,
        estimated_day_cost: day.estimatedDayCost,
      })
      .select("id")
      .single();
    if (dayError || !dayRow) throw new Error(dayError?.message ?? "Could not save itinerary.");

    const items = day.items.map((item, index) => ({
      day_id: dayRow.id as string,
      user_id: userId,
      time_of_day: item.timeOfDay,
      sort_order: index,
      title: item.title,
      description: item.description,
      duration_minutes: item.durationMinutes,
      estimated_cost: item.estimatedCost,
      why_it_fits: item.whyItFits,
      transport_note: item.transportNote || null,
      travel_time_minutes: item.travelTimeMinutes ?? null,
      accessibility_note: item.accessibilityNote || null,
    }));
    if (items.length) {
      const { error: itemError } = await supabase.from("itinerary_items").insert(items);
      if (itemError) throw new Error(itemError.message);
    }
  }

  return { id: tripId };
}

export async function listTripsForUser(supabase: Db, userId: string): Promise<SavedTripSummary[]> {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, title, destination, start_date, end_date, days_count, travelers_adults, travelers_children, budget_total, currency, fit_score, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedTripSummary[];
}

export async function getTripForUser(
  supabase: Db,
  userId: string,
  tripId: string,
): Promise<{ id: string; created_at: string; result: TripResult }> {
  const { data, error } = await supabase
    .from("trips")
    .select("id, created_at, guide")
    .eq("user_id", userId)
    .eq("id", tripId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Trip not found.");
  return {
    id: data.id as string,
    created_at: data.created_at as string,
    result: data.guide as TripResult,
  };
}

export async function deleteTripForUser(supabase: Db, userId: string, tripId: string) {
  const { error } = await supabase.from("trips").delete().eq("user_id", userId).eq("id", tripId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export function isTripInput(value: unknown): value is TripInput {
  return !!value && typeof value === "object" && "travelStyles" in (value as object);
}
